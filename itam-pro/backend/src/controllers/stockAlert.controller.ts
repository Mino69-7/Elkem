import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const alertSchema = z.object({
  deviceType: z.enum(['LAPTOP','DESKTOP','SMARTPHONE','TABLET','MONITOR','KEYBOARD','MOUSE','HEADSET','DOCKING_STATION','PRINTER','OTHER']),
  threshold:  z.number().int().min(0).max(999),
  isActive:   z.boolean().default(true),
});

/** GET /api/stockalerts — liste + statut actuel */
export async function listAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const alerts = await prisma.stockAlert.findMany({ orderBy: { deviceType: 'asc' } });

    // Compte les appareils IN_STOCK par type pour calculer le statut
    const stockCounts = await prisma.device.groupBy({
      by: ['type'],
      where: { status: 'IN_STOCK' },
      _count: { type: true },
    });
    const stockMap = Object.fromEntries(stockCounts.map((s) => [s.type, s._count.type]));

    const result = alerts.map((a) => ({
      ...a,
      currentStock: stockMap[a.deviceType] ?? 0,
      triggered: (stockMap[a.deviceType] ?? 0) < a.threshold,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/** POST /api/stockalerts */
export async function createAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = alertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Données invalides', details: parsed.error.flatten() });

    // Upsert : un seul seuil par type
    const alert = await prisma.stockAlert.upsert({
      where:  { deviceType: parsed.data.deviceType } as never,
      update: { threshold: parsed.data.threshold, isActive: parsed.data.isActive },
      create: parsed.data,
    });

    res.status(201).json(alert);
  } catch (err) {
    next(err);
  }
}

/** PUT /api/stockalerts/:id */
export async function updateAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = alertSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Données invalides', details: parsed.error.flatten() });

    const alert = await prisma.stockAlert.update({
      where: { id: req.params.id },
      data:  parsed.data,
    });
    res.json(alert);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/stockalerts/:id */
export async function deleteAlert(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.stockAlert.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/** GET /api/stockalerts/triggered — alertes actuellement déclenchées */
export async function getTriggered(req: Request, res: Response, next: NextFunction) {
  try {
    const alerts = await prisma.stockAlert.findMany({ where: { isActive: true } });
    const stockCounts = await prisma.device.groupBy({
      by: ['type'],
      where: { status: 'IN_STOCK' },
      _count: { type: true },
    });
    const stockMap = Object.fromEntries(stockCounts.map((s) => [s.type, s._count.type]));

    const triggered = alerts
      .map((a) => ({ ...a, currentStock: stockMap[a.deviceType] ?? 0 }))
      .filter((a) => a.currentStock < a.threshold);

    res.json(triggered);
  } catch (err) {
    next(err);
  }
}
