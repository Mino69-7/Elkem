import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

// ─── Liste des utilisateurs ───────────────────────────────────

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, role, active = 'true' } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {};

    if (active !== 'all') where.isActive = active !== 'false';
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { email:       { contains: search, mode: 'insensitive' } },
        { department:  { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        avatar: true,
        department: true,
        jobTitle: true,
        isActive: true,
        createdAt: true,
        _count: { select: { assignedDevices: true } },
      },
      orderBy: { displayName: 'asc' },
    });

    res.json(users);
  } catch (err) {
    next(err);
  }
}

// ─── Détail d'un utilisateur ──────────────────────────────────

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        avatar: true,
        department: true,
        jobTitle: true,
        isActive: true,
        createdAt: true,
        assignedDevices: {
          select: { id: true, assetTag: true, type: true, brand: true, model: true, status: true },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}
