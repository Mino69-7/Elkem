import { GlassCard } from '../components/ui/GlassCard';
export default function Devices() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Appareils</h1>
      <GlassCard className="text-center py-8">
        <p className="text-[var(--text-secondary)]">Liste des appareils — à développer en Phase 4</p>
      </GlassCard>
    </div>
  );
}
