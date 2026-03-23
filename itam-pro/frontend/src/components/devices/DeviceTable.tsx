import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Laptop, Monitor, Smartphone, Tablet, Printer, Keyboard,
  Mouse, Headphones, Layers, HelpCircle, ChevronUp, ChevronDown,
  Pencil, Trash2, UserRound,
} from 'lucide-react';
import { clsx } from 'clsx';
import { StatusBadge } from '../ui/StatusBadge';
import { Skeleton } from '../ui/Skeleton';
import type { Device, DeviceType } from '../../types';
import { DEVICE_TYPE_LABELS, formatDate } from '../../utils/formatters';
import { useDeviceStore } from '../../stores/deviceStore';

// ─── Icône par type ───────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────

interface DeviceTableProps {
  devices: Device[];
  isLoading?: boolean;
  onEdit:   (device: Device) => void;
  onDelete: (device: Device) => void;
}

// ─── Colonne triable ──────────────────────────────────────────

function SortHeader({ field, label }: { field: string; label: string }) {
  const { filters, setFilters } = useDeviceStore();
  const active = filters.sortBy === field;
  const asc    = active && filters.sortOrder === 'asc';

  return (
    <button
      onClick={() => setFilters({ sortBy: field, sortOrder: active && !asc ? 'asc' : 'desc', page: 1 })}
      className="flex items-center gap-1 text-left font-semibold text-xs uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors group"
      aria-label={`Trier par ${label}`}
    >
      {label}
      <span className={clsx('transition-opacity', active ? 'opacity-100' : 'opacity-0 group-hover:opacity-50')}>
        {asc ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </span>
    </button>
  );
}

// ─── Composant principal ──────────────────────────────────────

export default function DeviceTable({ devices, isLoading, onEdit, onDelete }: DeviceTableProps) {
  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Chargement de la liste">
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-[var(--border-glass)]">
                {[1, 2, 3, 4, 5, 6].map((j) => (
                  <td key={j} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!devices.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-muted)]">
        <Laptop size={40} className="opacity-30" />
        <p className="text-sm">Aucun appareil trouvé</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label="Liste des appareils">
        <thead>
          <tr className="border-b border-[var(--border-glass)]">
            <th className="px-4 py-3 text-left"><SortHeader field="assetTag" label="Tag" /></th>
            <th className="px-4 py-3 text-left"><SortHeader field="brand"    label="Appareil" /></th>
            <th className="px-4 py-3 text-left"><SortHeader field="type"     label="Type" /></th>
            <th className="px-4 py-3 text-left"><SortHeader field="status"   label="Statut" /></th>
            <th className="px-4 py-3 text-left hidden md:table-cell">Affecté à</th>
            <th className="px-4 py-3 text-left hidden lg:table-cell"><SortHeader field="updatedAt" label="Modifié" /></th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device, i) => {
            const Icon = TYPE_ICONS[device.type] ?? HelpCircle;
            return (
              <motion.tr
                key={device.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="border-b border-[var(--border-glass)] hover:bg-white/[0.03] transition-colors group"
              >
                {/* Tag */}
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                  <Link
                    to={`/devices/${device.id}`}
                    className="hover:text-primary transition-colors font-medium"
                  >
                    {device.assetTag}
                  </Link>
                </td>

                {/* Appareil */}
                <td className="px-4 py-3">
                  <Link to={`/devices/${device.id}`} className="hover:text-primary transition-colors">
                    <p className="font-medium text-[var(--text-primary)]">{device.brand} {device.model}</p>
                    <p className="text-xs text-[var(--text-muted)]">{device.serialNumber}</p>
                  </Link>
                </td>

                {/* Type */}
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                    <Icon size={14} className="flex-shrink-0" />
                    <span className="hidden sm:inline">{DEVICE_TYPE_LABELS[device.type]}</span>
                  </span>
                </td>

                {/* Statut */}
                <td className="px-4 py-3">
                  <StatusBadge status={device.status} size="sm" />
                </td>

                {/* Assigné */}
                <td className="px-4 py-3 hidden md:table-cell">
                  {device.assignedUser ? (
                    <span className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {device.assignedUser.displayName.charAt(0)}
                      </div>
                      <span className="text-[var(--text-secondary)] text-xs truncate max-w-[120px]">
                        {device.assignedUser.displayName}
                      </span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs">
                      <UserRound size={13} />
                      Libre
                    </span>
                  )}
                </td>

                {/* Modifié */}
                <td className="px-4 py-3 hidden lg:table-cell text-xs text-[var(--text-muted)]">
                  {formatDate(device.updatedAt)}
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(device)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-primary hover:bg-primary/10 transition-colors"
                      aria-label={`Modifier ${device.assetTag}`}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => onDelete(device)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      aria-label={`Supprimer ${device.assetTag}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
