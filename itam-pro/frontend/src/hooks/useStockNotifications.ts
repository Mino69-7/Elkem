import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import api from '../services/api';
import { useUIStore } from '../stores/uiStore';
import type { Device, DeviceType } from '../types';

// ─── Types ────────────────────────────────────────────────────

interface StockAlertRow {
  id: string;
  deviceType: DeviceType;
  threshold: number;
  isActive: boolean;
  currentStock: number;
  triggered: boolean;
}

export interface StockNotifications {
  inventaireCount: number;
  maintenanceCount: number;
  dechetsCount: number;
  totalCount: number;
  /** Types d'appareils avec une alerte déclenchée non consultée */
  unviewedAlertTypes: Set<string>;
  /** IDs de devices en maintenance dépassant leur deadline et non consultés */
  overdueUnviewedDeviceIds: Set<string>;
  /** IDs de devices en déchets avec un modèle actif et non consultés */
  activeModelUnviewedDeviceIds: Set<string>;
  /** Alertes déclenchées non consultées (pour le dropdown) */
  triggeredAlerts: StockAlertRow[];
  /** Appareils en maintenance en retard non consultés */
  overdueDevices: Device[];
  /** Appareils en déchets avec modèle actif non consultés */
  activeModelDevices: Device[];
}

// ─── Hook ─────────────────────────────────────────────────────

export function useStockNotifications(): StockNotifications {
  const {
    viewedInventaireAlerts,
    viewedMaintenanceDevices,
    viewedDechetsDevices,
  } = useUIStore();

  const { data: alerts = [] } = useQuery<StockAlertRow[]>({
    queryKey: ['stockalerts'],
    queryFn: () => api.get('/stockalerts').then((r) => r.data),
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

    // ── Inventaire ──────────────────────────────────────────
    const unviewedAlertTypes = new Set<string>();
    const triggeredAlerts: StockAlertRow[] = [];
    for (const alert of alerts) {
      if (!alert.isActive || !alert.triggered) continue;
      const viewed = viewedInventaireAlerts[alert.deviceType];
      // Non vu si jamais vu, ou si le stock a baissé depuis la dernière consultation
      if (viewed === undefined || alert.currentStock < viewed) {
        unviewedAlertTypes.add(alert.deviceType);
        triggeredAlerts.push(alert);
      }
    }
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
      unviewedAlertTypes,
      overdueUnviewedDeviceIds,
      activeModelUnviewedDeviceIds,
      triggeredAlerts,
      overdueDevices,
      activeModelDevices,
    };
  }, [
    alerts,
    maintData,
    retiredData,
    activeModels,
    viewedInventaireAlerts,
    viewedMaintenanceDevices,
    viewedDechetsDevices,
  ]);
}
