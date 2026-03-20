# ITAM Pro — Instructions pour Claude Code

## Contexte projet
PWA full-stack de gestion de parc informatique pour **Elkem**, remplaçant un fichier Excel.
Intégration Microsoft Intune (Graph API) + Azure AD SSO prévue.

Monorepo pnpm workspaces : `frontend/` + `backend/`

---

## Stack technique

| Couche | Technologies |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, TanStack Query, Framer Motion, Radix UI, Zod, react-hook-form |
| Backend | Node.js, Express, TypeScript, Prisma, PostgreSQL, Redis, JWT, Winston |
| Infra dev | Docker Desktop (PostgreSQL 16 :5432, Redis 7 :6379) |
| Auth | Local (bcrypt + JWT 7j) ou SSO Azure AD (OAuth2/OIDC) |

---

## Démarrage

```bash
# 1. Démarrer Docker Desktop, puis :
cd itam-pro
docker-compose up -d      # PostgreSQL + Redis

# 2. Premier démarrage uniquement
cd backend
npx prisma migrate dev --name init
npx tsx prisma/seed.ts

# 3. Développement quotidien (depuis itam-pro/)
pnpm dev                  # Backend :3001 + Frontend :5173 en parallèle
```

**Comptes de test (seed) :**
| Email | Mot de passe | Rôle |
|---|---|---|
| manager@elkem.com | Password123! | MANAGER |
| tech@elkem.com | Password123! | TECHNICIAN |
| viewer@elkem.com | Password123! | VIEWER |

---

## Architecture frontend

```
frontend/src/
├── components/
│   ├── layout/       AppShell, Sidebar, TopBar, MobileNav
│   ├── devices/      DeviceTable, DeviceCard, DeviceFilters, DeviceForm
│   └── ui/           GlassCard (export NOMMÉ), Button, Input, StatusBadge, Skeleton
├── pages/            Dashboard, Devices, DeviceDetail, Stock, Users, IntuneSync, Reports, Settings
├── hooks/            useAuth, useDevices
├── services/         api (axios), auth.service, device.service, user.service
├── stores/           authStore, uiStore (Zustand persist), deviceStore
├── types/            index.ts — miroir du schéma Prisma
└── utils/            formatters.ts, validators.ts
```

## Architecture backend

```
backend/src/
├── controllers/   auth.controller, device.controller, user.controller
├── routes/        auth.routes, device.routes, user.routes
├── middleware/    auth.middleware (authenticate, requireRole), error.middleware
└── lib/           prisma, jwt, logger
```

---

## Conventions importantes

### Frontend
- **GlassCard** : export nommé → `import { GlassCard } from '../components/ui/GlassCard'`
- **Skeleton** : export nommé → `import { Skeleton } from '../components/ui/Skeleton'`
- **Icône DOCKING_STATION** : utiliser `Layers` (lucide-react@0.441 n'a pas `Dock`)
- Le frontend proxie `/api` → `http://localhost:3001` via Vite (`vite.config.ts`)
- Toutes les pages sont **lazy-loaded** dans `App.tsx`
- Design system : classes `.glass-card`, `.btn-primary`, `.btn-secondary`, `.input-glass` définies dans `index.css`
- Variables CSS : `--text-primary`, `--text-secondary`, `--text-muted`, `--bg-primary`, `--bg-secondary`, `--border-glass`
- Dark/light mode : attribut `data-theme` sur `<html>`, géré par `uiStore`

### Backend
- `req.currentUser` est typé dans `auth.middleware.ts` (id, email, displayName, role)
- **Cascade delete** configuré dans Prisma pour AuditLog, MaintenanceLog, Attachment → pas besoin de delete manuel
- Audit automatique à écrire dans chaque controller (pas de middleware séparé)
- Permissions par rôle : VIEWER = lecture, TECHNICIAN = CRUD, MANAGER = tout

### Prisma
- Générer le client : `npx prisma generate` (depuis `backend/`)
- Studio : `npx prisma studio` ou `pnpm db:studio` depuis la racine
- Seed : `pnpm db:seed` depuis la racine

---

## État des phases

### ✅ Phase 1 — Fondations
Monorepo, Docker, Prisma schema, seed, design system, composants UI de base, types, formatters.

### ✅ Phase 2 — Authentification
Login local (bcrypt + JWT) + SSO Azure AD. `AUTH_MODE=local` dans `.env` pour dev.

### ✅ Phase 3 — Layout & Navigation
AppShell (useLocation fix), Sidebar (mobile drawer, prop `mobile`), TopBar (recherche câblée), MobileNav (fix active dot).

### ✅ Phase 4 — CRUD Appareils
- Backend : CRUD complet devices + users, audit auto, permissions par rôle
- Frontend : DeviceTable, DeviceCard, DeviceFilters, DeviceForm (drawer), DeviceDetail (4 onglets Radix Tabs), Users, Stock

### ⏳ Phase 5 — Intune + Dashboard
- IntuneService (Microsoft Graph Client)
- Page IntuneSync (3 sections : statut, liste, sync manuelle)
- Dashboard bento grid avec Recharts (KPIs + graphiques)

### ⏳ Phase 6 — Finitions & Production
- Jobs cron alertes stock automatiques
- Rapports CSV/Excel export
- PWA polish (service worker, manifest, icônes)
- README complet

---

## Notes techniques diverses
- `pnpm dev` depuis la racine lance backend + frontend via `concurrently`
- Port backend : 3001 (configurable via `PORT` dans `backend/.env`)
- `AUTH_MODE=local` → pas besoin d'Azure AD pour tester
- `AUTH_MODE=sso` → nécessite app registration Azure AD (tenant ID, client ID, client secret)
