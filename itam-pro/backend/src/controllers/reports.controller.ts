import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

// ─── Utilitaire CSV ───────────────────────────────────────────

function escapeCSV(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ];
  return '\uFEFF' + lines.join('\r\n'); // BOM UTF-8 pour Excel
}

// ─── Export appareils ─────────────────────────────────────────

export async function exportDevicesCSV(req: Request, res: Response, next: NextFunction) {
  try {
    const { type, status, assigned, site } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (type)             where.type   = type;
    if (status)           where.status = status;
    if (site)             where.site   = { contains: site, mode: 'insensitive' };
    if (assigned === 'true')  where.assignedUserId = { not: null };
    if (assigned === 'false') where.assignedUserId = null;

    const devices = await prisma.device.findMany({
      where,
      include: { assignedUser: { select: { displayName: true, email: true } } },
      orderBy: { assetTag: 'asc' },
    });

    const headers = [
      'Tag actif', 'N° de série', 'Type', 'Marque', 'Modèle',
      'Processeur', 'RAM', 'Stockage', 'Taille écran',
      'Clavier', 'Couleur', 'Statut', 'État', 'Localisation', 'Site',
      'Assigné à', 'Email utilisateur', 'Date affectation',
      'Date achat', 'Fin garantie', 'Prix achat (€)', 'Fournisseur', 'N° facture',
      'OS Intune', 'Version OS', 'Conforme Intune', 'Dernière sync Intune',
      'Notes', 'Date création', 'Dernière modification',
    ];

    const rows = devices.map((d) => [
      d.assetTag, d.serialNumber, d.type, d.brand, d.model,
      d.processor, d.ram, d.storage, d.screenSize,
      d.keyboardLayout, d.color, d.status, d.condition, d.location, d.site,
      d.assignedUser?.displayName, d.assignedUser?.email,
      d.assignedAt ? new Date(d.assignedAt).toLocaleDateString('fr-FR') : '',
      d.purchaseDate   ? new Date(d.purchaseDate).toLocaleDateString('fr-FR')   : '',
      d.warrantyExpiry ? new Date(d.warrantyExpiry).toLocaleDateString('fr-FR') : '',
      d.purchasePrice, d.supplier, d.invoiceNumber,
      d.intuneOsName, d.intuneOsVersion,
      d.intuneCompliant == null ? '' : d.intuneCompliant ? 'Oui' : 'Non',
      d.intuneLastSync ? new Date(d.intuneLastSync).toLocaleString('fr-FR') : '',
      d.notes,
      new Date(d.createdAt).toLocaleDateString('fr-FR'),
      new Date(d.updatedAt).toLocaleDateString('fr-FR'),
    ]);

    const csv = toCSV(headers, rows);
    const filename = `appareils_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    logger.info(`CSV export: ${devices.length} devices by ${req.currentUser!.email}`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

// ─── Export audit log ─────────────────────────────────────────

export async function exportAuditCSV(req: Request, res: Response, next: NextFunction) {
  try {
    const { deviceId, action, from, to } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (deviceId) where.deviceId = deviceId;
    if (action)   where.action   = action;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      };
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        device: { select: { assetTag: true, brand: true, model: true } },
        user:   { select: { displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const headers = [
      'Date', 'Action', 'Tag actif', 'Appareil',
      'Effectué par', 'Email', 'Champ modifié', 'Ancienne valeur', 'Nouvelle valeur', 'Commentaire',
    ];

    const rows = logs.map((l) => [
      new Date(l.createdAt).toLocaleString('fr-FR'),
      l.action,
      l.device.assetTag, `${l.device.brand} ${l.device.model}`,
      l.user.displayName, l.user.email,
      l.fieldName, l.oldValue, l.newValue, l.comment,
    ]);

    const csv = toCSV(headers, rows);
    const filename = `audit_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}
