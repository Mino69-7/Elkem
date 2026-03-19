import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { logger } from '../lib/logger.js';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/auth/login
 * Connexion locale avec email + mot de passe (AUTH_MODE=local)
 */
export async function localLogin(req: Request, res: Response): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Email ou mot de passe invalide', errors: parsed.error.flatten() });
      return;
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      // Délai anti-timing attack
      await bcrypt.hash('dummy', 10);
      res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ message: 'Compte désactivé' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      return;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
    });

    logger.info(`Connexion locale réussie : ${user.email}`);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        avatar: user.avatar,
        department: user.department,
        jobTitle: user.jobTitle,
      },
    });
  } catch (err) {
    logger.error('Erreur localLogin', { err });
    res.status(500).json({ message: 'Erreur interne' });
  }
}

/**
 * GET /api/auth/me
 * Retourne le profil de l'utilisateur connecté
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.currentUser!.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        avatar: true,
        department: true,
        jobTitle: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }

    res.json(user);
  } catch (err) {
    logger.error('Erreur getMe', { err });
    res.status(500).json({ message: 'Erreur interne' });
  }
}

/**
 * POST /api/auth/logout
 * Déconnexion (côté client : supprimer le token JWT)
 */
export async function logout(_req: Request, res: Response): Promise<void> {
  res.json({ message: 'Déconnexion réussie' });
}

/**
 * GET /api/auth/sso
 * Redirection vers Microsoft Entra ID pour l'authentification OIDC.
 * Uniquement disponible si AUTH_MODE=sso.
 */
export async function initiateSSO(_req: Request, res: Response): Promise<void> {
  const authMode = process.env.AUTH_MODE || 'local';
  if (authMode !== 'sso') {
    res.status(400).json({ message: 'SSO non activé. Définir AUTH_MODE=sso dans le .env' });
    return;
  }

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.AZURE_REDIRECT_URI || 'http://localhost:3001/api/auth/callback');
  const scope = encodeURIComponent('openid profile email User.Read');

  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize` +
    `?client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${redirectUri}` +
    `&scope=${scope}` +
    `&response_mode=query`;

  res.redirect(authUrl);
}

/**
 * GET /api/auth/callback
 * Callback OAuth2 Microsoft — échange le code contre un token,
 * crée ou met à jour l'utilisateur, retourne un JWT ITAM.
 */
export async function ssoCallback(req: Request, res: Response): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    const { code, error } = req.query as { code?: string; error?: string };

    if (error) {
      logger.error(`SSO erreur Azure AD : ${error}`);
      res.redirect(`${frontendUrl}/login?error=sso_failed`);
      return;
    }

    if (!code) {
      res.redirect(`${frontendUrl}/login?error=no_code`);
      return;
    }

    // Échanger le code contre un access token
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const redirectUri = process.env.AZURE_REDIRECT_URI || 'http://localhost:3001/api/auth/callback';

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          scope: 'openid profile email User.Read',
        }),
      }
    );

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json() as { access_token: string; id_token: string };

    // Récupérer le profil depuis Microsoft Graph
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!graphResponse.ok) {
      throw new Error('Failed to fetch user profile from Graph');
    }

    const msUser = await graphResponse.json() as {
      id: string;
      mail?: string;
      userPrincipalName: string;
      displayName: string;
      department?: string;
      jobTitle?: string;
    };

    const email = msUser.mail || msUser.userPrincipalName;

    // Récupérer les groupes pour le mapping des rôles
    let role: 'MANAGER' | 'TECHNICIAN' | 'VIEWER' = 'VIEWER';
    try {
      const groupsResp = await fetch('https://graph.microsoft.com/v1.0/me/memberOf?$select=displayName', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (groupsResp.ok) {
        const groups = await groupsResp.json() as { value: Array<{ displayName: string }> };
        const groupNames = groups.value.map((g) => g.displayName);
        if (groupNames.includes('ITAM-Managers')) role = 'MANAGER';
        else if (groupNames.includes('ITAM-Technicians')) role = 'TECHNICIAN';
      }
    } catch {
      // Erreur non bloquante — on garde le rôle VIEWER par défaut
    }

    // Créer ou mettre à jour l'utilisateur en base
    const user = await prisma.user.upsert({
      where: { azureId: msUser.id },
      update: {
        email,
        displayName: msUser.displayName,
        department: msUser.department,
        jobTitle: msUser.jobTitle,
        role,
      },
      create: {
        azureId: msUser.id,
        email,
        displayName: msUser.displayName,
        department: msUser.department,
        jobTitle: msUser.jobTitle,
        role,
      },
    });

    const itamToken = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
    });

    logger.info(`Connexion SSO réussie : ${user.email} (${user.role})`);

    // Rediriger vers le frontend avec le token dans l'URL fragment
    res.redirect(`${frontendUrl}/auth/callback#token=${itamToken}`);
  } catch (err) {
    logger.error('Erreur ssoCallback', { err });
    res.redirect(`${frontendUrl}/login?error=sso_error`);
  }
}
