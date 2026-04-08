import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

// ─── Schémas de validation ────────────────────────────────────

const deviceSchema = z.object({
  assetTag:        z.string().regex(/^[A-Z0-9-]+$/, 'Format invalide (ex: ELKEM-LT-001)').optional().nullable(),
  serialNumber:    z.string().min(1, 'Numéro de série requis'),
  type:            z.enum(['LAPTOP','DESKTOP','THIN_CLIENT','LAB_WORKSTATION','SMARTPHONE','TABLET','MONITOR','KEYBOARD','MOUSE','HEADSET','DOCKING_STATION','PRINTER','OTHER']),
  brand:           z.string().min(1, 'Marque requise'),
  model:           z.string().min(1, 'Modèle requis'),
  keyboardLayout:  z.enum(['AZERTY_FR','QWERTY_US','QWERTY_UK','QWERTY_ES','QWERTY_IT','QWERTY_NO','QWERTY_NL','QWERTZ_DE','QWERTZ_CH','QWERTY_RU','QWERTY_TR','QWERTY_AR','OTHER']).default('AZERTY_FR'),
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
  hostname:        z.string().optional(),
  vlan:            z.string().optional(),
  ipAddress:       z.string().optional(),
  macAddress:      z.string().optional(),
  bitlocker:       z.string().optional(),
  hasDocking:      z.boolean().optional(),
  imei:            z.string().optional(),
  modelId:         z.string().optional(),
});

const updateSchema = deviceSchema.partial();

// ─── Liste des appareils ──────────────────────────────────────

