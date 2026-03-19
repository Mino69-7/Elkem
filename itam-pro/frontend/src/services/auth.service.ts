import api from './api';
import type { User } from '../types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

const authService = {
  /** Connexion locale (email + mot de passe) */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', credentials);
    return data;
  },

  /** Récupérer le profil de l'utilisateur connecté */
  async getMe(): Promise<User> {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  /** Déconnexion */
  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  /** Lancer le flow SSO Microsoft (redirection) */
  initiateSSO(): void {
    window.location.href = '/api/auth/sso';
  },
};

export default authService;
