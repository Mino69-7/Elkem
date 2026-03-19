import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  /** Nombre de lignes à afficher (mode texte) */
  lines?: number;
}

/**
 * Composant skeleton pour les états de chargement.
 * Utilise l'animation shimmer définie dans index.css.
 */
export function Skeleton({ className, lines }: SkeletonProps) {
  if (lines) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Chargement...">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              'skeleton h-4',
              i === lines - 1 && 'w-3/4',
              className
            )}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={clsx('skeleton', className)}
      aria-busy="true"
      aria-label="Chargement..."
      role="status"
    />
  );
}

/** Skeleton pour une carte d'appareil */
export function DeviceCardSkeleton() {
  return (
    <div className="glass-card p-5 flex flex-col gap-3" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-1.5" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

/** Skeleton pour une ligne de tableau */
export function TableRowSkeleton({ cols = 7 }: { cols?: number }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}
