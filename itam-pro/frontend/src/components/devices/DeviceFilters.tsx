import { useEffect, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { useQuery } from '@tanstack/react-query';
import { Search, X, ChevronDown, Check, Tag, Layers, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import { useDeviceStore } from '../../stores/deviceStore';
import { DEVICE_STATUS_LABELS } from '../../utils/formatters';
import type { DeviceType, DeviceStatus, DeviceModel } from '../../types';
import api from '../../services/api';

// Utilisateurs page : statuts visibles (Actif, Perdu, Volé)
const USER_STATUSES: DeviceStatus[] = ['ASSIGNED', 'LOST', 'STOLEN'];

// ─── Filter pill (Radix UI Select, zéro native select) ──────────────────────
interface FilterPillProps {
  icon: React.ReactNode;
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  onChange: (v: string | undefined) => void;
  disabled?: boolean;
}

export function FilterPill({ icon, label, value, options, onChange, disabled }: FilterPillProps) {
  const isActive = value !== undefined;
  const displayLabel = isActive ? (options.find((o) => o.value === value)?.label ?? label) : label;

  return (
    <Select.Root
      value={value ?? '__all__'}
      onValueChange={(v) => onChange(v === '__all__' ? undefined : v)}
      disabled={disabled}
    >
      <Select.Trigger
        className={clsx(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium',
          'transition-all cursor-pointer select-none outline-none',
          'focus-visible:ring-2 focus-visible:ring-indigo-500/40',
          disabled && 'opacity-40 cursor-not-allowed',
          isActive
            ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
            : 'border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
        )}
        aria-label={label}
      >
        {isActive
          ? <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
          : <span className="text-[var(--text-muted)]">{icon}</span>
        }
        <span className="max-w-[140px] truncate">{displayLabel}</span>
        <Select.Icon>
          <ChevronDown size={10} className="opacity-50 shrink-0" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className={clsx(
            'z-[200] min-w-[180px] max-h-64 overflow-hidden rounded-xl shadow-2xl',
            'border border-[var(--border-glass)]',
            'animate-in fade-in-0 zoom-in-95'
          )}
          style={{ background: 'var(--surface-primary)', backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))', WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))' }}
        >
          <Select.Viewport className="p-1 overflow-y-auto max-h-60">
            {/* Option "tous" */}
            <Select.Item
              value="__all__"
              className={clsx(
                'flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer outline-none select-none',
                'text-[var(--text-muted)]',
                'data-[highlighted]:bg-indigo-600/20 data-[highlighted]:text-[var(--text-primary)]',
                'transition-colors'
              )}
            >
              <Select.ItemText>{label} (tous)</Select.ItemText>
              <Select.ItemIndicator>
                <Check size={11} className="text-indigo-400 shrink-0" />
              </Select.ItemIndicator>
            </Select.Item>

            <div className="my-1 h-px bg-[var(--border-glass)]" />

            {options.map((opt) => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                className={clsx(
                  'flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer outline-none select-none',
                  'text-[var(--text-primary)]',
                  'data-[highlighted]:bg-indigo-600/20 data-[highlighted]:text-[var(--text-primary)]',
                  'data-[state=checked]:text-indigo-400',
                  'transition-colors'
                )}
              >
                <Select.ItemText>{opt.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check size={11} className="text-indigo-400 shrink-0" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

// ─── DeviceFilters ───────────────────────────────────────────────────────────
interface DeviceFiltersProps {
  externalSearch?: string;
  activeType: DeviceType;
}

export default function DeviceFilters({ externalSearch, activeType }: DeviceFiltersProps) {
  const { filters, setFilters, resetFilters } = useDeviceStore();
  const [localSearch, setLocalSearch] = useState(filters.search ?? '');

  // Chargement des modèles pour le type actif
  const { data: models = [] } = useQuery<DeviceModel[]>({
    queryKey: ['device-models', activeType],
    queryFn:  () => api.get<DeviceModel[]>(`/devicemodels?type=${activeType}`).then((r) => r.data),
    staleTime: 60_000,
  });

  const modelOptions = models.map((m) => ({ value: m.name, label: `${m.brand} ${m.name}` }));

  useEffect(() => {
    if (externalSearch !== undefined && externalSearch !== localSearch) {
      setLocalSearch(externalSearch);
      setFilters({ search: externalSearch || undefined, page: 1 });
    }
  }, [externalSearch]); // eslint-disable-line

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({ search: localSearch.trim() || undefined, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch]); // eslint-disable-line

  const hasActiveFilters = !!(filters.search || filters.status || filters.model);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* ── Recherche compacte ───────────────────────── */}
      <div className="relative">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
        />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Rechercher…"
          className="input-glass pl-8 pr-7 py-1.5 text-xs rounded-full w-44 focus:w-56 transition-all duration-200"
          aria-label="Rechercher un appareil"
        />
        {localSearch && (
          <button
            onClick={() => { setLocalSearch(''); setFilters({ search: undefined, page: 1 }); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Effacer la recherche"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* ── Séparateur ──────────────────────────────── */}
      <div className="w-px h-4 bg-[var(--border-glass)]" />

      {/* ── Pills filtres ────────────────────────────── */}
      <FilterPill
        icon={<Layers size={11} />}
        label="Modèle"
        value={filters.model}
        options={modelOptions}
        onChange={(v) => setFilters({ model: v, page: 1 })}
        disabled={modelOptions.length === 0}
      />

      <FilterPill
        icon={<Tag size={11} />}
        label="Statut"
        value={filters.status}
        options={USER_STATUSES.map((s) => ({ value: s, label: DEVICE_STATUS_LABELS[s] }))}
        onChange={(v) => setFilters({ status: v as DeviceStatus | undefined, page: 1 })}
      />

      {/* ── Reset ────────────────────────────────────── */}
      {hasActiveFilters && (
        <button
          onClick={() => { setLocalSearch(''); resetFilters(); }}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs text-red-400/80 hover:text-red-400 hover:bg-red-500/8 border border-transparent hover:border-red-500/20 transition-all"
          aria-label="Réinitialiser les filtres"
        >
          <RotateCcw size={11} />
          Réinitialiser
        </button>
      )}
    </div>
  );
}