export async function listDevices(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      search, type, types, status, statuses, assigned, excludeStock, assignedUserId, model,
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
        { imei:        { contains: search, mode: 'insensitive' } },
        { brand:       { contains: search, mode: 'insensitive' } },
        { model:       { contains: search, mode: 'insensitive' } },
        { assignedUser:{ displayName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (type)             where.type   = type;
    else if (types)       where.type   = { in: types.split(',') };
    if (model)            where.model  = model;
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
    const existing = await prisma.device.findUnique({
      where: { id: req.params.id },
      include: { assignedUser: { select: { id: true, displayName: true } } },
    });
    if (!existing) return res.status(404).json({ message: 'Appareil introuvable' });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Données invalides', details: parsed.error.flatten() });

    const { purchaseDate, warrantyExpiry, assignedUserId, purchaseOrderId, ...rest } = parsed.data;
    const updateTechName = req.currentUser!.displayName ?? req.currentUser!.email;

    let data: Record<string, unknown> = {
      ...rest,
      purchaseDate:    purchaseDate    !== undefined ? new Date(purchaseDate)    : undefined,
      warrantyExpiry:  warrantyExpiry  !== undefined ? new Date(warrantyExpiry)  : undefined,
      purchaseOrderId: purchaseOrderId !== undefined ? (purchaseOrderId || null) : undefined,
    };

    // Changement d'utilisateur assigné
    const newAssignedUserId = assignedUserId !== undefined ? (assignedUserId || null) : undefined;
    const userChanged = newAssignedUserId !== undefined && newAssignedUserId !== existing.assignedUserId;
    if (userChanged) {
      data.assignedUserId = newAssignedUserId;
      data.assignedAt     = newAssignedUserId ? new Date() : null;
    }

    // Si l'appareil est lié à un PO, le modèle/marque/type/modelId sont verrouillés
    if (existing.purchaseOrderId) {
      data = { ...data, brand: existing.brand, model: existing.model, type: existing.type, modelId: existing.modelId };
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

    const STATUS_LABELS_FR: Record<string, string> = {
      ORDERED: 'Commandé', IN_STOCK: 'En stock', ASSIGNED: 'Attribué',
      PENDING_RETURN: 'À récupérer', IN_MAINTENANCE: 'En maintenance',
      LOANER: 'Prêt', LOST: 'Perdu', STOLEN: 'Volé', RETIRED: 'Déchet',
    };

    await prisma.auditLog.create({
      data: {
        deviceId:  existing.id,
        userId:    req.currentUser!.id,
        action,
        fieldName: action === 'STATUS_CHANGED' ? 'status' : undefined,
        oldValue:  action === 'STATUS_CHANGED' ? existing.status : undefined,
        newValue:  action === 'STATUS_CHANGED' ? parsed.data.status : undefined,
        comment:   action === 'STATUS_CHANGED'
          ? `${STATUS_LABELS_FR[existing.status] ?? existing.status} → ${STATUS_LABELS_FR[parsed.data.status!] ?? parsed.data.status} — par ${updateTechName}`
          : `Mis à jour par ${updateTechName}`,
        ipAddress: req.ip,
      },
    });

    // Audit : changement d'utilisateur assigné
    if (userChanged) {
      if (existing.assignedUserId && existing.assignedUser) {
        await prisma.auditLog.create({
          data: {
            deviceId:  existing.id,
            userId:    req.currentUser!.id,
            action:    'UNASSIGNED',
            oldValue:  existing.assignedUser.displayName,
            comment:   `Désaffecté de ${existing.assignedUser.displayName} par ${updateTechName}`,
            ipAddress: req.ip,
          },
        });
      }
      if (newAssignedUserId) {
        const newUser = await prisma.user.findUnique({ where: { id: newAssignedUserId }, select: { displayName: true } });
        await prisma.auditLog.create({
          data: {
            deviceId:  existing.id,
            userId:    req.currentUser!.id,
            action:    'ASSIGNED',
            newValue:  newUser?.displayName,
            comment:   `Assigné à ${newUser?.displayName ?? '—'} par ${updateTechName}`,
            ipAddress: req.ip,
          },
        });
      }
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// ─── Désaffecter / Archiver un appareil ──────────────────────
// Aucune suppression réelle — changement de statut + audit trail complet

const RETIRE_STATUS_LABELS: Record<string, string> = {
  IN_STOCK:       'Stock',
  IN_MAINTENANCE: 'En maintenance',
  RETIRED:        'Déchet',
  LOST:           'Perdu',
  STOLEN:         'Volé',
};
const ALLOWED_RETIRE_STATUSES = Object.keys(RETIRE_STATUS_LABELS);

export async function deleteDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const newStatus: string = (req.body?.status as string) || 'IN_STOCK';
    if (!ALLOWED_RETIRE_STATUSES.includes(newStatus)) {
      return res.status(400).json({ message: `Statut invalide. Valeurs acceptées : ${ALLOWED_RETIRE_STATUSES.join(', ')}` });
    }

    const device = await prisma.device.findUnique({
      where: { id: req.params.id },
      include: { assignedUser: { select: { displayName: true, email: true } } },
    });
    if (!device) return res.status(404).json({ message: 'Appareil introuvable' });

    const previousUser = device.assignedUser;
    const previousStatus = device.status;

    // Données de mise à jour
    const updateData: Record<string, unknown> = {
      assignedUserId: null,
      assignedAt:     null,
      status:         newStatus,
    };
    // Horodatage de sortie pour les statuts hors-service
    if (['RETIRED', 'LOST', 'STOLEN'].includes(newStatus)) {
      updateData.retiredAt = new Date();
    }

    const updated = await prisma.device.update({
      where: { id: device.id },
      data: updateData,
      include: { assignedUser: { select: { id: true, displayName: true, email: true, avatar: true } } },
    });

    const techName = req.currentUser!.displayName ?? req.currentUser!.email;
    const statusLabel = RETIRE_STATUS_LABELS[newStatus];

    // Log 1 : désaffectation de l'utilisateur
    if (previousUser) {
      await prisma.auditLog.create({
        data: {
          deviceId:  device.id,
          userId:    req.currentUser!.id,
          action:    'UNASSIGNED',
          oldValue:  previousUser.displayName,
          comment:   `Désaffecté de ${previousUser.displayName} par ${techName}`,
          ipAddress: req.ip,
        },
      });
    }

    // Log 2 : changement de statut
    await prisma.auditLog.create({
      data: {
        deviceId:  device.id,
        userId:    req.currentUser!.id,
        action:    'STATUS_CHANGED',
        fieldName: 'status',
        oldValue:  previousStatus,
        newValue:  newStatus,
        comment:   previousUser
          ? `${previousUser.displayName} → ${statusLabel} — par ${techName}`
          : `Statut : ${statusLabel} — par ${techName}`,
        ipAddress: req.ip,
      },
    });

    logger.info(`Device retired: ${device.assetTag} → ${newStatus} by ${req.currentUser!.email}`);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// ─── Assigner un appareil ─────────────────────────────────────

export async function assignDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, assetTag } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId requis' });

    const [device, user] = await Promise.all([
      prisma.device.findUnique({ where: { id: req.params.id } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!device) return res.status(404).json({ message: 'Appareil introuvable' });
    if (!user)   return res.status(404).json({ message: 'Utilisateur introuvable' });

    const updated = await prisma.device.update({
      where: { id: device.id },
      data: { assignedUserId: userId, assignedAt: new Date(), status: 'ASSIGNED', ...(assetTag ? { assetTag } : {}) },
      include: { assignedUser: { select: { id: true, displayName: true, email: true, avatar: true } } },
    });

    const assignTechName = req.currentUser!.displayName ?? req.currentUser!.email;
    await prisma.auditLog.create({
      data: {
        deviceId:  device.id,
        userId:    req.currentUser!.id,
        action:    'ASSIGNED',
        newValue:  user.displayName,
        comment:   `Assigné à ${user.displayName} par ${assignTechName}`,
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

    const unassignTechName = req.currentUser!.displayName ?? req.currentUser!.email;
    await prisma.auditLog.create({
      data: {
        deviceId:  device.id,
        userId:    req.currentUser!.id,
        action:    'UNASSIGNED',
        oldValue:  device.assignedUser?.displayName,
        comment:   `Désaffecté de ${device.assignedUser?.displayName ?? '—'} par ${unassignTechName}`,
        ipAddress: req.ip,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
