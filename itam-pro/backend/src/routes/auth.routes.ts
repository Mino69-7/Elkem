import { Router } from 'express';
import {
  localLogin,
  getMe,
  logout,
  initiateSSO,
  ssoCallback,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// ─── Routes publiques ──────────────────────────────────────────
/** POST /api/auth/login — connexion locale */
router.post('/login', localLogin);

/** GET /api/auth/sso — démarrer le flow SSO Microsoft */
router.get('/sso', initiateSSO);

/** GET /api/auth/callback — callback OAuth2 Microsoft */
router.get('/callback', ssoCallback);

// ─── Routes protégées ──────────────────────────────────────────
/** GET /api/auth/me — profil utilisateur connecté */
router.get('/me', authenticate, getMe);

/** POST /api/auth/logout */
router.post('/logout', authenticate, logout);

export default router;
