import { useState, useMemo, type ElementType } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Pencil, Trash2, UserRound, UserPlus, UserMinus,
  Loader2, AlertTriangle, CheckCircle, XCircle, Clock,
  Laptop, Monitor, Cpu, Tv, Layers, Headphones, Keyboard, Smartphone, Tablet, Server,
  Plus, X,
} from 'lucide-react';
import { useDevice, useUpdateDevice, useDeleteDevice, useAssignDevice } from '../hooks/useDevices';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCombobox } from '../components/ui/UserCombobox';
import { useAuthStore } from '../stores/authStore';
import { StatusBadge } from '../components/ui/StatusBadge';
import { AppSelect } from '../components/ui/AppSelect';
import DeviceForm from '../components/devices/DeviceForm';
import { GlassCard } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Skeleton';
import {
  formatDate, formatDateTime, formatPrice,
  DEVICE_TYPE_LABELS, KEYBOARD_LAYOUT_LABELS, AUDIT_ACTION_LABELS, ELKEM_SITES,
} from '../utils/formatters';

const SITE_OPTIONS = ELKEM_SITES.map((s) => ({ value: s.code, label: s.label }));
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
  { type: 'LAPTOP',          label: 'PC Portable',         Icon: Laptop,     color: 'text-blue-400',    bg: 'bg-blue-500/15',    section: 'workstation' },
  { type: 'DESKTOP',         label: 'PC Fixe',             Icon: Cpu,        color: 'text-purple-400',  bg: 'bg-purple-500/15',  section: 'workstation' },
  { type: 'THIN_CLIENT',     label: 'PC Client léger',     Icon: Tv,         color: 'text-cyan-400',    bg: 'bg-cyan-500/15',    section: 'workstation' },
  { type: 'LAB_WORKSTATION', label: 'PC Labo / Indus',     Icon: Server,     color: 'text-violet-400',  bg: 'bg-violet-500/15',  section: 'workstation' },
  // Smartphones/tablettes en tête des périphériques
  { type: 'SMARTPHONE',      label: 'Smartphone',          Icon: Smartphone, color: 'text-indigo-400',  bg: 'bg-indigo-500/15',  section: 'peripheral'  },
  { type: 'TABLET',          label: 'Tablette',            Icon: Tablet,     color: 'text-teal-400',    bg: 'bg-teal-500/15',    section: 'peripheral'  },
  { type: 'MONITOR',         label: 'Écran',               Icon: Monitor,    color: 'text-emerald-400', bg: 'bg-emerald-500/15', section: 'peripheral'  },
  { type: 'DOCKING_STATION', label: "Station d'accueil",   Icon: Layers,     color: 'text-orange-400',  bg: 'bg-orange-500/15',  section: 'peripheral'  },
  { type: 'HEADSET',         label: 'Casque audio',        Icon: Headphones, color: 'text-pink-400',    bg: 'bg-pink-500/15',    section: 'peripheral'  },
  // KEYBOARD = "Clavier / Souris" — affiche aussi les MOUSE dans la même ligne
  { type: 'KEYBOARD',        label: 'Clavier / Souris',    Icon: Keyboard,   color: 'text-yellow-400',  bg: 'bg-yellow-500/15',  section: 'peripheral'  },
];

// Types workstation (affichage enrichi dans les items)
const WORKSTATION_TYPES: DeviceType[] = ['LAPTOP', 'DESKTOP', 'THIN_CLIENT', 'LAB_WORKSTATION'];

// Types téléphoniques (modal spécifique avec recherche pool)
const PHONE_CAT_TYPES: DeviceType[] = ['SMARTPHONE', 'TABLET'];

// ─── Toggle switch iPhone style ───────────────────────────────

function ToggleSwitch({
  on, onClick, loading = false, disabled = false,
}: {
  on: boolean;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-pressed={on}
      className="relative inline-flex items-center w-[44px] h-[26px] rounded-full flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        background: on
          ? 'linear-gradient(135deg, rgba(16,185,129,0.90), rgba(5,150,105,0.80))'
          : 'rgba(255,255,255,0.08)',
        border: on ? '1px solid rgba(16,185,129,0.45)' : '1px solid rgba(255,255,255,0.12)',
        boxShadow: on
          ? '0 2px 10px rgba(16,185,129,0.28), inset 0 1px 0 rgba(255,255,255,0.15)'
          : 'inset 0 1px 3px rgba(0,0,0,0.20)',
        transition: 'background 0.25s, border-color 0.25s, box-shadow 0.25s',
      }}
    >
      {loading ? (
        <Loader2 size={12} className="mx-auto animate-spin text-white/70" />
      ) : (
        <motion.div
          className="absolute w-[20px] h-[20px] rounded-full"
          style={{
            background: on ? 'white' : 'rgba(255,255,255,0.58)',
            boxShadow: on
              ? '0 2px 6px rgba(0,0,0,0.26), 0 1px 2px rgba(0,0,0,0.16)'
              : '0 1px 3px rgba(0,0,0,0.18)',
          }}
          animate={{ x: on ? 21 : 3 }}
          transition={{ type: 'spring', stiffness: 560, damping: 32, mass: 0.55 }}
        />
      )}
    </button>
  );
}

