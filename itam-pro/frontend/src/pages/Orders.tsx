import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ShoppingCart, Plus, Lock, CheckCircle, Clock, AlertTriangle,
  X, Save, Package, Bell, Pencil, Trash2,
  Laptop, Monitor, Smartphone, Tablet, Printer,
  Keyboard, Mouse, Headphones, Layers, HelpCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Skeleton';
import { AppSelect } from '../components/ui/AppSelect';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import { usePurchaseOrders, useCreateOrder, useCancelOrder, useReceiveDevice } from '../hooks/usePurchaseOrders';
import { DEVICE_TYPE_LABELS, formatDate } from '../utils/formatters';
import type { DeviceModel, DeviceType, PurchaseOrder, POStatus } from '../types';
import type { POFormData, ReceiveDeviceData } from '../services/purchaseOrder.service';

// ─── Types locaux ─────────────────────────────────────────────

interface StockAlertRow {
  id: string;
  deviceType: DeviceType;
  threshold: number;
  isActive: boolean;
  currentStock: number;
  triggered: boolean;
}

// ─── Icônes ───────────────────────────────────────────────────

const TYPE_ICONS: Record<DeviceType, React.ComponentType<{ size?: number; className?: string }>> = {
  LAPTOP: Laptop, DESKTOP: Monitor, SMARTPHONE: Smartphone,
  TABLET: Tablet, MONITOR: Monitor, KEYBOARD: Keyboard,
  MOUSE: Mouse, HEADSET: Headphones, DOCKING_STATION: Layers,
  PRINTER: Printer, OTHER: HelpCircle,
};

const ALL_TYPES = Object.keys(DEVICE_TYPE_LABELS) as DeviceType[];
const TYPE_OPTIONS = ALL_TYPES.map((t) => ({ value: t, label: DEVICE_TYPE_LABELS[t] }));

// ─── Badge statut PO ──────────────────────────────────────────

const PO_STATUS_LABELS: Record<POStatus, string> = {
  PENDING:   'En attente',
  PARTIAL:   'Partiel',
  COMPLETE:  'Complet',
  CANCELLED: 'Annulé',
};

const PO_STATUS_COLORS: Record<POStatus, string> = {
  PENDING:   'bg-slate-500/15 text-slate-400',
  PARTIAL:   'bg-orange-500/15 text-orange-400',
  COMPLETE:  'bg-emerald-500/15 text-emerald-400',
  CANCELLED: 'bg-red-500/15 text-red-400',
};

function POStatusBadge({ status }: { status: POStatus }) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', PO_STATUS_COLORS[status])}>
      {PO_STATUS_LABELS[status]}
    </span>
  );
}

// ─── Barre de progression ──────────────────────────────────────

function ProgressBar({ received, total, status }: { received: number; total: number; status: POStatus }) {
  const pct = total > 0 ? Math.min((received / total) * 100, 100) : 0;
  const color = status === 'COMPLETE' ? 'bg-emerald-400' : status === 'PARTIAL' ? 'bg-orange-400' : 'bg-slate-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={clsx('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">{received}/{total}</span>
    </div>
  );
}

// ─── Modal réception ──────────────────────────────────────────

interface ReceiveModalProps {
  order: PurchaseOrder | null;
  onClose: () => void;
  onSubmit: (data: ReceiveDeviceData) => void;
  isPending: boolean;
  error?: string;
}

