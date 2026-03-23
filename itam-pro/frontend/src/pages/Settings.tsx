import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Bell, Plus, Trash2, AlertTriangle, CheckCircle,
  Laptop, Monitor, Smartphone, Tablet, Printer,
  Keyboard, Mouse, Headphones, Layers, HelpCircle,
  Package, Pencil, X, Save,
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Skeleton';
import { AppSelect } from '../components/ui/AppSelect';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import api from '../services/api';
import { DEVICE_TYPE_LABELS, KEYBOARD_LAYOUT_LABELS } from '../utils/formatters';
import type { DeviceType, DeviceModel } from '../types';

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

// ─── APIs locales ─────────────────────────────────────────────

const alertsApi = {
  list:   () => api.get<StockAlertRow[]>('/stockalerts').then((r) => r.data),
  upsert: (d: { deviceType: DeviceType; threshold: number; isActive: boolean }) =>
    api.post('/stockalerts', d).then((r) => r.data),
  update: (id: string, d: Partial<{ threshold: number; isActive: boolean }>) =>
    api.put(`/stockalerts/${id}`, d).then((r) => r.data),
  remove: (id: string) => api.delete(`/stockalerts/${id}`),
};

const modelsApi = {
  listAll: () => api.get<DeviceModel[]>('/devicemodels/all').then((r) => r.data),
  create:  (d: Partial<DeviceModel>) => api.post<DeviceModel>('/devicemodels', d).then((r) => r.data),
  update:  (id: string, d: Partial<DeviceModel>) => api.put<DeviceModel>(`/devicemodels/${id}`, d).then((r) => r.data),
  remove:  (id: string) => api.delete(`/devicemodels/${id}`),
};

// ─── Formulaire modèle ────────────────────────────────────────

interface ModelFormState {
  name: string; type: DeviceType | '';
  processor: string; ram: string; storage: string; screenSize: string; notes: string;
}

const emptyModel: ModelFormState = { name: '', type: '', processor: '', ram: '', storage: '', screenSize: '', notes: '' };

// ─── Composant principal ──────────────────────────────────────

