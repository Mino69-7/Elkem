import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import api from '../services/api';
import { useUIStore } from '../stores/uiStore';
import type { Device, DeviceType } from '../types';

// ─── Types ────────────────────────────────────────────────────

interface StockAlertRow {
  id: string;
  deviceType: DeviceType;
  deviceModelId: string | null;
  deviceModel: { id: string; brand: string; name: string; type: DeviceType } | null;
  threshold: number;
  isActive: boolean;
  currentStock: number;
  triggered: boolean;
}

interface ModelSummary {
  id: string;
  type: DeviceType;
  inStock: number;
}

export interface StockNotifications {
  inventaireCount: number;
  maintenanceCount: number;
  dechetsCount: number;
  totalCount: number;
  /** IDs de modèles (modelId) avec une alerte déclenchée non consultée */
  unviewedInventaireModelIds: Set<string>;
  /** Types d'appareils avec au moins un modèle non consulté (pour TopBar) */
  unviewedAlertTypes: Set<string>;
  /** IDs de devices en maintenance dépassant leur deadline et non consultés */
  overdueUnviewedDeviceIds: Set<string>;
  /** IDs de devices en déchets avec un modèle actif et non consultés */
  activeModelUnviewedDeviceIds: Set<string>;
  /** Alertes déclenchées non consultées (pour le dropdown TopBar) */
  triggeredAlerts: StockAlertRow[];
  /** Appareils en maintenance en retard non consultés */
  overdueDevices: Device[];
  /** Appareils en déchets avec modèle actif non consultés */
  activeModelDevices: Device[];
  /** Mapping modelId → inStock pour les modèles non vus (pour markAllViewed) */
  unviewedModelsWithStock: { id: string; inStock: number }[];
}

// ─── Hook ─────────────────────────────────────────────────────

export function useStockNotifications(): StockNotifications {
  const {
    viewedInventaireModels,
    viewedMaintenanceDevices,
    viewedDechetsDevices,
  } = useUIStore();

  const { data: alerts = [] } = useQuery<StockAlertRow[]>({
    queryKey: ['stockalerts'],
    queryFn: () => api.get('/stockalerts').then((r) => r.data),
    staleTime: 30_000,
  });

  // Stock-summary pour avoir les modèles par type — TanStack Query déduplique avec Stock.tsx
  const { data: stockSummary = [] } = useQuery<ModelSummary[]>({
    queryKey: ['stock-summary'],
    queryFn: () => api.get('/devicemodels/stock-summary').then((r) => r.data),
    staleTime: 30_000,
  });

  const { data: maintData } = useQuery<{ data: Device[]; total: number }>({
    queryKey: ['maintenance-devices'],
    queryFn: () =>
      api
        .get('/devices?status=IN_MAINTENANCE&limit=200&sortBy=updatedAt&sortOrder=desc')
        .then((r) => r.data),
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: retiredData } = useQuery<{ data: Device[]; total: number }>({
    queryKey: ['retired-devices'],
    queryFn: () =>
      api
        .get('/devices?statuses=RETIRED,LOST,STOLEN&limit=200&sortBy=updatedAt&sortOrder=desc')
        .then((r) => r.data),
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: activeModels = [] } = useQuery<{ id: string; brand: string; name: string }[]>({
    queryKey: ['device-models'],
    queryFn: () => api.get('/devicemodels').then((r) => r.data),
    staleTime: 60_000,
  });

  return useMemo(() => {
    const activeModelKeys = new Set(activeModels.map((m) => `${m.brand}|${m.name}`));
    const now = new Date();

    // ── Inventaire — granularité par modelId ────────────────
    // Alerte par modèle (deviceModelId != null) → pastille uniquement sur ce modèle.
    // Alerte par type (deviceModelId == null)   → pastille sur tous les modèles du type.
    // Dans les deux cas, la pastille disparaît quand ce modelId est marqué consulté.
    const unviewedInventaireModelIds = new Set<string>();
    const unviewedAlertTypes = new Set<string>();
    const triggeredAlerts: StockAlertRow[] = [];

    for (const alert of alerts) {
      if (!alert.isActive || !alert.triggered) continue;

      const candidates = alert.deviceModelId
        // Alerte par modèle : un seul modèle concerné
        ? stockSummary.filter((m) => m.id === alert.deviceModelId)
        // Alerte par type : tous les modèles du type
        : stockSummary.filter((m) => m.type === alert.deviceType);

      let hasUnviewed = false;
      for (const model of candidates) {
        const seenAt = viewedInventaireModels[model.id];
        if (seenAt === undefined || model.inStock < seenAt) {
          unviewedInventaireModelIds.add(model.id);
          hasUnviewed = true;
        }
      }

      if (hasUnviewed) {
        unviewedAlertTypes.add(alert.deviceType);
        triggeredAlerts.push(alert);
      }
    }

    // Mapping modelId → inStock pour les modèles non vus (utilisé par "tout vider")
    const unviewedModelsWithStock = stockSummary
      .filter((m) => unviewedInventaireModelIds.has(m.id))
      .map((m) => ({ id: m.id, inStock: m.inStock }));

    // inventaireCount = nombre de types distincts avec au moins un modèle non vu
    const inventaireCount = unviewedAlertTypes.size;

    // ── Maintenance ─────────────────────────────────────────
    const maintDevices = maintData?.data ?? [];
    const overdueUnviewedDeviceIds = new Set<string>();
    const overdueDevices: Device[] = [];
    for (const device of maintDevices) {
      const deadline = device.maintenanceDeadline ? new Date(device.maintenanceDeadline) : null;
      if (deadline && deadline < now && !viewedMaintenanceDevices.includes(device.id)) {
        overdueUnviewedDeviceIds.add(device.id);
        overdueDevices.push(device);
      }
    }
    const maintenanceCount = overdueUnviewedDeviceIds.size;

    // ── Déchets ─────────────────────────────────────────────
    const retiredDevices = retiredData?.data ?? [];
    const activeModelUnviewedDeviceIds = new Set<string>();
    const activeModelDevices: Device[] = [];
    for (const device of retiredDevices) {
      if (
        activeModelKeys.has(`${device.brand}|${device.model}`) &&
        !viewedDechetsDevices.includes(device.id)
      ) {
        activeModelUnviewedDeviceIds.add(device.id);
        activeModelDevices.push(device);
      }
    }
    const dechetsCount = activeModelUnviewedDeviceIds.size;

    return {
      inventaireCount,
      maintenanceCount,
      dechetsCount,
      totalCount: inventaireCount + maintenanceCount + dechetsCount,
      unviewedInventaireModelIds,
      unviewedAlertTypes,
      overdueUnviewedDeviceIds,
      activeModelUnviewedDeviceIds,
      triggeredAlerts,
      overdueDevices,
      activeModelDevices,
      unviewedModelsWithStock,
    };
  }, [
    alerts,
    stockSummary,
    maintData,
    retiredData,
    activeModels,
    viewedInventaireModels,
    viewedMaintenanceDevices,
    viewedDechetsDevices,
  ]);
}
