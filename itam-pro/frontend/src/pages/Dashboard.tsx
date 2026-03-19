import { GlassCard } from '../components/ui/GlassCard';
import { Skeleton } from '../components/ui/Skeleton';

/** Dashboard — sera développé en Phase 5 */
export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Vue d'ensemble du parc informatique</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassCard key={i} animate index={i}>
            <Skeleton className="h-6 w-24 mb-3" />
            <Skeleton className="h-10 w-16 mb-2" />
            <Skeleton className="h-4 w-20" />
          </GlassCard>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard animate index={4} className="h-64">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </GlassCard>
        <GlassCard animate index={5} className="h-64">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </GlassCard>
      </div>
      <GlassCard animate index={6} className="text-center py-8">
        <p className="text-[var(--text-secondary)]">Dashboard complet à venir en Phase 5</p>
      </GlassCard>
    </div>
  );
}
