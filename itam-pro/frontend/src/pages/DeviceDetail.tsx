import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Pencil, Trash2, UserRound, UserPlus, UserMinus,
  Loader2, AlertTriangle, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { useDevice, useUpdateDevice, useDeleteDevice, useAssignDevice, useUnassignDevice } from '../hooks/useDevices';
import { useQuery } from '@tanstack/react-query';
import { userService } from '../services/user.service';
import { useAuthStore } from '../stores/authStore';
import { StatusBadge } from '../components/ui/StatusBadge';
import DeviceForm from '../components/devices/DeviceForm';
import { GlassCard } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Skeleton';
import {
  formatDate, formatDateTime, formatPrice,
  DEVICE_TYPE_LABELS, DEVICE_CONDITION_LABELS, KEYBOARD_LAYOUT_LABELS, AUDIT_ACTION_LABELS,
} from '../utils/formatters';
import type { DeviceFormData } from '../services/device.service';

// ─── Champ info ───────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-[var(--border-glass)] last:border-0">
      <span className="text-xs text-[var(--text-muted)] flex-shrink-0">{label}</span>
      <span className="text-xs text-[var(--text-secondary)] text-right">{value ?? '—'}</span>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const canEdit = currentUser?.role === 'MANAGER' || currentUser?.role === 'TECHNICIAN';
  const isManager = currentUser?.role === 'MANAGER';

  const { data: device, isLoading, error } = useDevice(id!);

  const [formOpen,   setFormOpen]   = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [selectedUser, setSelectedUser] = useState('');

  const updateMut   = useUpdateDevice(id!);
  const deleteMut   = useDeleteDevice();
  const assignMut   = useAssignDevice(id!);
  const unassignMut = useUnassignDevice(id!);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.list(),
    enabled: assignOpen,
  });

  const handleUpdate = async (data: DeviceFormData) => {
    await updateMut.mutateAsync(data);
    setFormOpen(false);
  };

  const handleDelete = async () => {
    await deleteMut.mutateAsync(id!);
    navigate('/devices');
  };

  const handleAssign = async () => {
    if (!selectedUser) return;
    await assignMut.mutateAsync(selectedUser);
    setAssignOpen(false);
    setSelectedUser('');
  };

  const handleUnassign = async () => {
    await unassignMut.mutateAsync();
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
        <Link to="/devices" className="btn-secondary px-4 py-2 text-sm">Retour à la liste</Link>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">

      {/* ─── Navigation & titre ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <Link to="/devices" className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors" aria-label="Retour">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">{device.brand} {device.model}</h1>
              <StatusBadge status={device.status} />
            </div>
            <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{device.assetTag} · {device.serialNumber}</p>
          </div>
        </div>

        {canEdit && (
          <div className="sm:ml-auto flex items-center gap-2">
            {device.assignedUser ? (
              <button
                onClick={handleUnassign}
                disabled={unassignMut.isPending}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-amber-400 hover:border-amber-400/30 transition-colors"
              >
                {unassignMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
                Désassigner
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
      <Tabs.Root defaultValue="info">
        <Tabs.List className="flex gap-1 p-1 rounded-xl border border-[var(--border-glass)] w-fit" style={{ background: 'var(--bg-secondary)' }}>
          {[
            { value: 'info',        label: 'Informations' },
            { value: 'maintenance', label: `Maintenance (${device.maintenanceLogs?.length ?? 0})` },
            { value: 'audit',       label: `Historique (${device.auditLogs?.length ?? 0})` },
            { value: 'files',       label: `Fichiers (${device.attachments?.length ?? 0})` },
          ].map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors text-[var(--text-muted)] data-[state=active]:bg-primary/15 data-[state=active]:text-primary"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* ── Informations ── */}
        <Tabs.Content value="info" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Matériel */}
            <GlassCard padding="md" animate index={0}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Matériel</h3>
              <InfoRow label="Type"       value={DEVICE_TYPE_LABELS[device.type]} />
              <InfoRow label="Marque"     value={device.brand} />
              <InfoRow label="Modèle"     value={device.model} />
              <InfoRow label="Processeur" value={device.processor} />
              <InfoRow label="RAM"        value={device.ram} />
              <InfoRow label="Stockage"   value={device.storage} />
              <InfoRow label="Écran"      value={device.screenSize} />
              <InfoRow label="Couleur"    value={device.color} />
              <InfoRow label="Clavier"    value={device.keyboardLayout ? KEYBOARD_LAYOUT_LABELS[device.keyboardLayout] : undefined} />
            </GlassCard>

            {/* Statut & localisation */}
            <GlassCard padding="md" animate index={1}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Statut</h3>
              <div className="mb-3"><StatusBadge status={device.status} /></div>
              <InfoRow label="État"         value={device.condition ? DEVICE_CONDITION_LABELS[device.condition] : undefined} />
              <InfoRow label="Localisation" value={device.location} />
              <InfoRow label="Site"         value={device.site} />

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
            </GlassCard>

            {/* Cycle de vie */}
            <GlassCard padding="md" animate index={2}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Cycle de vie</h3>
              <InfoRow label="Achat"        value={formatDate(device.purchaseDate)} />
              <InfoRow label="Garantie"     value={formatDate(device.warrantyExpiry)} />
              <InfoRow label="Prix d'achat" value={formatPrice(device.purchasePrice)} />
              <InfoRow label="Fournisseur"  value={device.supplier} />
              <InfoRow label="N° facture"   value={device.invoiceNumber} />
              <InfoRow label="Créé le"      value={formatDate(device.createdAt)} />
              <InfoRow label="Modifié le"   value={formatDate(device.updatedAt)} />
              {device.notes && (
                <>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mt-4 mb-2">Notes</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{device.notes}</p>
                </>
              )}
            </GlassCard>
          </div>
        </Tabs.Content>

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
            {!device.auditLogs?.length ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-muted)]">
                <Clock size={36} className="opacity-30" />
                <p className="text-sm">Aucun historique</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-glass)]">
                {device.auditLogs.map((log, i) => (
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
              </div>
            )}
          </GlassCard>
        </Tabs.Content>

        {/* ── Fichiers ── */}
        <Tabs.Content value="files" className="mt-4">
          <GlassCard padding="none">
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-muted)]">
              <AlertTriangle size={36} className="opacity-30" />
              <p className="text-sm">Gestion des pièces jointes — Phase 6</p>
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
              <h3 className="font-semibold text-[var(--text-primary)]">Assigner à un utilisateur</h3>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="input-glass w-full py-2 text-sm"
              >
                <option value="">Sélectionner un utilisateur...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.displayName} — {u.email}</option>
                ))}
              </select>
              <div className="flex gap-3">
                <button onClick={() => setAssignOpen(false)} className="btn-secondary flex-1 py-2 text-sm">
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

      {/* ─── Confirmation suppression ────────────────────────── */}
      {deleting && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setDeleting(false)} />
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="glass-card p-6 max-w-sm w-full space-y-4 pointer-events-auto">
              <h3 className="font-semibold text-[var(--text-primary)]">Supprimer {device.assetTag} ?</h3>
              <p className="text-sm text-[var(--text-muted)]">Action irréversible. Tout l'historique sera supprimé.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleting(false)} className="btn-secondary flex-1 py-2 text-sm">Annuler</button>
                <button onClick={handleDelete} disabled={deleteMut.isPending} className="flex-1 py-2 text-sm rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors font-medium disabled:opacity-50">
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
