import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

// ─── Schémas de validation ────────────────────────────────────

const deviceSchema = z.object({
  assetTag:        z.string().regex(/^[A-Z0-9-]+$/, 'Format invalide (ex: ELKEM-LT-001)').optional().nullable(),
  serialNumber:    z.string().min(1, 'Numéro de série requis'),
  type:            z.enum(['LAPTOP','DESKTOP','SMARTPHONE','TABLET','MONITOR','KEYBOARD','MOUSE','HEADSET','DOCKING_STATION','PRINTER','OTHER']),
  brand:           z.string().min(1, 'Marque requise'),
  model:           z.string().min(1, 'Modèle requis'),
  keyboardLayout:  z.enum(['AZERTY_FR','QWERTY_US','QWERTY_UK','QWERTY_NO','QWERTY_NL','QWERTZ_DE','QWERTZ_CH','OTHER']).default('AZERTY_FR'),
  status:          z.enum(['ORDERED','IN_STOCK','ASSIGNED','PENDING_RETURN','IN_MAINTENANCE','LOANER','LOST','STOLEN','RETIRED']).default('IN_STOCK'),
  condition:       z.enum(['NEW','EXCELLENT','GOOD','FAIR','POOR']).default('GOOD'),
  processor:       z.string().optional(),
  ram:             z.string().optional(),
  storage:         z.string().optional(),
  screenSize:      z.string().optional(),
  color:           z.string().optional(),
  keyboardLanguage: z.string().optional(),
  location:        z.string().optional(),
  site:            z.string().optional(),
  purchaseDate:    z.string().optional(),
  warrantyExpiry:  z.string().optional(),
  purchasePrice:   z.number().optional(),
  supplier:        z.string().optional(),
  invoiceNumber:   z.string().optional(),
  notes:           z.string().optional(),
  assignedUserId:  z.string().optional(),
  purchaseOrderId: z.string().optional(),
});

const updateSchema = deviceSchema.partial();

// ─── Liste des appareils ──────────────────────────────────────

