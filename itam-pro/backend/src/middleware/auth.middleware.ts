import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import type { Role } from '@prisma/client';

// Extension du type Request pour transporter l'utilisateur authentifié
declare global {
  namespace Express {
    interface Request {
      currentUser?: {
        id: string;
        email: string;
        displayName: string;
        role: Role;
      };
    }
  }
}

/**
 * Middleware d'authentification JWT.
 * Extrait le token du header Authorization ou du cookie de session,
 * vérifie sa validité et attache l'utilisateur à la requête.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Extraction du token : Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      res.status(401).json({ message: 'Authentification requise' });
      return;
    }

    const payload = verifyToken(token);

    // Vérifier que l'utilisateur existe toujours en base et est actif
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, displayName: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ message: 'Utilisateur introuvable ou désactivé' });
      return;
    }

    req.currentUser = user;
    next();
  } catch {
    res.status(401).json({ message: 'Token invalide ou expiré' });
  }
}

/**
 * Middleware de contrôle des rôles.
 * Usage : requireRole('MANAGER', 'TECHNICIAN')
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.currentUser) {
      res.status(401).json({ message: 'Authentification requise' });
      return;
    }
    if (!roles.includes(req.currentUser.role)) {
      res.status(403).json({
        message: `Accès refusé. Rôle requis : ${roles.join(' ou ')}`,
      });
      return;
    }
    next();
  };
}
