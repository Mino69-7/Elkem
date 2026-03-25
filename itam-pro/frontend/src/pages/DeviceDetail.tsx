import { useState, useMemo, type ElementType } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Pencil, Trash2, UserRound, UserPlus, UserMinus,
  Loader2, AlertTriangle, CheckCircle, XCircle, Clock,
  Laptop, Monitor, Cpu, Tv, Layers, Headphones, Keyboard, Mouse, Smartphone, Tablet,
  Plus, X,
} from 'lucide-react';
import { useDevice, useUpdateDevice, useDeleteDevice, useAssignDevice, useUnassignDevice } from '../hooks/useDevices';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '../services/user.service';
import { useAuthStore } from '../stores/authStore';
import { StatusBadge } from '../components/ui/StatusBadge';
import { AppSelect } from '../components/ui/AppSelect';
import DeviceForm from '../components/devices/DeviceForm';
import { GlassCard } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Skeleton';
import {
  formatDate, formatDateTime, formatPrice,
  DEVICE_TYPE_LABELS, DEVICE_CONDITION_LABELS, KEYBOARD_LAYOUT_LABELS, AUDIT_ACTION_LABELS,
} from '../utils/formatters';
import type { DeviceFormData } from '../services/device.service';
import type { Device, DeviceType, DeviceModel } from '../types';
import api from '../services/api';

// ─── Champ info ───────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-[var(--border-glass)] last:border-0">
      <span className="text-xs text-[var(--text-muted)] flex-shrink-0">{label}</span>
      <span className="text-xs text-[var(--text-secondary)] text-right">{value ?? '—'}</span>
    </div>
  );
}

// ─── Config équipements ───────────────────────────────────────

interface EquipCategory {
  type: DeviceType;
  label: string;
  Icon: ElementType;
  color: string;
  bg: string;
  section: 'workstation' | 'peripheral';
}

const EQUIP_CATEGORIES: EquipCategory[] = [
  { type: 'LAPTOP',          label: 'Ordinateur portable', Icon: Laptop,     color: 'text-blue-400',    bg: 'bg-blue-500/15',    section: 'workstation' },
  { type: 'DESKTOP',         label: 'Ordinateur fixe',     Icon: Cpu,        color: 'text-purple-400',  bg: 'bg-purple-500/15',  section: 'workstation' },
  { type: 'OTHER',           label: 'Client léger',        Icon: Tv,         color: 'text-cyan-400',    bg: 'bg-cyan-500/15',    section: 'workstation' },
  { type: 'MONITOR',         label: 'Écran',               Icon: Monitor,    color: 'text-emerald-400', bg: 'bg-emerald-500/15', section: 'peripheral'  },
  { type: 'DOCKING_STATION', label: "Station d'accueil",   Icon: Layers,     color: 'text-orange-400',  bg: 'bg-orange-500/15',  section: 'peripheral'  },
  { type: 'HEADSET',         label: 'Casque audio',        Icon: Headphones, color: 'text-pink-400',    bg: 'bg-pink-500/15',    section: 'peripheral'  },
  { type: 'KEYBOARD',        label: 'Clavier',             Icon: Keyboard,   color: 'text-yellow-400',  bg: 'bg-yellow-500/15',  section: 'peripheral'  },
  { type: 'MOUSE',           label: 'Souris',              Icon: Mouse,      color: 'text-red-400',     bg: 'bg-red-500/15',     section: 'peripheral'  },
  { type: 'SMARTPHONE',      label: 'Smartphone',          Icon: Smartphone, color: 'text-indigo-400',  bg: 'bg-indigo-500/15',  section: 'peripheral'  },
  { type: 'TABLET',          label: 'Tablette',            Icon: Tablet,     color: 'text-teal-400',    bg: 'bg-teal-500/15',    section: 'peripheral'  },
];

// ─── Mode d'ajout par type ────────────────────────────────────

type AddMode = 'detailed' | 'quantity' | 'instant' | 'toggle';