export async function listDevices(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      search, type, types, status, statuses, assigned, excludeStock, assignedUserId,
      page = '1', limit = '25',
      sortBy = 'updatedAt', sortOrder = 'desc',
    } = req.query as Record<string, string>;

    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 25));

    const validSortFields = ['updatedAt','createdAt','assetTag','brand','model','status','type'];
    const safeSortBy    = validSortFields.includes(sortBy) ? sortBy : 'updatedAt';
    const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { assetTag:    { contains: search, mode: 'insensitive' } },
        { serialNumber:{ contains: search, mode: 'insensitive' } },
        { brand:       { contains: search, mode: 'insensitive' } },
        { model:       { contains: search, mode: 'insensitive' } },
        { assignedUser:{ displayName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (type)             where.type   = type;
    else if (types)       where.type   = { in: types.split(',') };
    if (status)                       where.status = status;
    else if (statuses)                where.status = { in: statuses.split(',') };
    else if (excludeStock === 'true') where.status = { notIn: ['IN_STOCK', 'ORDERED'] };
    if (assignedUserId)           where.assignedUserId = assignedUserId;
    else if (assigned === 'true')  where.assignedUserId = { not: null };
    else if (assigned === 'false') where.assignedUserId = null;

    const [data, total] = await Promise.all([
      prisma.device.findMany({
        where,
        include: {
          assignedUser: { select: { id: true, displayName: true, email: true, avatar: true, isActive: true } },
        },
        orderBy: { [safeSortBy]: safeSortOrder },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.device.count({ where }),
    ]);

    res.json({ data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    next(err);
  }
}

// ─── Détail d'un appareil ─────────────────────────────────────

export async function getDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const device = await prisma.device.findUnique({
      where: { id: req.params.id },
      include: {
        assignedUser:   { select: { id: true, displayName: true, email: true, avatar: true, role: true } },
        purchaseOrder:  { select: { id: true, reference: true } },
        auditLogs: {
          include: { user: { select: { id: true, displayName: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        maintenanceLogs: { orderBy: { createdAt: 'desc' } },
        attachments:     { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!device) return res.status(404).json({ message: 'Appareil introuvable' });
    res.json(device);
  } catch (err) {
    next(err);
  }
}

// ─── Créer un appareil ────────────────────────────────────────

export async function createDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = deviceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Données invalides', details: parsed.error.flatten() });

    const { purchaseDate, warrantyExpiry, assignedUserId, ...rest } = parsed.data;

    const device = await prisma.device.create({
      data: {
        ...rest,
        purchaseDate:   purchaseDate  ? new Date(purchaseDate)  : undefined,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : undefined,
        assignedUserId: assignedUserId || undefined,
        assignedAt:     assignedUserId ? new Date() : undefined,
      },
      include: {
        assignedUser: { select: { id: true, displayName: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        deviceId:  device.id,
        userId:    req.currentUser!.id,
        action:    'CREATED',
        comment:   `Appareil ${device.assetTag} créé`,
        ipAddress: req.ip,
      },
    });

    logger.info(`Device created: ${device.assetTag} by ${req.currentUser!.email}`);
    res.status(201).json(device);
  } catch (err) {
    next(err);
  }
}

// ─── Mettre à jour un appareil ────────────────────────────────

export async function updateDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.device.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Appareil introuvable' });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Données invalides', details: parsed.error.flatten() });

    const { purchaseDate, warrantyExpiry, assignedUserId, purchaseOrderId, ...rest } = parsed.data;

    let data: Record<string, unknown> = {
      ...rest,
      purchaseDate:    purchaseDate    !== undefined ? new Date(purchaseDate)    : undefined,
      warrantyExpiry:  warrantyExpiry  !== undefined ? new Date(warrantyExpiry)  : undefined,
      purchaseOrderId: purchaseOrderId !== undefined ? (purchaseOrderId || null) : undefined,
    };

    // Si l'appareil est lié à un PO, le modèle/marque/type sont verrouillés
    if (existing.purchaseOrderId) {
      data = { ...data, brand: existing.brand, model: existing.model, type: existing.type };
    }

    // Si changement de statut vers RETIRED, enregistrer retiredAt
    if (parsed.data.status === 'RETIRED' && existing.status !== 'RETIRED') {
      data.retiredAt = new Date();
    }

    const updated = await prisma.device.update({
      where: { id: req.params.id },
      data,
      include: {
        assignedUser: { select: { id: true, displayName: true, email: true, avatar: true } },
      },
    });

    // Audit : statut changé = entrée spécifique, sinon entrée générique
    const action = parsed.data.status && parsed.data.status !== existing.status
      ? 'STATUS_CHANGED' as const
      : 'UPDATED' as const;

    await prisma.auditLog.create({
      data: {
        deviceId:  existing.id,
        userId:    req.currentUser!.id,
        action,
        fieldName: action === 'STATUS_CHANGED' ? 'status' : undefined,
        oldValue:  action === 'STATUS_CHANGED' ? existing.status : undefined,
        newValue:  action === 'STATUS_CHANGED' ? parsed.data.status : undefined,
        comment:   action === 'UPDATED' ? `Appareil ${existing.assetTag} mis à jour` : undefined,
        ipAddress: req.ip,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// ─── Supprimer un appareil ────────────────────────────────────

export async function deleteDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const device = await prisma.device.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ message: 'Appareil introuvable' });

    await prisma.device.delete({ where: { id: device.id } }); // cascade via schema

    logger.info(`Device deleted: ${device.assetTag} by ${req.currentUser!.email}`);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ─── Assigner un appareil ─────────────────────────────────────

export async function assignDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId requis' });

    const [device, user] = await Promise.all([
      prisma.device.findUnique({ where: { id: req.params.id } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!device) return res.status(404).json({ message: 'Appareil introuvable' });
    if (!user)   return res.status(404).json({ message: 'Utilisateur introuvable' });

    const updated = await prisma.device.update({
      where: { id: device.id },
      data: { assignedUserId: userId, assignedAt: new Date(), status: 'ASSIGNED' },
      include: { assignedUser: { select: { id: true, displayName: true, email: true, avatar: true } } },
    });

    await prisma.auditLog.create({
      data: {
        deviceId:  device.id,
        userId:    req.currentUser!.id,
        action:    'ASSIGNED',
        newValue:  user.displayName,
        comment:   `Assigné à ${user.displayName}`,
        ipAddress: req.ip,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// ─── Désassigner un appareil ──────────────────────────────────

export async function unassignDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const device = await prisma.device.findUnique({
      where: { id: req.params.id },
      include: { assignedUser: true },
    });
    if (!device) return res.status(404).json({ message: 'Appareil introuvable' });

    const updated = await prisma.device.update({
      where: { id: device.id },
      data: { assignedUserId: null, assignedAt: null, status: 'IN_STOCK' },
    });

    await prisma.auditLog.create({
      data: {
        deviceId:  device.id,
        userId:    req.currentUser!.id,
        action:    'UNASSIGNED',
        oldValue:  device.assignedUser?.displayName,
        comment:   'Désassigné',
        ipAddress: req.ip,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
