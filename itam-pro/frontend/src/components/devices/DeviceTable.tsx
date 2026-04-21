import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Laptop, Monitor, Smartphone, Tablet, Printer, Keyboard,
  Mouse, Headphones, Layers, HelpCircle, ChevronUp, ChevronDown,
  Pencil, Trash2, UserRound, AlertTriangle, Tv, Server, Cpu,
} from 'lucide-react';
import { clsx } from 'clsx';
import * as Tooltip from '@radix-ui/react-tooltip';
import { StatusBadge } from '../ui/StatusBadge';
import { Skeleton } from '../ui/Skeleton';
import type { Device, DeviceType } from '../../types';
import { DEVICE_TYPE_LABELS, formatDate } from '../../utils/formatters';
import { useDeviceStore } from '../../stores/deviceStore';

// ─── Icône par type ───────────────────────────────────────────

const TYPE_ICONS: Record<DeviceType, React.ComponentType<{ size?: number; className?: string }>> = {
  LAPTOP:          Laptop,
  DESKTOP:         Cpu,
  THIN_CLIENT:     Tv,
  LAB_WORKSTATION: Server,
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
  onEdit:    (device: Device) => void;
  onDelete:  (device: Device) => void;
  fromTab?:  string;
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

export default function DeviceTable({ devices, isLoading, onEdit, onDelete, fromTab }: DeviceTableProps) {
  const navigate = useNavigate();

  // Calcul des doublons : même assignedUserId sur ≥2 appareils actifs
  const doublonUserIds = useMemo(() => {
    const counts = new Map<string, number>();
    devices.forEach(d => {
      if (d.assignedUserId && ['ASSIGNED', 'PENDING_RETURN', 'LOANER'].includes(d.status)) {
        counts.set(d.assignedUserId, (counts.get(d.assignedUserId) ?? 0) + 1);
      }
    });
    return new Set([...counts.entries()].filter(([, c]) => c >= 2).map(([uid]) => uid));
  }, [devices]);

  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="table-glass text-sm" aria-label="Chargement de la liste">
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
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
      <table className="table-glass text-sm" aria-label="Liste des appareils">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)]">Site</th>
            <th className="px-4 py-3 text-left hidden md:table-cell">Affecté à</th>
            <th className="px-4 py-3 text-left"><SortHeader field="type"     label="Type" /></th>
            <th className="px-4 py-3 text-left"><SortHeader field="brand"    label="Appareil" /></th>
            <th className="px-4 py-3 text-left"><SortHeader field="status"   label="Statut" /></th>
            <th className="px-4 py-3 text-left hidden lg:table-cell"><SortHeader field="updatedAt" label="Modifié" /></th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => {
            const Icon = TYPE_ICONS[device.type] ?? HelpCircle;
            return (
              <tr
                key={device.id}
                onClick={() => navigate(`/devices/${device.id}`, { state: { from: '/devices', fromTab } })}
                className="transition-colors group cursor-pointer"
              >
                {/* Site */}
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                  <span className="font-semibold tracking-wide">
                    {device.site ?? '—'}
                  </span>
                </td>

                {/* Assigné */}
                <td className="px-4 py-3 hidden md:table-cell">
                  {device.assignedUser ? (
                    <span className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${device.assignedUser.isActive === false ? 'bg-red-500/30' : 'bg-gradient-to-br from-indigo-400 to-cyan-400'}`}>
                        {device.assignedUser.displayName.charAt(0)}
                      </div>
                      <span className={`text-xs truncate max-w-[120px] ${device.assignedUser.isActive === false ? 'text-red-400' : 'text-[var(--text-secondary)]'}`}>
                        {device.assignedUser.displayName}
                      </span>
                      {device.assignedUser.isActive === false && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[9px] font-semibold">Inactif</span>
                      )}
                      {device.assignedUser.isActive !== false && device.assignedUserId && doublonUserIds.has(device.assignedUserId) && ['ASSIGNED', 'PENDING_RETURN', 'LOANER'].includes(device.status) && (
                        <Tooltip.Provider delayDuration={200}>
                          <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 text-[9px] font-semibold cursor-default">
                                <AlertTriangle size={9} />
                                Doublon
                              </span>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                              <Tooltip.Content
                                side="top"
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white z-50"
                                style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
                              >
                                Doublon détecté : cet utilisateur a plusieurs appareils actifs
                                <Tooltip.Arrow className="fill-black/85" />
                              </Tooltip.Content>
                            </Tooltip.Portal>
                          </Tooltip.Root>
                        </Tooltip.Provider>
                      )}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs">
                      <UserRound size={13} />
                      Libre
                    </span>
                  )}
                </td>

                {/* Type */}
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                    <Icon size={14} className="flex-shrink-0" />
                    <span className="hidden sm:inline">{DEVICE_TYPE_LABELS[device.type]}</span>
                  </span>
                </td>

                {/* Appareil */}
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--text-primary)]">{device.brand} {device.model}</p>
                  <p className="text-xs text-[var(--text-muted)]">{device.serialNumber}</p>
                </td>

                {/* Statut */}
                <td className="px-4 py-3">
                  <StatusBadge status={device.status} size="sm" />
                </td>

                {/* Modifié */}
                <td className="px-4 py-3 hidden lg:table-cell text-xs text-[var(--text-muted)]">
                  {formatDate(device.updatedAt)}
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(device); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-primary hover:bg-primary/10 transition-colors"
                      aria-label={`Modifier ${device.brand} ${device.model}`}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(device); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      aria-label={`Supprimer ${device.brand} ${device.model}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
