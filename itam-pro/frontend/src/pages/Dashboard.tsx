import { Link } from 'react-router-dom';
import {
  BarChart, Bar, PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  Monitor, Package, UserCheck, Wrench, ShieldAlert,
  TrendingUp, Activity, Clock,
} from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useStats } from '../hooks/useStats';
import { useAuthStore } from '../stores/authStore';
import {
  DEVICE_TYPE_LABELS, DEVICE_STATUS_LABELS,
  AUDIT_ACTION_LABELS, formatDate, formatDateTime,
} from '../utils/formatters';
import type { DeviceStatus, DeviceType } from '../types';

// ─── Palette Recharts ─────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  LAPTOP:          '#6366f1',
  DESKTOP:         '#8b5cf6',
  SMARTPHONE:      '#06b6d4',
  TABLET:          '#3b82f6',
  MONITOR:         '#10b981',
  KEYBOARD:        '#f59e0b',
  MOUSE:           '#f97316',
  HEADSET:         '#ec4899',
  DOCKING_STATION: '#14b8a6',
  PRINTER:         '#84cc16',
  OTHER:           '#6b7280',
};

const STATUS_CHART_COLORS: Record<string, string> = {
  ASSIGNED:       '#6366f1',
  IN_STOCK:       '#10b981',
  ORDERED:        '#3b82f6',
  IN_MAINTENANCE: '#f59e0b',
  LOANER:         '#06b6d4',
  LOST:           '#ef4444',
  STOLEN:         '#dc2626',
  RETIRED:        '#6b7280',
};

// ─── KPI Card ─────────────────────────────────────────────────

function KpiCard({
  label, value, icon: Icon, color, loading, index,
}: {
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  loading: boolean;
  index: number;
}) {
  return (
    <GlassCard animate index={index} hoverable>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">{label}</p>
          {loading
            ? <Skeleton className="h-9 w-16 mt-2" />
            : <p className="text-3xl font-bold mt-1" style={{ color }}>{value ?? 0}</p>
          }
        </div>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
    </GlassCard>
  );
}

