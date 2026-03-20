import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Laptop, Monitor, Smartphone, Tablet, Printer, Keyboard,
  Mouse, Headphones, Layers, HelpCircle, AlertTriangle, CheckCircle,
} from 'lucide-react';
import api from '../services/api';
import { GlassCard } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Skeleton';
import { DEVICE_TYPE_LABELS } from '../utils/formatters';
import type { DeviceType } from '../types';

// ─── Icônes par type ──────────────────────────────────────────

const TYPE_ICONS: Record<DeviceType, React.ComponentType<{ size?: number; className?: string }>> = {
  LAPTOP:          Laptop,
  DESKTOP:         Monitor,
  SMARTPHONE:      Smartphone,
  TABLET:          Tablet,
  MONITOR:         Monitor,
  KEYBOARD:        Keyboard,
  MOUSE:           Mouse,
  HEADSET:         Headphones,
  DOCKING_STATION: Layers,
  PRINTER:         Printer,
  OTHER:           HelpCircle,
};

// ─── Types ────────────────────────────────────────────────────

interface StockSummary {
  type: DeviceType;
  total:    number;
  inStock:  number;
  assigned: number;
  ordered:  number;
  alert?:   { threshold: number };
}

// ─── Fetch ────────────────────────────────────────────────────

async function fetchStockSummary(): Promise<StockSummary[]> {
  // On agrège depuis la liste des appareils sans pagination
  const { data } = await api.get<{ data: Array<{ type: DeviceType; status: string }> }>(
    '/devices?limit=1000'
  );

  const groups: Record<string, { total: number; inStock: number; assigned: number; ordered: number }> = {};

  data.data.forEach((d) => {
    if (!groups[d.type]) groups[d.type] = { total: 0, inStock: 0, assigned: 0, ordered: 0 };
    groups[d.type].total++;
    if (d.status === 'IN_STOCK')  groups[d.type].inStock++;
    if (d.status === 'ASSIGNED')  groups[d.type].assigned++;
    if (d.status === 'ORDERED')   groups[d.type].ordered++;
  });

  return Object.entries(groups)
    .map(([type, counts]) => ({ type: type as DeviceType, ...counts }))
    .sort((a, b) => b.total - a.total);
}

// ─── Composant principal ──────────────────────────────────────

export default function Stock() {
  const { data: summary = [], isLoading } = useQuery({
    queryKey: ['stock-summary'],
    queryFn:  fetchStockSummary,
    staleTime: 60_000,
  });

  const totalDevices  = summary.reduce((s, g) => s + g.total, 0);
  const totalInStock  = summary.reduce((s, g) => s + g.inStock, 0);
  const totalAssigned = summary.reduce((s, g) => s + g.assigned, 0);

  return (
    <div className="p-4 lg:p-6 space-y-4">

      {/* ─── En-tête ─────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Stock</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Vue d'ensemble du parc informatique</p>
      </div>

      {/* ─── KPIs globaux ────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total parc',   value: totalDevices,  color: 'text-[var(--text-primary)]' },
          { label: 'En stock',     value: totalInStock,  color: 'text-emerald-400' },
          { label: 'Assignés',     value: totalAssigned, color: 'text-indigo-400' },
        ].map((kpi, i) => (
          <GlassCard key={kpi.label} padding="md" animate index={i}>
            <p className="text-xs text-[var(--text-muted)]">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{isLoading ? '…' : kpi.value}</p>
          </GlassCard>
        ))}
      </div>

      {/* ─── Par type d'appareil ─────────────────────────────── */}
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Par type</h2>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <GlassCard key={i} padding="md"><Skeleton className="h-20 w-full" /></GlassCard>
          ))}
        </div>
      ) : !summary.length ? (
        <GlassCard padding="md" className="text-center py-12">
          <p className="text-[var(--text-muted)] text-sm">Aucun appareil enregistré</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {summary.map((group, i) => {
            const Icon = TYPE_ICONS[group.type] ?? HelpCircle;
            const stockRatio = group.total > 0 ? group.inStock / group.total : 0;
            const isLow = group.inStock < 3;

            return (
              <motion.div
                key={group.type}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <GlassCard padding="md">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLow ? 'bg-amber-500/15 text-amber-400' : 'bg-primary/10 text-primary'}`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {DEVICE_TYPE_LABELS[group.type]}
                        </p>
                        {isLow ? (
                          <AlertTriangle size={13} className="text-amber-400 flex-shrink-0" />
                        ) : (
                          <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {group.total} au total
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-[var(--text-primary)]">{group.inStock}</p>
                  </div>

                  {/* Barre de progression stock */}
                  <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${isLow ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${stockRatio * 100}%` }}
                      transition={{ delay: i * 0.05 + 0.3, duration: 0.6 }}
                    />
                  </div>

                  {/* Détail */}
                  <div className="flex justify-between mt-2">
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {group.inStock} en stock
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {group.assigned} assignés · {group.ordered} commandés
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
