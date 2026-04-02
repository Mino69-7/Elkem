import api from './api';
import type { Device, PaginatedResponse, DeviceFilters } from '../types';

export interface DeviceFormData {
  assetTag: string;
  serialNumber: string;
  type: string;
  brand: string;
  model: string;
  keyboardLayout: string;
  status?: string;
  condition?: string;
  processor?: string;
  ram?: string;
  storage?: string;
  screenSize?: string;
  color?: string;
  keyboardLanguage?: string;
  location?: string;
  site?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  purchasePrice?: number;
  supplier?: string;
  invoiceNumber?: string;
  notes?: string;
  assignedUserId?: string;
  purchaseOrderId?: string;
  hostname?: string;
  vlan?: string;
  ipAddress?: string;
  macAddress?: string;
  bitlocker?: boolean;
  hasDocking?: boolean;
  imei?: string;
  swappedDeviceId?: string;
}

export const deviceService = {
  async list(filters: Partial<DeviceFilters> = {}): Promise<PaginatedResponse<Device>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) {
        params.set(key, String(value));
      }
    });
    const { data } = await api.get<PaginatedResponse<Device>>(`/devices?${params.toString()}`);
    return data;
  },

  async get(id: string): Promise<Device> {
    const { data } = await api.get<Device>(`/devices/${id}`);
    return data;
  },

  async create(payload: DeviceFormData): Promise<Device> {
    const { data } = await api.post<Device>('/devices', payload);
    return data;
  },

  async update(id: string, payload: Partial<DeviceFormData>): Promise<Device> {
    const { data } = await api.put<Device>(`/devices/${id}`, payload);
    return data;
  },

  async retire(id: string, status: string): Promise<Device> {
    const { data } = await api.delete<Device>(`/devices/${id}`, { data: { status } });
    return data;
  },

  async assign(id: string, userId: string): Promise<Device> {
    const { data } = await api.patch<Device>(`/devices/${id}/assign`, { userId });
    return data;
  },

  async unassign(id: string): Promise<Device> {
    const { data } = await api.patch<Device>(`/devices/${id}/unassign`);
    return data;
  },
};
