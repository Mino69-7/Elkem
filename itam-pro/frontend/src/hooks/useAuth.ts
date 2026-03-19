import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import authService from '../services/auth.service';
import type { LoginCredentials } from '../services/auth.service';

/**
 * Hook centralisant toute la logique d'authentification.
 */
export function useAuth() {
  const { user, token, isAuthenticated, isLoading, setUser, setToken, logout: clearAuth, setLoading } = useAuthStore();
  const navigate = useNavigate();

  /** Connexion locale */
  const login = useCallback(async (credentials: LoginCredentials) => {
    setLoading(true);
    try {
      const { token, user } = await authService.login(credentials);
      setToken(token);
      setUser(user);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setToken, setUser, navigate]);

  /** Déconnexion */
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Pas bloquant
    } finally {
      clearAuth();
      navigate('/login');
    }
  }, [clearAuth, navigate]);

  /** Connexion SSO Microsoft */
  const loginWithSSO = useCallback(() => {
    authService.initiateSSO();
  }, []);

  return { user, token, isAuthenticated, isLoading, login, logout, loginWithSSO };
}
