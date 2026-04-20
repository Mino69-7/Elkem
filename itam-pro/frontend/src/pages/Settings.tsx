import { motion } from 'framer-motion';
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
          <div className="toggle-glass">
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`relative px-4 py-2 text-xs font-medium transition-colors duration-150 ${
                  theme === t ? 'text-primary' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {theme === t && (
                  <motion.div
                    className="absolute inset-0 rounded-[12px]"
                    layoutId="settings-theme-pill"
                    style={{
                      background: 'rgba(99,102,241,0.13)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(99,102,241,0.22)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative z-10">{t === 'dark' ? '🌙 Sombre' : '☀️ Clair'}</span>
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
            { label: 'Rôle',  value: user?.role === 'MANAGER' ? 'Manager' : user?.role === 'TECHNICIAN' ? 'Technicien' : 'Technicien Proximité' },
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
