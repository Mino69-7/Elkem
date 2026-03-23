import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, XCircle, AlertTriangle, RefreshCw, Wifi, WifiOff,
  Laptop, Loader2, ChevronDown, ChevronUp, ShieldCheck, ShieldX,
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Skeleton';
import { useAuthStore } from '../stores/authStore';
import { intuneServiceFe } from '../services/intune.service';
import type { SyncResult } from '../services/intune.service';
import { formatDateTime } from '../utils/formatters';

// ─── Badge conformité ─────────────────────────────────────────

function ComplianceBadge({ state }: { state: string }) {
  const map: Record<string, { label: string; className: string }> = {
    compliant:      { label: 'Conforme',      className: 'bg-emerald-500/15 text-emerald-400' },
    noncompliant:   { label: 'Non conforme',  className: 'bg-red-500/15 text-red-400' },
    unknown:        { label: 'Inconnu',       className: 'bg-slate-500/15 text-slate-400' },
    notApplicable:  { label: 'N/A',           className: 'bg-slate-500/15 text-slate-400' },
    inGracePeriod:  { label: 'Période grâce', className: 'bg-amber-500/15 text-amber-400' },
    configManager:  { label: 'Config Mgr',    className: 'bg-blue-500/15 text-blue-400' },
  };
  const { label, className } = map[state] ?? { label: state, className: 'bg-slate-500/15 text-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${className}`}>
      {state === 'compliant' ? <ShieldCheck size={10} /> : <ShieldX size={10} />}
      {label}
    </span>
  );
}

// ─── Composant principal ──────────────────────────────────────

