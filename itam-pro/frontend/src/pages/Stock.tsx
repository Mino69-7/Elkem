import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import {
  Plus, Package, ShoppingCart, AlertTriangle, CheckCircle,
  Laptop, Monitor, Smartphone, Tablet, Printer, Keyboard,
  Mouse, Headphones, Layers, HelpCircle, Cpu, MemoryStick, HardDrive,
  Trash2, LayoutGrid, List, ArrowLeft, Tv, Server, Wrench,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import api from '../services/api';
import { deviceService } from '../services/device.service';
import { GlassCard } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusBadge } from '../components/ui/StatusBadge';
import DeviceForm from '../components/devices/DeviceForm';
import { DEVICE_TYPE_LABELS, formatDate } from '../utils/formatters';
import type { DeviceType, Device } from '../types';
import type { DeviceFormData } from '../services/device.service';

// ─── Types ────────────────────────────────────────────────────

interface ModelStock {
  id: string;
  name: string;
  type: DeviceType;
  brand: string;
  processor?: string;
  ram?: string;
  storage?: string;
  screenSize?: string;
  order: number;
  inStock: number;
  ordered: number;
}

// ─── Icônes par type ──────────────────────────────────────────

const TYPE_ICONS: Record<DeviceType, React.ComponentType<{ size?: number; className?: string }>> = {
  LAPTOP: Laptop, DESKTOP: Monitor, THIN_CLIENT: Tv, LAB_WORKSTATION: Server,
  SMARTPHONE: Smartphone, TABLET: Tablet, MONITOR: Monitor, KEYBOARD: Keyboard,
  MOUSE: Mouse, HEADSET: Headphones, DOCKING_STATION: Layers, PRINTER: Printer, OTHER: HelpCircle,
};

const TYPE_ORDER: DeviceType[] = [
  'LAPTOP', 'DESKTOP', 'THIN_CLIENT', 'LAB_WORKSTATION', 'SMARTPHONE', 'TABLET', 'PRINTER',
  'MONITOR', 'KEYBOARD', 'MOUSE', 'HEADSET', 'DOCKING_STATION', 'OTHER',
];

// ─── Onglet Inventaire ────────────────────────────────────────

