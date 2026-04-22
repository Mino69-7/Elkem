import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ShoppingCart, Plus, Lock, CheckCircle, Clock, AlertTriangle,
  X, Save, Package, Bell, Pencil, Trash2, Check, History, User,
  Laptop, Monitor, Smartphone, Tablet, Printer,
  Keyboard, Mouse, Headphones, Layers, HelpCircle, GripVertical,
  Tv, Server, Search, ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigate, useLocation } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Skeleton';
import { AppSelect } from '../components/ui/AppSelect';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import api from '../services/api';
import { usePurchaseOrders, useOrderHistory, useCreateOrder, useCancelOrder, useReceiveDevice } from '../hooks/usePurchaseOrders';
import { DEVICE_TYPE_LABELS, KEYBOARD_LAYOUT_LABELS, formatDate } from '../utils/formatters';
import type { Device, DeviceModel, DeviceType, PurchaseOrder, POStatus } from '../types';
import type { POFormData, ReceiveDeviceData } from '../services/purchaseOrder.service';

// ─── Types locaux ─────────────────────────────────────────────

interface StockAlertRow {
  id: string;
  deviceType: DeviceType;
  deviceModelId: string | null;
  deviceModel: { id: string; brand: string; name: string; type: DeviceType } | null;
  threshold: number;
  isActive: boolean;
  currentStock: number;
  triggered: boolean;
}

// ─── Icônes ───────────────────────────────────────────────────

const TYPE_ICONS: Record<DeviceType, React.ComponentType<{ size?: number; className?: string }>> = {
  LAPTOP: Laptop, DESKTOP: Monitor, THIN_CLIENT: Tv, LAB_WORKSTATION: Server,
  SMARTPHONE: Smartphone, TABLET: Tablet, MONITOR: Monitor, KEYBOARD: Keyboard,
  MOUSE: Mouse, HEADSET: Headphones, DOCKING_STATION: Layers,
  PRINTER: Printer, OTHER: HelpCircle,
};

const ALL_TYPES = Object.keys(DEVICE_TYPE_LABELS) as DeviceType[];
const TYPE_OPTIONS = ALL_TYPES
  .filter((t) => t !== 'MOUSE')
  .map((t) => ({ value: t, label: t === 'KEYBOARD' ? 'Clavier / Souris' : DEVICE_TYPE_LABELS[t] }));

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
  resetKey: number;
  lastReceivedSn?: string;
}

// Nettoie un SN scanné : supprime le préfixe "S" ajouté par le GS1 Apple (Application Identifier)
// Ex: "SXYZ123456" → "XYZ123456" (seulement si S + 8+ alphanum)
function cleanSN(raw: string): string {
  const v = raw.trim().toUpperCase();
  if (v.length >= 9 && v.charAt(0) === 'S' && /^[A-Z0-9]+$/.test(v.slice(1))) return v.slice(1);
  return v;
}

function ReceiveModal({ order, onClose, onSubmit, isPending, error, resetKey, lastReceivedSn }: ReceiveModalProps) {
  const [sn,    setSn]    = useState('');
  const [imei,  setImei]  = useState('');
  const [notes, setNotes] = useState('');
  const snRef             = useRef<HTMLInputElement>(null);

  const isPhone = order?.deviceModel.type === 'SMARTPHONE' || order?.deviceModel.type === 'TABLET';

  // Réinitialise le formulaire après chaque réception réussie et refocalise le champ SN
  useEffect(() => {
    if (resetKey === 0) return;
    setSn('');
    setImei('');
    setNotes('');
    setTimeout(() => snRef.current?.focus(), 50);
  }, [resetKey]);

  if (!order) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sn.trim()) return;
    if (isPhone && sn.trim().length < 10) return;
    onSubmit({ serialNumber: sn.trim(), imei: imei.trim() || undefined, notes: notes.trim() || undefined });
  };

  const received = order.receivedCount;
  const total    = order.quantity;
  const pct      = total > 0 ? Math.min((received / total) * 100, 100) : 0;

  return (
    <Dialog.Root open={!!order} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          style={{ background: 'transparent' }}
          onOpenAutoFocus={(e) => { e.preventDefault(); snRef.current?.focus(); }}
        >
          <div className="glass-card rounded-2xl p-6 space-y-4">

            {/* En-tête */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Réception en cours</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Commande {order.reference}</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Compteur réceptionné / total */}
                <div className="text-right">
                  <span className="text-xl font-bold text-[var(--text-primary)]">{received}</span>
                  <span className="text-sm text-[var(--text-muted)]"> / {total}</span>
                  <p className="text-[10px] text-[var(--text-muted)]">réceptionnés</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5"
                  title="Fermer (les appareils déjà réceptionnés sont enregistrés)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Barre de progression */}
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-emerald-400"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>

            {/* Flash succès dernier SN */}
            <AnimatePresence>
              {lastReceivedSn && (
                <motion.div
                  key={lastReceivedSn + resetKey}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2"
                >
                  <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                  <span className="text-xs text-emerald-400 font-mono">{lastReceivedSn}</span>
                  <span className="text-xs text-emerald-400/70">enregistré</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Infos modèle verrouillées */}
            <div className="rounded-xl border border-[var(--border-glass)] bg-white/[0.02] p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                <Lock size={10} />
                Modèle verrouillé — Tag {order.reference}
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

            {/* Formulaire */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--text-muted)]">Numéro de série *</label>
                <input
                  ref={snRef}
                  value={sn}
                  onChange={(e) => {
                    const cleaned = cleanSN(e.target.value);
                    if (isPhone && cleaned.length > 12) return;
                    setSn(cleaned);
                  }}
                  placeholder="Scannez ou saisissez le SN…"
                  required
                  maxLength={isPhone ? 12 : undefined}
                  className="input-glass py-2 text-sm font-mono"
                />
              </div>
              {isPhone && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--text-muted)]">IMEI *</label>
                  <input
                    value={imei}
                    onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); setImei(d.length > 15 ? d.slice(-15) : d); }}
                    placeholder="15 chiffres"
                    required
                    className="input-glass py-2 text-sm font-mono tracking-widest"
                  />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--text-muted)]">Notes</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observations optionnelles…"
                  className="input-glass py-2 text-sm"
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2"
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={isPending || !sn.trim() || (isPhone && !imei.trim())}
                className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50"
              >
                <CheckCircle size={15} />
                {isPending ? 'Enregistrement…' : `Réceptionner (${received + 1}/${total})`}
              </button>

              <p className="text-[10px] text-center text-[var(--text-muted)]">
                Fermer avec ✕ pour interrompre — les appareils déjà réceptionnés sont enregistrés
              </p>
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
  nextRef: string;
}

