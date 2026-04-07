import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deviceService, type DeviceFormData } from '../services/device.service';
import { useDeviceStore } from '../stores/deviceStore';

// ─── Liste paginée ────────────────────────────────────────────

export function useDevices(extraFilters?: Partial<import('../types').DeviceFilters>) {
  const filters = useDeviceStore((s) => s.filters);
  const merged  = extraFilters ? { ...filters, ...extraFilters } : filters;
  return useQuery({
    queryKey: ['devices', merged],
    queryFn:  () => deviceService.list(merged),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

// ─── Détail ───────────────────────────────────────────────────

export function useDevice(id: string) {
  return useQuery({
    queryKey: ['device', id],
    queryFn:  () => deviceService.get(id),
    enabled:  !!id,
  });
}

// ─── Mutations ────────────────────────────────────────────────

export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DeviceFormData) => deviceService.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['devices'] }),
  });
}

export function useUpdateDevice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<DeviceFormData>) => deviceService.update(id, data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['device', id] });
      qc.invalidateQueries({ queryKey: ['stock-summary'] });
      qc.invalidateQueries({ queryKey: ['stock-devices'] });
      qc.invalidateQueries({ queryKey: ['stockalerts'] });
      qc.invalidateQueries({ queryKey: ['maintenance-devices'] });
      qc.invalidateQueries({ queryKey: ['retired-devices'] });
    },
  });
}

export function useDeleteDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => deviceService.retire(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['device', id] });
      qc.invalidateQueries({ queryKey: ['stock-summary'] });
      qc.invalidateQueries({ queryKey: ['stock-devices'] });
      qc.invalidateQueries({ queryKey: ['stockalerts'] });
      qc.invalidateQueries({ queryKey: ['retired-devices'] });
      qc.invalidateQueries({ queryKey: ['maintenance-devices'] });
    },
  });
}

export function useAssignDevice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => deviceService.assign(id, userId),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['device', id] });
      qc.invalidateQueries({ queryKey: ['stock-summary'] });
      qc.invalidateQueries({ queryKey: ['stock-devices'] });
      qc.invalidateQueries({ queryKey: ['stockalerts'] });
      qc.invalidateQueries({ queryKey: ['maintenance-devices'] });
      qc.invalidateQueries({ queryKey: ['retired-devices'] });
    },
  });
}

export function useUnassignDevice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deviceService.unassign(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['device', id] });
      qc.invalidateQueries({ queryKey: ['stock-summary'] });
      qc.invalidateQueries({ queryKey: ['stock-devices'] });
      qc.invalidateQueries({ queryKey: ['stockalerts'] });
      qc.invalidateQueries({ queryKey: ['maintenance-devices'] });
      qc.invalidateQueries({ queryKey: ['retired-devices'] });
    },
  });
}