function getAddMode(type: DeviceType): AddMode {
  if (type === 'DOCKING_STATION') return 'toggle';
  if (type === 'MONITOR')         return 'quantity';
  if (type === 'HEADSET' || type === 'KEYBOARD' || type === 'MOUSE') return 'instant';
  return 'detailed'; // LAPTOP, DESKTOP, OTHER, SMARTPHONE, TABLET
}

// ─── Formulaire ajout rapide ──────────────────────────────────

function QuickAddForm({
  type, assignedUserId, allModels, onSuccess, onCancel,
}: {
  type: DeviceType;
  assignedUserId: string;
  allModels: DeviceModel[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const [sn, setSn]             = useState('');
  const [modelId, setModelId]   = useState('');
  const [qty, setQty]           = useState(1);
  const [qtyLoading, setQtyLoading] = useState(false);

  const models       = allModels.filter((m) => m.type === type && m.isActive);
  const selectedModel = models.find((m) => m.id === modelId);
  const mode         = getAddMode(type);

  const buildPayload = (snVal: string, model?: DeviceModel) => ({
    serialNumber: snVal,
    type,
    brand:   model?.brand ?? '—',
    model:   model?.name  ?? DEVICE_TYPE_LABELS[type],
    status:  'ASSIGNED',
    assignedUserId,
    condition: 'GOOD',
    ...(model ? { processor: model.processor, ram: model.ram, storage: model.storage, screenSize: model.screenSize } : {}),
  });

  const createMut = useMutation({
    mutationFn: (body: object) => api.post('/devices', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-devices', assignedUserId] });
      onSuccess();
    },
  });

  // Mode INSTANT (2+ models) — model chips, click = direct add
  if (mode === 'instant') {
    return (
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-[var(--border-glass)] bg-primary/5">
        <span className="text-xs text-[var(--text-muted)]">Modèle :</span>
        {models.map((m) => (
          <button
            key={m.id}
            onClick={() => createMut.mutate(buildPayload(`PERIPH-${Date.now()}`, m))}
            disabled={createMut.isPending}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border-glass)] text-[var(--text-secondary)] hover:bg-primary/10 hover:border-primary/30 transition-colors disabled:opacity-50"
          >
            {m.name}
          </button>
        ))}
        {createMut.isPending && <Loader2 size={12} className="animate-spin text-[var(--text-muted)]" />}
        <button onClick={onCancel} className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <X size={14} />
        </button>
        {createMut.isError && <p className="w-full text-xs text-red-400">Erreur lors de l'ajout.</p>}
      </div>
    );
  }

  // Mode QUANTITY (Monitor) — quantity picker + optional model
  if (mode === 'quantity') {
    const handleQty = async () => {
      setQtyLoading(true);
      try {
        const model = selectedModel ?? models[0];
        for (let i = 0; i < qty; i++) {
          await api.post('/devices', buildPayload(`MON-${Date.now() + i}`, model));
        }
        qc.invalidateQueries({ queryKey: ['user-devices', assignedUserId] });
        onSuccess();
      } catch {
        setQtyLoading(false);
      }
    };
    return (
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-[var(--border-glass)] bg-primary/5">
        <span className="text-xs text-[var(--text-muted)]">Quantité :</span>
        <div className="flex items-center border border-[var(--border-glass)] rounded-lg overflow-hidden">
          <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors">−</button>
          <span className="px-3 text-xs font-semibold text-[var(--text-primary)] min-w-[1.5rem] text-center">{qty}</span>
          <button onClick={() => setQty(Math.min(8, qty + 1))} className="px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors">+</button>
        </div>
        {models.length > 0 && (
          <AppSelect
            value={modelId}
            onChange={setModelId}
            placeholder="Modèle (optionnel)…"
            className="w-52"
            options={models.map((m) => ({ value: m.id, label: `${m.brand} ${m.name}` }))}
          />
        )}
        <button
          onClick={handleQty}
          disabled={qtyLoading}
          className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50 flex items-center gap-1"
        >
          {qtyLoading ? <Loader2 size={12} className="animate-spin" /> : <><Plus size={12} />Ajouter {qty > 1 ? `×${qty}` : ''}</>}
        </button>
        <button onClick={onCancel} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><X size={14} /></button>
      </div>
    );
  }

  // Mode DETAILED (Laptop/Desktop/Other/Smartphone/Tablet) — SN + model
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-[var(--border-glass)] bg-primary/5">
      <input
        autoFocus
        value={sn}
        onChange={(e) => setSn(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sn.trim() && createMut.mutate(buildPayload(sn.trim(), selectedModel))}
        placeholder="N° de série"
        className="input-glass text-xs px-3 py-1.5 w-44 flex-shrink-0"
      />
      {models.length > 0 && (
        <AppSelect
          value={modelId}
          onChange={setModelId}
          placeholder="Modèle (catalogue)…"
          className="w-52"
          options={models.map((m) => ({ value: m.id, label: `${m.brand} ${m.name}` }))}
        />
      )}
      <button
        onClick={() => createMut.mutate(buildPayload(sn.trim(), selectedModel))}
        disabled={!sn.trim() || createMut.isPending}
        className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50 flex items-center gap-1"
      >
        {createMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <><Plus size={12} />Ajouter</>}
      </button>
      <button onClick={onCancel} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><X size={14} /></button>
      {createMut.isError && <p className="w-full text-xs text-red-400">Erreur lors de l'ajout.</p>}
    </div>
  );
}

// ─── Onglet équipements ───────────────────────────────────────

function TabEquipement({ userId, canEdit, isManager }: { userId: string; canEdit: boolean; isManager?: boolean }) {
  const qc = useQueryClient();
  const [addingType,       setAddingType]       = useState<DeviceType | null>(null);
  const [directAddingType, setDirectAddingType] = useState<DeviceType | null>(null);
  const [editingDevice,    setEditingDevice]    = useState<Device | null>(null);

  const { data: userDevices = [], isLoading } = useQuery<Device[]>({
    queryKey: ['user-devices', userId],
    queryFn:  async () => {
      const r = await api.get(`/devices?assignedUserId=${userId}&limit=100`);
      return r.data.data as Device[];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: allModels = [] } = useQuery<DeviceModel[]>({
    queryKey: ['device-models'],
    queryFn: () => api.get('/devicemodels').then((r) => r.data),
    staleTime: 60_000,
  });

  const devicesByType = useMemo(() => {
    const map: Partial<Record<DeviceType, Device[]>> = {};
    for (const d of userDevices) {
      if (!map[d.type]) map[d.type] = [];
      map[d.type]!.push(d);
    }
    return map;
  }, [userDevices]);

  // Ajout direct sans formulaire (périphériques simples)
  const handleDirectAdd = (type: DeviceType, model?: DeviceModel) => {
    setDirectAddingType(type);
    api.post('/devices', {
      serialNumber: `PERIPH-${type}-${Date.now()}`,
      type,
      brand:  model?.brand ?? '—',
      model:  model?.name  ?? DEVICE_TYPE_LABELS[type],
      status: 'ASSIGNED',
      assignedUserId: userId,
      condition: 'GOOD',
    }).then(() => {
      qc.invalidateQueries({ queryKey: ['user-devices', userId] });
      setDirectAddingType(null);
    }).catch(() => setDirectAddingType(null));
  };

  // Retirer la station d'accueil (désassigner)
  const removeDockingMut = useMutation({
    mutationFn: (deviceId: string) => api.patch(`/devices/${deviceId}/unassign`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-devices', userId] }),
  });

  // Mise à jour d'un équipement depuis l'onglet
  const updateEquipMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => api.put(`/devices/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-devices', userId] });
      setEditingDevice(null);
    },
  });

  const handleAddClick = (cat: EquipCategory) => {
    const mode = getAddMode(cat.type);
    if (mode === 'instant') {
      const typeModels = allModels.filter((m) => m.type === cat.type && m.isActive);
      if (typeModels.length <= 1) {
        handleDirectAdd(cat.type, typeModels[0]);
        return;
      }
    }
    if (mode === 'toggle') {
      handleDirectAdd(cat.type);
      return;
    }
    setAddingType(cat.type);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const renderSection = (title: string, categories: EquipCategory[]) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 px-1">{title}</p>
      <GlassCard padding="none">
        {categories.map((cat, idx) => {
          const devices  = devicesByType[cat.type] ?? [];
          const hasItems = devices.length > 0;
          const isAdding = addingType === cat.type;
          const isDocking = cat.type === 'DOCKING_STATION';
          const isDirectLoading = directAddingType === cat.type;
          const isDuplicate = cat.section === 'workstation' && devices.length > 1;
          const { Icon } = cat;

          return (
            <div key={cat.type} className={idx > 0 ? 'border-t border-[var(--border-glass)]' : ''}>

              {/* ── Ligne catégorie ── */}
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${hasItems ? cat.bg : 'bg-white/5'}`}>
                  <Icon size={14} className={hasItems ? cat.color : 'text-[var(--text-muted)]'} />
                </div>
                <span className={`text-sm font-medium flex-1 ${hasItems ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                  {cat.label}
                </span>

                {/* Badge doublon workstation */}
                {isDuplicate && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 text-[9px] font-semibold">
                    <AlertTriangle size={9} />
                    {devices.length} appareils
                  </span>
                )}

                {isDocking ? (
                  // ── Docking : toggle Oui / Non ──
                  canEdit ? (
                    hasItems ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                        <button
                          onClick={() => devices[0] && removeDockingMut.mutate(devices[0].id)}
                          disabled={removeDockingMut.isPending}
                          className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-50"
                        >
                          {removeDockingMut.isPending ? <Loader2 size={10} className="animate-spin" /> : 'Non'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-muted)]">—</span>
                        <button
                          onClick={() => handleAddClick(cat)}
                          disabled={isDirectLoading}
                          className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-emerald-400 hover:border-emerald-400/30 transition-colors disabled:opacity-50"
                        >
                          {isDirectLoading ? <Loader2 size={10} className="animate-spin" /> : 'Oui'}
                        </button>
                      </div>
                    )
                  ) : (
                    hasItems
                      ? <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                      : <span className="text-xs text-[var(--text-muted)]">—</span>
                  )
                ) : (
                  // ── Normal : checkmark / dash + bouton ajouter ──
                  <>
                    {hasItems
                      ? <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                      : <span className="text-xs text-[var(--text-muted)]">—</span>
                    }
                    {canEdit && !isAdding && (
                      <button
                        onClick={() => handleAddClick(cat)}
                        disabled={isDirectLoading}
                        className="ml-2 flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-primary transition-colors disabled:opacity-50"
                      >
                        {isDirectLoading ? <Loader2 size={10} className="animate-spin" /> : <Plus size={12} />}
                        Ajouter
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* ── Appareils existants ── */}
              {devices.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-2 border-t border-[var(--border-glass)] bg-white/[0.015]">
                  <div className="w-7 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">{d.brand} {d.model}</span>
                    {d.serialNumber && !d.serialNumber.startsWith('PERIPH-') && !d.serialNumber.startsWith('MON-') && (
                      <span className="text-xs text-[var(--text-muted)] ml-2 font-mono">{d.serialNumber}</span>
                    )}
                  </div>
                  <StatusBadge status={d.status} />
                  {canEdit && (
                    <button
                      onClick={() => setEditingDevice(d)}
                      className="ml-1 p-1 rounded-lg text-[var(--text-muted)] hover:text-primary hover:bg-primary/10 transition-colors"
                      aria-label="Modifier"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </div>
              ))}

              {/* ── Formulaire ajout ── */}
              <AnimatePresence>
                {isAdding && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <QuickAddForm
                      type={cat.type}
                      assignedUserId={userId}
                      allModels={allModels}
                      onSuccess={() => setAddingType(null)}
                      onCancel={() => setAddingType(null)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          );
        })}
      </GlassCard>
    </div>
  );

  const workstations = EQUIP_CATEGORIES.filter((c) => c.section === 'workstation');
  const peripherals  = EQUIP_CATEGORIES.filter((c) => c.section === 'peripheral');

  return (
    <div className="space-y-4">
      {renderSection('Poste de travail', workstations)}
      {renderSection('Périphériques', peripherals)}

      {/* Formulaire d'édition d'un équipement */}
      {canEdit && (
        <DeviceForm
          device={editingDevice}
          isOpen={!!editingDevice}
          isSaving={updateEquipMut.isPending}
          isManager={isManager}
          onClose={() => setEditingDevice(null)}
          onSubmit={(data) => editingDevice && updateEquipMut.mutate({ id: editingDevice.id, data })}
        />
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = (location.state as any)?.from ?? '/devices';
  const { user: currentUser } = useAuthStore();
  const canEdit = currentUser?.role === 'MANAGER' || currentUser?.role === 'TECHNICIAN';
  const isManager = currentUser?.role === 'MANAGER';

  const { data: device, isLoading, error } = useDevice(id!);

  const [formOpen,   setFormOpen]   = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [selectedUser, setSelectedUser] = useState('');

  const updateMut   = useUpdateDevice(id!);
  const deleteMut   = useDeleteDevice();
  const assignMut   = useAssignDevice(id!);
  const unassignMut = useUnassignDevice(id!);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.list(),
    enabled: assignOpen,
  });

  const handleUpdate = async (data: DeviceFormData) => {
    await updateMut.mutateAsync(data);
    setFormOpen(false);
  };

  const handleDelete = async () => {
    await deleteMut.mutateAsync(id!);
    navigate(backTo);
  };

  const handleAssign = async () => {
    if (!selectedUser) return;
    await assignMut.mutateAsync(selectedUser);
    setAssignOpen(false);
    setSelectedUser('');
  };

  const handleUnassign = async () => {
    await unassignMut.mutateAsync();
  };

  // ─── États ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2"><Skeleton className="h-64 rounded-2xl" /></div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="p-6 flex flex-col items-center gap-4 pt-16">
        <AlertTriangle size={40} className="text-red-400" />
        <p className="text-[var(--text-secondary)]">Appareil introuvable</p>
        <button onClick={() => navigate(backTo)} className="btn-secondary px-4 py-2 text-sm">Retour à la liste</button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">

      {/* ─── Navigation & titre ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(backTo)} className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors" aria-label="Retour">
            <ArrowLeft size={16} />
          </button>
          {backTo === '/devices' && device.assignedUser ? (
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">{device.assignedUser.displayName}</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-sm text-[var(--text-muted)]">{device.brand} {device.model}</span>
                <StatusBadge status={device.status} />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-[var(--text-primary)]">{device.brand} {device.model}</h1>
                <StatusBadge status={device.status} />
              </div>
              <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{device.assetTag} · {device.serialNumber}</p>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="sm:ml-auto flex items-center gap-2">
            {device.assignedUser ? (
              <button
                onClick={handleUnassign}
                disabled={unassignMut.isPending}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-amber-400 hover:border-amber-400/30 transition-colors"
              >
                {unassignMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
                Désassigner
              </button>
            ) : (
              <button
                onClick={() => setAssignOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-primary hover:border-primary/30 transition-colors"
              >
                <UserPlus size={14} />
                Assigner
              </button>
            )}
            <button onClick={() => setFormOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm btn-secondary">
              <Pencil size={14} />
              Modifier
            </button>
            {isManager && (
              <button onClick={() => setDeleting(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Onglets ─────────────────────────────────────────── */}
      <Tabs.Root defaultValue="info">
        <Tabs.List className="flex gap-1 p-1 rounded-xl border border-[var(--border-glass)] w-fit" style={{ background: 'var(--bg-secondary)' }}>
          {[
            { value: 'info',        label: 'Informations' },
            ...(device.assignedUser ? [{ value: 'equipment', label: 'Équipement' }] : []),
            { value: 'maintenance', label: `Maintenance (${device.maintenanceLogs?.length ?? 0})` },
            { value: 'audit',       label: `Historique (${device.auditLogs?.length ?? 0})` },
          ].map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors text-[var(--text-muted)] data-[state=active]:bg-primary/15 data-[state=active]:text-primary"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* ── Informations ── */}
        <Tabs.Content value="info" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Matériel */}
            <GlassCard padding="md" animate index={0}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Matériel</h3>
              {device.purchaseOrder?.reference ? (
                <div className="flex justify-between items-center gap-4 py-2 border-b border-[var(--border-glass)]">
                  <span className="text-xs text-[var(--text-muted)] flex-shrink-0">N° commande</span>
                  <span className="text-xs font-mono font-semibold text-primary">{device.purchaseOrder.reference}</span>
                </div>
              ) : (
                <div className="flex justify-between items-center gap-4 py-2 border-b border-[var(--border-glass)]">
                  <span className="text-xs text-[var(--text-muted)] flex-shrink-0">N° commande</span>
                  <span className="text-xs text-amber-400 flex items-center gap-1">⚠ Non lié à une commande</span>
                </div>
              )}
              <InfoRow label="Type"       value={DEVICE_TYPE_LABELS[device.type]} />
              <InfoRow label="Marque"     value={device.brand} />
              <InfoRow label="Modèle"     value={device.model} />
              <InfoRow label="Processeur" value={device.processor} />
              <InfoRow label="RAM"        value={device.ram} />
              <InfoRow label="Stockage"   value={device.storage} />
              <InfoRow label="Écran"      value={device.screenSize} />
              <InfoRow label="Couleur"    value={device.color} />
              <InfoRow label="Clavier"    value={device.keyboardLayout ? KEYBOARD_LAYOUT_LABELS[device.keyboardLayout] : undefined} />
            </GlassCard>

            {/* Statut & localisation */}
            <GlassCard padding="md" animate index={1}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Statut</h3>
              <div className="mb-3"><StatusBadge status={device.status} /></div>
              <InfoRow label="État"         value={device.condition ? DEVICE_CONDITION_LABELS[device.condition] : undefined} />
              <InfoRow label="Localisation" value={device.location} />
              <InfoRow label="Site"         value={device.site} />

              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mt-4 mb-3">Affectation</h3>
              {device.assignedUser ? (
                <div className="flex items-center gap-3 py-2">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {device.assignedUser.displayName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{device.assignedUser.displayName}</p>
                    <p className="text-xs text-[var(--text-muted)]">{device.assignedUser.email}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 py-2 text-[var(--text-muted)]">
                  <UserRound size={16} />
                  <span className="text-sm">Non assigné</span>
                </div>
              )}
              <InfoRow label="Depuis" value={device.assignedAt ? formatDate(device.assignedAt) : undefined} />
            </GlassCard>

            {/* Cycle de vie */}
            <GlassCard padding="md" animate index={2}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Cycle de vie</h3>
              <InfoRow label="Achat"        value={formatDate(device.purchaseDate)} />
              <InfoRow label="Garantie"     value={formatDate(device.warrantyExpiry)} />
              <InfoRow label="Prix d'achat" value={formatPrice(device.purchasePrice)} />
              <InfoRow label="Fournisseur"  value={device.supplier} />
              <InfoRow label="N° commande"  value={device.purchaseOrder?.reference} />
              <InfoRow label="N° facture"   value={device.invoiceNumber} />
              <InfoRow label="Créé le"      value={formatDate(device.createdAt)} />
              <InfoRow label="Modifié le"   value={formatDate(device.updatedAt)} />
              {device.notes && (
                <>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mt-4 mb-2">Notes</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{device.notes}</p>
                </>
              )}
            </GlassCard>
          </div>
        </Tabs.Content>

        {/* ── Équipement ── */}
        {device.assignedUser && (
          <Tabs.Content value="equipment" className="mt-4">
            <TabEquipement userId={device.assignedUser.id} canEdit={canEdit} isManager={isManager} />
          </Tabs.Content>
        )}

        {/* ── Maintenance ── */}
        <Tabs.Content value="maintenance" className="mt-4">
          <GlassCard padding="none">
            {!device.maintenanceLogs?.length ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-muted)]">
                <CheckCircle size={36} className="opacity-30" />
                <p className="text-sm">Aucune maintenance enregistrée</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-glass)]">
                {device.maintenanceLogs.map((log, i) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex gap-4 p-4"
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${log.resolved ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                      {log.resolved ? <CheckCircle size={16} /> : <Clock size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{log.type}</span>
                        {log.provider && <span className="text-xs text-[var(--text-muted)]">· {log.provider}</span>}
                        {log.cost && <span className="text-xs text-[var(--text-muted)]">· {formatPrice(log.cost)}</span>}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">{log.description}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {formatDate(log.startDate)}{log.endDate ? ` → ${formatDate(log.endDate)}` : ''}
                      </p>
                    </div>
                    {!log.resolved && <XCircle size={14} className="text-amber-400 flex-shrink-0 mt-1" />}
                  </motion.div>
                ))}
              </div>
            )}
          </GlassCard>
        </Tabs.Content>

        {/* ── Historique d'audit ── */}
        <Tabs.Content value="audit" className="mt-4">
          <GlassCard padding="none">
            {!device.auditLogs?.length ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-muted)]">
                <Clock size={36} className="opacity-30" />
                <p className="text-sm">Aucun historique</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-glass)]">
                {device.auditLogs.map((log, i) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex gap-3 px-4 py-3"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-[var(--text-primary)]">
                          {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">par {log.user?.displayName ?? '—'}</span>
                      </div>
                      {(log.comment || (log.oldValue && log.newValue)) && (
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          {log.comment ?? `${log.oldValue} → ${log.newValue}`}
                        </p>
                      )}
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{formatDateTime(log.createdAt)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </GlassCard>
        </Tabs.Content>

      </Tabs.Root>

      {/* ─── Formulaire d'édition ────────────────────────────── */}
      {canEdit && (
        <DeviceForm
          device={device}
          isOpen={formOpen}
          isSaving={updateMut.isPending}
          isManager={isManager}
          onClose={() => setFormOpen(false)}
          onSubmit={handleUpdate}
        />
      )}

      {/* ─── Modal assignation ───────────────────────────────── */}
      {assignOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            onClick={() => setAssignOpen(false)}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          >
            <div className="glass-card p-6 max-w-sm w-full space-y-4 pointer-events-auto">
              <h3 className="font-semibold text-[var(--text-primary)]">Assigner à un utilisateur</h3>
              <AppSelect
                value={selectedUser}
                onChange={setSelectedUser}
                placeholder="Sélectionner un utilisateur…"
                className="w-full"
                options={users.map((u) => ({ value: u.id, label: `${u.displayName} — ${u.email}` }))}
              />
              <div className="flex gap-3">
                <button onClick={() => setAssignOpen(false)} className="btn-secondary flex-1 py-2 text-sm">
                  Annuler
                </button>
                <button
                  onClick={handleAssign}
                  disabled={!selectedUser || assignMut.isPending}
                  className="btn-primary flex-1 py-2 text-sm disabled:opacity-50"
                >
                  {assignMut.isPending ? 'En cours…' : 'Assigner'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* ─── Confirmation suppression ────────────────────────── */}
      {deleting && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setDeleting(false)} />
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="glass-card p-6 max-w-sm w-full space-y-4 pointer-events-auto">
              <h3 className="font-semibold text-[var(--text-primary)]">Supprimer {device.assetTag} ?</h3>
              <p className="text-sm text-[var(--text-muted)]">Action irréversible. Tout l'historique sera supprimé.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleting(false)} className="btn-secondary flex-1 py-2 text-sm">Annuler</button>
                <button onClick={handleDelete} disabled={deleteMut.isPending} className="flex-1 py-2 text-sm rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors font-medium disabled:opacity-50">
                  {deleteMut.isPending ? 'Suppression…' : 'Supprimer'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