function POForm({ models, onSubmit, onCancel, isPending, nextRef }: POFormProps) {
  const [form, setForm]           = useState<POFormData>({
    reference:     nextRef,
    deviceModelId: '',
    quantity:      1,
    expectedAt:    '',
    notes:         '',
  });
  const [selectedType, setSelectedType] = useState<DeviceType | ''>('');

  const activeModels   = models.filter((m) => m.isActive);
  const filteredModels = selectedType
    ? activeModels.filter((m) => m.type === selectedType)
    : activeModels;
  const modelOptions   = filteredModels.map((m) => ({ value: m.id, label: `${m.name} — ${m.brand}` }));

  const handleTypeChange = (v: string) => {
    setSelectedType(v as DeviceType | '');
    // Réinitialise le modèle si il n'appartient plus au type sélectionné
    const current = activeModels.find((m) => m.id === form.deviceModelId);
    if (current && v && current.type !== v) {
      setForm((s) => ({ ...s, deviceModelId: '' }));
    }
  };

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
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--text-muted)]">Type</label>
          <AppSelect
            value={selectedType}
            onChange={handleTypeChange}
            options={TYPE_OPTIONS}
            placeholder="Tous les types…"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--text-muted)]">Modèle *</label>
          <AppSelect
            value={form.deviceModelId}
            onChange={(v) => setForm((s) => ({ ...s, deviceModelId: v }))}
            options={modelOptions}
            placeholder={selectedType ? 'Choisir un modèle…' : 'Choisir un type d\'abord…'}
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

