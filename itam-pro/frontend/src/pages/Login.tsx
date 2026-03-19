import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { loginSchema, type LoginFormData } from '../utils/validators';
import { useSearchParams } from 'react-router-dom';

// Messages d'erreur SSO mappés depuis les paramètres URL
const SSO_ERRORS: Record<string, string> = {
  sso_failed: 'L\'authentification Microsoft a échoué. Réessayez.',
  no_code: 'Réponse Microsoft invalide. Réessayez.',
  sso_error: 'Erreur lors de la connexion Microsoft. Vérifiez votre configuration Azure.',
};

export default function Login() {
  const [showLocalForm, setShowLocalForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const { login, loginWithSSO, isLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const ssoError = searchParams.get('error');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onLocalSubmit = async (data: LoginFormData) => {
    setLoginError(null);
    try {
      await login(data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setLoginError(error.response?.data?.message || 'Email ou mot de passe incorrect');
    }
  };

  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center p-4 relative overflow-hidden">
      {/* Orbes décoratifs animés */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], x: [0, 30, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl"
          animate={{ scale: [1, 1.3, 1], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        <motion.div
          className="absolute top-1/2 right-1/3 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.1, 1], x: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        />
      </div>

      {/* Carte principale */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <GlassCard padding="lg">
          {/* Logo + titre */}
          <div className="text-center mb-8">
            <motion.div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 mb-4 shadow-glow"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="2" y="6" width="28" height="18" rx="3" stroke="white" strokeWidth="2" fill="none"/>
                <path d="M10 24v3M22 24v3M7 27h18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M8 12h4M8 16h8M8 19h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
              </svg>
            </motion.div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">ITAM Pro</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Gestion de parc informatique Elkem
            </p>
          </div>

          {/* Erreur SSO */}
          {ssoError && SSO_ERRORS[ssoError] && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6"
              role="alert"
            >
              <AlertCircle size={16} aria-hidden="true" />
              {SSO_ERRORS[ssoError]}
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {!showLocalForm ? (
              /* ─── Vue principale : bouton SSO ─────────── */
              <motion.div
                key="sso"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={loginWithSSO}
                  leftIcon={
                    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" aria-hidden="true">
                      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                    </svg>
                  }
                >
                  Se connecter avec Microsoft
                </Button>

                <p className="text-xs text-center text-[var(--text-muted)]">
                  Utilisez votre compte Elkem (@elkem.com)
                </p>

                <div className="relative flex items-center gap-3 my-6">
                  <div className="flex-1 h-px bg-[var(--border-glass)]" />
                  <span className="text-xs text-[var(--text-muted)]">ou</span>
                  <div className="flex-1 h-px bg-[var(--border-glass)]" />
                </div>

                <button
                  className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors py-2"
                  onClick={() => setShowLocalForm(true)}
                >
                  Connexion locale (environnement de développement)
                </button>
              </motion.div>
            ) : (
              /* ─── Formulaire local ─────────────────────── */
              <motion.form
                key="local"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSubmit(onLocalSubmit)}
                className="space-y-4"
                aria-label="Formulaire de connexion locale"
              >
                <div className="flex items-center gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => { setShowLocalForm(false); setLoginError(null); }}
                    className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                    aria-label="Retour"
                  >
                    ← Retour
                  </button>
                  <h2 className="text-sm font-medium text-[var(--text-secondary)]">
                    Connexion locale
                  </h2>
                </div>

                {/* Erreur de connexion */}
                {loginError && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                    role="alert"
                  >
                    <AlertCircle size={16} aria-hidden="true" />
                    {loginError}
                  </motion.div>
                )}

                <Input
                  label="Email"
                  type="email"
                  placeholder="manager@elkem.com"
                  autoComplete="email"
                  error={errors.email?.message}
                  {...register('email')}
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[var(--text-secondary)]" htmlFor="password">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className={`input-glass pr-10 w-full ${errors.password ? 'border-red-500/50' : ''}`}
                      aria-invalid={!!errors.password}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-400" role="alert">{errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  loading={isLoading}
                >
                  Se connecter
                </Button>

                {/* Comptes de test */}
                <div className="mt-4 p-3 rounded-xl border border-[var(--border-glass)] bg-white/[0.02]">
                  <p className="text-xs text-[var(--text-muted)] font-medium mb-2">Comptes de test :</p>
                  {[
                    { email: 'manager@elkem.com', role: 'Manager' },
                    { email: 'tech@elkem.com', role: 'Technicien' },
                    { email: 'viewer@elkem.com', role: 'Lecteur' },
                  ].map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      className="block w-full text-left px-2 py-1 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/5 transition-colors"
                      onClick={() => {
                        const form = document.querySelector('form');
                        const emailInput = form?.querySelector<HTMLInputElement>('[name="email"]');
                        const passInput = form?.querySelector<HTMLInputElement>('[name="password"]');
                        if (emailInput) { emailInput.value = account.email; emailInput.dispatchEvent(new Event('input', { bubbles: true })); }
                        if (passInput) { passInput.value = 'Password123!'; passInput.dispatchEvent(new Event('input', { bubbles: true })); }
                      }}
                    >
                      <span className="font-medium">{account.role}</span> — {account.email}
                    </button>
                  ))}
                  <p className="text-xs text-[var(--text-muted)] mt-1">Mot de passe : Password123!</p>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>
    </div>
  );
}
