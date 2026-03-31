import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, LayoutGrid, LayoutList, ChevronLeft, ChevronRight,
  Laptop, Monitor, Smartphone, Tablet, Cpu, Server, Tv, Printer,
  X, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDevices, useUpdateDevice, useDeleteDevice } from '../hooks/useDevices';
import { useDeviceStore } from '../stores/deviceStore';
import { useAuthStore } from '../stores/authStore';
import DeviceFilters from '../components/devices/DeviceFilters';
import DeviceTable from '../components/devices/DeviceTable';
import DeviceCard from '../components/devices/DeviceCard';
import DeviceForm from '../components/devices/DeviceForm';
import { GlassCard } from '../components/ui/GlassCard';
import { UserCombobox } from '../components/ui/UserCombobox';
import { DEVICE_TYPE_LABELS } from '../utils/formatters';
import api from '../services/api';
import type { Device, DeviceType } from '../types';
import type { DeviceFormData } from '../services/device.service';

// ─── Onglets de type ──────────────────────────────────────────

const TYPE_TABS: { type: DeviceType; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { type: 'LAPTOP',          label: 'PC Portable',    Icon: Laptop },
  { type: 'DESKTOP',         label: 'PC Fixe',         Icon: Cpu },
  { type: 'LAB_WORKSTATION', label: 'PC Labo / Indus', Icon: Server },
  { type: 'THIN_CLIENT',     label: 'Clients légers',  Icon: Tv },
  { type: 'SMARTPHONE',      label: 'Téléphones',      Icon: Smartphone },
  { type: 'TABLET',          label: 'Tablettes',       Icon: Tablet },
  { type: 'MONITOR',         label: 'Écrans',          Icon: Monitor },
  { type: 'PRINTER',         label: 'Imprimantes',     Icon: Printer },
];

// ─── Modal affectation depuis pool stock ──────────────────────

