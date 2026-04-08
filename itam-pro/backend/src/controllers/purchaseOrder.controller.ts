import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const poSchema = z.object({
  reference:     z.string().min(1),
  deviceModelId: z.string().min(1),
  quantity:      z.number().int().min(1),
  expectedAt:    z.string().optional(),
  notes:         z.string().optional(),
});

const PO_INCLUDE = { deviceModel: true, createdBy: { select: { id: true, displayName: true } } };

// Liste les POs actifs (hors CANCELLED et COMPLETE)
export async function listOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      where: { status: { notIn: ['CANCELLED', 'COMPLETE'] } },
      include: PO_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) { next(err); }
}

// Historique complet — toutes les commandes, tous statuts
export async function listHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      include: PO_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) { next(err); }
}

// Créer un PO (MANAGER uniquement)
export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = poSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Données invalides', details: parsed.error.flatten() });
    const order = await prisma.purchaseOrder.create({
      data: {
        ...parsed.data,
        expectedAt: parsed.data.expectedAt ? new Date(parsed.data.expectedAt) : undefined,
        createdById: (req as any).currentUser.id,
      },
      include: PO_INCLUDE,
    });
    res.status(201).json(order);
  } catch (err) { next(err); }
}

// Modifier un PO (MANAGER uniquement)
export async function updateOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = poSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Données invalides', details: parsed.error.flatten() });
    const order = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: {
        ...parsed.data,
        expectedAt: parsed.data.expectedAt ? new Date(parsed.data.expectedAt) : undefined,
      },
      include: PO_INCLUDE,
    });
    res.json(order);
  } catch (err) { next(err); }
}

// Annuler un PO (MANAGER uniquement) — jamais supprimé
export async function cancelOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
      include: PO_INCLUDE,
    });
    res.json(order);
  } catch (err) { next(err); }
}

// Réceptionner un appareil (TECHNICIAN+) — crée le Device lié au PO
// Tag IT = référence commande (identique pour tout le lot) ; unicité assurée par serialNumber
export async function receiveDevice(req: Request, res: Response, next: NextFunction) {
  try {
    const { orderId } = req.params;
    const { serialNumber, notes, imei } = z.object({
      serialNumber: z.string().min(1),
      notes:        z.string().optional(),
      imei:         z.string().optional(),
    }).parse(req.body);

    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: { deviceModel: true },
    });
    if (!order) return res.status(404).json({ message: 'Commande introuvable' });
    if (order.status === 'CANCELLED') return res.status(400).json({ message: 'Commande annulée' });
    if (order.receivedCount >= order.quantity) return res.status(400).json({ message: 'Commande déjà complète' });

    // Vérifier unicité SN
    const snExists = await prisma.device.findUnique({ where: { serialNumber } });
    if (snExists) return res.status(400).json({ message: 'Numéro de série déjà existant' });

    // Tag IT = référence de la commande (commun à tous les appareils du même lot)
    // La traçabilité individuelle est assurée par le serialNumber et purchaseOrderId
    const newReceived = order.receivedCount + 1;
    const assetTag = order.reference;

    const dm = order.deviceModel;

    // Créer le device lié au PO (modèle verrouillé)
    const device = await prisma.device.create({
      data: {
        assetTag,
        serialNumber,
        type:           dm.type,
        brand:          dm.brand,
        model:          dm.name,
        modelId:        dm.id,
        processor:      dm.processor ?? undefined,
        ram:            dm.ram ?? undefined,
        storage:        dm.storage ?? undefined,
        screenSize:     dm.screenSize ?? undefined,
        keyboardLayout: (dm as any).keyboardLayout ?? 'AZERTY_FR',
        status:         'IN_STOCK',
        condition:      'NEW',
        purchaseOrderId: orderId,
        imei:           imei || undefined,
        notes,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        deviceId: device.id,
        userId:   (req as any).currentUser.id,
        action:   'CREATED',
        comment:  `Réceptionné via commande ${order.reference} — Tag ${assetTag}`,
      },
    });

    // Incrémenter receivedCount et mettre à jour le statut du PO
    const newStatus = newReceived >= order.quantity ? 'COMPLETE' : 'PARTIAL';
    await prisma.purchaseOrder.update({
      where: { id: orderId },
      data: { receivedCount: newReceived, status: newStatus },
    });

    res.status(201).json(device);
  } catch (err) { next(err); }
}
