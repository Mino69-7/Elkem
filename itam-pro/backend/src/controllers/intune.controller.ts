import type { Request, Response, NextFunction } from 'express';
import { intuneService } from '../services/intune.service.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

/** GET /api/intune/status */
export async function getIntuneStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = await intuneService.getStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
}

/** GET /api/intune/devices */
export async function listIntuneDevices(req: Request, res: Response, next: NextFunction) {
  try {
    const devices = await intuneService.listDevices();
    res.json({ data: devices, total: devices.length });
  } catch (err) {
    next(err);
  }
}

/** POST /api/intune/sync */
export async function syncIntune(req: Request, res: Response, next: NextFunction) {
  try {
    logger.info(`Intune sync triggered by ${req.currentUser!.email}`);
    const result = await intuneService.syncDevices(prisma, req.currentUser!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