export default function Settings() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useUIStore();
  const isManager = user?.role === 'MANAGER';
  const qc = useQueryClient();

  // ── Alertes stock ─────────────────────────────────────────

  const [addingType, setAddingType]           = useState<DeviceType | ''>('');
  const [addingThreshold, setAddingThreshold] = useState(3);

  const { data: alerts = [], isLoading: loadingAlerts } = useQuery({
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

  // ── Modèles ───────────────────────────────────────────────

  const [editingModel, setEditingModel] = useState<DeviceModel | null>(null);
  const [modelForm, setModelForm]       = useState<ModelFormState>(emptyModel);
  const [showModelForm, setShowModelForm] = useState(false);

  const { data: deviceModels = [], isLoading: loadingModels } = useQuery({
    queryKey: ['device-models-all'],
    queryFn:  modelsApi.listAll,
    enabled:  isManager,
    staleTime: 30_000,
  });

  const createModelMut = useMutation({
    mutationFn: modelsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['device-models-all'] }); qc.invalidateQueries({ queryKey: ['device-models'] }); resetModelForm(); },
  });
  const updateModelMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DeviceModel> }) => modelsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['device-models-all'] }); qc.invalidateQueries({ queryKey: ['device-models'] }); resetModelForm(); },
  });
  const deleteModelMut = useMutation({
    mutationFn: modelsApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['device-models-all'] }); qc.invalidateQueries({ queryKey: ['device-models'] }); },
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

  // Grouper les modèles par type
  const modelsByType = deviceModels.reduce<Record<string, DeviceModel[]>>((acc, m) => {
    (acc[m.type] = acc[m.type] ?? []).push(m);
    return acc;
  }, {});

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl">

      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Paramètres</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Configuration de l'application</p>
      </div>

      {/* ─── Apparence ───────────────────────────────────────── */}
      <GlassCard>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Apparence</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Thème</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Mode sombre ou clair</p>
          </div>
          <div className="flex rounded-xl border border-[var(--border-glass)] overflow-hidden">
            {(['dark', 'light'] as const).map((t) => (
              <button key={t} onClick={() => setTheme(t)} className={`px-4 py-2 text-xs font-medium transition-colors ${theme === t ? 'bg-primary/20 text-primary' : 'text-[var(--text-muted)] hover:bg-white/5'}`}>
                {t === 'dark' ? '🌙 Sombre' : '☀️ Clair'}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* ─── Modèles d'appareils (MANAGER) ───────────────────── */}
      {isManager && (
        <GlassCard padding="none">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--border-glass)]">
            <div className="flex items-center gap-2">
              <Laptop size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Catalogue des modèles</h2>
            </div>
            {!showModelForm && (
              <button onClick={() => { resetModelForm(); setShowModelForm(true); }} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs">
                <Plus size={13} /> Nouveau modèle
              </button>
            )}
          </div>

          {/* Formulaire ajout/édition */}
          {showModelForm && (
            <div className="px-4 py-4 border-b border-[var(--border-glass)] bg-white/[0.02] space-y-3">
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
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
              <div className="flex gap-2">
                <button onClick={resetModelForm} className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs">
                  <X size={13} /> Annuler
                </button>
                <button
                  onClick={handleSaveModel}
                  disabled={!modelForm.name || !modelForm.type || createModelMut.isPending || updateModelMut.isPending}
                  className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs disabled:opacity-50"
                >
                  <Save size={13} /> {editingModel ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </div>
          )}

          {/* Liste des modèles groupés par type */}
          {loadingModels
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-3"><Skeleton className="h-4 w-48" /></div>
              ))
            : deviceModels.length === 0
              ? <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">Aucun modèle configuré</p>
              : Object.entries(modelsByType).map(([type, models]) => (
                  <div key={type}>
                    <div className="px-4 py-2 bg-white/[0.02] border-b border-[var(--border-glass)]">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {DEVICE_TYPE_LABELS[type as DeviceType]}
                      </p>
                    </div>
                    {models.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border-glass)] hover:bg-white/[0.02] transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)]">{m.name}</p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate">
                            {[m.processor, m.ram, m.storage, m.screenSize].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => openEditModel(m)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-primary hover:bg-primary/10 transition-colors">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => deleteModelMut.mutate(m.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
          }
        </GlassCard>
      )}

      {/* ─── Alertes stock ───────────────────────────────────── */}
      <GlassCard padding="none">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--border-glass)]">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Alertes de stock</h2>
            {!loadingAlerts && triggeredCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-semibold">
                {triggeredCount} actif{triggeredCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)]">Alerte quand le stock descend sous le seuil</p>
        </div>

        <div className="divide-y divide-[var(--border-glass)]">
          {loadingAlerts
            ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="px-4 py-3"><Skeleton className="h-8 w-full" /></div>)
            : alerts.length === 0
              ? <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">Aucune alerte configurée</p>
              : alerts.map((alert, i) => {
                  const Icon = TYPE_ICONS[alert.deviceType] ?? HelpCircle;
                  return (
                    <motion.div key={alert.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="px-4 py-3 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${alert.triggered && alert.isActive ? 'bg-amber-500/15 text-amber-400' : 'bg-primary/10 text-primary'}`}>
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
                          <button onClick={() => updateAlertMut.mutate({ id: alert.id, data: { isActive: !alert.isActive } })} className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${alert.isActive ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-slate-500/15 text-slate-400 hover:bg-slate-500/25'}`}>
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
            <button disabled={!addingType || upsertAlertMut.isPending} onClick={() => addingType && upsertAlertMut.mutate({ deviceType: addingType, threshold: addingThreshold, isActive: true })} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50">
              <Plus size={13} /> Ajouter
            </button>
          </div>
        )}
      </GlassCard>

      {/* ─── Mon compte ──────────────────────────────────────── */}
      <GlassCard>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Mon compte</h2>
        <div className="space-y-3">
          {[
            { label: 'Nom',   value: user?.displayName },
            { label: 'Email', value: user?.email },
            { label: 'Rôle',  value: user?.role === 'MANAGER' ? 'Manager' : user?.role === 'TECHNICIAN' ? 'Technicien' : 'Lecteur' },
          ].map((row) => (
            <div key={row.label} className="flex justify-between py-2 border-b border-[var(--border-glass)] last:border-0">
              <span className="text-xs text-[var(--text-muted)]">{row.label}</span>
              <span className="text-xs text-[var(--text-secondary)] font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
