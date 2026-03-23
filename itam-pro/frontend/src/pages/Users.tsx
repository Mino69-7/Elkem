import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, Laptop, Shield, Eye } from 'lucide-react';
import { userService } from '../services/user.service';
import { GlassCard } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Skeleton';
import { AppSelect } from '../components/ui/AppSelect';
import { ROLE_LABELS } from '../utils/formatters';
import type { Role } from '../types';

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
  const [search, setSearch] = useState('');
  const [role, setRole]     = useState<Role | ''>('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', search, role],
    queryFn:  () => userService.list({ search: search || undefined, role: role || undefined }),
    staleTime: 30_000,
  });

  return (
    <div className="p-4 lg:p-6 space-y-4">

      {/* ─── En-tête ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Utilisateurs</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {isLoading ? '…' : `${users.length} utilisateur${users.length > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* ─── Filtres ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="input-glass pl-9 py-2 text-sm w-full"
          />
        </div>
        <AppSelect
          value={role}
          onChange={(v) => setRole(v as Role | '')}
          placeholder="Tous les rôles"
          options={[
            { value: 'MANAGER',    label: 'Manager'    },
            { value: 'TECHNICIAN', label: 'Technicien' },
            { value: 'VIEWER',     label: 'Lecteur'    },
          ]}
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
          {users.map((u, i) => {
            const RoleIcon = ROLE_ICONS[u.role] ?? Eye;
            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <GlassCard padding="md" hoverable>
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {u.displayName.charAt(0)}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--text-primary)] text-sm truncate">{u.displayName}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{u.email}</p>
                      {u.jobTitle && <p className="text-xs text-[var(--text-muted)] truncate">{u.jobTitle}</p>}

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                          <RoleIcon size={10} />
                          {ROLE_LABELS[u.role]}
                        </span>
                        {u.department && (
                          <span className="text-xs text-[var(--text-muted)] bg-white/5 px-2 py-0.5 rounded-full">
                            {u.department}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Appareils assignés */}
                  <div className="mt-3 pt-3 border-t border-[var(--border-glass)] flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">Appareils assignés</span>
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {u._count?.assignedDevices ?? 0}
                    </span>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
