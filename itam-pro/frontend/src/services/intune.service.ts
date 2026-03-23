import api from './api';

export interface IntuneStatus {
  configured: boolean;
  connected: boolean;
  error?: string;
}

export interface IntuneDevice {
  id: string;
  deviceName: string;
  serialNumber: string;
  operatingSystem: string;
  osVersion: string;
  complianceState: 'compliant' | 'noncompliant' | 'unknown' | 'notApplicable' | 'inGracePeriod' | 'configManager';
  enrolledDateTime: string;
  lastSyncDateTime: string;
  manufacturer: string;
  model: string;
  userDisplayName: string | null;
  userPrincipalName: string | null;
}

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  errors: number;
  details: string[];
}

export const intuneServiceFe = {
  async getStatus(): Promise<IntuneStatus> {
    const { data } = await api.get<IntuneStatus>('/intune/status');
    return data;
  },

  async listDevices(): Promise<{ data: IntuneDevice[]; total: number }> {
    const { data } = await api.get<{ data: IntuneDevice[]; total: number }>('/intune/devices');
    return data;
  },

  async sync(): Promise<SyncResult> {
    const { data } = await api.post<SyncResult>('/intune/sync');
    return data;
  },
};
