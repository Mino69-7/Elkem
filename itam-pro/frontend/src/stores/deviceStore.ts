import { create } from 'zustand';
import type { DeviceFilters } from '../types';

interface DeviceStore {
  filters: DeviceFilters;
  selectedIds: string[];
  viewMode: 'table' | 'grid';
  setFilters: (filters: Partial<DeviceFilters>) => void;
  resetFilters: () => void;
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setViewMode: (mode: 'table' | 'grid') => void;
}

const defaultFilters: DeviceFilters = {
  page: 1,
  limit: 25,
  sortBy: 'updatedAt',
  sortOrder: 'desc',
};

export const useDeviceStore = create<DeviceStore>()((set) => ({
  filters: defaultFilters,
  selectedIds: [],
  viewMode: 'table',

  setFilters: (filters) =>
    set((s) => ({ filters: { ...s.filters, ...filters, page: filters.page ?? 1 } })),

  resetFilters: () => set({ filters: defaultFilters }),

  toggleSelection: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((i) => i !== id)
        : [...s.selectedIds, id],
    })),

  selectAll: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),
  setViewMode: (viewMode) => set({ viewMode }),
}));
