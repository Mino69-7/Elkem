import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { GlassCard } from '../components/ui/GlassCard';

export default function Settings() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useUIStore();

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl">

      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Paramètres</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Configuration de l'application</p>
      </div>

      {/* ─── Apparence ───────────────────────────────────────── */}
      <GlassCard>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Apparence</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Thème</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Mode sombre ou clair</p>
          </div>
          <div className="flex rounded-xl border border-[var(--border-glass)] overflow-hidden">
            {(['dark', 'light'] as const).map((t) => (
              <button key={t} onClick={() => setTheme(t)} className={`px-4 py-2 text-xs font-medium transition-colors ${theme === t ? 'bg-primary/20 text-primary' : 'text-[var(--text-muted)] hover:bg-white/5'}`}>
                {t === 'dark' ? '🌙 Sombre' : '☀️ Clair'}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* ─── Mon compte ──────────────────────────────────────── */}
      <GlassCard>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Mon compte</h2>
        <div className="space-y-3">
          {[
            { label: 'Nom',   value: user?.displayName },
            { label: 'Email', value: user?.email },
            { label: 'Rôle',  value: user?.role === 'MANAGER' ? 'Manager' : user?.role === 'TECHNICIAN' ? 'Technicien' : 'Lecteur' },
          ].map((row) => (
            <div key={row.label} className="flex justify-between py-2 border-b border-[var(--border-glass)] last:border-0">
              <span className="text-xs text-[var(--text-muted)]">{row.label}</span>
              <span className="text-xs text-[var(--text-secondary)] font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
