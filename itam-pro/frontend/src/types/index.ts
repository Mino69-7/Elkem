// ─── Enums (miroir du schéma Prisma) ─────────────────────────

export type Role = 'MANAGER' | 'TECHNICIAN' | 'VIEWER';

export type DeviceType =
  | 'LAPTOP' | 'DESKTOP' | 'THIN_CLIENT' | 'LAB_WORKSTATION'
  | 'SMARTPHONE' | 'TABLET'
  | 'MONITOR' | 'KEYBOARD' | 'MOUSE' | 'HEADSET'
  | 'DOCKING_STATION' | 'PRINTER' | 'OTHER';

export type DeviceStatus =
  | 'ORDERED' | 'IN_STOCK' | 'ASSIGNED' | 'PENDING_RETURN'
  | 'IN_MAINTENANCE' | 'LOANER' | 'LOST' | 'STOLEN' | 'RETIRED';

export type POStatus = 'PENDING' | 'PARTIAL' | 'COMPLETE' | 'CANCELLED';

export type DeviceCondition = 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export type KeyboardLayout =
  | 'AZERTY_FR' | 'QWERTY_US' | 'QWERTY_UK' | 'QWERTY_NO'
  | 'QWERTY_NL' | 'QWERTZ_DE' | 'QWERTZ_CH' | 'OTHER';

export type AuditAction =
  | 'CREATED' | 'UPDATED' | 'STATUS_CHANGED' | 'ASSIGNED'
  | 'UNASSIGNED' | 'DELETED' | 'INTUNE_SYNCED'
  | 'MAINTENANCE_ADDED' | 'ATTACHMENT_ADDED';

// ─── Modèles ──────────────────────────────────────────────────

export interface User {
  id: string;
  azureId?: string;
  email: string;
  displayName: string;
  role: Role;
  avatar?: string;
  department?: string;
  jobTitle?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  assetTag: string;
  serialNumber: string;
  intuneDeviceId?: string;
  intuneUrl?: string;
  type: DeviceType;
  brand: string;
  model: string;
  processor?: string;
  ram?: string;
  storage?: string;
  screenSize?: string;
  color?: string;
  keyboardLayout: KeyboardLayout;
  keyboardLanguage?: string;
  status: DeviceStatus;
  condition: DeviceCondition;
  location?: string;
  site?: string;
  assignedUserId?: string;
  assignedUser?: User;
  assignedAt?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  lastMaintenanceDate?: string;
  retiredAt?: string;
  purchasePrice?: number;
  supplier?: string;
  invoiceNumber?: string;
  intuneLastSync?: string;
  intuneOsVersion?: string;
  intuneCompliant?: boolean;
  intuneLastSeen?: string;
  intuneEnrolled?: string;
  intuneOsName?: string;
  notes?: string;
  qrCode?: string;
  hostname?: string;
  vlan?: string;
  ipAddress?: string;
  macAddress?: string;
  bitlocker?: string;
  hasDocking?: boolean;
  imei?: string;
  modelId?: string;
  purchaseOrderId?: string;
  purchaseOrder?: PurchaseOrder;
  createdAt: string;
  updatedAt: string;
  auditLogs?: AuditLog[];
  maintenanceLogs?: MaintenanceLog[];
  attachments?: Attachment[];
}

export interface AuditLog {
  id: string;
  deviceId: string;
  userId: string;
  user: User;
  action: AuditAction;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  comment?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface MaintenanceLog {
  id: string;
  deviceId: string;
  type: string;
  description: string;
  cost?: number;
  provider?: string;
  startDate: string;
  endDate?: string;
  resolved: boolean;
  createdAt: string;
}

export interface Attachment {
  id: string;
  deviceId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
  createdAt: string;
}

export interface DeviceModel {
  id:         string;
  name:       string;
  type:       DeviceType;
  brand:      string;
  processor?: string;
  ram?:       string;
  storage?:   string;
  screenSize?: string;
  notes?:     string;
  isActive:   boolean;
  order:      number;
  createdAt:  string;
  updatedAt:  string;
}

export interface StockAlert {
  id: string;
  deviceType: DeviceType;
  threshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  reference: string;
  deviceModelId: string;
  deviceModel: DeviceModel;
  quantity: number;
  receivedCount: number;
  status: POStatus;
  expectedAt?: string;
  notes?: string;
  createdById: string;
  createdBy: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  devices?: Device[];
}

// ─── API response types ───────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

// ─── Filter types ─────────────────────────────────────────────

export interface DeviceFilters {
  search?: string;
  type?: DeviceType;
  types?: string;        // comma-separated list, e.g. 'LAPTOP,DESKTOP,OTHER'
  model?: string;        // exact model name filter
  statuses?: string;     // comma-separated list, e.g. 'ASSIGNED,LOST,STOLEN'
  status?: DeviceStatus;
  location?: string;
  assigned?: boolean;
  excludeStock?: boolean;
  assignedUserId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