function AssignFromPoolModal({ type, onClose }: { type: DeviceType; onClose: () => void }) {
  const qc        = useQueryClient();
  const typeLabel = DEVICE_TYPE_LABELS[type] ?? type;
  const isPhone   = type === 'SMARTPHONE' || type === 'TABLET';

  const [userId,      setUserId]      = useState('');
  const [userDisplay, setUserDisplay] = useState<string | undefined>(undefined);
  const [search,      setSearch]      = useState('');
  const [showDrop,    setShowDrop]    = useState(false);
  const [selected,    setSelected]    = useState<Device | null>(null);
  const [ticketRef,   setTicketRef]   = useState('IT-');

  const { data: pool = [], isFetching } = useQuery<Device[]>({
    queryKey: ['assign-pool', type, search],
    queryFn: async () => {
      const r = await api.get(`/devices?type=${type}&status=IN_STOCK&search=${encodeURIComponent(search)}&limit=20`);
      return r.data.data as Device[];
    },
    enabled: search.length >= 1,
    staleTime: 0,
  });

  const assignMut = useMutation({
    mutationFn: (deviceId: string) =>
      api.patch(`/devices/${deviceId}/assign`, {
        userId,
        ...(ticketRef.trim().length > 3 ? { assetTag: ticketRef.trim().toUpperCase() } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['stock-summary'] });
      qc.invalidateQueries({ queryKey: ['stock-devices'] });
      qc.invalidateQueries({ queryKey: ['stockalerts'] });
      onClose();
    },
  });

  const canSubmit = !!userId && !!selected && ticketRef.trim().length > 3 && !assignMut.isPending;

  return (
    <AnimatePresence>
      <>
        <motion.div
          className="fixed inset-0 z-50 bg-black/60"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-md flex flex-col rounded-2xl shadow-2xl pointer-events-auto overflow-hidden"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', maxHeight: '90vh' }}
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
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* ── Utilisateur ── */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Utilisateur</p>
                <UserCombobox
                  value={userId}
                  displayValue={userDisplay}
                  onChange={(id, user) => {
                    setUserId(id ?? '');
                    setUserDisplay(user ? `${user.displayName} (${user.email})` : undefined);
                  }}
                />
              </div>

              <div className="h-px bg-[var(--border-glass)]" />

              {/* ── Appareil depuis le pool ── */}
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">Appareil du stock</p>

                {!selected ? (
                  <div className="relative">
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--text-secondary)]">
                        {isPhone ? 'Rechercher par SN ou IMEI' : 'Rechercher par numéro de série'}
                      </label>
                      <input
                        autoFocus={!!userId}
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setShowDrop(true); }}
                        onFocus={() => setShowDrop(true)}
                        placeholder="Ex : ABC1234…"
                        className="input-glass py-2 text-sm w-full font-mono"
                      />
                    </div>
                    {showDrop && search.length >= 1 && (
                      <div
                        className="absolute z-10 top-full left-0 right-0 mt-1 rounded-xl border border-[var(--border-glass)] shadow-xl overflow-hidden"
                        style={{ background: 'var(--bg-secondary)' }}
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
                              onClick={() => { setSelected(p); setShowDrop(false); }}
                              className="w-full text-left px-4 py-2.5 hover:bg-primary/5 transition-colors border-b border-[var(--border-glass)] last:border-0"
                            >
                              <p className="text-xs font-semibold text-[var(--text-primary)]">{p.brand} {p.model}</p>
                              <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                                SN: {p.serialNumber}
                                {p.imei && ` · IMEI: ${p.imei}`}
                                {[p.processor, p.ram, p.storage].filter(Boolean).length > 0 && (
                                  <span className="not-italic"> · {[p.processor, p.ram, p.storage].filter(Boolean).join(' · ')}</span>
                                )}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    {/* Carte appareil sélectionné */}
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
                    </div>

                    {/* SN en lecture seule */}
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--text-secondary)]">N° de série</label>
                      <input readOnly value={selected.serialNumber} className="input-glass py-2 text-sm w-full font-mono bg-white/[0.02] cursor-default" />
                    </div>

                    {/* IMEI (smartphones/tablettes) */}
                    {isPhone && (
                      <div className="space-y-1">
                        <label className="text-xs text-[var(--text-secondary)]">IMEI</label>
                        <input readOnly value={selected.imei ?? '—'} className="input-glass py-2 text-sm w-full font-mono tracking-widest bg-white/[0.02] cursor-default" />
                      </div>
                    )}

                    {/* N° ticket */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[var(--text-secondary)]">
                        N° ticket <span className="text-red-400">*</span>
                      </label>
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

// ─── Page Utilisateurs ────────────────────────────────────────

export default function Devices() {
  const [searchParams] = useSearchParams();
  const externalSearch = searchParams.get('search') ?? undefined;

  const { filters, setFilters, viewMode, setViewMode } = useDeviceStore();
  const { user } = useAuthStore();
  const canEdit = user?.role === 'MANAGER' || user?.role === 'TECHNICIAN';

  const [activeTab, setActiveTab] = useState<DeviceType>('LAPTOP');

  // L'onglet actif est le filtre principal
  const { data, isLoading } = useDevices({ type: activeTab, statuses: 'ASSIGNED,LOST,STOLEN' });

  // Modal affectation depuis pool
  const [assignOpen, setAssignOpen] = useState(false);

  // DeviceForm édition uniquement
  const [formOpen, setFormOpen]   = useState(false);
  const [editing,  setEditing]    = useState<Device | null>(null);
  const [deleting, setDeleting]   = useState<Device | null>(null);

  const updateMut = useUpdateDevice(editing?.id ?? '');
  const deleteMut = useDeleteDevice();

  const handleTabChange = (type: DeviceType) => {
    setActiveTab(type);
    setFilters({ type: undefined, model: undefined, page: 1 });
  };

  const openEdit   = (d: Device) => { setEditing(d); setFormOpen(true); };
  const closeForm  = () => { setFormOpen(false); setEditing(null); };

  const handleSubmit = async (data: DeviceFormData) => {
    if (editing) await updateMut.mutateAsync(data);
    closeForm();
  };

  const handleDeleteConfirm = async () => {
    if (!deleting) return;
    await deleteMut.mutateAsync(deleting.id);
    setDeleting(null);
  };

  const devices    = data?.data       ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const activeTabMeta = TYPE_TABS.find((t) => t.type === activeTab)!;

  return (
    <div className="p-4 lg:p-6 space-y-4">

      {/* ─── En-tête ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Utilisateurs</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {isLoading ? '…' : `${total} appareil${total > 1 ? 's' : ''} · ${activeTabMeta.label}`}
          </p>
        </div>

        <div className="sm:ml-auto flex items-center gap-2">
          {/* Toggle vue */}
          <div className="flex rounded-xl border border-[var(--border-glass)] overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 transition-colors ${viewMode === 'table' ? 'bg-primary/15 text-primary' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
              aria-label="Vue tableau" aria-pressed={viewMode === 'table'}
            >
              <LayoutList size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-primary/15 text-primary' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
              aria-label="Vue grille" aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          {canEdit && (
            <button onClick={() => setAssignOpen(true)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
              <Plus size={16} />
              Nouveau
            </button>
          )}
        </div>
      </div>

      {/* ─── Toggle types d'équipements ──────────────────────── */}
      <div className="overflow-x-auto pb-0.5">
        <div className="flex gap-1 min-w-max">
          {TYPE_TABS.map(({ type, label, Icon }) => {
            const isActive = activeTab === type;
            return (
              <button
                key={type}
                onClick={() => handleTabChange(type)}
                className={`
                  relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium
                  transition-colors whitespace-nowrap select-none
                  ${isActive
                    ? 'text-primary'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'}
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="type-tab-bg"
                    className="absolute inset-0 rounded-xl bg-primary/12 border border-primary/25"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon size={13} className="relative z-10 flex-shrink-0" />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Filtres ─────────────────────────────────────────── */}
      <DeviceFilters externalSearch={externalSearch} activeType={activeTab} />

      {/* ─── Liste ───────────────────────────────────────────── */}
      <GlassCard padding="none">
        {viewMode === 'table' ? (
          <DeviceTable
            devices={devices}
            isLoading={isLoading}
            onEdit={openEdit}
            onDelete={setDeleting}
          />
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="glass-card p-4 h-40 animate-pulse" style={{ background: 'var(--bg-glass)' }} />
                ))
              : devices.map((d, i) => (
                  <DeviceCard key={d.id} device={d} index={i} onEdit={openEdit} onDelete={setDeleting} />
                ))
            }
          </div>
        )}
      </GlassCard>

      {/* ─── Pagination ──────────────────────────────────────── */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-[var(--text-muted)]">Page {filters.page} sur {totalPages}</p>
          <div className="flex gap-2">
            <button
              disabled={(filters.page ?? 1) <= 1}
              onClick={() => setFilters({ page: (filters.page ?? 1) - 1 })}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} /> Précédent
            </button>
            <button
              disabled={(filters.page ?? 1) >= totalPages}
              onClick={() => setFilters({ page: (filters.page ?? 1) + 1 })}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Suivant <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ─── Modal affectation depuis pool ───────────────────── */}
      {canEdit && assignOpen && (
        <AssignFromPoolModal
          type={activeTab}
          onClose={() => setAssignOpen(false)}
        />
      )}

      {/* ─── Formulaire édition ──────────────────────────────── */}
      {canEdit && (
        <DeviceForm
          device={editing}
          isOpen={formOpen && !!editing}
          isSaving={updateMut.isPending}
          isManager={user?.role === 'MANAGER'}
          onClose={closeForm}
          onSubmit={handleSubmit}
        />
      )}

      {/* ─── Confirmation suppression ────────────────────────── */}
      {deleting && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            onClick={() => setDeleting(null)}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="glass-card p-6 max-w-sm w-full space-y-4 pointer-events-auto">
              <h3 className="font-semibold text-[var(--text-primary)]">Supprimer {deleting.assetTag} ?</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Action irréversible. {deleting.brand} {deleting.model} et tout son historique seront supprimés.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleting(null)} className="btn-secondary flex-1 py-2 text-sm">
                  Annuler
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteMut.isPending}
                  className="flex-1 py-2 text-sm rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors font-medium disabled:opacity-50"
                >
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