function TabOrders({ isManager, nextRef }: { isManager: boolean; nextRef: string }) {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = usePurchaseOrders();
  const createMut  = useCreateOrder();
  const cancelMut  = useCancelOrder();
  const receiveMut = useReceiveDevice();

  const [showForm,        setShowForm]        = useState(false);
  const [receivingOrder,  setReceivingOrder]  = useState<PurchaseOrder | null>(null);
  const [receiveError,    setReceiveError]    = useState('');
  const [resetKey,        setResetKey]        = useState(0);
  const [lastReceivedSn,  setLastReceivedSn]  = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const selectedOrder = useMemo(
    () => (selectedOrderId ? (orders.find((o) => o.id === selectedOrderId) ?? null) : null),
    [orders, selectedOrderId]
  );

  // Récupération des modèles pour le formulaire
  const { data: allModels = [] } = useQuery<DeviceModel[]>({
    queryKey: ['device-models-all'],
    queryFn:  () => api.get<DeviceModel[]>('/devicemodels/all').then((r) => r.data),
    staleTime: 60_000,
  });

  const closeReceiveModal = () => {
    setReceivingOrder(null);
    setLastReceivedSn('');
    setResetKey(0);
    setReceiveError('');
  };

  const handleReceive = (data: ReceiveDeviceData) => {
    if (!receivingOrder) return;
    setReceiveError('');
    receiveMut.mutate(
      { orderId: receivingOrder.id, data },
      {
        onSuccess: () => {
          const newCount = receivingOrder.receivedCount + 1;
          qc.invalidateQueries({ queryKey: ['orders'] });
          qc.invalidateQueries({ queryKey: ['orders-history'] });
          qc.invalidateQueries({ queryKey: ['stock-summary'] });
          qc.invalidateQueries({ queryKey: ['stock-devices'] });
          qc.invalidateQueries({ queryKey: ['ordered-devices'] });
          qc.invalidateQueries({ queryKey: ['stockalerts'] });

          if (newCount >= receivingOrder.quantity) {
            // Commande complète — fermeture automatique
            closeReceiveModal();
          } else {
            // Reste des appareils à réceptionner — on garde le modal ouvert
            setLastReceivedSn(data.serialNumber);
            setResetKey((k) => k + 1);
            setReceivingOrder((prev) =>
              prev ? { ...prev, receivedCount: newCount } : null
            );
          }
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
          {orders.map((order) => {
            const isClickable = order.receivedCount > 0;
            return (
              <div
                key={order.id}
                onClick={() => isClickable && setSelectedOrderId(order.id)}
                className={clsx(isClickable && 'cursor-pointer')}
              >
                <GlassCard padding="md" className={clsx(isClickable && 'hover:border-primary/30 transition-colors')}>
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
                          onClick={(e) => { e.stopPropagation(); setReceiveError(''); setLastReceivedSn(''); setResetKey(0); setReceivingOrder(order); }}
                          className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                        >
                          <Package size={13} /> Réceptionner
                        </button>
                      )}
                      {isManager && order.status !== 'COMPLETE' && order.status !== 'CANCELLED' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm(`Annuler la commande ${order.reference} ?`)) cancelMut.mutate(order.id); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Annuler la commande"
                        >
                          <X size={14} />
                        </button>
                      )}
                      {isClickable && <ChevronRight size={14} className="text-[var(--text-muted)]" />}
                    </div>
                  </div>
                </GlassCard>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal réception */}
      <ReceiveModal
        order={receivingOrder}
        onClose={closeReceiveModal}
        onSubmit={handleReceive}
        isPending={receiveMut.isPending}
        error={receiveError}
        resetKey={resetKey}
        lastReceivedSn={lastReceivedSn}
      />

      {/* Drawer détail commande */}
      <AnimatePresence>
        {selectedOrder && (
          <PODetailDrawer order={selectedOrder} fromTab="orders" onClose={() => setSelectedOrderId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Onglet Catalogue modèles ─────────────────────────────────

const HAS_KEYBOARD_TYPES = ['LAPTOP', 'DESKTOP', 'THIN_CLIENT', 'LAB_WORKSTATION'];

const KEYBOARD_OPTIONS = [
  'AZERTY_FR','QWERTY_UK','QWERTY_ES','QWERTY_IT','QWERTZ_DE',
  'QWERTY_NO','QWERTY_RU','QWERTY_TR','QWERTY_AR',
].map((k) => ({ value: k, label: KEYBOARD_LAYOUT_LABELS[k] ?? k }));

interface ModelFormState {
  name: string; type: DeviceType | ''; brand: string;
  processor: string; ram: string; storage: string; screenSize: string;
  keyboardLayout: string; notes: string;
}

const emptyModel: ModelFormState = { name: '', type: '', brand: '', processor: '', ram: '', storage: '', screenSize: '', keyboardLayout: 'AZERTY_FR', notes: '' };

function TabCatalogue({ isManager }: { isManager: boolean }) {
  const qc = useQueryClient();

  const [editingModel,    setEditingModel]    = useState<DeviceModel | null>(null);
  const [modelForm,       setModelForm]       = useState<ModelFormState>(emptyModel);
  const [showModelForm,   setShowModelForm]   = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Drag state
  const [localModels, setLocalModels] = useState<DeviceModel[]>([]);
  const [draggingId,  setDraggingId]  = useState<string | null>(null); // visuel uniquement
  const [dragOverId,  setDragOverId]  = useState<string | null>(null);
  // Ref pour lire l'id source sans stale closure dans handleDrop
  const draggingIdRef = useRef<string | null>(null);

  const { data: deviceModels = [], isLoading } = useQuery<DeviceModel[]>({
    queryKey: ['device-models-all'],
    queryFn:  () => api.get<DeviceModel[]>('/devicemodels/all').then((r) => r.data),
    enabled:  isManager,
    staleTime: 0,           // toujours frais à chaque montage du composant
    refetchOnMount: true,
  });

  // Sync simple : quand les données serveur changent, on reflète dans le state local
  // (fonctionne aussi avec React StrictMode qui exécute les effets deux fois)
  useEffect(() => {
    setLocalModels(deviceModels);
  }, [deviceModels]);

  const modelsApi = {
    create: (d: Partial<DeviceModel>) => api.post<DeviceModel>('/devicemodels', d).then((r) => r.data),
    update: (id: string, d: Partial<DeviceModel>) => api.put<DeviceModel>(`/devicemodels/${id}`, d).then((r) => r.data),
    toggle: (id: string, isActive: boolean) => api.put<DeviceModel>(`/devicemodels/${id}`, { isActive }).then((r) => r.data),
    delete: (id: string) => api.delete(`/devicemodels/${id}`),
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
  const reorderMut = useMutation({
    mutationFn: (items: { id: string; order: number }[]) => api.patch('/devicemodels/reorder', { items }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['device-models-all'] });
      qc.invalidateQueries({ queryKey: ['stock-summary'] });
    },
    onError: (err) => {
      // Revert optimistic update en cas d'erreur
      setLocalModels(deviceModels);
      console.error('[reorder] Erreur sauvegarde ordre :', err);
    },
  });
  const deleteModelMut = useMutation({
    mutationFn: (id: string) => modelsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['device-models-all'] });
      qc.invalidateQueries({ queryKey: ['device-models'] });
      setConfirmDeleteId(null);
    },
  });

  const resetModelForm = () => { setEditingModel(null); setModelForm(emptyModel); setShowModelForm(false); };

  const openEditModel = (m: DeviceModel) => {
    setEditingModel(m);
    setModelForm({ name: m.name, type: m.type, brand: m.brand, processor: m.processor ?? '', ram: m.ram ?? '', storage: m.storage ?? '', screenSize: m.screenSize ?? '', keyboardLayout: (m as any).keyboardLayout ?? 'AZERTY_FR', notes: m.notes ?? '' });
    setShowModelForm(true);
  };

  const handleSaveModel = () => {
    if (!modelForm.name || !modelForm.type || !modelForm.brand) return;
    const t = modelForm.type as DeviceType;
    const hasSpecs    = ['LAPTOP', 'DESKTOP', 'LAB_WORKSTATION'].includes(t);
    const hasKeyboard = HAS_KEYBOARD_TYPES.includes(t);
    const payload = {
      name:           modelForm.name,
      type:           t,
      brand:          modelForm.brand,
      processor:      hasSpecs    ? modelForm.processor      || undefined : undefined,
      ram:            hasSpecs    ? modelForm.ram             || undefined : undefined,
      storage:        hasSpecs    ? modelForm.storage         || undefined : undefined,
      screenSize:     t === 'LAPTOP' ? modelForm.screenSize  || undefined : undefined,
      keyboardLayout: hasKeyboard ? modelForm.keyboardLayout || undefined : undefined,
      notes:          modelForm.notes || undefined,
    };
    if (editingModel) updateModelMut.mutate({ id: editingModel.id, data: payload });
    else createModelMut.mutate(payload);
  };

  // ── Drag handlers ──────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, id: string) => {
    draggingIdRef.current = id;          // ref = pas de stale closure
    setDraggingId(id);                   // state = pour les classes CSS
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== draggingIdRef.current) setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string, type: string) => {
    e.preventDefault();
    const fromId = draggingIdRef.current; // lecture via ref : toujours à jour
    // Réinitialise immédiatement les indicateurs visuels
    draggingIdRef.current = null;
    setDraggingId(null);
    setDragOverId(null);

    if (!fromId || fromId === targetId) return;

    const typeModels = localModels.filter((m) => m.type === type);
    const fromIdx = typeModels.findIndex((m) => m.id === fromId);
    const toIdx   = typeModels.findIndex((m) => m.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    // Réordonne le groupe du type concerné
    const reordered = [...typeModels];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Remplace les éléments du type à leurs positions dans le tableau global
    const updated = [...localModels];
    const typeIndices = updated.reduce<number[]>((acc, m, i) => {
      if (m.type === type) acc.push(i);
      return acc;
    }, []);
    reordered.forEach((m, j) => { updated[typeIndices[j]] = { ...m, order: j }; });

    // Mise à jour optimiste immédiate (visible avant la réponse serveur)
    setLocalModels(updated);

    // Sauvegarde en base — onSuccess invalide les queries → refetch → sync confirmée
    reorderMut.mutate(reordered.map((m, idx) => ({ id: m.id, order: idx })));
  };

  const handleDragEnd = () => {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
  };

  const modelsByType = localModels.reduce<Record<string, DeviceModel[]>>((acc, m) => {
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
                {/* Ligne 1 : Type + Marque */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--text-muted)]">Type *</label>
                  <AppSelect
                    value={modelForm.type}
                    onChange={(v) => {
                      const next = v as DeviceType;
                      const hasSpecs    = ['LAPTOP', 'DESKTOP', 'LAB_WORKSTATION'].includes(next);
                      const hasKeyboard = HAS_KEYBOARD_TYPES.includes(next);
                      setModelForm((s) => ({
                        ...s,
                        type:           next,
                        processor:      hasSpecs    ? s.processor  : '',
                        ram:            hasSpecs    ? s.ram        : '',
                        storage:        hasSpecs    ? s.storage    : '',
                        screenSize:     next === 'LAPTOP' ? s.screenSize : '',
                        keyboardLayout: hasKeyboard ? s.keyboardLayout : '',
                      }));
                    }}
                    options={TYPE_OPTIONS}
                    placeholder="Type…"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--text-muted)]">Marque *</label>
                  <input value={modelForm.brand} onChange={(e) => setModelForm((s) => ({ ...s, brand: e.target.value }))} placeholder="Dell, Apple, Samsung…" className="input-glass py-2 text-sm" />
                </div>
                {/* Ligne 2 : Nom (pleine largeur) */}
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-xs text-[var(--text-muted)]">Nom du modèle *</label>
                  <input value={modelForm.name} onChange={(e) => setModelForm((s) => ({ ...s, name: e.target.value }))} placeholder="iPhone 17 Pro, Latitude 5460, UltraSharp 27…" className="input-glass py-2 text-sm" />
                </div>
                {/* Specs conditionnelles — LAPTOP, PC Fixe, PC Labo uniquement */}
                {['LAPTOP', 'DESKTOP', 'LAB_WORKSTATION'].includes(modelForm.type) && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-[var(--text-muted)]">Processeur / Puce</label>
                      <input value={modelForm.processor} onChange={(e) => setModelForm((s) => ({ ...s, processor: e.target.value }))} placeholder="Core Ultra 5 125U, i7-1265U…" className="input-glass py-2 text-sm" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-[var(--text-muted)]">RAM</label>
                      <input value={modelForm.ram} onChange={(e) => setModelForm((s) => ({ ...s, ram: e.target.value }))} placeholder="16 Go DDR4, 32 Go DDR5…" className="input-glass py-2 text-sm" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-[var(--text-muted)]">Stockage</label>
                      <input value={modelForm.storage} onChange={(e) => setModelForm((s) => ({ ...s, storage: e.target.value }))} placeholder="256 Go SSD, 512 Go NVMe…" className="input-glass py-2 text-sm" />
                    </div>
                    {modelForm.type === 'LAPTOP' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-[var(--text-muted)]">Taille écran</label>
                        <input value={modelForm.screenSize} onChange={(e) => setModelForm((s) => ({ ...s, screenSize: e.target.value }))} placeholder='14", 15.6"…' className="input-glass py-2 text-sm" />
                      </div>
                    )}
                  </>
                )}
                {/* Clavier — tous les postes de travail */}
                {HAS_KEYBOARD_TYPES.includes(modelForm.type) && (
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-xs text-[var(--text-muted)]">Disposition clavier</label>
                    <AppSelect
                      value={modelForm.keyboardLayout}
                      onChange={(v) => setModelForm((s) => ({ ...s, keyboardLayout: v }))}
                      options={KEYBOARD_OPTIONS}
                      placeholder="Clavier…"
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={resetModelForm} className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs"><X size={13} /> Annuler</button>
                <button
                  onClick={handleSaveModel}
                  disabled={!modelForm.name || !modelForm.type || !modelForm.brand || createModelMut.isPending || updateModelMut.isPending}
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
      ) : localModels.length === 0 ? (
        <GlassCard padding="md" className="text-center py-12">
          <p className="text-sm text-[var(--text-muted)]">Aucun modèle configuré</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {Object.entries(modelsByType).map(([type, models]) => {
            const Icon = TYPE_ICONS[type as DeviceType] ?? HelpCircle;
            return (
              <GlassCard key={type} padding="none">
                {/* ── En-tête de groupe ── */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-glass)]">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.12)' }}>
                    <Icon size={12} className="text-primary" />
                  </div>
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">
                    {DEVICE_TYPE_LABELS[type as DeviceType]}
                  </p>
                  <span className="ml-auto text-[10px] text-[var(--text-muted)]">
                    {models.length} modèle{models.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* ── Lignes draggables ── */}
                {models.map((m, idx) => (
                  <div
                    key={m.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, m.id)}
                    onDragOver={(e) => handleDragOver(e, m.id)}
                    onDrop={(e) => handleDrop(e, m.id, type)}
                    onDragEnd={handleDragEnd}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 transition-colors select-none',
                      idx < models.length - 1 && 'border-b border-[var(--border-glass)]/60',
                      draggingId === m.id
                        ? 'opacity-40 bg-primary/5'
                        : dragOverId === m.id
                          ? 'border-t-2 border-t-primary/60 bg-primary/[0.04]'
                          : 'hover:bg-white/[0.025]'
                    )}
                  >
                    {/* Poignée drag */}
                    <GripVertical
                      size={14}
                      className="text-[var(--text-muted)] cursor-grab active:cursor-grabbing flex-shrink-0 opacity-30 hover:opacity-70 transition-opacity"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={clsx('text-sm font-medium', m.isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] line-through')}>{m.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                        <span className="text-[var(--text-secondary)]">{m.brand}</span>
                        {[m.processor, m.ram, m.storage, m.screenSize].filter(Boolean).length > 0 && (
                          <span> · {[m.processor, m.ram, m.storage, m.screenSize].filter(Boolean).join(' · ')}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0 items-center">
                      {confirmDeleteId === m.id ? (
                        <>
                          <span className="text-[10px] text-[var(--text-muted)]">Confirmer ?</span>
                          <button
                            onClick={() => deleteModelMut.mutate(m.id)}
                            disabled={deleteModelMut.isPending}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-white/5 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <>
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
                          <button onClick={() => setConfirmDeleteId(m.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Sentinel pour "aucun modèle sélectionné" dans AppSelect — Radix UI interdit value=""
const MODEL_ALL = '__ALL__';

// ─── Onglet Règles d'alerte ────────────────────────────────────

function TabAlerts({ isManager }: { isManager: boolean }) {
  const qc = useQueryClient();
  const { clearInventaireModelsViewed } = useUIStore();

  const [addingType,      setAddingType]      = useState<DeviceType | ''>('');
  // '__ALL__' = alerte par type (aucun modèle spécifique) — jamais ''
  const [addingModelId,   setAddingModelId]   = useState<string>(MODEL_ALL);
  const [addingThreshold, setAddingThreshold] = useState(3);

  const alertsApi = {
    list:   () => api.get<StockAlertRow[]>('/stockalerts').then((r) => r.data),
    upsert: (d: { deviceType: DeviceType; deviceModelId: string | null; threshold: number; isActive: boolean }) =>
      api.post('/stockalerts', d).then((r) => r.data),
    update: (id: string, d: Partial<{ threshold: number; isActive: boolean }>) =>
      api.put(`/stockalerts/${id}`, d).then((r) => r.data),
    remove: (id: string) => api.delete(`/stockalerts/${id}`),
  };

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['stockalerts'], queryFn: alertsApi.list, staleTime: 30_000,
  });

  // Modèles actifs — même clé que le catalogue pour bénéficier du cache
  const { data: activeModels = [] } = useQuery<DeviceModel[]>({
    queryKey: ['device-models'],
    queryFn:  () => api.get<DeviceModel[]>('/devicemodels').then((r) => r.data),
    staleTime: 60_000,
  });

  // Modèles filtrés par le type sélectionné
  const modelsForType = useMemo(
    () => (addingType ? activeModels.filter((m) => m.type === addingType) : []),
    [activeModels, addingType]
  );

  // IDs de modèles déjà couverts par une alerte par-modèle
  const alertedModelIds = useMemo(
    () => new Set(alerts.filter((a) => a.deviceModelId).map((a) => a.deviceModelId!)),
    [alerts]
  );
  // Types déjà couverts par une alerte "par type" (deviceModelId = null)
  const alertedTypes = useMemo(
    () => new Set(alerts.filter((a) => !a.deviceModelId).map((a) => a.deviceType)),
    [alerts]
  );

  const upsertAlertMut = useMutation({
    mutationFn: alertsApi.upsert,
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ['stockalerts'] });
      // Clear viewed state so pastilles réapparaissent immédiatement si stock sous seuil
      if (variables.deviceModelId) {
        clearInventaireModelsViewed([variables.deviceModelId]);
      } else {
        // Alerte par type → effacer tous les modèles de ce type
        const ids = activeModels.filter((m) => m.type === variables.deviceType).map((m) => m.id);
        if (ids.length) clearInventaireModelsViewed(ids);
      }
      setAddingType('');
      setAddingModelId(MODEL_ALL);
      setAddingThreshold(3);
    },
  });
  const updateAlertMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ threshold: number; isActive: boolean }> }) =>
      alertsApi.update(id, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ['stockalerts'] });
      // Si le seuil change, réinitialiser l'état vu pour que les pastilles se mettent à jour
      if (variables.data.threshold !== undefined) {
        const alert = alerts.find((a) => a.id === variables.id);
        if (alert) {
          if (alert.deviceModelId) {
            clearInventaireModelsViewed([alert.deviceModelId]);
          } else {
            const ids = activeModels.filter((m) => m.type === alert.deviceType).map((m) => m.id);
            if (ids.length) clearInventaireModelsViewed(ids);
          }
        }
      }
    },
  });
  const deleteAlertMut = useMutation({
    mutationFn: alertsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stockalerts'] }),
  });

  const triggeredCount = alerts.filter((a) => a.triggered && a.isActive).length;
  const typeAlerts      = alerts.filter((a) => !a.deviceModelId);
  const modelAlerts     = alerts.filter((a) =>  !!a.deviceModelId);

  const handleAdd = () => {
    if (!addingType) return;
    upsertAlertMut.mutate({
      deviceType:    addingType as DeviceType,
      // MODEL_ALL = pas de modèle spécifique → null côté backend
      deviceModelId: addingModelId === MODEL_ALL ? null : addingModelId,
      threshold:     addingThreshold,
      isActive:      true,
    });
  };

  const handleTypeChange = (type: string) => {
    setAddingType(type as DeviceType);
    setAddingModelId(MODEL_ALL); // reset modèle à chaque changement de type
  };

  const canAdd = !!addingType && !upsertAlertMut.isPending;

  // Options du dropdown modèle — MODEL_ALL en premier, JAMAIS value=""
  const modelOptions = useMemo(() => [
    { value: MODEL_ALL, label: 'Tous les modèles' },
    ...modelsForType
      .filter((m) => !alertedModelIds.has(m.id))
      .map((m) => ({ value: m.id, label: `${m.brand} ${m.name}` })),
  ], [modelsForType, alertedModelIds]);

  const renderAlertRow = (alert: StockAlertRow) => {
    const Icon = TYPE_ICONS[alert.deviceType] ?? HelpCircle;
    const label = alert.deviceModel
      ? `${alert.deviceModel.brand} ${alert.deviceModel.name}`
      : DEVICE_TYPE_LABELS[alert.deviceType];

    return (
      <div
        key={alert.id}
        className="px-4 py-3 flex items-center gap-3"
      >
        <div className={clsx(
          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
          alert.triggered && alert.isActive ? 'bg-amber-500/15 text-amber-400' : 'bg-primary/10 text-primary'
        )}>
          <Icon size={16} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">{label}</p>
            {alert.deviceModel && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 flex-shrink-0">
                par modèle
              </span>
            )}
            {alert.triggered && alert.isActive && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 flex-shrink-0">
                <AlertTriangle size={10} /> Sous le seuil
              </span>
            )}
            {!alert.triggered && alert.isActive && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 flex-shrink-0">
                <CheckCircle size={10} /> OK
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {alert.deviceModel && (
              <span className="mr-1.5 opacity-60">{DEVICE_TYPE_LABELS[alert.deviceType]} ·</span>
            )}
            Stock actuel : <span className="font-medium text-[var(--text-secondary)]">{alert.currentStock}</span>
            {' '}· Seuil : <span className="font-medium text-[var(--text-secondary)]">{alert.threshold}</span>
          </p>
        </div>

        {isManager && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => updateAlertMut.mutate({ id: alert.id, data: { isActive: !alert.isActive } })}
              className={clsx(
                'text-xs px-2.5 py-1 rounded-lg font-medium transition-colors',
                alert.isActive
                  ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                  : 'bg-slate-500/15 text-slate-400 hover:bg-slate-500/25'
              )}
            >
              {alert.isActive ? 'Actif' : 'Inactif'}
            </button>
            <input
              type="number" defaultValue={alert.threshold} min={0} max={999}
              className="input-glass w-16 py-1 text-xs text-center"
              onBlur={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val !== alert.threshold)
                  updateAlertMut.mutate({ id: alert.id, data: { threshold: val } });
              }}
            />
            <button
              onClick={() => deleteAlertMut.mutate(alert.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-2xl">
      <GlassCard padding="none">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 pt-4 pb-3 border-b border-[var(--border-glass)]">
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

        {/* Skeleton initial */}
        {isLoading && (
          <div className="divide-y divide-[var(--border-glass)]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-3"><Skeleton className="h-8 w-full" /></div>
            ))}
          </div>
        )}

        {/* Aucune alerte */}
        {!isLoading && alerts.length === 0 && (
          <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">Aucune alerte configurée</p>
        )}

        {/* Alertes par type */}
        {!isLoading && typeAlerts.length > 0 && (
          <div>
            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              Par type d'appareil
            </p>
            <div className="divide-y divide-[var(--border-glass)]">
              {typeAlerts.map((alert) => renderAlertRow(alert))}
            </div>
          </div>
        )}

        {/* Alertes par modèle */}
        {!isLoading && modelAlerts.length > 0 && (
          <div className={clsx(typeAlerts.length > 0 && 'border-t border-[var(--border-glass)]')}>
            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              Par modèle
            </p>
            <div className="divide-y divide-[var(--border-glass)]">
              {modelAlerts.map((alert) => renderAlertRow(alert))}
            </div>
          </div>
        )}

        {/* Formulaire d'ajout */}
        {isManager && (
          <div className="px-4 py-3 border-t border-[var(--border-glass)]">
            <div className="flex flex-wrap items-center gap-2">
              <Package size={15} className="text-[var(--text-muted)] flex-shrink-0" />

              {/* Type */}
              <div className="w-40 flex-shrink-0">
                <AppSelect
                  value={addingType}
                  onChange={handleTypeChange}
                  options={ALL_TYPES.map((t) => ({ value: t, label: DEVICE_TYPE_LABELS[t] }))}
                  placeholder="Type…"
                />
              </div>

              {/* Modèle — visible uniquement si le type a des modèles actifs */}
              {addingType && modelsForType.length > 0 && (
                <div className="w-52 flex-shrink-0">
                  {/* RÈGLE ABSOLUE : jamais value="" dans AppSelect → sentinel MODEL_ALL */}
                  <AppSelect
                    value={addingModelId}
                    onChange={(v) => setAddingModelId(v)}
                    options={modelOptions}
                    placeholder="Modèle (optionnel)"
                  />
                </div>
              )}

              {/* Avertissement type déjà couvert */}
              {addingType && alertedTypes.has(addingType as DeviceType) && addingModelId === MODEL_ALL && (
                <span className="text-[11px] text-amber-400 flex items-center gap-1 flex-shrink-0">
                  <AlertTriangle size={11} /> Alerte type existante
                </span>
              )}

              {/* Seuil */}
              <input
                type="number"
                value={addingThreshold}
                min={1} max={999}
                onChange={(e) => setAddingThreshold(parseInt(e.target.value) || 1)}
                className="input-glass w-16 py-1.5 text-xs text-center flex-shrink-0"
              />

              <button
                disabled={!canAdd}
                onClick={handleAdd}
                className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50 flex-shrink-0"
              >
                <Plus size={13} /> Ajouter
              </button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// ─── Drawer détail commande ───────────────────────────────────

function PODetailDrawer({ order, fromTab, onClose }: { order: PurchaseOrder; fromTab: string; onClose: () => void }) {
  const navigate = useNavigate();
  const devices: Device[] = order.devices ?? [];

  const handleDeviceClick = (device: Device) => {
    const { status } = device;
    if (['ASSIGNED', 'PENDING_RETURN', 'LOANER'].includes(status)) {
      navigate(`/devices/${device.id}`, { state: { from: '/orders', fromTab } });
    } else if (status === 'IN_STOCK') {
      navigate(`/devices/${device.id}`, { state: { from: '/stock', fromTab: 'inventaire' } });
    } else if (status === 'IN_MAINTENANCE') {
      navigate(`/devices/${device.id}`, { state: { from: '/orders', fromTab } });
    } else if (['RETIRED', 'LOST', 'STOLEN'].includes(status)) {
      navigate(`/devices/${device.id}`, { state: { from: '/orders', fromTab } });
    }
    onClose();
  };

  const Icon = TYPE_ICONS[order.deviceModel.type] ?? HelpCircle;

  return createPortal(
    <>
      {/* Backdrop léger — même style que DeviceForm */}
      <motion.div
        key="po-backdrop"
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,10,0.42)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', cursor: 'pointer' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.20 }}
        onClick={onClose}
      />

      {/* Drawer flottant arrondi — même patron que DeviceForm */}
      <motion.div
        key="po-drawer"
        className="modal-glass flex flex-col pointer-events-auto"
        style={{
          position: 'fixed',
          right: '16px',
          top: '16px',
          bottom: '16px',
          width: '480px',
          maxWidth: 'calc(100vw - 32px)',
          zIndex: 201,
        }}
        initial={{ x: 'calc(100% + 24px)', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 'calc(100% + 24px)', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.85 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Décorations liquid glass ── */}
        {/* Ligne specular supérieure */}
        <div className="absolute inset-x-0 top-0 h-[2px] pointer-events-none flex-shrink-0" style={{ borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', background: 'linear-gradient(90deg, transparent 5%, rgba(180,160,255,0.80) 30%, rgba(99,200,255,0.65) 70%, transparent 95%)' }} />
        {/* Reflet vertical gauche */}
        <div className="absolute top-0 left-0 pointer-events-none" style={{ width: '2px', height: '45%', background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)' }} />
        {/* Orbe indigo haut-droite */}
        <div className="absolute pointer-events-none" style={{ top: '-50px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(6,182,212,0.08) 45%, transparent 68%)', filter: 'blur(10px)' }} />
        {/* Orbe subtil bas-gauche */}
        <div className="absolute pointer-events-none" style={{ bottom: '-30px', left: '-30px', width: '140px', height: '140px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', filter: 'blur(8px)' }} />

        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 flex-shrink-0 relative z-10" style={{ borderBottom: '1px solid rgba(139,120,255,0.20)' }}>
          {/* Icône type */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.20)' }}
          >
            <Icon size={16} className="text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{order.reference}</span>
              <POStatusBadge status={order.status} />
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {order.deviceModel.brand} {order.deviceModel.name}
              <span className="ml-2">— {DEVICE_TYPE_LABELS[order.deviceModel.type]}</span>
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              {order.receivedCount} / {order.quantity} appareil{order.quantity > 1 ? 's' : ''} reçu{order.receivedCount > 1 ? 's' : ''}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-150"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
          >
            <X size={15} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Liste des appareils */}
        <div className="flex-1 overflow-y-auto px-5 py-4 relative z-10">
          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package size={32} className="mb-3" style={{ color: 'var(--text-muted)', opacity: 0.30 }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun appareil réceptionné</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                Appareils réceptionnés ({devices.length})
              </p>
              {devices.map((device) => {
                const isNavigable = !['ORDERED'].includes(device.status);
                return (
                  <div
                    key={device.id}
                    onClick={() => isNavigable && handleDeviceClick(device)}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150',
                      isNavigable
                        ? 'cursor-pointer'
                        : 'opacity-50 cursor-default'
                    )}
                    style={{
                      border: '1px solid rgba(139,120,255,0.15)',
                      background: 'rgba(255,255,255,0.02)',
                    }}
                    onMouseEnter={(e) => {
                      if (isNavigable) {
                        (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,102,241,0.08)';
                        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.30)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,120,255,0.15)';
                    }}
                  >
                    {/* SN + Tag */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {device.serialNumber}
                        </span>
                        {device.assetTag && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono whitespace-nowrap" style={{ background: 'rgba(99,102,241,0.15)', color: 'rgb(129,140,248)' }}>
                            {device.assetTag}
                          </span>
                        )}
                      </div>
                      {device.assignedUser && (
                        <div className="flex items-center gap-1 mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          <User size={9} />
                          <span className="truncate">{device.assignedUser.displayName}</span>
                        </div>
                      )}
                    </div>
                    {/* Statut + flèche */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={device.status} />
                      {isNavigable && (
                        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </>,
    document.body
  );
}

// ─── Onglet Historique ────────────────────────────────────────

function TabHistory() {
  const { data: history = [], isLoading } = useOrderHistory();
  const [search,           setSearch]           = useState('');
  const [selectedOrderId,  setSelectedOrderId]  = useState<string | null>(null);

  // Toujours dérivé du cache live → se met à jour si un refetch a lieu pendant que le drawer est ouvert
  const selectedOrder = useMemo(
    () => (selectedOrderId ? (history.find((o) => o.id === selectedOrderId) ?? null) : null),
    [history, selectedOrderId]
  );

  // Filtre par référence OU par SN d'un appareil lié
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return history;
    return history.filter((order) =>
      order.reference.toLowerCase().includes(q) ||
      (order.devices ?? []).some((d) => d.serialNumber.toLowerCase().includes(q))
    );
  }, [history, search]);

  // IDs des commandes dont la correspondance vient du SN (pas de la référence)
  const snMatchIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return new Set<string>();
    const matched = new Set<string>();
    history.forEach((order) => {
      const refMatch = order.reference.toLowerCase().includes(q);
      const snMatch  = (order.devices ?? []).some((d) => d.serialNumber.toLowerCase().includes(q));
      if (snMatch && !refMatch) matched.add(order.id);
    });
    return matched;
  }, [history, search]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <GlassCard key={i} padding="md"><Skeleton className="h-14 w-full" /></GlassCard>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Barre de recherche */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Référence ou N° de série…"
          className="input-glass pl-8 pr-8 py-2 text-sm w-full"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <GlassCard padding="md" className="text-center py-12">
          <History size={32} className="mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
          <p className="text-sm text-[var(--text-muted)]">Aucune commande dans l'historique</p>
        </GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard padding="md" className="text-center py-8">
          <p className="text-sm text-[var(--text-muted)]">Aucun résultat pour « {search} »</p>
        </GlassCard>
      ) : (
        filtered.map((order) => {
          const isClickable = order.receivedCount > 0;
          const hasSNMatch  = snMatchIds.has(order.id);
          return (
            <div
              key={order.id}
              onClick={() => isClickable && setSelectedOrderId(order.id)}
              className={clsx(isClickable && 'cursor-pointer')}
            >
              <GlassCard padding="md" className={clsx(isClickable && 'hover:border-primary/30 transition-colors')}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{order.reference}</span>
                      <POStatusBadge status={order.status} />
                      {hasSNMatch && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 text-[10px] font-semibold">
                          SN trouvé
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {order.deviceModel.brand} {order.deviceModel.name}
                      <span className="text-[var(--text-muted)] ml-2">— {DEVICE_TYPE_LABELS[order.deviceModel.type]}</span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(order.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <User size={10} />
                        {order.createdBy?.displayName ?? '—'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        {order.receivedCount} / {order.quantity}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">appareils reçus</div>
                    </div>
                    {isClickable && <ChevronRight size={14} className="text-[var(--text-muted)]" />}
                  </div>
                </div>
              </GlassCard>
            </div>
          );
        })
      )}

      <AnimatePresence>
        {selectedOrder && (
          <PODetailDrawer order={selectedOrder} fromTab="history" onClose={() => setSelectedOrderId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────

export default function Orders() {
  const { user }   = useAuthStore();
  const location   = useLocation();
  const isManager  = user?.role === 'MANAGER';
  const [activeTab, setActiveTab] = useState<string>(
    (location.state as any)?.tab ?? 'orders'
  );

  // Re-sync quand la navigation change (ex: retour depuis DeviceDetail ou clic Sidebar)
  useEffect(() => {
    const t = (location.state as any)?.tab;
    setActiveTab(t ?? 'orders');
  }, [location.state]);

  // nextRef calculé depuis l'historique complet pour éviter les doublons
  const { data: history = [] } = useOrderHistory();
  const year = new Date().getFullYear();
  const nextRef = useMemo(() => {
    const refs = history.map((o) => o.reference).filter((r) => r.startsWith(`CMD-${year}-`));
    const maxN = refs.reduce((max, r) => {
      const n = parseInt(r.split('-')[2] ?? '0');
      return n > max ? n : max;
    }, 0);
    return `CMD-${year}-${String(maxN + 1).padStart(3, '0')}`;
  }, [history, year]);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Commandes & Catalogue</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Gestion des achats, modèles et alertes de stock</p>
      </div>

      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="tabs-glass mb-6">
          {[
            { value: 'orders',    label: 'Commandes' },
            { value: 'catalogue', label: 'Catalogue modèles' },
            { value: 'alerts',    label: "Règles d'alerte" },
            { value: 'history',   label: 'Historique' },
          ].map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className={clsx(
                'relative px-4 py-2 rounded-[18px] text-sm font-medium outline-none transition-colors',
                activeTab === tab.value ? 'text-primary' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {activeTab === tab.value && (
                <motion.div
                  layoutId="orders-tabs-pill"
                  className="absolute inset-0 rounded-[18px]"
                  style={{
                    background: 'rgba(99,102,241,0.13)',
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

        <Tabs.Content value="orders">
          <TabOrders isManager={isManager} nextRef={nextRef} />
        </Tabs.Content>
        <Tabs.Content value="catalogue">
          <TabCatalogue isManager={isManager} />
        </Tabs.Content>
        <Tabs.Content value="alerts">
          <TabAlerts isManager={isManager} />
        </Tabs.Content>
        <Tabs.Content value="history">
          <TabHistory />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
