import api from './api';
import type { PurchaseOrder } from '../types';

export interface POFormData {
  reference: string;
  deviceModelId: string;
  quantity: number;
  expectedAt?: string;
  notes?: string;
}

export interface ReceiveDeviceData {
  serialNumber: string;
  notes?: string;
}

export const purchaseOrderService = {
  list:    ()                       => api.get<PurchaseOrder[]>('/orders').then(r => r.data),
  history: ()                       => api.get<PurchaseOrder[]>('/orders/history').then(r => r.data),
  create:  (data: POFormData)       => api.post<PurchaseOrder>('/orders', data).then(r => r.data),
  update:  (id: string, data: Partial<POFormData>) => api.put<PurchaseOrder>(`/orders/${id}`, data).then(r => r.data),
  cancel:  (id: string)             => api.delete<PurchaseOrder>(`/orders/${id}`).then(r => r.data),
  receive: (orderId: string, data: ReceiveDeviceData) => api.post(`/orders/${orderId}/receive`, data).then(r => r.data),
};