export default function IntuneSync() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const canSync = user?.role === 'MANAGER' || user?.role === 'TECHNICIAN';

  const [syncResult, setSyncResult]   = useState<SyncResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [search, setSearch]           = useState('');

  // Statut connexion
  const { data: status, isLoading: loadingStatus } = useQuery({
    queryKey: ['intune-status'],
    queryFn:  intuneServiceFe.getStatus,
    staleTime: 30_000,
  });

  // Liste appareils Intune (seulement si connecté)
  const { data: intuneData, isLoading: loadingDevices, refetch: refetchDevices } = useQuery({
    queryKey: ['intune-devices'],
    queryFn:  intuneServiceFe.listDevices,
    enabled:  status?.connected === true,
    staleTime: 60_000,
  });

  // Mutation sync
  const syncMut = useMutation({
    mutationFn: intuneServiceFe.sync,
    onSuccess: (result) => {
      setSyncResult(result);
      setShowDetails(false);
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      refetchDevices();
    },
  });

  const filteredDevices = (intuneData?.data ?? []).filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.deviceName.toLowerCase().includes(q) ||
      d.serialNumber.toLowerCase().includes(q) ||
      (d.manufacturer || '').toLowerCase().includes(q) ||
      (d.model || '').toLowerCase().includes(q) ||
      (d.userDisplayName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 lg:p-6 space-y-4">

      {/* ─── En-tête ───────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Synchronisation Intune</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Microsoft Endpoint Manager — Gestion des appareils</p>
      </div>

      {/* ─── Section 1 : Statut connexion ──────────────────── */}
      <GlassCard>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              loadingStatus ? 'bg-slate-500/10' :
              status?.connected ? 'bg-emerald-500/15' : 'bg-red-500/15'
            }`}>
              {loadingStatus
                ? <Loader2 size={20} className="text-[var(--text-muted)] animate-spin" />
                : status?.connected
                  ? <Wifi size={20} className="text-emerald-400" />
                  : <WifiOff size={20} className="text-red-400" />
              }
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {loadingStatus ? 'Vérification…' :
                 status?.connected ? 'Connecté à Microsoft Intune' : 'Non connecté'}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {loadingStatus ? '—' :
                 status?.connected
                   ? `${intuneData?.total ?? '…'} appareil${(intuneData?.total ?? 0) > 1 ? 's' : ''} gérés`
                   : status?.error ?? (status?.configured ? 'Connexion impossible' : 'Variables d\'environnement Azure AD manquantes')
                }
              </p>
            </div>
          </div>

          {canSync && (
            <button
              onClick={() => syncMut.mutate()}
              disabled={syncMut.isPending || !status?.connected}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncMut.isPending
                ? <><Loader2 size={15} className="animate-spin" /> Synchronisation…</>
                : <><RefreshCw size={15} /> Synchroniser maintenant</>
              }
            </button>
          )}
        </div>

        {/* Indicateurs config */}
        {!loadingStatus && !status?.configured && (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
            <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={13} /> Configuration requise</p>
            <p>Ajoutez ces variables dans <code className="font-mono bg-amber-500/10 px-1 rounded">backend/.env</code> :</p>
            <pre className="font-mono bg-black/20 rounded p-2 mt-1 text-[11px] leading-relaxed">
{`AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret`}
            </pre>
          </div>
        )}
      </GlassCard>

      {/* ─── Section 2 : Résultat dernière sync ────────────── */}
      <AnimatePresence>
        {syncResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <GlassCard>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {syncResult.errors === 0
                    ? <CheckCircle size={20} className="text-emerald-400 flex-shrink-0" />
                    : <AlertTriangle size={20} className="text-amber-400 flex-shrink-0" />
                  }
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Synchronisation terminée</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {syncResult.synced} appareils traités ·{' '}
                      <span className="text-emerald-400">{syncResult.created} créés</span> ·{' '}
                      <span className="text-blue-400">{syncResult.updated} mis à jour</span>
                      {syncResult.errors > 0 && <> · <span className="text-red-400">{syncResult.errors} erreurs</span></>}
                    </p>
                  </div>
                </div>
                {syncResult.details.length > 0 && (
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    Détails {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                )}
              </div>

              <AnimatePresence>
                {showDetails && syncResult.details.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 p-3 rounded-xl bg-black/20 font-mono text-[11px] text-[var(--text-muted)] space-y-1 max-h-40 overflow-y-auto">
                      {syncResult.details.map((d, i) => <p key={i}>{d}</p>)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Section 3 : Liste appareils Intune ────────────── */}
      {status?.connected && (
        <GlassCard padding="none">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-glass)] gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Appareils gérés par Intune
              {!loadingDevices && intuneData && (
                <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">({intuneData.total})</span>
              )}
            </h2>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="input-glass py-1.5 text-xs w-48"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Appareils Intune">
              <thead>
                <tr className="border-b border-[var(--border-glass)]">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Appareil</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] hidden md:table-cell">Système</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Conformité</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] hidden lg:table-cell">Utilisateur</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] hidden xl:table-cell">Dernière sync</th>
                </tr>
              </thead>
              <tbody>
                {loadingDevices
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-[var(--border-glass)]">
                        {[1,2,3,4].map((j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  : filteredDevices.length === 0
                    ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                          {search ? 'Aucun résultat' : 'Aucun appareil Intune'}
                        </td>
                      </tr>
                    )
                    : filteredDevices.map((device, i) => (
                        <motion.tr
                          key={device.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.01 }}
                          className="border-b border-[var(--border-glass)] hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Laptop size={14} className="text-[var(--text-muted)] flex-shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-[var(--text-primary)]">{device.deviceName}</p>
                                <p className="text-[10px] text-[var(--text-muted)]">{device.manufacturer} {device.model}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <p className="text-xs text-[var(--text-secondary)]">{device.operatingSystem}</p>
                            <p className="text-[10px] text-[var(--text-muted)]">{device.osVersion}</p>
                          </td>
                          <td className="px-4 py-3">
                            <ComplianceBadge state={device.complianceState} />
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-xs text-[var(--text-secondary)]">
                            {device.userDisplayName ?? <span className="text-[var(--text-muted)]">—</span>}
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell text-xs text-[var(--text-muted)]">
                            {device.lastSyncDateTime ? formatDateTime(device.lastSyncDateTime) : '—'}
                          </td>
                        </motion.tr>
                      ))
                }
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
