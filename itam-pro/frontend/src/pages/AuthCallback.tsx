import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import authService from '../services/auth.service';

/**
 * Page callback SSO.
 * Microsoft redirige ici avec le token ITAM dans le fragment d'URL (#token=...).
 * Cette page le récupère, fetch le profil user, et redirige vers le dashboard.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();

  useEffect(() => {
    const fragment = window.location.hash;
    const params = new URLSearchParams(fragment.slice(1));
    const token = params.get('token');

    if (!token) {
      navigate('/login?error=sso_error');
      return;
    }

    setToken(token);

    // Récupérer le profil complet
    authService.getMe()
      .then((user) => {
        setUser(user);
        navigate('/dashboard');
      })
      .catch(() => {
        navigate('/login?error=sso_error');
      });
  }, [navigate, setToken, setUser]);

  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 mx-auto mb-4 animate-pulse" aria-hidden="true" />
        <p className="text-[var(--text-secondary)] text-sm">Connexion en cours...</p>
      </div>
    </div>
  );
}
