import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Laptop, Shield, Eye, UserX, Loader2, X, ShieldCheck } from 'lucide-react';
import { userService } from '../services/user.service';
import { useAuthStore } from '../stores/authStore';
import { GlassCard } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Skeleton';
import { FilterPill } from '../components/devices/DeviceFilters';
import { ROLE_LABELS } from '../utils/formatters';
import type { Role, User } from '../types';
import api from '../services/api';

const ROLE_COLORS: Record<Role, string> = {
  MANAGER:    'bg-indigo-500/15 text-indigo-400',
  TECHNICIAN: 'bg-cyan-500/15 text-cyan-400',
  VIEWER:     'bg-slate-500/15 text-slate-400',
};

const ROLE_ICONS: Record<Role, React.ComponentType<{ size?: number }>> = {
  MANAGER:    Shield,
  TECHNICIAN: Laptop,
  VIEWER:     Eye,
};

export default function Users() {
  const [search,    setSearch]    = useState('');
  const [role,      setRole]      = useState<Role | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<User | null>(null);

  const { user: currentUser } = useAuthStore();
  const isManager = currentUser?.role === 'MANAGER';
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', search, role],
    queryFn:  () => userService.list({ search: search || undefined, role: role }),
    staleTime: 30_000,
  });

  const deactivateMut = useMutation({
    mutationFn: (userId: string) => api.delete(`/users/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setDeactivating(null);
    },
  });

  return (
    <div className="p-4 lg:p-6 space-y-4">

      {/* ─── En-tête ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Admin</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {isLoading ? '…' : `${users.length} utilisateur${users.length > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* ─── Filtres ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Recherche compacte */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="input-glass pl-8 pr-7 py-1.5 text-xs rounded-full w-44 focus:w-56 transition-all duration-200"
            aria-label="Rechercher un compte"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Effacer"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Séparateur */}
        <div className="w-px h-4 bg-[var(--border-glass)]" />

        {/* Filtre rôle — pill compact */}
        <FilterPill
          icon={<ShieldCheck size={11} />}
          label="Rôle"
          value={role}
          options={[
            { value: 'MANAGER',    label: 'Manager'    },
            { value: 'TECHNICIAN', label: 'Technicien'          },
            { value: 'VIEWER',     label: 'Technicien Proximité' },
          ]}
          onChange={(v) => setRole(v as Role | undefined)}
        />
      </div>

      {/* ─── Grille utilisateurs ─────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <GlassCard key={i} padding="md">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : !users.length ? (
        <GlassCard padding="md" className="text-center py-12">
          <p className="text-[var(--text-muted)] text-sm">Aucun utilisateur trouvé</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => {
            const RoleIcon = ROLE_ICONS[u.role] ?? Eye;
            return (
              <div key={u.id}>
                <GlassCard padding="md" hoverable className={!u.isActive ? 'opacity-60' : undefined}>
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ${u.isActive ? 'bg-gradient-to-br from-indigo-400 to-cyan-400' : 'bg-red-500/30'}`}>
                      {u.displayName.charAt(0)}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[var(--text-primary)] text-sm truncate">{u.displayName}</p>
                        {!u.isActive && (
                          <span className="px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[9px] font-semibold flex-shrink-0">Inactif</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] truncate">{u.email}</p>
                      {u.jobTitle && <p className="text-xs text-[var(--text-muted)] truncate">{u.jobTitle}</p>}

                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                          <RoleIcon size={10} />
                          {ROLE_LABELS[u.role]}
                        </span>
                      </div>
                    </div>

                    {/* Bouton désactivation (Manager uniquement, user actif) */}
                    {isManager && u.isActive && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeactivating(u); }}
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                        aria-label="Désactiver le compte"
                        title="Désactiver le compte"
                      >
                        <UserX size={14} />
                      </button>
                    )}
                  </div>

                  {/* Appareils assignés */}
                  <div className="mt-3 pt-3 border-t border-[var(--border-glass)] flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">Appareils assignés</span>
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {u._count?.assignedDevices ?? 0}
                    </span>
                  </div>
                </GlassCard>
              </div>
            );
          })}
        </div>
      )}
      {/* ─── Modale confirmation désactivation ──────────────── */}
      <AnimatePresence>
        {deactivating && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeactivating(null)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="glass-card p-6 max-w-sm w-full space-y-4 pointer-events-auto">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                    <UserX size={20} className="text-red-400" />
                  </div>
                  <button onClick={() => setDeactivating(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    <X size={16} />
                  </button>
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">Désactiver {deactivating.displayName} ?</h3>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Le compte sera désactivé. Ses appareils restent visibles dans la page Appareils jusqu'à récupération physique par un technicien.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeactivating(null)}
                    className="btn-secondary flex-1 py-2 text-sm"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => deactivateMut.mutate(deactivating.id)}
                    disabled={deactivateMut.isPending}
                    className="flex-1 py-2 text-sm rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deactivateMut.isPending && <Loader2 size={13} className="animate-spin" />}
                    Désactiver
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
