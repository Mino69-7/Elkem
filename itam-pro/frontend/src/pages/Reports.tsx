import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileDown, Laptop, ClipboardList, Filter, Loader2 } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { AppSelect } from '../components/ui/AppSelect';
import { useAuthStore } from '../stores/authStore';
import { DEVICE_TYPE_LABELS, DEVICE_STATUS_LABELS } from '../utils/formatters';
import type { DeviceType, DeviceStatus } from '../types';

// ─── Téléchargement via fetch avec token ──────────────────────

async function downloadCSV(url: string, filename: string) {
  const token = useAuthStore.getState().token;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

// ─── Composant export card ────────────────────────────────────

function ExportCard({
  icon: Icon,
  title,
  description,
  onExport,
  loading,
  index,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  onExport: () => void;
  loading: boolean;
  index: number;
  children?: React.ReactNode;
}) {
  return (
    <GlassCard animate index={index}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon size={20} className="text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
        </div>
      </div>

      {children && <div className="space-y-3 mb-4">{children}</div>}

      <button
        onClick={onExport}
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2 py-2 text-sm disabled:opacity-50"
      >
        {loading
          ? <><Loader2 size={15} className="animate-spin" /> Génération…</>
          : <><FileDown size={15} /> Exporter CSV</>
        }
      </button>
    </GlassCard>
  );
}

// ─── Composant principal ──────────────────────────────────────

export default function Reports() {
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [loadingAudit,   setLoadingAudit]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtres export appareils
  const [typeFilter,     setTypeFilter]     = useState<DeviceType | ''>('');
  const [statusFilter,   setStatusFilter]   = useState<DeviceStatus | ''>('');
  const [assignedFilter, setAssignedFilter] = useState<'' | 'true' | 'false'>('');

  // Filtres export audit
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo,   setAuditTo]   = useState('');

  const handleExportDevices = async () => {
    setLoadingDevices(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter)     params.set('type',     typeFilter);
      if (statusFilter)   params.set('status',   statusFilter);
      if (assignedFilter) params.set('assigned', assignedFilter);
      const qs = params.toString() ? `?${params}` : '';
      const date = new Date().toISOString().slice(0, 10);
      await downloadCSV(`/api/reports/devices.csv${qs}`, `appareils_${date}.csv`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'export');
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleExportAudit = async () => {
    setLoadingAudit(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (auditFrom) params.set('from', auditFrom);
      if (auditTo)   params.set('to',   auditTo);
      const qs = params.toString() ? `?${params}` : '';
      const date = new Date().toISOString().slice(0, 10);
      await downloadCSV(`/api/reports/audit.csv${qs}`, `audit_${date}.csv`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'export');
    } finally {
      setLoadingAudit(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">

      {/* ─── En-tête ─────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Rapports</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Exports CSV — compatibles Excel, Google Sheets</p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400"
        >
          {error}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ─── Export appareils ────────────────────────────── */}
        <ExportCard
          icon={Laptop}
          title="Export Appareils"
          description="Liste complète du parc avec toutes les informations (matériel, statut, assignation, financier, Intune)"
          onExport={handleExportDevices}
          loading={loadingDevices}
          index={0}
        >
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Filter size={12} />
            <span className="font-medium">Filtres optionnels</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <AppSelect
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as DeviceType | '')}
              placeholder="Tous les types"
              options={(Object.keys(DEVICE_TYPE_LABELS) as DeviceType[]).map((t) => ({
                value: t,
                label: DEVICE_TYPE_LABELS[t],
              }))}
            />
            <AppSelect
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as DeviceStatus | '')}
              placeholder="Tous les statuts"
              options={(Object.keys(DEVICE_STATUS_LABELS) as DeviceStatus[]).map((s) => ({
                value: s,
                label: DEVICE_STATUS_LABELS[s],
              }))}
            />
            <AppSelect
              value={assignedFilter}
              onChange={(v) => setAssignedFilter(v as '' | 'true' | 'false')}
              placeholder="Tous (assignés + libres)"
              options={[
                { value: 'true',  label: 'Assignés uniquement' },
                { value: 'false', label: 'Libres uniquement'   },
              ]}
            />
          </div>
        </ExportCard>

        {/* ─── Export audit ─────────────────────────────────── */}
        <ExportCard
          icon={ClipboardList}
          title="Export Journal d'activité"
          description="Historique de toutes les actions effectuées sur les appareils (création, modification, assignation, sync Intune…)"
          onExport={handleExportAudit}
          loading={loadingAudit}
          index={1}
        >
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Filter size={12} />
            <span className="font-medium">Plage de dates (optionnel)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">Du</label>
              <input
                type="date"
                value={auditFrom}
                onChange={(e) => setAuditFrom(e.target.value)}
                className="input-glass py-1.5 text-xs w-full"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">Au</label>
              <input
                type="date"
                value={auditTo}
                onChange={(e) => setAuditTo(e.target.value)}
                className="input-glass py-1.5 text-xs w-full"
              />
            </div>
          </div>
        </ExportCard>
      </div>

      {/* ─── Info format ──────────────────────────────────────── */}
      <GlassCard animate index={2} className="text-xs text-[var(--text-muted)] space-y-1">
        <p className="font-medium text-[var(--text-secondary)]">À propos du format CSV</p>
        <p>Les fichiers sont encodés en <span className="font-mono text-[var(--text-primary)]">UTF-8 avec BOM</span> pour une compatibilité optimale avec Microsoft Excel.</p>
        <p>Ouvrir dans Excel : double-cliquer sur le fichier .csv — les accents français s'affichent correctement.</p>
      </GlassCard>
    </div>
  );
}
