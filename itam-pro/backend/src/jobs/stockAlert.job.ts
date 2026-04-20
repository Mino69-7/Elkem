import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export function startStockAlertJob() {
  cron.schedule('0 * * * *', async () => {
    logger.info('[CRON] Vérification des alertes de stock…');

    try {
      const alerts = await prisma.stockAlert.findMany({
        where:   { isActive: true },
        include: { deviceModel: { select: { brand: true, name: true } } },
      });
      if (!alerts.length) return;

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

      let triggered = 0;
      for (const alert of alerts) {
        const current = alert.deviceModelId
          ? (modelStockMap[alert.deviceModelId] ?? 0)
          : (typeStockMap[alert.deviceType] ?? 0);

        if (current < alert.threshold) {
          const label = alert.deviceModel
            ? `${alert.deviceModel.brand} ${alert.deviceModel.name}`
            : alert.deviceType;
          logger.warn(`[STOCK ALERT] ${label} : ${current} en stock (seuil : ${alert.threshold})`);
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
