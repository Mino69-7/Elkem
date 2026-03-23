import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalDevices,
      totalUsers,
      byStatus,
      byType,
      warrantyExpiring,
      recentActivity,
      recentDevices,
    ] = await Promise.all([
      // Compteurs globaux
      prisma.device.count(),
      prisma.user.count({ where: { isActive: true } }),

      // Répartition par statut
      prisma.device.groupBy({
        by: ['status'],
        _count: { status: true },
        orderBy: { _count: { status: 'desc' } },
      }),

      // Répartition par type
      prisma.device.groupBy({
        by: ['type'],
        _count: { type: true },
        orderBy: { _count: { type: 'desc' } },
      }),

      // Garanties expirant dans 30 jours
      prisma.device.findMany({
        where: {
          warrantyExpiry: { gte: now, lte: in30days },
          status: { not: 'RETIRED' },
        },
        select: {
          id: true,
          assetTag: true,
          brand: true,
          model: true,
          type: true,
          warrantyExpiry: true,
          assignedUser: { select: { displayName: true } },
        },
        orderBy: { warrantyExpiry: 'asc' },
        take: 10,
      }),

      // Activité récente
      prisma.auditLog.findMany({
        include: {
          user: { select: { displayName: true, email: true } },
          device: { select: { id: true, assetTag: true, brand: true, model: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),

      // Derniers appareils ajoutés
      prisma.device.findMany({
        select: {
          id: true,
          assetTag: true,
          brand: true,
          model: true,
          type: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // Compteurs dérivés des statuts
    const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count.status]));

    res.json({
      totals: {
        devices:       totalDevices,
        users:         totalUsers,
        assigned:      statusMap['ASSIGNED']      ?? 0,
        inStock:       statusMap['IN_STOCK']      ?? 0,
        inMaintenance: statusMap['IN_MAINTENANCE'] ?? 0,
        ordered:       statusMap['ORDERED']       ?? 0,
        loaner:        statusMap['LOANER']        ?? 0,
      },
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.status })),
      byType:   byType.map((t)   => ({ type:   t.type,   count: t._count.type   })),
      warrantyExpiring,
      recentActivity,
      recentDevices,
    });
  } catch (err) {
    next(err);
  }
}
