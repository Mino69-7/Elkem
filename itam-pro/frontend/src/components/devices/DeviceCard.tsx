import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Laptop, Monitor, Smartphone, Tablet, Printer, Keyboard,
  Mouse, Headphones, Layers, HelpCircle, Pencil, Trash2, UserRound,
} from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';
import { DEVICE_TYPE_LABELS } from '../../utils/formatters';
import type { Device, DeviceType } from '../../types';

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

interface DeviceCardProps {
  device: Device;
  index:  number;
  onEdit:   (device: Device) => void;
  onDelete: (device: Device) => void;
}

export default function DeviceCard({ device, index, onEdit, onDelete }: DeviceCardProps) {
  const Icon = TYPE_ICONS[device.type] ?? HelpCircle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="glass-card p-4 group relative flex flex-col gap-3"
    >
      {/* Actions au survol */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
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

      {/* Icône type */}
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
        <Icon size={20} />
      </div>

      {/* Infos principales */}
      <div className="min-w-0">
        <Link
          to={`/devices/${device.id}`}
          className="block font-semibold text-[var(--text-primary)] text-sm hover:text-primary transition-colors truncate"
        >
          {device.brand} {device.model}
        </Link>
        <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{device.assetTag}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{DEVICE_TYPE_LABELS[device.type]}</p>
      </div>

      {/* Statut */}
      <StatusBadge status={device.status} size="sm" />

      {/* Utilisateur assigné */}
      <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-glass)]">
        {device.assignedUser ? (
          <>
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
              {device.assignedUser.displayName.charAt(0)}
            </div>
            <span className="text-xs text-[var(--text-secondary)] truncate">
              {device.assignedUser.displayName}
            </span>
          </>
        ) : (
          <>
            <UserRound size={14} className="text-[var(--text-muted)] flex-shrink-0" />
            <span className="text-xs text-[var(--text-muted)]">Non assigné</span>
          </>
        )}
      </div>
    </motion.div>
  );
}
