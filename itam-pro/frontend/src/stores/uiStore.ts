import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
}

interface UIStore {
  // Thème
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;

  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Notifications système (legacy)
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notif: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;

  // Alertes stock vues — persistées pour "pastille disparaît après consultation"
  viewedInventaireAlerts: Record<string, number>; // { [deviceType]: stockWhenViewed }
  viewedMaintenanceDevices: string[];             // device IDs vus en maintenance
  viewedDechetsDevices: string[];                 // device IDs vus en déchets
  markInventaireAlertViewed: (deviceType: string, currentStock: number) => void;
  markMaintenanceDeviceViewed: (deviceId: string) => void;
  markDechetsDeviceViewed: (deviceId: string) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // ─── Thème ────────────────────────────────────────────
      theme: 'dark',
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setTheme: (theme) => set({ theme }),

      // ─── Sidebar ──────────────────────────────────────────
      sidebarOpen: false,
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleSidebarCollapse: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // ─── Notifications ────────────────────────────────────
      notifications: [],
      unreadCount: 0,
      addNotification: (notif) => {
        const newNotif: Notification = {
          ...notif,
          id: crypto.randomUUID(),
          read: false,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          notifications: [newNotif, ...s.notifications].slice(0, 50),
          unreadCount: s.unreadCount + 1,
        }));
      },
      markAsRead: (id) => {
        const notifs = get().notifications;
        const updated = notifs.map((n) => n.id === id ? { ...n, read: true } : n);
        set({ notifications: updated, unreadCount: updated.filter((n) => !n.read).length });
      },
      markAllAsRead: () => {
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },
      clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

      // ─── Alertes stock vues ───────────────────────────────
      viewedInventaireAlerts: {},
      viewedMaintenanceDevices: [],
      viewedDechetsDevices: [],
      markInventaireAlertViewed: (deviceType, currentStock) =>
        set((s) => ({
          viewedInventaireAlerts: { ...s.viewedInventaireAlerts, [deviceType]: currentStock },
        })),
      markMaintenanceDeviceViewed: (deviceId) =>
        set((s) => ({
          viewedMaintenanceDevices: s.viewedMaintenanceDevices.includes(deviceId)
            ? s.viewedMaintenanceDevices
            : [...s.viewedMaintenanceDevices.slice(-199), deviceId],
        })),
      markDechetsDeviceViewed: (deviceId) =>
        set((s) => ({
          viewedDechetsDevices: s.viewedDechetsDevices.includes(deviceId)
            ? s.viewedDechetsDevices
            : [...s.viewedDechetsDevices.slice(-199), deviceId],
        })),
    }),
    {
      name: 'itam-ui-store',
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        viewedInventaireAlerts: s.viewedInventaireAlerts,
        viewedMaintenanceDevices: s.viewedMaintenanceDevices,
        viewedDechetsDevices: s.viewedDechetsDevices,
      }),
    }
  )
);
