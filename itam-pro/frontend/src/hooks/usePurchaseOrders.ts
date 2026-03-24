import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrderService, type POFormData, type ReceiveDeviceData } from '../services/purchaseOrder.service';

export function usePurchaseOrders() {
  return useQuery({ queryKey: ['orders'], queryFn: purchaseOrderService.list });
}

export function useOrderHistory() {
  return useQuery({ queryKey: ['orders-history'], queryFn: purchaseOrderService.history, staleTime: 30_000 });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: POFormData) => purchaseOrderService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useUpdateOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<POFormData>) => purchaseOrderService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseOrderService.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useReceiveDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: ReceiveDeviceData }) =>
      purchaseOrderService.receive(orderId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}
