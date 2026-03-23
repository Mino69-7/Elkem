import type { Request, Response, NextFunction } from 'express';
import https from 'https';
import { prisma } from '../lib/prisma.js';
import { intuneService } from '../services/intune.service.js';
import { logger } from '../lib/logger.js';

// ─── Utilitaire HTTP simple (pas de dépendance externe) ──────

function httpsGet(url: string, headers: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout: 6000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ─── Lookup Dell ─────────────────────────────────────────────

async function lookupDell(serviceTag: string): Promise<{ model?: string; warrantyEnd?: string } | null> {
  const DELL_API_KEY = process.env.DELL_API_KEY;

  // ── Option A : Dell TechDirect API (clé requise) ──────────
  if (DELL_API_KEY) {
    try {
      const raw = await httpsGet(
        `https://apigtwb2c.us.dell.com/PROD/sbil/eapi/v5/asset-entitlements?servicetags=${serviceTag}&apikey=${DELL_API_KEY}`,
        { Accept: 'application/json' }
      );
      const json = JSON.parse(raw);
      const asset = json?.[0];
      if (asset?.productLineDescription) {
        return {
          model:       asset.productLineDescription,
          warrantyEnd: asset.entitlements?.[0]?.endDate,
        };
      }
    } catch (err) {
      logger.warn(`Dell TechDirect API error for ${serviceTag}: ${err}`);
    }
  }

  // Headers imitant un navigateur réel
  const browserHeaders = {
    'Accept':          'application/json, text/plain, */*',
    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer':         'https://www.dell.com/support/home/fr-fr',
    'Origin':          'https://www.dell.com',
    'sec-fetch-site':  'same-origin',
    'sec-fetch-mode':  'cors',
  };

  // ── Option B : API warranty v2 ────────────────────────────
  try {
    const raw = await httpsGet(
      `https://www.dell.com/support/warranty/api/v2/Warranty/Details?servicetag=${serviceTag}&lang=en&region=en`,
      browserHeaders
    );
    const json = JSON.parse(raw);
    // Réponse : { SystemDescription, EndDate, ... } ou tableau
    const item = Array.isArray(json) ? json[0] : json;
    if (item?.SystemDescription) {
      return {
        model:       item.SystemDescription,
        warrantyEnd: item.EndDate ?? item.entitlements?.[0]?.endDate,
      };
    }
  } catch (err) {
    logger.warn(`Dell warranty v2 API error for ${serviceTag}: ${err}`);
  }

  // ── Option C : API détail warranty (ancien endpoint) ──────
  try {
    const raw = await httpsGet(
      `https://www.dell.com/support/home/api/v1/en-us/warranty/detail?servicetag=${serviceTag}`,
      browserHeaders
    );
    const json = JSON.parse(raw);
    if (json?.productName) {
      return {
        model:       json.productName,
        warrantyEnd: json?.entitlements?.[0]?.endDate,
      };
    }
  } catch (err) {
    logger.warn(`Dell warranty v1 API error for ${serviceTag}: ${err}`);
  }

  // ── Option D : API GetSystemInfo ──────────────────────────
  try {
    const raw = await httpsGet(
      `https://www.dell.com/support/components/en-us/GlobalSearch/GetItemByServiceTag?servicetag=${serviceTag}`,
      browserHeaders
    );
    const json = JSON.parse(raw);
    if (json?.productName || json?.ProductName) {
      return {
        model: json.productName ?? json.ProductName,
      };
    }
  } catch (err) {
    logger.warn(`Dell GetItemByServiceTag error for ${serviceTag}: ${err}`);
  }

  return null;
}

// ─── Controller ───────────────────────────────────────────────

/**
 * GET /api/lookup/serial/:serialNumber
 * 1. Vérifie les doublons en base locale
 * 2. Cherche dans Intune (si configuré)
 * 3. Cherche sur Dell.com (service tag = numéro de série Dell)
 */
export async function lookupBySerial(req: Request, res: Response, next: NextFunction) {
  try {
    const { serialNumber } = req.params;

    // ── 1. Doublon local ──────────────────────────────────────
    const existing = await prisma.device.findFirst({
      where: { serialNumber: { equals: serialNumber, mode: 'insensitive' } },
      select: { id: true, assetTag: true, brand: true, model: true, status: true },
    });
    if (existing) {
      return res.json({
        found:   true,
        source:  'local',
        warning: `Numéro de série déjà enregistré sous ${existing.assetTag}`,
        data:    existing,
      });
    }

    // ── 2. Intune ─────────────────────────────────────────────
    const intuneStatus = await intuneService.getStatus();
    if (intuneStatus.connected) {
      try {
        const devices = await intuneService.listDevices(500);
        const match = devices.find(
          (d) => d.serialNumber?.toLowerCase() === serialNumber.toLowerCase()
        );
        if (match) {
          logger.info(`Lookup: found ${serialNumber} in Intune (${match.deviceName})`);
          return res.json({
            found:  true,
            source: 'intune',
            data: {
              model:      `${match.manufacturer} ${match.model}`.trim(),
              osName:     match.operatingSystem,
              osVersion:  match.osVersion,
              assignedTo: match.userDisplayName,
            },
          });
        }
      } catch (err) {
        logger.warn(`Intune lookup failed for ${serialNumber}: ${err}`);
      }
    }

    // ── 3. Dell ───────────────────────────────────────────────
    const dellResult = await lookupDell(serialNumber);
    if (dellResult?.model) {
      // Cherche le modèle dans notre catalogue pour récupérer les specs
      const catalogModel = await prisma.deviceModel.findFirst({
        where: { name: { contains: dellResult.model.replace(/Dell\s*/i, '').trim(), mode: 'insensitive' } },
      });

      logger.info(`Lookup: found ${serialNumber} on Dell (${dellResult.model})`);
      return res.json({
        found:  true,
        source: 'dell',
        data: {
          model:       dellResult.model,
          warrantyEnd: dellResult.warrantyEnd,
          // Specs depuis le catalogue local si le modèle est connu
          processor:      catalogModel?.processor,
          ram:            catalogModel?.ram,
          storage:        catalogModel?.storage,
          screenSize:     catalogModel?.screenSize,
          catalogModelId: catalogModel?.id,
          catalogModelType: catalogModel?.type,
        },
      });
    }

    // ── 4. Non trouvé partout ─────────────────────────────────
    const hasDellKey = !!process.env.DELL_API_KEY;
    res.json({
      found:  false,
      source: null,
      hint:   !hasDellKey
        ? 'Ajoutez DELL_API_KEY dans .env pour activer la recherche Dell automatique'
        : 'Non trouvé sur Dell ni dans Intune',
    });
  } catch (err) {
    next(err);
  }
}
