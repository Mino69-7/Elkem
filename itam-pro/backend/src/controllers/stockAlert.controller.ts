import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const DEVICE_TYPES = ['LAPTOP','DESKTOP','THIN_CLIENT','LAB_WORKSTATION','SMARTPHONE','TABLET','MONITOR','KEYBOARD','MOUSE','HEADSET','DOCKING_STATION','PRINTER','OTHER'] as const;

const alertSchema = z.object({
  deviceType:    z.enum(DEVICE_TYPES),
  deviceModelId: z.string().optional().nullable(),
  threshold:     z.number().int().min(0).max(999),
  isActive:      z.boolean().default(true),
});

const MODEL_SELECT = { id: true, brand: true, name: true, type: true } as const;

/** GET /api/stockalerts — liste toutes les alertes avec statut actuel */
export async function listAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const alerts = await prisma.stockAlert.findMany({
      orderBy: [{ deviceType: 'asc' }, { createdAt: 'asc' }],
      include: { deviceModel: { select: MODEL_SELECT } },
    });

    // Stock par type (pour alertes de type)
    const stockByType = await prisma.device.groupBy({
      by: ['type'],
      where: { status: 'IN_STOCK' },
      _count: { type: true },
    });
    const typeStockMap = Object.fromEntries(stockByType.map((s) => [s.type, s._count.type]));

    // Stock par modelId (pour alertes de modèle)
    const stockByModel = await prisma.device.groupBy({
      by: ['modelId'],
      where: { status: 'IN_STOCK', modelId: { not: null } },
      _count: { modelId: true },
    });
    const modelStockMap: Record<string, number> = Object.fromEntries(
      stockByModel.filter((s) => s.modelId != null).map((s) => [s.modelId!, s._count.modelId])
    );

    const result = alerts.map((a) => {
      const currentStock = a.deviceModelId
        ? (modelStockMap[a.deviceModelId] ?? 0)
        : (typeStockMap[a.deviceType] ?? 0);
      return { ...a, currentStock, triggered: currentStock < a.threshold };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/** POST /api/stockalerts — crée ou met à jour une alerte (upsert par deviceModelId ou deviceType) */
export async function createAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = alertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Données invalides', details: parsed.error.flatten() });

    const { deviceType, deviceModelId, threshold, isActive } = parsed.data;

    // Cherche une alerte existante du même niveau (modèle ou type)
    const existing = await prisma.stockAlert.findFirst({
      where: deviceModelId
        ? { deviceModelId }
        : { deviceType, deviceModelId: null },
    });

    let alert;
    if (existing) {
      alert = await prisma.stockAlert.update({
        where: { id: existing.id },
        data:  { threshold, isActive },
        include: { deviceModel: { select: MODEL_SELECT } },
      });
    } else {
      alert = await prisma.stockAlert.create({
        data:    { deviceType, deviceModelId: deviceModelId ?? null, threshold, isActive },
        include: { deviceModel: { select: MODEL_SELECT } },
      });
    }

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
      where:   { id: req.params.id },
      data:    parsed.data,
      include: { deviceModel: { select: MODEL_SELECT } },
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
    const alerts = await prisma.stockAlert.findMany({
      where:   { isActive: true },
      include: { deviceModel: { select: MODEL_SELECT } },
    });

    const stockByType = await prisma.device.groupBy({
      by: ['type'],
      where: { status: 'IN_STOCK' },
      _count: { type: true },
    });
    const typeStockMap = Object.fromEntries(stockByType.map((s) => [s.type, s._count.type]));

    const stockByModel = await prisma.device.groupBy({
      by: ['modelId'],
      where: { status: 'IN_STOCK', modelId: { not: null } },
      _count: { modelId: true },
    });
    const modelStockMap: Record<string, number> = Object.fromEntries(
      stockByModel.filter((s) => s.modelId != null).map((s) => [s.modelId!, s._count.modelId])
    );

    const triggered = alerts
      .map((a) => {
        const currentStock = a.deviceModelId
          ? (modelStockMap[a.deviceModelId] ?? 0)
          : (typeStockMap[a.deviceType] ?? 0);
        return { ...a, currentStock };
      })
      .filter((a) => a.currentStock < a.threshold);

    res.json(triggered);
  } catch (err) {
    next(err);
  }
}