// ─── (QuickAddForm supprimé — ajout via toggle uniquement) ──────

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
  const [sn,        setSn]        = useState('');
  const [assetTag,  setAssetTag]  = useState('');
  const [hostname,  setHostname]  = useState('');
  const [modelId,   setModelId]   = useState('');
  const [qty,       setQty]       = useState(1);
  const [docking,   setDocking]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [ticketRef, setTicketRef] = useState('IT-');

  const models        = allModels.filter((m) => m.type === type && m.isActive);
  const selectedModel = models.find((m) => m.id === modelId);
  const isWorkstation = WORKSTATION_TYPES.includes(type);
  const isLab         = type === 'LAB_WORKSTATION';
  const isMonitor     = type === 'MONITOR';
  const ticketRequired = type !== 'KEYBOARD' && type !== 'MOUSE';

  // Payload de base pour un device assigné
  const basePayload = (snVal: string, model?: DeviceModel) => ({
    serialNumber:   snVal,
    type,
    brand:          model?.brand ?? '—',
    model:          model?.name  ?? DEVICE_TYPE_LABELS[type],
    modelId:        model?.id,
    status:         'ASSIGNED',
    assignedUserId,
    condition:      'GOOD',
    ...(model ? { processor: model.processor, ram: model.ram, storage: model.storage, screenSize: model.screenSize } : {}),
    ...(ticketRef.trim().length > 3 ? { assetTag: ticketRef.trim().toUpperCase() } : {}),
  });

  const createMut = useMutation({
    mutationFn: (body: object) => api.post('/devices', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-devices', assignedUserId] });
    },
  });

  // ── Mode WORKSTATION (LAPTOP / DESKTOP / THIN_CLIENT / LAB / OTHER) ──
  if (isWorkstation) {
    const canSubmit = sn.trim() && assetTag.trim();
    const handleAdd = () => {
      if (!canSubmit) return;
      createMut.mutate({
        ...basePayload(sn.trim(), selectedModel),
        assetTag: assetTag.trim().toUpperCase(),
        ...(isLab && hostname.trim() ? { hostname: hostname.trim() } : {}),
      }, { onSuccess });
    };
    return (
      <div className="px-4 py-3 border-t border-[var(--border-glass)] bg-primary/5 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <input
            autoFocus
            value={sn}
            onChange={(e) => setSn(e.target.value)}
            placeholder="N° de série *"
            className="input-glass text-xs px-3 py-1.5"
          />
          <input
            value={assetTag}
            onChange={(e) => setAssetTag(e.target.value.toUpperCase())}
            placeholder="Tag actif (IT-xxxxx) *"
            className="input-glass text-xs px-3 py-1.5 uppercase"
          />
          <AppSelect
            value={modelId}
            onChange={setModelId}
            placeholder="Modèle du catalogue…"
            className="col-span-2"
            options={models.map((m) => ({ value: m.id, label: `${m.brand} ${m.name}` }))}
          />
          {isLab && (
            <input
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="Hostname (optionnel)"
              className="input-glass text-xs px-3 py-1.5 col-span-2"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAdd}
            disabled={!canSubmit || createMut.isPending}
            className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50 flex items-center gap-1"
          >
            {createMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <><Plus size={12} />Ajouter</>}
          </button>
          <button onClick={onCancel} className="btn-secondary px-3 py-1.5 text-xs">Annuler</button>
          {createMut.isError && <p className="text-xs text-red-400">Erreur lors de l'ajout.</p>}
        </div>
      </div>
    );
  }

  // ── Mode MONITOR — quantité + modèle + docking intégrée ──
  if (isMonitor) {
    const handleAdd = async () => {
      setLoading(true);
      try {
        const model = selectedModel ?? models[0];
        for (let i = 0; i < qty; i++) {
          await api.post('/devices', {
            ...basePayload(`MON-${Date.now() + i}`, model),
            hasDocking: docking,
          });
        }
        qc.invalidateQueries({ queryKey: ['user-devices', assignedUserId] });
        onSuccess();
      } finally {
        setLoading(false);
      }
    };
    return (
      <div className="px-4 py-3 border-t border-[var(--border-glass)] bg-primary/5 space-y-2.5">
        <input
          autoFocus
          value={ticketRef}
          onChange={(e) => setTicketRef(e.target.value.toUpperCase())}
          placeholder="N° ticket (IT-XXXXX) *"
          className="input-glass text-xs px-3 py-1.5 w-full uppercase"
        />
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quantité */}
          <div className="flex items-center border border-[var(--border-glass)] rounded-lg overflow-hidden">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors">−</button>
            <span className="px-3 text-xs font-semibold text-[var(--text-primary)] min-w-[2rem] text-center">{qty}</span>
            <button onClick={() => setQty(Math.min(8, qty + 1))} className="px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors">+</button>
          </div>
          {/* Modèle */}
          {models.length > 0 && (
            <AppSelect
              value={modelId}
              onChange={setModelId}
              placeholder="Modèle (optionnel)…"
              className="w-52"
              options={models.map((m) => ({ value: m.id, label: `${m.brand} ${m.name}` }))}
            />
          )}
          {/* Docking intégrée */}
          <button
            type="button"
            onClick={() => setDocking(!docking)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              docking
                ? 'border-orange-500/40 bg-orange-500/10 text-orange-400'
                : 'border-[var(--border-glass)] text-[var(--text-muted)] hover:bg-white/5'
            }`}
          >
            <Layers size={12} />
            Docking intégrée
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAdd}
            disabled={loading || ticketRef.trim().length <= 3}
            className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50 flex items-center gap-1"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <><Plus size={12} />Ajouter {qty > 1 ? `×${qty}` : ''}</>}
          </button>
          <button onClick={onCancel} className="btn-secondary px-3 py-1.5 text-xs">Annuler</button>
        </div>
      </div>
    );
  }

  // ── Mode SIMPLE (Casque, Clavier / Souris, Station d'accueil) ──
  const canSubmitSimple = !ticketRequired || ticketRef.trim().length > 3;
  const handleAddSimple = () => {
    createMut.mutate(basePayload(`PERIPH-${Date.now()}`, selectedModel ?? models[0]), { onSuccess });
  };

  return (
    <div className="px-4 py-3 border-t border-[var(--border-glass)] bg-primary/5 space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <input
          autoFocus
          value={ticketRef}
          onChange={(e) => setTicketRef(e.target.value.toUpperCase())}
          placeholder={ticketRequired ? 'N° ticket (IT-XXXXX) *' : 'N° ticket (optionnel)'}
          className="input-glass text-xs px-3 py-1.5 uppercase"
        />
        {models.length > 0 && (
          <AppSelect
            value={modelId}
            onChange={setModelId}
            placeholder="Modèle (optionnel)…"
            options={models.map((m) => ({ value: m.id, label: `${m.brand} ${m.name}` }))}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleAddSimple}
          disabled={!canSubmitSimple || createMut.isPending}
          className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50 flex items-center gap-1"
        >
          {createMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <><Plus size={12} />Ajouter</>}
        </button>
        <button onClick={onCancel} className="btn-secondary px-3 py-1.5 text-xs">Annuler</button>
        {createMut.isError && <p className="text-xs text-red-400">Erreur lors de l'ajout.</p>}
      </div>
    </div>
  );
}

// ─── Modal Smartphone / Tablette ─────────────────────────────

function PhoneModal({
  type, userId, device, onClose,
}: {
  type: DeviceType;
  userId: string;
  device: Device | null;
  onClose: () => void;
}) {
  const qc       = useQueryClient();
  const isEdit   = !!device;
  const typeLabel = type === 'SMARTPHONE' ? 'Smartphone' : 'Tablette';

  // ─ Mode affectation : recherche dans le pool IN_STOCK ──
  const [search,       setSearch]       = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected,     setSelected]     = useState<Device | null>(null);

  // ─ Mode édition ────────────────────────────────────────
  const [imei,      setImei]      = useState(device?.imei ?? '');
  const [sn,        setSn]        = useState(device?.serialNumber ?? '');
  const [ticketRef, setTicketRef] = useState(device?.assetTag ?? 'IT-');

  const { data: pool = [], isFetching } = useQuery<Device[]>({
    queryKey: ['phone-pool', type, search],
    queryFn:  async () => {
      const r = await api.get(`/devices?type=${type}&status=IN_STOCK&search=${encodeURIComponent(search)}&limit=15`);
      return r.data.data as Device[];
    },
    enabled: !isEdit && search.length >= 2,
    staleTime: 0,
  });

  const assignMut = useMutation({
    mutationFn: (phoneId: string) => api.patch(`/devices/${phoneId}/assign`, {
      userId,
      ...(ticketRef.trim().length > 3 ? { assetTag: ticketRef.trim().toUpperCase() } : {}),
    }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['user-devices', userId] });
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['stock-summary'] });
      qc.invalidateQueries({ queryKey: ['stock-devices'] });
      qc.invalidateQueries({ queryKey: ['stockalerts'] });
      qc.invalidateQueries({ queryKey: ['maintenance-devices'] });
      onClose();
    },
  });

  const updateMut = useMutation({
    mutationFn: () => api.put(`/devices/${device!.id}`, {
      imei: imei.trim() || undefined,
      serialNumber: sn.trim() || undefined,
      ...(ticketRef.trim().length > 3 ? { assetTag: ticketRef.trim().toUpperCase() } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-devices', userId] });
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['device', device!.id] });
      onClose();
    },
  });

  const canSubmit = isEdit
    ? ticketRef.trim().length > 3 && !updateMut.isPending
    : !!selected && ticketRef.trim().length > 3 && !assignMut.isPending;

  return (
    <AnimatePresence>
      <>
        <motion.div
          className="fixed inset-0 z-50 bg-black/60"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-md flex flex-col rounded-2xl shadow-2xl pointer-events-auto overflow-hidden"
            style={{ background: 'var(--surface-primary)', backdropFilter: 'blur(var(--glass-blur-heavy)) saturate(var(--glass-saturation))', WebkitBackdropFilter: 'blur(var(--glass-blur-heavy)) saturate(var(--glass-saturation))', border: '1px solid var(--glass-border)', maxHeight: '90vh' }}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 38 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-glass)] flex-shrink-0">
              <h2 className="font-semibold text-[var(--text-primary)]">
                {isEdit ? `Modifier — ${device.brand} ${device.model}` : `Affecter un ${typeLabel}`}
              </h2>
              <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Corps */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {isEdit ? (
                /* ── Mode édition ── */
                <>
                  <div className="rounded-xl border border-[var(--border-glass)] bg-white/[0.02] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">Modèle</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{device.brand} {device.model}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">N° de série</label>
                    <input
                      value={sn}
                      onChange={(e) => setSn(e.target.value)}
                      placeholder="Ex : F3KXXXXXX"
                      className="input-glass py-2 text-sm w-full font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">IMEI</label>
                    <input
                      value={imei}
                      onChange={(e) => setImei(e.target.value.replace(/\D/g, '').slice(0, 15))}
                      placeholder="15 chiffres"
                      className="input-glass py-2 text-sm w-full font-mono tracking-widest"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">N° ticket <span className="text-red-400">*</span></label>
                    <input
                      value={ticketRef}
                      onChange={(e) => setTicketRef(e.target.value.toUpperCase())}
                      placeholder="IT-XXXXX"
                      className="input-glass py-2 text-sm w-full font-mono uppercase"
                    />
                  </div>
                </>
              ) : (
                /* ── Mode affectation (pool) ── */
                <>
                  {!selected ? (
                    <>
                      <p className="text-xs text-[var(--text-muted)]">
                        Sélectionnez un {typeLabel.toLowerCase()} disponible dans le stock.
                        Saisissez le SN ou l'IMEI pour filtrer.
                      </p>
                      <div className="relative">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-[var(--text-secondary)]">Rechercher par SN ou IMEI</label>
                          <input
                            autoFocus
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
                            onFocus={() => setShowDropdown(true)}
                            placeholder="Saisir au moins 2 caractères…"
                            className="input-glass py-2 text-sm w-full font-mono"
                          />
                        </div>
                        {showDropdown && search.length >= 2 && (
                          <div
                            className="absolute z-10 top-full left-0 right-0 mt-1 rounded-xl border border-[var(--border-glass)] shadow-xl overflow-hidden"
                            style={{ background: 'var(--surface-primary)', backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))', WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))' }}
                          >
                            {isFetching ? (
                              <div className="flex items-center justify-center py-3 gap-2 text-[var(--text-muted)]">
                                <Loader2 size={13} className="animate-spin" />
                                <span className="text-xs">Recherche…</span>
                              </div>
                            ) : pool.length === 0 ? (
                              <div className="px-4 py-3 text-xs text-[var(--text-muted)] text-center">
                                Aucun {typeLabel.toLowerCase()} disponible en stock
                              </div>
                            ) : (
                              pool.map((p) => (
                                <button
                                  key={p.id}
                                  onClick={() => { setSelected(p); setShowDropdown(false); }}
                                  className="w-full text-left px-4 py-2.5 hover:bg-primary/5 transition-colors border-b border-[var(--border-glass)] last:border-0"
                                >
                                  <p className="text-xs font-semibold text-[var(--text-primary)]">{p.brand} {p.model}</p>
                                  <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                                    SN: {p.serialNumber}{p.imei ? ` · IMEI: ${p.imei}` : ''}
                                  </p>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400 mb-1">Appareil sélectionné</p>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{selected.brand} {selected.model}</p>
                        {selected.purchaseOrder?.reference && (
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">Commande : {selected.purchaseOrder.reference}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-[var(--text-secondary)]">N° de série</label>
                        <input
                          readOnly
                          value={selected.serialNumber}
                          className="input-glass py-2 text-sm w-full font-mono bg-white/[0.02] cursor-default"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-[var(--text-secondary)]">IMEI</label>
                        <input
                          readOnly
                          value={selected.imei ?? '—'}
                          className="input-glass py-2 text-sm w-full font-mono tracking-widest bg-white/[0.02] cursor-default"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-[var(--text-secondary)]">N° ticket <span className="text-red-400">*</span></label>
                        <input
                          autoFocus
                          value={ticketRef}
                          onChange={(e) => setTicketRef(e.target.value.toUpperCase())}
                          placeholder="IT-XXXXX"
                          className="input-glass py-2 text-sm w-full font-mono uppercase"
                        />
                      </div>
                      <button
                        onClick={() => { setSelected(null); setSearch(''); setTicketRef('IT-'); }}
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline transition-colors"
                      >
                        Changer de {typeLabel.toLowerCase()}
                      </button>
                    </motion.div>
                  )}
                </>
              )}
            </div>

            {/* Pied */}
            <div className="flex gap-3 px-5 py-4 border-t border-[var(--border-glass)] flex-shrink-0">
              <button onClick={onClose} className="btn-secondary flex-1 py-2 text-sm">Annuler</button>
              <button
                onClick={() => isEdit ? updateMut.mutate() : selected && assignMut.mutate(selected.id)}
                disabled={!canSubmit}
                className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {(isEdit ? updateMut.isPending : assignMut.isPending) && <Loader2 size={14} className="animate-spin" />}
                {isEdit ? 'Enregistrer' : 'Affecter'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}

// ─── WorkstationModal (affectation depuis pool stock) ─────────

function WorkstationModal({
  type, userId, onClose,
}: {
  type: DeviceType;
  userId: string;
  onClose: () => void;
}) {
  const qc        = useQueryClient();
  const typeLabel = DEVICE_TYPE_LABELS[type] ?? type;

  const [search,       setSearch]       = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected,     setSelected]     = useState<Device | null>(null);
  const [ticketRef,    setTicketRef]    = useState('IT-');

  const { data: pool = [], isFetching } = useQuery<Device[]>({
    queryKey: ['ws-pool', type, search],
    queryFn:  async () => {
      const r = await api.get(`/devices?type=${type}&status=IN_STOCK&search=${encodeURIComponent(search)}&limit=20`);
      return r.data.data as Device[];
    },
    enabled: search.length >= 1,
    staleTime: 0,
  });

  const assignMut = useMutation({
    mutationFn: (deviceId: string) => api.patch(`/devices/${deviceId}/assign`, {
      userId,
      ...(ticketRef.trim().length > 3 ? { assetTag: ticketRef.trim().toUpperCase() } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-devices', userId] });
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['stock-summary'] });
      qc.invalidateQueries({ queryKey: ['stock-devices'] });
      qc.invalidateQueries({ queryKey: ['stockalerts'] });
      qc.invalidateQueries({ queryKey: ['maintenance-devices'] });
      onClose();
    },
  });

  const canSubmit = !!selected && ticketRef.trim().length > 3 && !assignMut.isPending;

  return (
    <AnimatePresence>
      <>
        <motion.div
          className="fixed inset-0 z-50 bg-black/60"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-md flex flex-col rounded-2xl shadow-2xl pointer-events-auto overflow-hidden"
            style={{ background: 'var(--surface-primary)', backdropFilter: 'blur(var(--glass-blur-heavy)) saturate(var(--glass-saturation))', WebkitBackdropFilter: 'blur(var(--glass-blur-heavy)) saturate(var(--glass-saturation))', border: '1px solid var(--glass-border)', maxHeight: '90vh' }}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 38 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-glass)] flex-shrink-0">
              <h2 className="font-semibold text-[var(--text-primary)]">Affecter — {typeLabel}</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Corps */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!selected ? (
                <>
                  <p className="text-xs text-[var(--text-muted)]">
                    Saisissez le numéro de série du {typeLabel.toLowerCase()} à affecter — les appareils disponibles en stock s'affichent au fur et à mesure.
                  </p>
                  <div className="relative">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[var(--text-secondary)]">Numéro de série</label>
                      <input
                        autoFocus
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
                        onFocus={() => setShowDropdown(true)}
                        placeholder="Ex : ABC1234…"
                        className="input-glass py-2 text-sm w-full font-mono"
                      />
                    </div>
                    {showDropdown && search.length >= 1 && (
                      <div
                        className="absolute z-10 top-full left-0 right-0 mt-1 rounded-xl border border-[var(--glass-border)] shadow-xl overflow-hidden"
                        style={{ background: 'var(--surface-primary)', backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))', WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))' }}
                      >
                        {isFetching ? (
                          <div className="flex items-center justify-center py-3 gap-2 text-[var(--text-muted)]">
                            <Loader2 size={13} className="animate-spin" />
                            <span className="text-xs">Recherche…</span>
                          </div>
                        ) : pool.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-[var(--text-muted)] text-center">
                            Aucun {typeLabel.toLowerCase()} disponible en stock
                          </div>
                        ) : (
                          pool.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => { setSelected(p); setShowDropdown(false); }}
                              className="w-full text-left px-4 py-2.5 hover:bg-primary/5 transition-colors border-b border-[var(--border-glass)] last:border-0"
                            >
                              <p className="text-xs font-semibold text-[var(--text-primary)]">{p.brand} {p.model}</p>
                              <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                                SN: {p.serialNumber}
                                {[p.processor, p.ram, p.storage].filter(Boolean).join(' · ') && (
                                  <span> · {[p.processor, p.ram, p.storage].filter(Boolean).join(' · ')}</span>
                                )}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400 mb-1">Appareil sélectionné</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{selected.brand} {selected.model}</p>
                    {[selected.processor, selected.ram, selected.storage].filter(Boolean).length > 0 && (
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        {[selected.processor, selected.ram, selected.storage].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {selected.site && (
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Site : {selected.site}</p>
                    )}
                    {selected.purchaseOrder?.reference && (
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Commande : {selected.purchaseOrder.reference}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">N° de série</label>
                    <input
                      readOnly
                      value={selected.serialNumber}
                      className="input-glass py-2 text-sm w-full font-mono bg-white/[0.02] cursor-default"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">N° ticket <span className="text-red-400">*</span></label>
                    <input
                      autoFocus
                      value={ticketRef}
                      onChange={(e) => setTicketRef(e.target.value.toUpperCase())}
                      placeholder="IT-XXXXX"
                      className="input-glass py-2 text-sm w-full font-mono uppercase"
                    />
                  </div>
                  <button
                    onClick={() => { setSelected(null); setSearch(''); setTicketRef('IT-'); }}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline transition-colors"
                  >
                    Changer d'appareil
                  </button>
                </motion.div>
              )}
            </div>

            {/* Pied */}
            <div className="flex gap-3 px-5 py-4 border-t border-[var(--border-glass)] flex-shrink-0">
              <button onClick={onClose} className="btn-secondary flex-1 py-2 text-sm">Annuler</button>
              <button
                onClick={() => selected && assignMut.mutate(selected.id)}
                disabled={!canSubmit}
                className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {assignMut.isPending && <Loader2 size={14} className="animate-spin" />}
                Affecter
              </button>
            </div>
          </motion.div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}

// ─── Onglet équipements ───────────────────────────────────────

// ─── Types workstation (ouvre la modal pleine) ───────────────
const WORKSTATION_CAT_TYPES: DeviceType[] = ['LAPTOP', 'DESKTOP', 'THIN_CLIENT', 'LAB_WORKSTATION'];

function TabEquipements({ userId, canEdit }: { userId: string; canEdit: boolean; isManager?: boolean }) {
  const qc = useQueryClient();

  // ── Confirmation retrait (workstations / téléphones uniquement) ──
  const [removeConfirm, setRemoveConfirm] = useState<{ device: Device } | null>(null);
  const [removeStatus,  setRemoveStatus]  = useState('IN_STOCK');
  const [removeDeadline, setRemoveDeadline] = useState('');

  // ── Toggle simple (DOCKING_STATION / HEADSET / KEYBOARD) ──
  const [togglePending, setTogglePending] = useState<DeviceType | null>(null);

  // ── Monitor config ──
  const [monitorOpen,    setMonitorOpen]    = useState(false);
  const [monitorQty,     setMonitorQty]     = useState<1 | 2>(1);
  const [monitorScreens, setMonitorScreens] = useState<{ hasDocking: boolean }[]>([{ hasDocking: false }]);
  const [monitorPending, setMonitorPending] = useState(false);

  const { data: userDevices = [], isLoading } = useQuery<Device[]>({
    queryKey: ['user-devices', userId],
    queryFn:  async () => {
      const r = await api.get(`/devices?assignedUserId=${userId}&limit=100`);
      return r.data.data as Device[];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const devicesByType = useMemo(() => {
    const map: Partial<Record<DeviceType, Device[]>> = {};
    for (const d of userDevices) {
      if (!map[d.type]) map[d.type] = [];
      map[d.type]!.push(d);
    }
    return map;
  }, [userDevices]);

  // ── Invalidation groupée ──────────────────────────────────────
  const invalidateAll = (extraDeviceId?: string) => {
    qc.invalidateQueries({ queryKey: ['user-devices', userId] });
    qc.invalidateQueries({ queryKey: ['devices'] });
    qc.invalidateQueries({ queryKey: ['stock-summary'] });
    qc.invalidateQueries({ queryKey: ['stock-devices'] });
    qc.invalidateQueries({ queryKey: ['stockalerts'] });
    qc.invalidateQueries({ queryKey: ['maintenance-devices'] });
    qc.invalidateQueries({ queryKey: ['retired-devices'] });
    if (extraDeviceId) qc.invalidateQueries({ queryKey: ['device', extraDeviceId] });
  };

  // ── Retrait workstation / téléphone (popup statut) ─────────
  const removeMut = useMutation({
    mutationFn: ({ device: d, status, maintenanceDeadline }: { device: Device; status: string; maintenanceDeadline?: string }) =>
      api.delete(`/devices/${d.id}`, { data: { status, ...(maintenanceDeadline ? { maintenanceDeadline } : {}) } }),
    onSuccess: (_, { device: d }) => {
      invalidateAll(d.id);
      setRemoveConfirm(null);
      setRemoveStatus('IN_STOCK');
    },
    onError: () => setRemoveConfirm(null),
  });

  // ── Toggle simple (DOCKING_STATION / HEADSET / KEYBOARD) ─────
  const handleToggleSimple = async (type: DeviceType, hasItem: boolean, devices: Device[]) => {
    if (togglePending) return;
    setTogglePending(type);
    try {
      if (hasItem) {
        for (const d of devices) {
          await api.delete(`/devices/${d.id}`, { data: { status: 'RETIRED' } });
        }
      } else {
        await api.post('/devices', {
          serialNumber:   `PERIPH-${Date.now()}`,
          type,
          brand:          '—',
          model:          DEVICE_TYPE_LABELS[type] ?? type,
          status:         'ASSIGNED',
          assignedUserId: userId,
          condition:      'GOOD',
        });
      }
      invalidateAll();
    } finally {
      setTogglePending(null);
    }
  };

  // ── Retrait de tous les écrans (toggle OFF) ───────────────────
  const handleRemoveAllMonitors = async () => {
    const monitors = devicesByType['MONITOR'] ?? [];
    if (!monitors.length) return;
    setMonitorPending(true);
    try {
      for (const d of monitors) {
        await api.delete(`/devices/${d.id}`, { data: { status: 'RETIRED' } });
      }
      invalidateAll();
    } finally {
      setMonitorPending(false);
    }
  };

  // ── Confirmation ajout / mise à jour écrans ───────────────────
  const handleConfirmMonitor = async () => {
    setMonitorPending(true);
    try {
      // Retirer les écrans existants (fake, donc RETIRED direct)
      for (const d of devicesByType['MONITOR'] ?? []) {
        await api.delete(`/devices/${d.id}`, { data: { status: 'RETIRED' } });
      }
      // Créer les nouveaux écrans
      for (let i = 0; i < monitorQty; i++) {
        const hasDocking = monitorScreens[i]?.hasDocking ?? false;
        await api.post('/devices', {
          serialNumber:   `MON-${Date.now() + i * 100}`,
          type:           'MONITOR',
          brand:          '—',
          model:          `24"${hasDocking ? ' avec Docking' : ''}`,
          status:         'ASSIGNED',
          assignedUserId: userId,
          condition:      'GOOD',
          hasDocking,
        });
      }
      invalidateAll();
      setMonitorOpen(false);
    } finally {
      setMonitorPending(false);
    }
  };

  // ── Sync monitorScreens quand qty change ──────────────────────
  const setMonitorQtyAndSync = (qty: 1 | 2) => {
    setMonitorQty(qty);
    setMonitorScreens((prev) => {
      if (qty === 1) return [prev[0] ?? { hasDocking: false }];
      return [prev[0] ?? { hasDocking: false }, prev[1] ?? { hasDocking: false }];
    });
  };


  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-36 rounded-lg" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-8 w-36 rounded-lg" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  // ── Item pour workstations et téléphones (lecture seule + retrait) ──
  const renderDeviceItem = (d: Device, _cat: EquipCategory) => {
    const isWorkstation = WORKSTATION_TYPES.includes(d.type);
    const isPhone       = PHONE_CAT_TYPES.includes(d.type);
    const isFake        = d.serialNumber.startsWith('PERIPH-') || d.serialNumber.startsWith('MON-');

    return (
      <motion.div
        key={d.id}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--border-glass)] bg-white/[0.018] group"
      >
        {/* Spacer icône */}
        <div className="w-7 flex-shrink-0" />

        {/* Infos device */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {d.brand} {d.model}
            </span>
            {d.assetTag && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono font-semibold">
                {d.assetTag}
              </span>
            )}
            {isWorkstation && d.hostname && (
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {d.hostname}
              </span>
            )}
            {!isFake && d.serialNumber && (
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {d.serialNumber}
              </span>
            )}
          </div>
          {/* N° commande pour workstations */}
          {isWorkstation && d.purchaseOrder?.reference && (
            <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
              Commande : {d.purchaseOrder.reference}
            </span>
          )}
          {/* IMEI pour smartphones/tablettes */}
          {isPhone && d.imei && (
            <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block font-mono">
              IMEI : {d.imei}
            </span>
          )}
        </div>

        {/* Statut */}
        <StatusBadge status={d.status} />

        {/* Retrait uniquement — plus d'édition depuis cet onglet */}
        {canEdit && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setRemoveConfirm({ device: d })}
              title={isFake ? 'Retirer' : 'Désaffecter'}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </motion.div>
    );
  };

  // ── Rendu d'une catégorie workstation ou téléphone (lecture + retrait) ──
  const renderReadOnlyCategory = (cat: EquipCategory, idx: number) => {
    const devices = cat.type === 'KEYBOARD'
      ? [...(devicesByType['KEYBOARD'] ?? []), ...(devicesByType['MOUSE'] ?? [])]
      : (devicesByType[cat.type] ?? []);
    const hasItems    = devices.length > 0;
    const isDuplicate = cat.section === 'workstation' && devices.length > 1;
    const { Icon } = cat;
    return (
      <div key={cat.type} className={idx > 0 ? 'border-t border-[var(--border-glass)]' : ''}>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${hasItems ? cat.bg : 'bg-white/5'}`}>
            <Icon size={15} className={hasItems ? cat.color : 'text-[var(--text-muted)]'} />
          </div>
          <span className={`text-sm font-medium flex-1 ${hasItems ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
            {cat.label}
            {hasItems && (
              <span className="ml-2 text-[10px] font-normal text-[var(--text-muted)]">({devices.length})</span>
            )}
          </span>
          {isDuplicate && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 text-[9px] font-semibold">
              <AlertTriangle size={9} />
              {devices.length} postes
            </span>
          )}
        </div>
        {devices.map((d) => renderDeviceItem(d, cat))}
      </div>
    );
  };

  // ── Toggle simple (DOCKING_STATION / HEADSET / KEYBOARD) ────
  const renderToggleCategory = (cat: EquipCategory, idx: number) => {
    const devices = cat.type === 'KEYBOARD'
      ? [...(devicesByType['KEYBOARD'] ?? []), ...(devicesByType['MOUSE'] ?? [])]
      : (devicesByType[cat.type] ?? []);
    const hasItems  = devices.length > 0;
    const isLoading = togglePending === cat.type;
    const { Icon } = cat;
    return (
      <div key={cat.type} className={idx > 0 ? 'border-t border-[var(--border-glass)]' : ''}>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${hasItems ? cat.bg : 'bg-white/5'}`}>
            <Icon size={15} className={`transition-colors duration-300 ${hasItems ? cat.color : 'text-[var(--text-muted)]'}`} />
          </div>
          <span className={`text-sm font-medium flex-1 transition-colors duration-300 ${hasItems ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
            {cat.label}
          </span>
          {canEdit && (
            <ToggleSwitch
              on={hasItems}
              loading={isLoading}
              onClick={() => handleToggleSimple(cat.type, hasItems, devices)}
            />
          )}
        </div>
      </div>
    );
  };

  // ── Catégorie Écrans — toggle + panneau de configuration ──────
  const renderMonitorCategory = (idx: number) => {
    const cat      = EQUIP_CATEGORIES.find((c) => c.type === 'MONITOR')!;
    const monitors = devicesByType['MONITOR'] ?? [];
    const hasMonitors = monitors.length > 0;
    const withDocking = monitors.filter((m) => m.hasDocking).length;

    const summaryText = hasMonitors
      ? `${monitors.length} écran${monitors.length > 1 ? 's' : ''} · ${withDocking} avec docking`
      : '';

    return (
      <div key="MONITOR" className={idx > 0 ? 'border-t border-[var(--border-glass)]' : ''}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${hasMonitors ? cat.bg : 'bg-white/5'}`}>
            <Monitor size={15} className={`transition-colors duration-300 ${hasMonitors ? cat.color : 'text-[var(--text-muted)]'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <span className={`text-sm font-medium transition-colors duration-300 ${hasMonitors ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
              {cat.label}
            </span>
            {hasMonitors && (
              <span className="ml-2 text-[10px] text-[var(--text-muted)]">{summaryText}</span>
            )}
          </div>
          {canEdit && (
            <ToggleSwitch
              on={hasMonitors}
              loading={monitorPending}
              onClick={() => {
                if (hasMonitors) {
                  handleRemoveAllMonitors();
                } else {
                  setMonitorQty(1);
                  setMonitorScreens([{ hasDocking: false }]);
                  setMonitorOpen(true);
                }
              }}
            />
          )}
        </div>

        {/* Panneau de configuration (uniquement à l'ajout) */}
        <AnimatePresence initial={false}>
          {monitorOpen && !hasMonitors && (
            <motion.div
              key="monitor-config"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="px-4 pb-4 pt-1 border-t border-[var(--border-glass)] bg-primary/[0.04] space-y-4">

                {/* Quantité */}
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] w-20 flex-shrink-0">
                    Quantité
                  </span>
                  <div className="flex gap-1.5">
                    {([1, 2] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMonitorQtyAndSync(n)}
                        className="w-9 h-9 text-sm font-semibold rounded-xl border transition-all duration-200"
                        style={monitorQty === n ? {
                          background: 'rgba(99,102,241,0.18)',
                          borderColor: 'rgba(99,102,241,0.45)',
                          color: 'rgb(129,140,248)',
                          boxShadow: '0 0 12px rgba(99,102,241,0.18)',
                        } : {
                          background: 'transparent',
                          borderColor: 'var(--border-glass)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sélection modèle par écran */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                    Modèle
                  </span>
                  {Array.from({ length: monitorQty }, (_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-2"
                    >
                      <span className="text-xs text-[var(--text-muted)] w-14 flex-shrink-0">
                        Écran {monitorQty > 1 ? i + 1 : ''}
                      </span>
                      <div className="flex gap-1.5 flex-1">
                        {[
                          { label: '24"',             hasDocking: false },
                          { label: '24" avec Docking', hasDocking: true  },
                        ].map((opt) => {
                          const active = (monitorScreens[i]?.hasDocking ?? false) === opt.hasDocking;
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={() => setMonitorScreens((prev) => {
                                const next = [...prev];
                                next[i] = { hasDocking: opt.hasDocking };
                                return next;
                              })}
                              className="flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all duration-200"
                              style={active ? {
                                background: opt.hasDocking
                                  ? 'rgba(245,158,11,0.15)'
                                  : 'rgba(16,185,129,0.12)',
                                borderColor: opt.hasDocking
                                  ? 'rgba(245,158,11,0.35)'
                                  : 'rgba(16,185,129,0.30)',
                                color: opt.hasDocking ? 'rgb(251,191,36)' : 'rgb(52,211,153)',
                              } : {
                                background: 'transparent',
                                borderColor: 'var(--border-glass)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <motion.button
                    type="button"
                    onClick={handleConfirmMonitor}
                    disabled={monitorPending}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {monitorPending
                      ? <><Loader2 size={12} className="animate-spin" />En cours…</>
                      : <><CheckCircle size={12} />Confirmer</>
                    }
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => setMonitorOpen(false)}
                    className="btn-secondary px-4 py-2 text-xs"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // ── Sections ─────────────────────────────────────────────────
  const workstationCats = EQUIP_CATEGORIES.filter((c) => c.section === 'workstation');
  const phoneCats       = EQUIP_CATEGORIES.filter((c) => PHONE_CAT_TYPES.includes(c.type));
  const toggleCats      = EQUIP_CATEGORIES.filter(
    (c) => c.section === 'peripheral' && !PHONE_CAT_TYPES.includes(c.type) && c.type !== 'MONITOR'
  );

  return (
    <div className="space-y-4">

      {/* ── Section Postes de travail (lecture seule) ── */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 px-1">
          Poste de travail
        </p>
        <GlassCard padding="none">
          {workstationCats.map((cat, i) => renderReadOnlyCategory(cat, i))}
        </GlassCard>
      </div>

      {/* ── Section Périphériques ── */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 px-1">
          Périphériques
        </p>
        <GlassCard padding="none">
          {/* Smartphones / Tablettes — lecture seule */}
          {phoneCats.map((cat, i) => renderReadOnlyCategory(cat, i))}

          {/* Écrans — toggle + config */}
          {renderMonitorCategory(phoneCats.length)}

          {/* Station d'accueil / Casque / Clavier-Souris — toggle simple */}
          {toggleCats.map((cat, i) => renderToggleCategory(cat, phoneCats.length + 1 + i))}
        </GlassCard>
      </div>

      {/* ── Popup désaffectation (workstations et téléphones) ── */}
      {removeConfirm && createPortal((() => {
        const d = removeConfirm.device;
        const isFake = d.serialNumber.startsWith('PERIPH-') || d.serialNumber.startsWith('MON-');
        const closePopup = () => { setRemoveConfirm(null); setRemoveStatus('IN_STOCK'); setRemoveDeadline(''); };
        return (
          <>
            {/* Backdrop — assez léger pour laisser les couleurs de la page traverser le blur du card */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,10,0.42)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', cursor: 'pointer' }}
              onClick={closePopup}
            />
            {/* Modal card — portal = hors du contexte transform de AppShell */}
            <motion.div
              style={{ position: 'fixed', inset: 0, zIndex: 151, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', pointerEvents: 'none' }}
              initial={{ opacity: 0, scale: 0.82, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', stiffness: 500, damping: 36, mass: 0.72 }}
            >
              <div className="modal-glass w-full max-w-sm pointer-events-auto p-6 space-y-5">

                {/* ── Décorations specular liquid glass ── */}
                {/* Ligne de lumière sur le bord supérieur */}
                <div className="absolute inset-x-0 top-0 h-[2px] pointer-events-none" style={{
                  borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
                  background: 'linear-gradient(90deg, transparent 5%, rgba(180,160,255,0.80) 35%, rgba(99,200,255,0.60) 65%, transparent 95%)',
                }} />
                {/* Reflet vertical gauche */}
                <div className="absolute top-0 left-0 pointer-events-none" style={{ width: '2px', height: '60%', background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)' }} />
                {/* Orbe indigo haut-droite */}
                <div className="absolute pointer-events-none" style={{ top: '-40px', right: '-32px', width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.28) 0%, rgba(6,182,212,0.10) 45%, transparent 70%)', filter: 'blur(8px)' }} />
                {/* Orbe amber bas-gauche — accent chaud */}
                <div className="absolute pointer-events-none" style={{ bottom: '-20px', left: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.14) 0%, transparent 70%)', filter: 'blur(6px)' }} />

                {/* ── En-tête ── */}
                <div className="flex items-start gap-3 relative z-10">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.20) 0%, rgba(234,88,12,0.12) 100%)',
                    border: '1px solid rgba(245,158,11,0.40)',
                    boxShadow: '0 0 12px rgba(245,158,11,0.20), inset 0 1px 0 rgba(255,255,255,0.15)',
                  }}>
                    <AlertTriangle size={17} style={{ color: 'rgb(251,191,36)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-[15px] leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {isFake ? 'Retirer cet équipement' : 'Désaffecter cet équipement'}
                    </h3>
                    <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {d.assetTag || d.serialNumber}
                      </span>
                      {' '}<span style={{ opacity: 0.70 }}>— {d.brand} {d.model}</span>
                    </p>
                  </div>
                </div>

                {/* Séparateur lumineux */}
                <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,120,255,0.50) 30%, rgba(99,200,255,0.35) 70%, transparent)' }} />

                {/* ── Sélecteur statut (vrais devices uniquement) ── */}
                {!isFake && (
                  <div className="space-y-2 relative z-10">
                    <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)', letterSpacing: '0.10em' }}>
                      Nouveau statut <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <AppSelect
                      value={removeStatus}
                      onChange={setRemoveStatus}
                      options={[
                        { value: 'IN_STOCK',       label: 'Stock — retour en inventaire' },
                        { value: 'IN_MAINTENANCE', label: 'Maintenance — envoi en atelier' },
                        { value: 'RETIRED',        label: 'Déchet — mise au rebut' },
                        { value: 'LOST',           label: 'Perdu — signalement perte' },
                        { value: 'STOLEN',         label: 'Volé — signalement vol' },
                      ]}
                    />
                    <p className="text-[11.5px] leading-relaxed min-h-[1.25rem]" style={{ color: 'var(--text-secondary)', opacity: 0.85 }}>
                      {removeStatus === 'IN_STOCK'       && "L'équipement retourne dans le pool de stock disponible."}
                      {removeStatus === 'IN_MAINTENANCE' && "L'équipement est envoyé en atelier et apparaîtra dans l'onglet Maintenance."}
                      {removeStatus === 'RETIRED'        && "L'équipement est mis au rebut et apparaîtra dans l'onglet Déchets."}
                      {removeStatus === 'LOST'           && "L'équipement est signalé perdu et apparaîtra dans l'onglet Déchets."}
                      {removeStatus === 'STOLEN'         && "L'équipement est signalé volé et apparaîtra dans l'onglet Déchets."}
                    </p>
                  </div>
                )}

                {!isFake && removeStatus === 'IN_MAINTENANCE' && (
                  <div className="space-y-2 pt-1 relative z-10">
                    <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)', letterSpacing: '0.10em' }}>
                      Deadline de retour <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optionnel)</span>
                    </label>
                    <input type="date" value={removeDeadline} onChange={(e) => setRemoveDeadline(e.target.value)} className="input-glass w-full text-sm" />
                  </div>
                )}

                {isFake && (
                  <p className="text-[12px] leading-relaxed relative z-10" style={{ color: 'var(--text-secondary)', opacity: 0.85 }}>
                    Cet équipement sera retiré de la liste et archivé dans les déchets.
                  </p>
                )}

                {/* Note de traçabilité */}
                <p className="text-[11px] leading-relaxed relative z-10 pt-3" style={{
                  color: 'var(--text-muted)',
                  borderTop: '1px solid rgba(139,120,255,0.20)',
                }}>
                  L'action sera tracée dans l'historique avec votre nom et la date.
                </p>

                {/* ── Actions ── */}
                <div className="flex gap-3 relative z-10">
                  <button onClick={closePopup} className="btn-secondary flex-1 py-2.5 text-sm">
                    Annuler
                  </button>
                  <motion.button
                    onClick={() => removeMut.mutate({
                      device: d,
                      status: isFake ? 'RETIRED' : removeStatus,
                      maintenanceDeadline: !isFake && removeStatus === 'IN_MAINTENANCE' ? removeDeadline || undefined : undefined,
                    })}
                    disabled={removeMut.isPending}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex-1 py-2.5 text-[13px] rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                      border: '1px solid rgba(245,158,11,0.45)',
                      color: '#ffffff',
                      boxShadow: '0 4px 20px rgba(245,158,11,0.35), inset 0 1px 0 rgba(255,255,255,0.20)',
                    }}
                  >
                    {removeMut.isPending ? <><Loader2 size={14} className="animate-spin" />En cours…</> : 'Confirmer'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        );
      })(), document.body)}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo  = (location.state as any)?.from    ?? '/devices';
  const fromTab = (location.state as any)?.fromTab ?? undefined;
  const goBack  = () => navigate(backTo, { state: fromTab ? { tab: fromTab } : undefined });
  const { user: currentUser } = useAuthStore();
  const canEdit = currentUser?.role === 'MANAGER' || currentUser?.role === 'TECHNICIAN';
  const isManager = currentUser?.role === 'MANAGER';

  const { data: device, isLoading, error } = useDevice(id!);
  const qcMain = useQueryClient();

  const [activeDetailTab, setActiveDetailTab] = useState('info');
  const [formOpen,   setFormOpen]   = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleting,             setDeleting]             = useState(false);
  const [retireStatus,         setRetireStatus]         = useState('IN_STOCK');
  const [retireDeadline,       setRetireDeadline]       = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [assignSite,   setAssignSite]   = useState('SUD');

  const updateMut = useUpdateDevice(id!);
  const deleteMut = useDeleteDevice();
  const assignMut = useAssignDevice(id!);

  const handleUpdate = async (data: DeviceFormData) => {
    await updateMut.mutateAsync(data);
    setFormOpen(false);
  };

  const handleDelete = async () => {
    try {
      await deleteMut.mutateAsync({
        id: id!,
        status: retireStatus,
        maintenanceDeadline: retireStatus === 'IN_MAINTENANCE' ? retireDeadline || undefined : undefined,
      });
      goBack();
    } catch {
      // L'erreur est exposée via deleteMut.error — pas de navigation si échec
    }
  };

  const handleAssign = async () => {
    if (!selectedUser) return;
    await assignMut.mutateAsync(selectedUser);
    // Poser le site via PUT séparé (même pattern qu'AssignFromPoolModal)
    await api.put(`/devices/${id}`, { site: assignSite });
    // Invalider la fiche device pour refléter le nouveau site
    qcMain.invalidateQueries({ queryKey: ['device', id] });
    setAssignOpen(false);
    setSelectedUser('');
    setAssignSite('SUD');
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
        <button onClick={goBack} className="btn-secondary px-4 py-2 text-sm">Retour à la liste</button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">

      {/* ─── Navigation & titre ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors" aria-label="Retour">
            <ArrowLeft size={16} />
          </button>
          {backTo === '/devices' && device.assignedUser ? (
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">{device.assignedUser.displayName}</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-sm text-[var(--text-muted)] font-mono">
                  {device.hostname ? `${device.hostname} | ` : ''}{device.brand} {device.model}
                </span>
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
                onClick={() => setDeleting(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-amber-400 hover:border-amber-400/30 transition-colors"
              >
                <UserMinus size={14} />
                Désaffecter
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
      <Tabs.Root value={activeDetailTab} onValueChange={setActiveDetailTab}>
        <Tabs.List className="tabs-glass">
          {[
            { value: 'info',        label: 'Informations' },
            ...(device.assignedUser ? [{ value: 'equipment', label: 'Équipements' }] : []),
            { value: 'maintenance', label: `Maintenance (${device.maintenanceLogs?.length ?? 0})` },
            { value: 'audit',       label: `Historique (${device.auditLogs?.length ?? 0})` },
          ].map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className={clsx(
                'relative px-3 py-1.5 text-sm font-medium rounded-[18px] outline-none transition-colors',
                activeDetailTab === tab.value
                  ? 'text-primary'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {activeDetailTab === tab.value && (
                <motion.div
                  layoutId="detail-tabs-pill"
                  className="absolute inset-0 rounded-[18px]"
                  style={{
                    background: 'rgba(99,102,241,0.13)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(99,102,241,0.22)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 8px rgba(99,102,241,0.12)',
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* ── Informations ── */}
        <Tabs.Content value="info" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

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
              <InfoRow label="Type"   value={DEVICE_TYPE_LABELS[device.type]} />
              <InfoRow label="Marque" value={device.brand} />
              <InfoRow label="Modèle" value={device.model} />
              <InfoRow label="N° de série" value={device.serialNumber} />

              {/* IMEI — smartphones / tablettes */}
              {(device.type === 'SMARTPHONE' || device.type === 'TABLET') && (
                <InfoRow label="IMEI" value={device.imei} />
              )}

              {/* Specs PC — LAPTOP, DESKTOP, LAB_WORKSTATION (pas THIN_CLIENT) */}
              {(['LAPTOP', 'DESKTOP', 'LAB_WORKSTATION'] as string[]).includes(device.type) && (
                <>
                  <InfoRow label="Processeur" value={device.processor} />
                  <InfoRow label="RAM"        value={device.ram} />
                  <InfoRow label="Stockage"   value={device.storage} />
                </>
              )}

              {/* Stockage — smartphones / tablettes */}
              {(device.type === 'SMARTPHONE' || device.type === 'TABLET') && (
                <InfoRow label="Stockage" value={device.storage} />
              )}

              {/* Écran — LAPTOP uniquement */}
              {device.type === 'LAPTOP' && (
                <InfoRow label="Écran" value={device.screenSize} />
              )}

              {/* Taille — moniteurs */}
              {device.type === 'MONITOR' && (
                <InfoRow label="Taille" value={device.screenSize} />
              )}

              {/* Clavier — LAPTOP, DESKTOP, LAB_WORKSTATION */}
              {(['LAPTOP', 'DESKTOP', 'LAB_WORKSTATION'] as string[]).includes(device.type) && (
                <InfoRow label="Clavier" value={device.keyboardLayout ? KEYBOARD_LAYOUT_LABELS[device.keyboardLayout] : undefined} />
              )}

              {/* Hostname — tous les postes de travail */}
              {(['LAPTOP', 'DESKTOP', 'THIN_CLIENT', 'LAB_WORKSTATION'] as string[]).includes(device.type) && (
                <InfoRow label="Hostname" value={device.hostname} />
              )}

              {/* Réseau étendu — LAB_WORKSTATION uniquement */}
              {device.type === 'LAB_WORKSTATION' && (
                <>
                  {(device.vlan || device.ipAddress || device.macAddress || device.bitlocker !== undefined) && (
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mt-4 mb-2">Réseau</h3>
                  )}
                  <InfoRow label="VLAN"        value={device.vlan} />
                  <InfoRow label="Adresse IP"  value={device.ipAddress} />
                  <InfoRow label="Adresse MAC" value={device.macAddress} />
                  <InfoRow label="Clé Bitlocker" value={device.bitlocker} />
                </>
              )}
            </GlassCard>

            {/* Statut & Affectation */}
            <GlassCard padding="md" animate index={1}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Statut</h3>
              <div className="mb-3"><StatusBadge status={device.status} /></div>
              <InfoRow label="Site" value={device.site} />

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
            <TabEquipements userId={device.assignedUser.id} canEdit={canEdit} isManager={isManager} />
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
            <div className="divide-y divide-[var(--border-glass)]">
              {(device.auditLogs ?? []).map((log, i) => (
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

              {/* Entrée de création — toujours visible en bas */}
              <div className="flex gap-3 px-4 py-3 opacity-50">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-[var(--text-primary)]">Enregistrement créé</span>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{formatDateTime(device.createdAt)}</p>
                </div>
              </div>
            </div>
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
          formTitle={`Modifier — ${device.assignedUser?.displayName ?? device.assetTag ?? device.serialNumber}`}
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
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">Assigner à un utilisateur</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Tapez au moins 2 caractères pour rechercher un utilisateur.
                </p>
              </div>

              {/* Utilisateur */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Utilisateur <span className="text-red-400">*</span>
                </label>
                <UserCombobox
                  value={selectedUser}
                  onChange={(userId) => setSelectedUser(userId)}
                  placeholder="Rechercher un utilisateur…"
                  inline
                />
              </div>

              {/* Site */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Site <span className="text-red-400">*</span>
                </label>
                <AppSelect
                  value={assignSite}
                  onChange={setAssignSite}
                  options={SITE_OPTIONS}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setAssignOpen(false); setSelectedUser(''); setAssignSite('SUD'); }}
                  className="btn-secondary flex-1 py-2 text-sm"
                >
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

      {/* ─── Confirmation désaffectation ─────────────────────── */}
      {deleting && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => { setDeleting(false); setRetireStatus('IN_STOCK'); }} />
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="glass-card p-6 max-w-sm w-full space-y-5 pointer-events-auto">

              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">Désaffecter cet équipement</h3>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  <span className="font-mono font-semibold text-[var(--text-primary)]">{device.assetTag || device.serialNumber}</span>
                  {' '}— {device.brand} {device.model}
                </p>
                {device.assignedUser && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Actuellement affecté à <span className="font-medium text-[var(--text-secondary)]">{device.assignedUser.displayName}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Nouveau statut <span className="text-red-400">*</span>
                </label>
                <AppSelect
                  value={retireStatus}
                  onChange={setRetireStatus}
                  options={[
                    { value: 'IN_STOCK',       label: 'Stock — retour en inventaire' },
                    { value: 'IN_MAINTENANCE', label: 'Maintenance — envoi en atelier' },
                    { value: 'RETIRED',        label: 'Déchet — mise au rebut' },
                    { value: 'LOST',           label: 'Perdu — signalement perte' },
                    { value: 'STOLEN',         label: 'Volé — signalement vol' },
                  ]}
                />
                <p className="text-[10px] text-[var(--text-muted)]">
                  {retireStatus === 'IN_STOCK'       && 'L\'équipement retourne dans le pool de stock disponible.'}
                  {retireStatus === 'IN_MAINTENANCE' && 'L\'équipement est envoyé en atelier et apparaîtra dans l\'onglet Maintenance.'}
                  {retireStatus === 'RETIRED'        && 'L\'équipement est mis au rebut et apparaîtra dans l\'onglet Déchets.'}
                  {retireStatus === 'LOST'           && 'L\'équipement est signalé perdu et apparaîtra dans l\'onglet Déchets.'}
                  {retireStatus === 'STOLEN'         && 'L\'équipement est signalé volé et apparaîtra dans l\'onglet Déchets.'}
                </p>
              </div>

              {retireStatus === 'IN_MAINTENANCE' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                    Deadline de retour <span className="text-[var(--text-muted)]">(optionnel)</span>
                  </label>
                  <input
                    type="date"
                    value={retireDeadline}
                    onChange={(e) => setRetireDeadline(e.target.value)}
                    className="input-glass w-full text-sm"
                  />
                </div>
              )}

              <p className="text-xs text-[var(--text-muted)] border-t border-[var(--border-glass)] pt-3">
                L'action sera tracée dans l'historique avec votre nom et la date.
              </p>

              <div className="flex gap-3">
                <button onClick={() => { setDeleting(false); setRetireStatus('IN_STOCK'); setRetireDeadline(''); }} className="btn-secondary flex-1 py-2 text-sm">Annuler</button>
                <button onClick={handleDelete} disabled={deleteMut.isPending} className="flex-1 py-2 text-sm rounded-xl bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 transition-colors font-medium disabled:opacity-50">
                  {deleteMut.isPending ? 'En cours…' : 'Confirmer'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
