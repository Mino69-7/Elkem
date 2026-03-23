import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, LayoutGrid, LayoutList, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDevices, useCreateDevice, useUpdateDevice, useDeleteDevice } from '../hooks/useDevices';
import { useDeviceStore } from '../stores/deviceStore';
import { useAuthStore } from '../stores/authStore';
import DeviceFilters from '../components/devices/DeviceFilters';
import DeviceTable from '../components/devices/DeviceTable';
import DeviceCard from '../components/devices/DeviceCard';
import DeviceForm from '../components/devices/DeviceForm';
import { GlassCard } from '../components/ui/GlassCard';
import type { Device } from '../types';
import type { DeviceFormData } from '../services/device.service';

export default function Devices() {
  const [searchParams] = useSearchParams();
  const externalSearch = searchParams.get('search') ?? undefined;

  const { filters, setFilters, viewMode, setViewMode } = useDeviceStore();
  const { user } = useAuthStore();
  const canEdit = user?.role === 'MANAGER' || user?.role === 'TECHNICIAN';

  const { data, isLoading } = useDevices();

  const [formOpen, setFormOpen] = useState(false);
  const [editing,  setEditing]  = useState<Device | null>(null);
  const [deleting, setDeleting] = useState<Device | null>(null);

  const createMut = useCreateDevice();
  const updateMut = useUpdateDevice(editing?.id ?? '');
  const deleteMut = useDeleteDevice();

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit   = (d: Device) => { setEditing(d); setFormOpen(true); };
  const closeForm  = () => { setFormOpen(false); setEditing(null); };

  const handleSubmit = async (data: DeviceFormData) => {
    if (editing) await updateMut.mutateAsync(data);
    else         await createMut.mutateAsync(data);
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

  return (
    <div className="p-4 lg:p-6 space-y-4">

      {/* ─── En-tête ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Appareils</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {isLoading ? '…' : `${total} appareil${total > 1 ? 's' : ''} en service`}
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
            <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
              <Plus size={16} />
              Nouveau
            </button>
          )}
        </div>
      </div>

      {/* ─── Filtres ─────────────────────────────────────────── */}
      <DeviceFilters externalSearch={externalSearch} />

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

      {/* ─── Formulaire ──────────────────────────────────────── */}
      {canEdit && (
        <DeviceForm
          device={editing}
          isOpen={formOpen}
          isSaving={createMut.isPending || updateMut.isPending}
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
