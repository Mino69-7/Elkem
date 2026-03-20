import api from './api';
import type { User } from '../types';

export interface UserWithCount extends User {
  _count: { assignedDevices: number };
}

export const userService = {
  async list(params: { search?: string; role?: string } = {}): Promise<UserWithCount[]> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.role)   query.set('role', params.role);
    const { data } = await api.get<UserWithCount[]>(`/users?${query.toString()}`);
    return data;
  },

  async get(id: string): Promise<User & { assignedDevices: unknown[] }> {
    const { data } = await api.get(`/users/${id}`);
    return data;
  },
};
