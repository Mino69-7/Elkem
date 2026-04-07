import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const KEYBOARD_LAYOUTS = ['AZERTY_FR','QWERTY_US','QWERTY_UK','QWERTY_ES','QWERTY_IT','QWERTY_NO','QWERTY_NL','QWERTZ_DE','QWERTZ_CH','QWERTY_RU','QWERTY_TR','QWERTY_AR','OTHER'] as const;

const modelSchema = z.object({
  name:           z.string().min(1),
  type:           z.enum(['LAPTOP','DESKTOP','THIN_CLIENT','LAB_WORKSTATION','SMARTPHONE','TABLET','MONITOR','KEYBOARD','MOUSE','HEADSET','DOCKING_STATION','PRINTER','OTHER']),
  brand:          z.string().min(1),
  processor:      z.string().optional(),
  ram:            z.string().optional(),
  storage:        z.string().optional(),
  screenSize:     z.string().optional(),
  keyboardLayout: z.enum(KEYBOARD_LAYOUTS).optional(),
  notes:          z.string().optional(),
  isActive:       z.boolean().default(true),
  order:          z.number().int().default(0),
});

export async function listModels(req: Request, res: Response, next: NextFunction) {
  try {
    const { type } = req.query as Record<string, string>;
    const models = await prisma.deviceModel.findMany({
      where: {
        isActive: true,
        ...(type ? { type: type as never } : {}),
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
    res.json(models);
  } catch (err) { next(err); }
}

export async function stockSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const models = await prisma.deviceModel.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    });

    // Compte IN_STOCK et ORDERED groupé par nom de modèle
    const counts = await prisma.device.groupBy({
      by: ['model', 'status'],
      where: { status: { in: ['IN_STOCK', 'ORDERED'] } },
      _count: { id: true },
    });

    const result = models.map((m) => ({
      ...m,
      inStock: counts.find((c) => c.model === m.name && c.status === 'IN_STOCK')?._count.id ?? 0,
      ordered: counts.find((c) => c.model === m.name && c.status === 'ORDERED')?._count.id  ?? 0,
    }));

    res.json(result);
  } catch (err) { next(err); }
}

export async function listAllModels(req: Request, res: Response, next: NextFunction) {
  try {
    const models = await prisma.deviceModel.findMany({
      orderBy: [{ type: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    });
    res.json(models);
  } catch (err) { next(err); }
}

export async function createModel(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = modelSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Données invalides', details: parsed.error.flatten() });
    const model = await prisma.deviceModel.create({ data: parsed.data });
    res.status(201).json(model);
  } catch (err) { next(err); }
}

export async function updateModel(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = modelSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Données invalides', details: parsed.error.flatten() });
    const model = await prisma.deviceModel.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(model);
  } catch (err) { next(err); }
}

export async function deleteModel(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.deviceModel.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function reorderModels(req: Request, res: Response, next: NextFunction) {
  try {
    const items = z.array(z.object({ id: z.string(), order: z.number().int() })).parse(req.body.items);
    await Promise.all(items.map(({ id, order }) => prisma.deviceModel.update({ where: { id }, data: { order } })));
    res.json({ ok: true });
  } catch (err) { next(err); }
}
