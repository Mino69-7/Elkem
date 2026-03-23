import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');
import { logger } from '../lib/logger.js';

// ─── Types Microsoft Graph ────────────────────────────────────

export interface IntuneDevice {
  id: string;
  deviceName: string;
  serialNumber: string;
  operatingSystem: string;
  osVersion: string;
  complianceState: 'compliant' | 'noncompliant' | 'unknown' | 'notApplicable' | 'inGracePeriod' | 'configManager';
  enrolledDateTime: string;
  lastSyncDateTime: string;
  manufacturer: string;
  model: string;
  userDisplayName: string | null;
  userPrincipalName: string | null;
  managedDeviceOwnerType: string;
  deviceEnrollmentType: string;
  azureADDeviceId: string | null;
}

export interface IntuneSyncResult {
  synced: number;
  created: number;
  updated: number;
  errors: number;
  details: string[];
}

// ─── Service ──────────────────────────────────────────────────

class IntuneService {
  private client: Client | null = null;

  private isConfigured(): boolean {
    return !!(
      process.env.GRAPH_TENANT_ID &&
      process.env.GRAPH_CLIENT_ID &&
      process.env.GRAPH_CLIENT_SECRET
    );
  }

  private getClient(): Client {
    if (this.client) return this.client;

    if (!this.isConfigured()) {
      throw new Error('Azure AD non configuré (GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET manquants)');
    }

    const credential = new ClientSecretCredential(
      process.env.GRAPH_TENANT_ID!,
      process.env.GRAPH_CLIENT_ID!,
      process.env.GRAPH_CLIENT_SECRET!,
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default'],
    });

    this.client = Client.initWithMiddleware({ authProvider });
    return this.client;
  }

  /** Vérifie si Intune est configuré et accessible */
  async getStatus(): Promise<{ configured: boolean; connected: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { configured: false, connected: false, error: 'Variables GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET manquantes dans .env' };
    }

    try {
      const client = this.getClient();
      // Test léger — récupère juste le premier appareil
      await client.api('/deviceManagement/managedDevices').top(1).get();
      return { configured: true, connected: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`Intune connection test failed: ${message}`);
      return { configured: true, connected: false, error: message };
    }
  }

  /** Récupère tous les appareils Intune (pagination automatique) */
  async listDevices(limit = 100): Promise<IntuneDevice[]> {
    const client = this.getClient();
    const devices: IntuneDevice[] = [];

    let response = await client
      .api('/deviceManagement/managedDevices')
      .select([
        'id', 'deviceName', 'serialNumber', 'operatingSystem', 'osVersion',
        'complianceState', 'enrolledDateTime', 'lastSyncDateTime',
        'manufacturer', 'model', 'userDisplayName', 'userPrincipalName',
        'managedDeviceOwnerType', 'deviceEnrollmentType', 'azureADDeviceId',
      ].join(','))
      .top(limit)
      .get();

    devices.push(...(response.value ?? []));

    // Pagination
    while (response['@odata.nextLink'] && devices.length < 500) {
      response = await client.api(response['@odata.nextLink']).get();
      devices.push(...(response.value ?? []));
    }

    return devices;
  }

  /** Synchronise les appareils Intune avec la base locale */
  async syncDevices(prisma: import('@prisma/client').PrismaClient, userId: string): Promise<IntuneSyncResult> {
    const result: IntuneSyncResult = { synced: 0, created: 0, updated: 0, errors: 0, details: [] };

    const intuneDevices = await this.listDevices();
    result.synced = intuneDevices.length;

    for (const iDev of intuneDevices) {
      try {
        const existing = await prisma.device.findFirst({
          where: {
            OR: [
              { intuneDeviceId: iDev.id },
              { serialNumber: iDev.serialNumber },
            ],
          },
        });

        const intuneData = {
          intuneDeviceId:  iDev.id,
          intuneOsName:    iDev.operatingSystem,
          intuneOsVersion: iDev.osVersion,
          intuneCompliant: iDev.complianceState === 'compliant',
          intuneLastSync:  new Date(),
          intuneLastSeen:  iDev.lastSyncDateTime ? new Date(iDev.lastSyncDateTime) : undefined,
          intuneEnrolled:  iDev.enrolledDateTime ? new Date(iDev.enrolledDateTime) : undefined,
          intuneUrl:       `https://intune.microsoft.com/#blade/Microsoft_Intune_Devices/DeviceDetailsCommandBarBlade/deviceId/${iDev.id}`,
        };

        if (existing) {
          await prisma.device.update({ where: { id: existing.id }, data: intuneData });
          await prisma.auditLog.create({
            data: {
              deviceId: existing.id,
              userId,
              action:   'INTUNE_SYNCED',
              comment:  `Synchronisé depuis Intune (${iDev.complianceState})`,
            },
          });
          result.updated++;
        } else {
          // Appareil Intune non présent localement — on le crée
          const assetTag = `INTUNE-${iDev.deviceName.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 20)}`;

          const created = await prisma.device.create({
            data: {
              assetTag,
              serialNumber: iDev.serialNumber || `INTUNE-${iDev.id.slice(0, 8)}`,
              brand:        iDev.manufacturer || 'Inconnu',
              model:        iDev.model        || 'Inconnu',
              type:         'LAPTOP',
              status:       'ASSIGNED',
              keyboardLayout: 'AZERTY_FR',
              ...intuneData,
            },
          });

          await prisma.auditLog.create({
            data: {
              deviceId: created.id,
              userId,
              action:   'CREATED',
              comment:  `Créé automatiquement via Intune sync`,
            },
          });
          result.created++;
          result.details.push(`Créé : ${assetTag} (${iDev.deviceName})`);
        }
      } catch (err: unknown) {
        result.errors++;
        const message = err instanceof Error ? err.message : String(err);
        result.details.push(`Erreur ${iDev.deviceName} : ${message}`);
        logger.warn(`Intune sync error for ${iDev.deviceName}: ${message}`);
      }
    }

    logger.info(`Intune sync completed: ${result.synced} synced, ${result.created} created, ${result.updated} updated, ${result.errors} errors`);
    return result;
  }
}

export const intuneService = new IntuneService();
