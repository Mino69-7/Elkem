import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

/**
 * Vérifie les seuils de stock toutes les heures.
 * Log une alerte pour chaque type d'appareil dont le stock est sous le seuil configuré.
 */
export function startStockAlertJob() {
  // Toutes les heures, à la minute 0
  cron.schedule('0 * * * *', async () => {
    logger.info('[CRON] Vérification des alertes de stock…');

    try {
      const alerts = await prisma.stockAlert.findMany({ where: { isActive: true } });
      if (!alerts.length) return;

      const stockCounts = await prisma.device.groupBy({
        by: ['type'],
        where: { status: 'IN_STOCK' },
        _count: { type: true },
      });
      const stockMap = Object.fromEntries(stockCounts.map((s) => [s.type, s._count.type]));

      let triggered = 0;
      for (const alert of alerts) {
        const current = stockMap[alert.deviceType] ?? 0;
        if (current < alert.threshold) {
          logger.warn(
            `[STOCK ALERT] ${alert.deviceType} : ${current} en stock (seuil : ${alert.threshold})`
          );
          triggered++;
        }
      }

      if (triggered === 0) {
        logger.info('[CRON] Aucune alerte de stock déclenchée.');
      } else {
        logger.warn(`[CRON] ${triggered} alerte(s) de stock déclenchée(s).`);
      }
    } catch (err) {
      logger.error('[CRON] Erreur lors de la vérification du stock :', err);
    }
  });

  logger.info('[CRON] Job "stock-alerts" démarré (toutes les heures)');
}
