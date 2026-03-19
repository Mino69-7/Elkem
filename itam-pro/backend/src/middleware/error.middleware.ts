import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

/** Gestion centralisée des erreurs Express */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(`${req.method} ${req.path}`, { error: err.message, stack: err.stack });

  // Erreurs Prisma
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as unknown as { code: string };
    if (prismaErr.code === 'P2002') {
      res.status(409).json({ message: 'Une entrée avec ces données existe déjà' });
      return;
    }
    if (prismaErr.code === 'P2025') {
      res.status(404).json({ message: 'Ressource introuvable' });
      return;
    }
  }

  res.status(500).json({
    message: process.env.NODE_ENV === 'production'
      ? 'Erreur interne du serveur'
      : err.message,
  });
}
