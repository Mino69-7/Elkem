import { useEffect, useState } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { useDeviceStore } from '../../stores/deviceStore';
import { DEVICE_TYPE_LABELS, DEVICE_STATUS_LABELS } from '../../utils/formatters';
import type { DeviceType, DeviceStatus } from '../../types';

const DEVICE_TYPES = Object.keys(DEVICE_TYPE_LABELS) as DeviceType[];
const DEVICE_STATUSES = Object.keys(DEVICE_STATUS_LABELS) as DeviceStatus[];

interface DeviceFiltersProps {
  /** Valeur de recherche provenant de la TopBar (synchronisation) */
  externalSearch?: string;
}

export default function DeviceFilters({ externalSearch }: DeviceFiltersProps) {
  const { filters, setFilters, resetFilters } = useDeviceStore();
  const [localSearch, setLocalSearch] = useState(filters.search ?? '');

  // Sync avec la recherche globale de la TopBar
  useEffect(() => {
    if (externalSearch !== undefined && externalSearch !== localSearch) {
      setLocalSearch(externalSearch);
      setFilters({ search: externalSearch || undefined, page: 1 });
    }
  }, [externalSearch]); // eslint-disable-line

  // Debounce sur la recherche locale
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({ search: localSearch.trim() || undefined, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch]); // eslint-disable-line

  const hasActiveFilters = !!(filters.search || filters.type || filters.status || filters.assigned !== undefined);

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Recherche */}
      <div className="relative flex-1 min-w-48 max-w-72">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Rechercher..."
          className="input-glass pl-9 pr-8 py-2 text-sm w-full"
          aria-label="Rechercher un appareil"
        />
        {localSearch && (
          <button
            onClick={() => { setLocalSearch(''); setFilters({ search: undefined, page: 1 }); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            aria-label="Effacer"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Type */}
      <select
        value={filters.type ?? ''}
        onChange={(e) => setFilters({ type: (e.target.value as DeviceType) || undefined, page: 1 })}
        className="input-glass py-2 text-sm pr-8"
        aria-label="Filtrer par type"
      >
        <option value="">Tous les types</option>
        {DEVICE_TYPES.map((t) => (
          <option key={t} value={t}>{DEVICE_TYPE_LABELS[t]}</option>
        ))}
      </select>

      {/* Statut */}
      <select
        value={filters.status ?? ''}
        onChange={(e) => setFilters({ status: (e.target.value as DeviceStatus) || undefined, page: 1 })}
        className="input-glass py-2 text-sm pr-8"
        aria-label="Filtrer par statut"
      >
        <option value="">Tous les statuts</option>
        {DEVICE_STATUSES.map((s) => (
          <option key={s} value={s}>{DEVICE_STATUS_LABELS[s]}</option>
        ))}
      </select>

      {/* Assigné */}
      <select
        value={filters.assigned === undefined ? '' : String(filters.assigned)}
        onChange={(e) => {
          const v = e.target.value;
          setFilters({ assigned: v === '' ? undefined : v === 'true', page: 1 });
        }}
        className="input-glass py-2 text-sm pr-8"
        aria-label="Filtrer par affectation"
      >
        <option value="">Tous</option>
        <option value="true">Assignés</option>
        <option value="false">Libres</option>
      </select>

      {/* Reset */}
      {hasActiveFilters && (
        <button
          onClick={() => { setLocalSearch(''); resetFilters(); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/5 transition-colors border border-[var(--border-glass)]"
          aria-label="Réinitialiser les filtres"
        >
          <SlidersHorizontal size={14} />
          Réinitialiser
        </button>
      )}
    </div>
  );
}
