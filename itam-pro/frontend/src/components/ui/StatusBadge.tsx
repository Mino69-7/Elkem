import { clsx } from 'clsx';
import { DEVICE_STATUS_LABELS, DEVICE_STATUS_COLORS } from '../../utils/formatters';
import type { DeviceStatus } from '../../types';

interface StatusBadgeProps {
  status: DeviceStatus;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

/**
 * Badge de statut coloré selon le statut de l'appareil.
 */
export function StatusBadge({ status, size = 'md', showDot = true }: StatusBadgeProps) {
  const colors = DEVICE_STATUS_COLORS[status] ?? {
    bg: 'bg-slate-500/15',
    text: 'text-slate-400',
    dot: 'bg-slate-400',
  };
  const label = DEVICE_STATUS_LABELS[status] ?? status;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        colors.bg,
        colors.text,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs'
      )}
      aria-label={`Statut : ${label}`}
    >
      {showDot && (
        <span className={clsx('rounded-full flex-shrink-0', colors.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} aria-hidden="true" />
      )}
      {label}
    </span>
  );
}