function TabInventaire({ formOpen, setFormOpen }: { formOpen: boolean; setFormOpen: (v: boolean) => void }) {
  const qc       = useQueryClient();
  const navigate = useNavigate();
  const [viewMode, setViewMode]         = useState<'grid' | 'list'>('grid');
  const [selectedModel, setSelectedModel] = useState<ModelStock | null>(null);

  const { data: modelStock = [], isLoading: loadingModels } = useQuery<ModelStock[]>({
    queryKey: ['stock-summary'],
    queryFn:  async () => { const { data } = await api.get('/devicemodels/stock-summary'); return data; },
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: stockDevices, isLoading: loadingDevices } = useQuery<{ data: Device[]; total: number }>({
    queryKey: ['stock-devices'],
    queryFn:  async () => {
      const { data } = await api.get('/devices?status=IN_STOCK&limit=200&sortBy=updatedAt&sortOrder=desc');
      return data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: orderedDevices } = useQuery<{ data: Device[]; total: number }>({
    queryKey: ['ordered-devices'],
    queryFn:  async () => {
      const { data } = await api.get('/devices?status=ORDERED&limit=100');
      return data;
    },
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: (d: DeviceFormData) => deviceService.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-summary'] });
      qc.invalidateQueries({ queryKey: ['stock-devices'] });
      qc.invalidateQueries({ queryKey: ['devices'] });
      setFormOpen(false);
    },
  });

  const byType = TYPE_ORDER.reduce<Record<string, ModelStock[]>>((acc, t) => {
    const group = modelStock.filter((m) => m.type === t);
    if (group.length) acc[t] = group;
    return acc;
  }, {});

  const totalInStock = modelStock.reduce((s, m) => s + m.inStock, 0);
  const totalOrdered = modelStock.reduce((s, m) => s + m.ordered, 0);
  const alertCount   = modelStock.filter((m) => m.inStock === 0).length;

  const allDevices = [...(stockDevices?.data ?? []), ...(orderedDevices?.data ?? [])];

  const goToDevice = (deviceId: string) =>
    navigate(`/devices/${deviceId}`, { state: { from: '/stock' } });

  // ─── Vue détail modèle ──────────────────────────────────────

  if (selectedModel) {
    const modelDevices = allDevices.filter((d) => d.model === selectedModel.name && d.brand === selectedModel.brand);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedModel(null)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="font-semibold text-[var(--text-primary)]">{selectedModel.brand} {selectedModel.name}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {DEVICE_TYPE_LABELS[selectedModel.type]} · {modelDevices.length} appareil{modelDevices.length !== 1 ? 's' : ''}
              {selectedModel.processor && ` · ${selectedModel.processor}`}
              {selectedModel.ram && ` · ${selectedModel.ram}`}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              selectedModel.inStock === 0 ? 'bg-amber-400/15 text-amber-400' : 'bg-emerald-400/15 text-emerald-400'
            }`}>
              {selectedModel.inStock === 0 ? <AlertTriangle size={11} /> : <CheckCircle size={11} />}
              {selectedModel.inStock} en stock
            </span>
            {selectedModel.ordered > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-400/15 text-indigo-400">
                <ShoppingCart size={11} />
                +{selectedModel.ordered} commandé{selectedModel.ordered > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {loadingDevices ? (
          <GlassCard padding="none">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-[var(--border-glass)]">
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </GlassCard>
        ) : modelDevices.length === 0 ? (
          <GlassCard padding="md" className="text-center py-10">
            <p className="text-sm text-[var(--text-muted)]">Aucun appareil pour ce modèle</p>
          </GlassCard>
        ) : (
          <GlassCard padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-glass)]">
                    {['Tag IT', 'N° Série', 'Site', 'Statut', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modelDevices.map((device, i) => (
                    <motion.tr
                      key={device.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => goToDevice(device.id)}
                      className="border-b border-[var(--border-glass)]/50 hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--text-primary)]">
                        {device.assetTag ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                        {device.serialNumber}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                        {device.site ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={device.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] text-primary">Détail →</span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}

        <DeviceForm
          device={null}
          isOpen={formOpen}
          isSaving={createMut.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(data) => createMut.mutate(data)}
        />
      </div>
    );
  }

  // ─── Vue principale ─────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ─── KPIs ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'En stock',  value: totalInStock, icon: Package,       color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
          { label: 'Commandés', value: totalOrdered, icon: ShoppingCart,  color: 'text-indigo-400',  bg: 'bg-indigo-400/10'  },
          { label: 'Ruptures',  value: alertCount,   icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-400/10'   },
        ].map((kpi, i) => (
          <GlassCard key={kpi.label} padding="md" animate index={i}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.bg}`}>
                <kpi.icon size={18} className={kpi.color} />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">{kpi.label}</p>
                <p className={`text-2xl font-bold ${kpi.color}`}>
                  {loadingModels ? '…' : kpi.value}
                </p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* ─── Inventaire par modèle ───────────────────────────── */}
      {loadingModels ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <GlassCard key={i} padding="md"><Skeleton className="h-24 w-full" /></GlassCard>
          ))}
        </div>
      ) : Object.keys(byType).length === 0 ? (
        <GlassCard padding="md" className="text-center py-10">
          <p className="text-[var(--text-muted)] text-sm">
            Aucun modèle dans le catalogue — ajoutez-en depuis Commandes
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {/* Toggle vue */}
          <div className="flex justify-end gap-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-primary/15 text-primary' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
              title="Vue grille"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-primary/15 text-primary' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
              title="Vue liste"
            >
              <List size={15} />
            </button>
          </div>

          {viewMode === 'grid' ? (
            /* ── Vue grille ──────────────────────────────────── */
            Object.entries(byType).map(([type, models]) => {
              const Icon = TYPE_ICONS[type as DeviceType] ?? HelpCircle;
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={14} className="text-[var(--text-muted)]" />
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                      {DEVICE_TYPE_LABELS[type]}
                    </h2>
                    <span className="text-xs text-[var(--text-muted)]">
                      — {models.reduce((s, m) => s + m.inStock, 0)} disponible{models.reduce((s, m) => s + m.inStock, 0) !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {models.map((model, i) => {
                      const isEmpty = model.inStock === 0;
                      return (
                        <motion.div
                          key={model.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => setSelectedModel(model)}
                          className="cursor-pointer"
                        >
                          <GlassCard padding="md" className="h-full hover:border-primary/30 transition-colors">
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-[var(--text-primary)] truncate">{model.name}</p>
                                <p className="text-[11px] text-[var(--text-muted)]">{model.brand}</p>
                              </div>
                              <div className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                                isEmpty
                                  ? 'bg-amber-400/15 text-amber-400'
                                  : 'bg-emerald-400/15 text-emerald-400'
                              }`}>
                                {isEmpty ? <AlertTriangle size={11} /> : <CheckCircle size={11} />}
                                {model.inStock}
                              </div>
                            </div>

                            <div className="space-y-1 mb-3">
                              {model.processor && (
                                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                                  <Cpu size={11} className="flex-shrink-0 text-indigo-400/60" />
                                  <span className="truncate">{model.processor}</span>
                                </div>
                              )}
                              {model.ram && (
                                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                                  <MemoryStick size={11} className="flex-shrink-0 text-cyan-400/60" />
                                  <span>{model.ram}</span>
                                </div>
                              )}
                              {model.storage && (
                                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                                  <HardDrive size={11} className="flex-shrink-0 text-emerald-400/60" />
                                  <span>{model.storage}</span>
                                </div>
                              )}
                            </div>

                            <div className="h-1 rounded-full bg-white/5 overflow-hidden mb-2">
                              <motion.div
                                className={`h-full rounded-full ${isEmpty ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                initial={{ width: 0 }}
                                animate={{ width: isEmpty ? '3%' : `${Math.min((model.inStock / 10) * 100, 100)}%` }}
                                transition={{ delay: i * 0.04 + 0.2, duration: 0.5 }}
                              />
                            </div>

                            <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                              <span>{isEmpty ? 'Rupture' : `${model.inStock} dispo`}</span>
                              {model.ordered > 0 && (
                                <span className="text-indigo-400">
                                  +{model.ordered} commandé{model.ordered > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </GlassCard>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            /* ── Vue liste ───────────────────────────────────── */
            <div className="space-y-4">
              {Object.entries(byType).map(([type, models]) => {
                const Icon = TYPE_ICONS[type as DeviceType] ?? HelpCircle;
                const typeTotal = models.reduce((s, m) => s + m.inStock, 0);
                return (
                  <div key={type}>
                    {/* En-tête de catégorie */}
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={14} className="text-[var(--text-muted)]" />
                      <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                        {DEVICE_TYPE_LABELS[type]}
                      </h2>
                      <span className="text-xs text-[var(--text-muted)]">
                        — {typeTotal} disponible{typeTotal !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <GlassCard padding="none">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[var(--border-glass)]">
                              {['Modèle', 'Processeur', 'RAM', 'Stockage', 'En stock', 'Commandés'].map((h) => (
                                <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {models.map((model, i) => {
                              const isEmpty = model.inStock === 0;
                              return (
                                <motion.tr
                                  key={model.id}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: i * 0.02 }}
                                  onClick={() => setSelectedModel(model)}
                                  className="border-b border-[var(--border-glass)]/50 last:border-0 hover:bg-white/[0.03] transition-colors cursor-pointer"
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <Icon size={13} className="text-[var(--text-muted)] flex-shrink-0" />
                                      <div>
                                        <p className="text-sm font-medium text-[var(--text-primary)]">{model.name}</p>
                                        <p className="text-[10px] text-[var(--text-muted)]">{model.brand}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-[var(--text-muted)] max-w-[160px] truncate">
                                    {model.processor ?? '—'}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                                    {model.ram ?? '—'}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                                    {model.storage ?? '—'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                                      isEmpty ? 'bg-amber-400/15 text-amber-400' : 'bg-emerald-400/15 text-emerald-400'
                                    }`}>
                                      {isEmpty ? <AlertTriangle size={10} /> : <CheckCircle size={10} />}
                                      {model.inStock}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    {model.ordered > 0 ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-400/15 text-indigo-400">
                                        +{model.ordered}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-[var(--text-muted)]">—</span>
                                    )}
                                  </td>
                                </motion.tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </GlassCard>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Liste individuelle appareils en stock ───────────── */}
      {!loadingDevices && (stockDevices?.data ?? []).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-[var(--text-muted)]" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
              Appareils disponibles ({(stockDevices?.data ?? []).length})
            </h2>
          </div>
          <GlassCard padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-glass)]">
                    {['Tag IT', 'Modèle', 'N° Série', 'Site', 'Depuis'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{h}</th>
                    ))}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {(stockDevices?.data ?? []).map((device, i) => (
                    <motion.tr
                      key={device.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => goToDevice(device.id)}
                      className="border-b border-[var(--border-glass)]/50 last:border-0 hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--text-primary)]">
                        {device.assetTag ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                        {device.brand} {device.model}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                        {device.serialNumber}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                        {device.site ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                        {device.updatedAt ? formatDate(device.updatedAt) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] text-primary">Détail →</span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ─── Formulaire réception ────────────────────────────── */}
      <DeviceForm
        device={null}
        isOpen={formOpen}
        isSaving={createMut.isPending}
        onClose={() => setFormOpen(false)}
        onSubmit={(data) => createMut.mutate(data)}
      />
    </div>
  );
}

// ─── Onglet Déchets ────────────────────────────────────────────

function TabDechets() {
  const navigate = useNavigate();

  const { data: retiredDevices, isLoading } = useQuery<{ data: Device[]; total: number }>({
    queryKey: ['retired-devices'],
    queryFn: async () => {
      const { data } = await api.get('/devices?statuses=RETIRED,LOST,STOLEN&limit=200&sortBy=updatedAt&sortOrder=desc');
      return data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const devices = retiredDevices?.data ?? [];
  const now = Date.now();
  const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    RETIRED: { label: 'Déchet',  cls: 'bg-zinc-500/20 text-zinc-400' },
    LOST:    { label: 'Perdu',   cls: 'bg-red-500/15 text-red-400' },
    STOLEN:  { label: 'Volé',    cls: 'bg-purple-500/15 text-purple-400' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trash2 size={16} className="text-[var(--text-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--text-secondary)]">
          Appareils hors service ({devices.length})
        </h2>
      </div>

      {isLoading ? (
        <GlassCard padding="none">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-[var(--border-glass)]">
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </GlassCard>
      ) : devices.length === 0 ? (
        <GlassCard padding="md" className="text-center py-12">
          <Trash2 size={32} className="mx-auto mb-3 text-[var(--text-muted)] opacity-30" />
          <p className="text-sm text-[var(--text-muted)]">Aucun appareil hors service</p>
        </GlassCard>
      ) : (
        <GlassCard padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-glass)]">
                  {['Tag IT', 'N° Série', 'Modèle', 'Statut', 'Date sortie', 'Alerte', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.map((device, i) => {
                  const retiredAt = device.retiredAt ? new Date(device.retiredAt).getTime() : null;
                  const isRecent = retiredAt !== null && (now - retiredAt) < SIX_MONTHS_MS && !!device.purchaseOrderId;
                  const badge = STATUS_BADGE[device.status];
                  return (
                    <motion.tr
                      key={device.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => navigate(`/devices/${device.id}`, { state: { from: '/stock' } })}
                      className="border-b border-[var(--border-glass)]/50 hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--text-primary)]">
                        {device.assetTag}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                        {device.serialNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                        {device.brand} {device.model}
                      </td>
                      <td className="px-4 py-3">
                        {badge && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                        {device.retiredAt ? formatDate(device.retiredAt) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {isRecent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/15 text-orange-400">
                            <AlertTriangle size={10} />
                            Récent
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] text-primary">Détail →</span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ─── Onglet Maintenance ───────────────────────────────────────

function TabMaintenance() {
  const navigate = useNavigate();

  const { data: maintDevices, isLoading } = useQuery<{ data: Device[]; total: number }>({
    queryKey: ['maintenance-devices'],
    queryFn: async () => {
      const { data } = await api.get('/devices?status=IN_MAINTENANCE&limit=200&sortBy=updatedAt&sortOrder=desc');
      return data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const devices = maintDevices?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wrench size={16} className="text-[var(--text-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--text-secondary)]">
          Appareils en maintenance ({devices.length})
        </h2>
      </div>

      {isLoading ? (
        <GlassCard padding="none">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-[var(--border-glass)]">
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </GlassCard>
      ) : devices.length === 0 ? (
        <GlassCard padding="md" className="text-center py-12">
          <Wrench size={32} className="mx-auto mb-3 text-[var(--text-muted)] opacity-30" />
          <p className="text-sm text-[var(--text-muted)]">Aucun appareil en maintenance</p>
        </GlassCard>
      ) : (
        <GlassCard padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-glass)]">
                  {['Tag IT', 'N° Série', 'Modèle', 'Utilisateur', 'Site', 'Modifié le', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.map((device, i) => (
                  <motion.tr
                    key={device.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => navigate(`/devices/${device.id}`, { state: { from: '/stock' } })}
                    className="border-b border-[var(--border-glass)]/50 last:border-0 hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--text-primary)]">
                      {device.assetTag ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                      {device.serialNumber}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                      {device.brand} {device.model}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                      {device.assignedUser?.displayName ?? <span className="italic">Non assigné</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                      {device.site ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                      {formatDate(device.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] text-primary">Historique →</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────

export default function Stock() {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* ─── En-tête ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Stock & Inventaire</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Disponibilités par modèle — appareils non assignés</p>
        </div>
        <div className="sm:ml-auto">
          <button
            onClick={() => setFormOpen(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Plus size={16} />
            Réceptionner
          </button>
        </div>
      </div>

      {/* ─── Onglets ─────────────────────────────────────────── */}
      <Tabs.Root defaultValue="inventaire">
        <Tabs.List className="flex gap-1 p-1 rounded-xl border border-[var(--border-glass)] bg-white/[0.02] w-fit mb-6">
          {[
            { value: 'inventaire',  label: 'Inventaire' },
            { value: 'maintenance', label: 'Maintenance' },
            { value: 'dechets',     label: 'Déchets' },
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

        <Tabs.Content value="inventaire">
          <TabInventaire formOpen={formOpen} setFormOpen={setFormOpen} />
        </Tabs.Content>
        <Tabs.Content value="maintenance">
          <TabMaintenance />
        </Tabs.Content>
        <Tabs.Content value="dechets">
          <TabDechets />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