// ─── Tooltip personnalisé ─────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; name?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-[var(--text-muted)] mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-[var(--text-primary)] font-semibold">{p.value} appareil{p.value > 1 ? 's' : ''}</p>
      ))}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuthStore();
  const { data, isLoading } = useStats();

  const byTypeData = (data?.byType ?? []).map((d) => ({
    name: DEVICE_TYPE_LABELS[d.type as DeviceType] ?? d.type,
    value: d.count,
    color: TYPE_COLORS[d.type] ?? '#6b7280',
  }));

  const byStatusData = (data?.byStatus ?? []).map((d) => ({
    name: DEVICE_STATUS_LABELS[d.status as DeviceStatus] ?? d.status,
    value: d.count,
    color: STATUS_CHART_COLORS[d.status] ?? '#6b7280',
  }));

  return (
    <div className="p-4 lg:p-6 space-y-4">

      {/* ─── En-tête ───────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          Bonjour, {user?.displayName?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Vue d'ensemble du parc informatique Elkem</p>
      </div>

      {/* ─── KPI row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total appareils" value={data?.totals.devices}       icon={Monitor}    color="#6366f1" loading={isLoading} index={0} />
        <KpiCard label="En stock"        value={data?.totals.inStock}        icon={Package}    color="#10b981" loading={isLoading} index={1} />
        <KpiCard label="Assignés"        value={data?.totals.assigned}       icon={UserCheck}  color="#06b6d4" loading={isLoading} index={2} />
        <KpiCard label="En maintenance"  value={data?.totals.inMaintenance}  icon={Wrench}     color="#f59e0b" loading={isLoading} index={3} />
      </div>

      {/* ─── Graphiques ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* BarChart — par type */}
        <GlassCard animate index={4} className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Appareils par type</h2>
          </div>
          {isLoading
            ? <Skeleton className="h-48 w-full rounded-xl" />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byTypeData} barSize={28} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {byTypeData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </GlassCard>

        {/* DonutChart — par statut */}
        <GlassCard animate index={5}>
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Statuts</h2>
          </div>
          {isLoading
            ? <Skeleton className="h-48 w-full rounded-xl" />
            : (
              <div className="flex flex-col items-center gap-3">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={byStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={64}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {byStatusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-1.5">
                  {byStatusData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        {d.name}
                      </span>
                      <span className="font-medium text-[var(--text-primary)]">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          }
        </GlassCard>
      </div>

      {/* ─── Bas de page ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Activité récente */}
        <GlassCard animate index={6} padding="none">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--border-glass)]">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Activité récente</h2>
            </div>
          </div>
          <div className="divide-y divide-[var(--border-glass)]">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 flex gap-3">
                    <Skeleton className="w-7 h-7 rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))
              : data?.recentActivity.length === 0
                ? <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">Aucune activité</p>
                : data?.recentActivity.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="px-4 py-3 flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Activity size={12} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-[var(--text-primary)] leading-snug">
                            <span className="font-medium">{log.user.displayName}</span>
                            {' — '}
                            <span className="text-[var(--text-muted)]">{AUDIT_ACTION_LABELS[log.action] ?? log.action}</span>
                            {' '}
                            <Link
                              to={`/devices/${log.device.id}`}
                              state={{ from: '/dashboard' }}
                              className="font-mono text-[10px] text-primary hover:underline"
                            >
                              {log.device.assetTag}
                            </Link>
                          </p>
                          {log.comment && (
                            <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{log.comment}</p>
                          )}
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{formatDateTime(log.createdAt)}</p>
                        </div>
                      </motion.div>
                ))
            }
          </div>
        </GlassCard>

        {/* Garanties expirant + derniers appareils */}
        <div className="space-y-4">

          {/* Garanties */}
          <GlassCard animate index={7} padding="none">
            <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-[var(--border-glass)]">
              <ShieldAlert size={16} className="text-amber-400" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Garanties expirant bientôt</h2>
              {!isLoading && data && (
                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                  {data.warrantyExpiring.length} / 30j
                </span>
              )}
            </div>
            <div className="divide-y divide-[var(--border-glass)]">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="px-4 py-3 flex gap-3">
                      <Skeleton className="flex-1 h-3" />
                      <Skeleton className="w-20 h-3" />
                    </div>
                  ))
                : data?.warrantyExpiring.length === 0
                  ? <p className="px-4 py-5 text-xs text-[var(--text-muted)] text-center">Aucune garantie n'expire dans les 30 prochains jours</p>
                  : data?.warrantyExpiring.map((d) => (
                      <Link
                        key={d.id}
                        to={`/devices/${d.id}`}
                        state={{ from: '/dashboard' }}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[var(--text-primary)] truncate">{d.brand} {d.model}</p>
                          <p className="text-[10px] text-[var(--text-muted)] font-mono">{d.assetTag}</p>
                        </div>
                        <span className="text-[10px] text-amber-400 font-medium whitespace-nowrap flex-shrink-0">
                          {formatDate(d.warrantyExpiry)}
                        </span>
                      </Link>
                    ))
              }
            </div>
          </GlassCard>

          {/* Derniers ajouts */}
          <GlassCard animate index={8} padding="none">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--border-glass)]">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Derniers ajouts</h2>
              </div>
              <Link to="/devices" className="text-xs text-primary hover:underline">Voir tout</Link>
            </div>
            <div className="divide-y divide-[var(--border-glass)]">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="px-4 py-3 flex justify-between gap-3">
                      <Skeleton className="flex-1 h-3" />
                      <Skeleton className="w-16 h-3" />
                    </div>
                  ))
                : data?.recentDevices.map((d) => (
                    <Link
                      key={d.id}
                      to={`/devices/${d.id}`}
                      state={{ from: '/dashboard' }}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">{d.brand} {d.model}</p>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono">{d.assetTag}</p>
                      </div>
                      <StatusBadge status={d.status} size="sm" showDot={false} />
                    </Link>
                  ))
              }
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
