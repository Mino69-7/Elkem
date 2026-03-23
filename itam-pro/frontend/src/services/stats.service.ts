import api from './api';
import type { DeviceType, DeviceStatus } from '../types';

export interface StatsResponse {
  totals: {
    devices:       number;
    users:         number;
    assigned:      number;
    inStock:       number;
    inMaintenance: number;
    ordered:       number;
    loaner:        number;
  };
  byStatus: { status: DeviceStatus; count: number }[];
  byType:   { type: DeviceType;   count: number }[];
  warrantyExpiring: {
    id: string;
    assetTag: string;
    brand: string;
    model: string;
    type: DeviceType;
    warrantyExpiry: string;
    assignedUser?: { displayName: string } | null;
  }[];
  recentActivity: {
    id: string;
    action: string;
    comment?: string;
    createdAt: string;
    user: { displayName: string; email: string };
    device: { id: string; assetTag: string; brand: string; model: string };
  }[];
  recentDevices: {
    id: string;
    assetTag: string;
    brand: string;
    model: string;
    type: DeviceType;
    status: DeviceStatus;
    createdAt: string;
  }[];
}

export const statsService = {
  async get(): Promise<StatsResponse> {
    const { data } = await api.get<StatsResponse>('/stats');
    return data;
  },
};