function ReceiveModal({ order, onClose, onSubmit, isPending, error }: ReceiveModalProps) {
  const [sn, setSn]         = useState('');
  const [tag, setTag]       = useState('');
  const [notes, setNotes]   = useState('');

  if (!order) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ serialNumber: sn, assetTag: tag.toUpperCase(), notes: notes || undefined });
  };

  return (
    <Dialog.Root open={!!order} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          style={{ background: 'var(--bg-secondary)' }}
        >
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Réceptionner un appareil</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Commande {order.reference}</p>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5">
                <X size={16} />
              </button>
            </div>

            {/* Infos modèle verrouillées */}
            <div className="rounded-xl border border-[var(--border-glass)] bg-white/[0.02] p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                <Lock size={10} />
                Modèle verrouillé (commande {order.reference})
              </div>
              {[
                { label: 'Modèle', value: order.deviceModel.name },
                { label: 'Marque', value: order.deviceModel.brand },
                { label: 'Type',   value: DEVICE_TYPE_LABELS[order.deviceModel.type] },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{row.label}</span>
                  <span className="text-[var(--text-secondary)] font-medium">{row.value}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--text-muted)]">Tag IT *</label>
                <input
                  value={tag}
                  onChange={(e) => setTag(e.target.value.toUpperCase())}
                  placeholder="ELKEM-LT-001"
                  pattern="[A-Z0-9-]+"
                  required
                  className="input-glass py-2 text-sm font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--text-muted)]">Numéro de série *</label>
                <input
                  value={sn}
                  onChange={(e) => setSn(e.target.value)}
                  placeholder="ABC123XYZ"
                  required
                  className="input-glass py-2 text-sm font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--text-muted)]">Notes</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observations…"
                  className="input-glass py-2 text-sm"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="btn-secondary flex-1 flex items-center justify-center gap-1.5 py-2 text-sm">
                  <X size={14} /> Annuler
                </button>
                <button type="submit" disabled={isPending} className="btn-primary flex-1 flex items-center justify-center gap-1.5 py-2 text-sm disabled:opacity-50">
                  <CheckCircle size={14} /> Réceptionner
                </button>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Formulaire création PO ────────────────────────────────────

interface POFormProps {
  models: DeviceModel[];
  onSubmit: (data: POFormData) => void;
  onCancel: () => void;
  isPending: boolean;
  currentYear: number;
  nextRef: string;
}

function POForm({ models, onSubmit, onCancel, isPending, nextRef }: POFormProps) {
  const [form, setForm] = useState<POFormData>({
    reference:     nextRef,
    deviceModelId: '',
    quantity:      1,
    expectedAt:    '',
    notes:         '',
  });

  const activeModels = models.filter((m) => m.isActive);
  const modelOptions = activeModels.map((m) => ({ value: m.id, label: `${m.name} — ${m.brand}` }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reference || !form.deviceModelId || form.quantity < 1) return;
    onSubmit({
      ...form,
      expectedAt: form.expectedAt || undefined,
      notes:      form.notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--text-muted)]">Référence *</label>
          <input
            value={form.reference}
            onChange={(e) => setForm((s) => ({ ...s, reference: e.target.value }))}
            placeholder="CMD-2026-001"
            required
            className="input-glass py-2 text-sm font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--text-muted)]">Quantité *</label>
          <input
            type="number"
            value={form.quantity}
            onChange={(e) => setForm((s) => ({ ...s, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
            min={1}
            required
            className="input-glass py-2 text-sm"
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <label className="text-xs text-[var(--text-muted)]">Modèle *</label>
          <AppSelect
            value={form.deviceModelId}
            onChange={(v) => setForm((s) => ({ ...s, deviceModelId: v }))}
            options={modelOptions}
            placeholder="Choisir un modèle…"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--text-muted)]">Date attendue</label>
          <input
            type="date"
            value={form.expectedAt}
            onChange={(e) => setForm((s) => ({ ...s, expectedAt: e.target.value }))}
            className="input-glass py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--text-muted)]">Notes</label>
          <input
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="Observations…"
            className="input-glass py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-sm">
          <X size={14} /> Annuler
        </button>
        <button
          type="submit"
          disabled={!form.reference || !form.deviceModelId || form.quantity < 1 || isPending}
          className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-50"
        >
          <Save size={14} /> Créer la commande
        </button>
      </div>
    </form>
  );
}

// ─── Onglet Commandes ─────────────────────────────────────────

function TabOrders({ isManager }: { isManager: boolean }) {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = usePurchaseOrders();
  const createMut  = useCreateOrder();
  const cancelMut  = useCancelOrder();
  const receiveMut = useReceiveDevice();

  const [showForm,        setShowForm]        = useState(false);
  const [receivingOrder,  setReceivingOrder]  = useState<PurchaseOrder | null>(null);
  const [receiveError,    setReceiveError]    = useState('');

  // Récupération des modèles pour le formulaire
  const { data: allModels = [] } = useQuery<DeviceModel[]>({
    queryKey: ['device-models-all'],
    queryFn:  () => api.get<DeviceModel[]>('/devicemodels/all').then((r) => r.data),
    staleTime: 60_000,
  });

  // Auto-suggestion de référence
  const year = new Date().getFullYear();
  const nextRef = useMemo(() => {
    const refs = orders.map((o) => o.reference).filter((r) => r.startsWith(`CMD-${year}-`));
    const maxN = refs.reduce((max, r) => {
      const n = parseInt(r.split('-')[2] ?? '0');
      return n > max ? n : max;
    }, 0);
    return `CMD-${year}-${String(maxN + 1).padStart(3, '0')}`;
  }, [orders, year]);

  const handleReceive = (data: ReceiveDeviceData) => {
    if (!receivingOrder) return;
    setReceiveError('');
    receiveMut.mutate(
      { orderId: receivingOrder.id, data },
      {
        onSuccess: () => {
          setReceivingOrder(null);
          qc.invalidateQueries({ queryKey: ['stock-summary'] });
          qc.invalidateQueries({ queryKey: ['stock-devices'] });
        },
        onError: (err: any) => {
          setReceiveError(err?.response?.data?.message ?? 'Erreur lors de la réception');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassCard key={i} padding="md"><Skeleton className="h-16 w-full" /></GlassCard>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bouton nouvelle commande */}
      {isManager && !showForm && (
        <div className="flex justify-end">
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <Plus size={16} /> Nouvelle commande
          </button>
        </div>
      )}

      {/* Formulaire création */}
      <AnimatePresence>
        {showForm && isManager && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <GlassCard padding="md">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Nouvelle commande</h3>
              <POForm
                models={allModels}
                onSubmit={(data) => { createMut.mutate(data, { onSuccess: () => setShowForm(false) }); }}
                onCancel={() => setShowForm(false)}
                isPending={createMut.isPending}
                currentYear={year}
                nextRef={nextRef}
              />
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Liste des commandes */}
      {orders.length === 0 ? (
        <GlassCard padding="md" className="text-center py-12">
          <ShoppingCart size={32} className="mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
          <p className="text-sm text-[var(--text-muted)]">Aucune commande en cours</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {orders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <GlassCard padding="md">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Infos principales */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{order.reference}</span>
                      <POStatusBadge status={order.status} />
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {order.deviceModel.brand} {order.deviceModel.name}
                      <span className="text-[var(--text-muted)] ml-2">— {DEVICE_TYPE_LABELS[order.deviceModel.type]}</span>
                    </div>
                    {order.expectedAt && (
                      <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                        <Clock size={10} />
                        Attendu le {formatDate(order.expectedAt)}
                      </div>
                    )}
                    {/* Barre de progression */}
                    <div className="max-w-xs">
                      <ProgressBar received={order.receivedCount} total={order.quantity} status={order.status} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {order.status !== 'COMPLETE' && order.status !== 'CANCELLED' && (
                      <button
                        onClick={() => { setReceiveError(''); setReceivingOrder(order); }}
                        className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                      >
                        <Package size={13} /> Réceptionner
                      </button>
                    )}
                    {isManager && order.status !== 'COMPLETE' && order.status !== 'CANCELLED' && (
                      <button
                        onClick={() => { if (confirm(`Annuler la commande ${order.reference} ?`)) cancelMut.mutate(order.id); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Annuler la commande"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal réception */}
      <ReceiveModal
        order={receivingOrder}
        onClose={() => setReceivingOrder(null)}
        onSubmit={handleReceive}
        isPending={receiveMut.isPending}
        error={receiveError}
      />
    </div>
  );
}

// ─── Onglet Catalogue modèles ─────────────────────────────────

interface ModelFormState {
  name: string; type: DeviceType | '';
  processor: string; ram: string; storage: string; screenSize: string; notes: string;
}

const emptyModel: ModelFormState = { name: '', type: '', processor: '', ram: '', storage: '', screenSize: '', notes: '' };

function TabCatalogue({ isManager }: { isManager: boolean }) {
  const qc = useQueryClient();

  const [editingModel,   setEditingModel]   = useState<DeviceModel | null>(null);
  const [modelForm,      setModelForm]      = useState<ModelFormState>(emptyModel);
  const [showModelForm,  setShowModelForm]  = useState(false);

  const { data: deviceModels = [], isLoading } = useQuery<DeviceModel[]>({
    queryKey: ['device-models-all'],
    queryFn:  () => api.get<DeviceModel[]>('/devicemodels/all').then((r) => r.data),
    enabled:  isManager,
    staleTime: 30_000,
  });

  const modelsApi = {
    create: (d: Partial<DeviceModel>) => api.post<DeviceModel>('/devicemodels', d).then((r) => r.data),
    update: (id: string, d: Partial<DeviceModel>) => api.put<DeviceModel>(`/devicemodels/${id}`, d).then((r) => r.data),
    toggle: (id: string, isActive: boolean) => api.put<DeviceModel>(`/devicemodels/${id}`, { isActive }).then((r) => r.data),
  };

  const createModelMut = useMutation({
    mutationFn: modelsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['device-models-all'] }); qc.invalidateQueries({ queryKey: ['device-models'] }); resetModelForm(); },
  });
  const updateModelMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DeviceModel> }) => modelsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['device-models-all'] }); qc.invalidateQueries({ queryKey: ['device-models'] }); resetModelForm(); },
  });
  const toggleModelMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => modelsApi.toggle(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['device-models-all'] }),
  });

  const resetModelForm = () => { setEditingModel(null); setModelForm(emptyModel); setShowModelForm(false); };

  const openEditModel = (m: DeviceModel) => {
    setEditingModel(m);
    setModelForm({ name: m.name, type: m.type, processor: m.processor ?? '', ram: m.ram ?? '', storage: m.storage ?? '', screenSize: m.screenSize ?? '', notes: m.notes ?? '' });
    setShowModelForm(true);
  };

  const handleSaveModel = () => {
    if (!modelForm.name || !modelForm.type) return;
    const payload = { name: modelForm.name, type: modelForm.type as DeviceType, brand: 'Dell', processor: modelForm.processor || undefined, ram: modelForm.ram || undefined, storage: modelForm.storage || undefined, screenSize: modelForm.screenSize || undefined, notes: modelForm.notes || undefined };
    if (editingModel) updateModelMut.mutate({ id: editingModel.id, data: payload });
    else createModelMut.mutate(payload);
  };

  const modelsByType = deviceModels.reduce<Record<string, DeviceModel[]>>((acc, m) => {
    (acc[m.type] = acc[m.type] ?? []).push(m);
    return acc;
  }, {});

  if (!isManager) {
    return (
      <GlassCard padding="md" className="text-center py-12">
        <p className="text-sm text-[var(--text-muted)]">Accès réservé aux managers</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {isManager && !showModelForm && (
        <div className="flex justify-end">
          <button onClick={() => { resetModelForm(); setShowModelForm(true); }} className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm">
            <Plus size={14} /> Nouveau modèle
          </button>
        </div>
      )}

      <AnimatePresence>
        {showModelForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <GlassCard padding="md">
              <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-3">
                {editingModel ? `Modifier — ${editingModel.name}` : 'Nouveau modèle'}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--text-muted)]">Nom *</label>
                  <input value={modelForm.name} onChange={(e) => setModelForm((s) => ({ ...s, name: e.target.value }))} placeholder="Latitude 5460" className="input-glass py-2 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--text-muted)]">Type *</label>
                  <AppSelect value={modelForm.type} onChange={(v) => setModelForm((s) => ({ ...s, type: v as DeviceType }))} options={TYPE_OPTIONS} placeholder="Type…" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--text-muted)]">Processeur</label>
                  <input value={modelForm.processor} onChange={(e) => setModelForm((s) => ({ ...s, processor: e.target.value }))} placeholder="Intel Core i5-1345U" className="input-glass py-2 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--text-muted)]">RAM</label>
                  <input value={modelForm.ram} onChange={(e) => setModelForm((s) => ({ ...s, ram: e.target.value }))} placeholder="16 Go DDR4" className="input-glass py-2 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--text-muted)]">Stockage</label>
                  <input value={modelForm.storage} onChange={(e) => setModelForm((s) => ({ ...s, storage: e.target.value }))} placeholder="256 Go SSD NVMe" className="input-glass py-2 text-sm" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--text-muted)]">Taille écran</label>
                  <input value={modelForm.screenSize} onChange={(e) => setModelForm((s) => ({ ...s, screenSize: e.target.value }))} placeholder='14"' className="input-glass py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={resetModelForm} className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs"><X size={13} /> Annuler</button>
                <button
                  onClick={handleSaveModel}
                  disabled={!modelForm.name || !modelForm.type || createModelMut.isPending || updateModelMut.isPending}
                  className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs disabled:opacity-50"
                >
                  <Save size={13} /> {editingModel ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <GlassCard padding="none">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-4 py-3"><Skeleton className="h-4 w-48" /></div>
          ))}
        </GlassCard>
      ) : deviceModels.length === 0 ? (
        <GlassCard padding="md" className="text-center py-12">
          <p className="text-sm text-[var(--text-muted)]">Aucun modèle configuré</p>
        </GlassCard>
      ) : (
        <GlassCard padding="none">
          {Object.entries(modelsByType).map(([type, models]) => {
            const Icon = TYPE_ICONS[type as DeviceType] ?? HelpCircle;
            return (
              <div key={type}>
                <div className="px-4 py-2 bg-white/[0.02] border-b border-[var(--border-glass)] flex items-center gap-2">
                  <Icon size={12} className="text-[var(--text-muted)]" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {DEVICE_TYPE_LABELS[type as DeviceType]}
                  </p>
                </div>
                {models.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border-glass)] hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className={clsx('text-sm font-medium', m.isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] line-through')}>{m.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate">
                        {[m.processor, m.ram, m.storage, m.screenSize].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0 items-center">
                      <button
                        onClick={() => toggleModelMut.mutate({ id: m.id, isActive: !m.isActive })}
                        className={clsx(
                          'text-[10px] px-2.5 py-1 rounded-lg font-medium transition-colors',
                          m.isActive
                            ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                            : 'bg-slate-500/15 text-slate-400 hover:bg-slate-500/25'
                        )}
                      >
                        {m.isActive ? 'Actif' : 'Inactif'}
                      </button>
                      <button onClick={() => openEditModel(m)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-primary hover:bg-primary/10 transition-colors">
                        <Pencil size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </GlassCard>
      )}
    </div>
  );
}

// ─── Onglet Règles d'alerte ────────────────────────────────────

function TabAlerts({ isManager }: { isManager: boolean }) {
  const qc = useQueryClient();

  const [addingType,      setAddingType]      = useState<DeviceType | ''>('');
  const [addingThreshold, setAddingThreshold] = useState(3);

  const alertsApi = {
    list:   () => api.get<StockAlertRow[]>('/stockalerts').then((r) => r.data),
    upsert: (d: { deviceType: DeviceType; threshold: number; isActive: boolean }) =>
      api.post('/stockalerts', d).then((r) => r.data),
    update: (id: string, d: Partial<{ threshold: number; isActive: boolean }>) =>
      api.put(`/stockalerts/${id}`, d).then((r) => r.data),
    remove: (id: string) => api.delete(`/stockalerts/${id}`),
  };

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['stockalerts'], queryFn: alertsApi.list, staleTime: 30_000,
  });

  const upsertAlertMut = useMutation({
    mutationFn: alertsApi.upsert,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stockalerts'] }); setAddingType(''); setAddingThreshold(3); },
  });
  const updateAlertMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ threshold: number; isActive: boolean }> }) => alertsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stockalerts'] }),
  });
  const deleteAlertMut = useMutation({
    mutationFn: alertsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stockalerts'] }),
  });

  const existingAlertTypes = new Set(alerts.map((a) => a.deviceType));
  const availableAlertTypes = ALL_TYPES.filter((t) => !existingAlertTypes.has(t));
  const triggeredCount = alerts.filter((a) => a.triggered && a.isActive).length;

  return (
    <div className="max-w-2xl">
      <GlassCard padding="none">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--border-glass)]">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Alertes de stock</h2>
            {!isLoading && triggeredCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-semibold">
                {triggeredCount} actif{triggeredCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)]">Alerte quand le stock descend sous le seuil</p>
        </div>

        <div className="divide-y divide-[var(--border-glass)]">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="px-4 py-3"><Skeleton className="h-8 w-full" /></div>)
            : alerts.length === 0
              ? <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">Aucune alerte configurée</p>
              : alerts.map((alert, i) => {
                  const Icon = TYPE_ICONS[alert.deviceType] ?? HelpCircle;
                  return (
                    <motion.div key={alert.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="px-4 py-3 flex items-center gap-3">
                      <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', alert.triggered && alert.isActive ? 'bg-amber-500/15 text-amber-400' : 'bg-primary/10 text-primary')}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[var(--text-primary)]">{DEVICE_TYPE_LABELS[alert.deviceType]}</p>
                          {alert.triggered && alert.isActive && <span className="flex items-center gap-1 text-[10px] text-amber-400"><AlertTriangle size={10} /> Sous le seuil</span>}
                          {!alert.triggered && alert.isActive && <span className="flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle size={10} /> OK</span>}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          Stock actuel : <span className="font-medium text-[var(--text-secondary)]">{alert.currentStock}</span> · Seuil : <span className="font-medium text-[var(--text-secondary)]">{alert.threshold}</span>
                        </p>
                      </div>
                      {isManager && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => updateAlertMut.mutate({ id: alert.id, data: { isActive: !alert.isActive } })} className={clsx('text-xs px-2.5 py-1 rounded-lg font-medium transition-colors', alert.isActive ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-slate-500/15 text-slate-400 hover:bg-slate-500/25')}>
                            {alert.isActive ? 'Actif' : 'Inactif'}
                          </button>
                          <input type="number" defaultValue={alert.threshold} min={0} max={999} className="input-glass w-16 py-1 text-xs text-center"
                            onBlur={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val !== alert.threshold) updateAlertMut.mutate({ id: alert.id, data: { threshold: val } }); }}
                          />
                          <button onClick={() => deleteAlertMut.mutate(alert.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })
          }
        </div>

        {isManager && availableAlertTypes.length > 0 && (
          <div className="px-4 py-3 border-t border-[var(--border-glass)] flex items-center gap-3">
            <Package size={16} className="text-[var(--text-muted)] flex-shrink-0" />
            <div className="flex-1">
              <AppSelect value={addingType} onChange={(v) => setAddingType(v as DeviceType)} options={availableAlertTypes.map((t) => ({ value: t, label: DEVICE_TYPE_LABELS[t] }))} placeholder="Choisir un type…" />
            </div>
            <input type="number" value={addingThreshold} min={1} max={999} onChange={(e) => setAddingThreshold(parseInt(e.target.value) || 1)} className="input-glass w-16 py-1.5 text-xs text-center" />
            <button disabled={!addingType || upsertAlertMut.isPending} onClick={() => addingType && upsertAlertMut.mutate({ deviceType: addingType as DeviceType, threshold: addingThreshold, isActive: true })} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50">
              <Plus size={13} /> Ajouter
            </button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────

export default function Orders() {
  const { user } = useAuthStore();
  const isManager    = user?.role === 'MANAGER';
  const isTechnician = user?.role === 'TECHNICIAN' || isManager;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Commandes & Catalogue</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Gestion des achats, modèles et alertes de stock</p>
      </div>

      <Tabs.Root defaultValue="orders">
        <Tabs.List className="flex gap-1 p-1 rounded-xl border border-[var(--border-glass)] bg-white/[0.02] w-fit mb-6">
          {[
            { value: 'orders',   label: 'Commandes' },
            { value: 'catalogue', label: 'Catalogue modèles' },
            { value: 'alerts',   label: 'Règles d\'alerte' },
          ].map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 outline-none',
                'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                'data-[state=active]:bg-primary/15 data-[state=active]:text-primary'
              )}
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="orders">
          <TabOrders isManager={isManager} />
        </Tabs.Content>
        <Tabs.Content value="catalogue">
          <TabCatalogue isManager={isManager} />
        </Tabs.Content>
        <Tabs.Content value="alerts">
          <TabAlerts isManager={isManager} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
