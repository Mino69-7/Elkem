# ITAM Pro — Instructions pour Claude Code

## Contexte projet
PWA full-stack de gestion de parc informatique pour **Elkem**, remplaçant un fichier Excel.
Intégration Microsoft Intune (Graph API) + Azure AD SSO prévue.
Objectif : **zéro perte**, zéro doublon, traçabilité complète de chaque appareil.

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
│                     AppSelect (Radix UI custom dropdown, fond #1a1a2e)
│                     UserCombobox (search-as-you-type, appel /api/users?search=)
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
├── controllers/   auth, device, user, stats, intune, stockAlert, reports, deviceModel, lookup
├── routes/        auth, device, user, stats, intune, stockAlert, reports, deviceModel, lookup
├── middleware/    auth.middleware (authenticate, requireRole), error.middleware
├── services/      intune.service (Microsoft Graph Client)
├── jobs/          stockAlert.job (node-cron, toutes les heures)
└── lib/           prisma, jwt, logger
```

---

## Conventions importantes

### Frontend
- **GlassCard** : export nommé → `import { GlassCard } from '../components/ui/GlassCard'`
- **Skeleton** : export nommé → `import { Skeleton } from '../components/ui/Skeleton'`
- **AppSelect** : export nommé → `import { AppSelect } from '../components/ui/AppSelect'` — à utiliser pour TOUS les dropdowns de formulaire (pas de `<select>` natif dans les formulaires)
- **UserCombobox** : export nommé → `import { UserCombobox } from '../components/ui/UserCombobox'` — recherche utilisateurs avec debounce 300ms, sélection obligatoire depuis la liste
- **Icône DOCKING_STATION** : utiliser `Layers` (lucide-react n'a pas `Dock`)
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
- Paramètre `excludeStock=true` sur `GET /api/devices` → exclut IN_STOCK et ORDERED (utilisé par la page Appareils)

### Prisma
- Générer le client : `npx prisma generate` (depuis `backend/`)
- Studio : `npx prisma studio` ou `pnpm db:studio` depuis la racine
- Seed : `pnpm db:seed` depuis la racine ou `npx tsx prisma/seed.ts` depuis `backend/`
- **Le seed utilise `update:` pour mettre à jour les specs** — toujours rejouer après modification des modèles Dell

---

## Architecture logique des pages (décision validée)

| Page | Contenu | Statuts concernés |
|---|---|---|
| **Stock** | Inventaire entrepôt, par modèle avec compteurs, réception livraisons | IN_STOCK, ORDERED |
| **Appareils** | Registre du parc déployé, master registry, audit trail | ASSIGNED, IN_MAINTENANCE, LOANER, LOST, STOLEN, RETIRED |
| **Paramètres** | Config système, catalogue modèles (MANAGER), seuils stock | — |

**Règle fondamentale** : aucun appareil n'est jamais supprimé, uniquement son statut change. Zéro suppression = zéro perte.

---

## Catalogue modèles Dell (seed)

Tous type LAPTOP, brand Dell, screenSize 14" :

| Modèle | Processeur | RAM | Stockage |
|---|---|---|---|
| Latitude 5450 | Intel Core Ultra 5 125U | 32 Go DDR5 | 512 Go SSD NVMe |
| Latitude 5440 | Intel Core Ultra 5 125U | 32 Go DDR5 | 512 Go SSD NVMe |
| Latitude 5430 | Intel Core i7-1265U | 16 Go DDR4 | 512 Go SSD NVMe |
| Latitude 5420 | Intel Core i7-1165G7 | 16 Go DDR4 | 512 Go SSD NVMe |
| Latitude 5410 | Intel Core i7-10610U | 16 Go DDR4 | 256 Go SSD NVMe |
| Latitude 5400 | Intel Core i7-8665U | 16 Go DDR4 | 256 Go SSD NVMe |
| Précision 3490 | Intel Core Ultra 7 165H | 32 Go DDR5 | 512 Go SSD NVMe |
| Pro 14 | Intel Core Ultra 5 125U | 32 Go DDR5 | 512 Go SSD NVMe |

---

## Routes API backend

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/devices?excludeStock=true` | Liste appareils hors stock (page Appareils) |
| GET | `/api/devices?status=IN_STOCK` | Appareils en stock (page Stock) |
| GET | `/api/devicemodels/stock-summary` | Inventaire par modèle avec compteurs IN_STOCK/ORDERED |
| GET | `/api/lookup/serial/:sn` | Lookup SN : local → Intune → Dell (public + TechDirect) |
| GET | `/api/users?search=xxx` | Recherche utilisateurs (UserCombobox) |
| GET | `/api/stats` | KPIs dashboard |
| GET | `/api/reports/devices` | Export CSV appareils |
| GET | `/api/reports/audit` | Export CSV audit |

---

## DeviceForm — comportement attendu

- **Tag actif** : placeholder `IT-00001`, majuscules/chiffres/tirets uniquement
- **N° de série + bouton Sync** : appelle `/api/lookup/serial/:sn`
  - Source `local` → alerte doublon (amber)
  - Source `intune` → affiche modèle trouvé (vert)
  - Source `dell` → auto-remplit processeur/RAM/stockage/écran + sélectionne type+modèle si dans catalogue
- **Type** → charge la liste de modèles filtrée
- **Modèle** → auto-remplit les specs via `onModelChange()`
- **Utilisateur assigné** : UserCombobox obligatoire par clic (pas de saisie libre)
- **Statut** : Actif / Stock / Rétention / Maintenance / Perdu / Volé
- **Site** : 11 sites Elkem (Saint-Fons SUD par défaut)
- **Clavier** : 9 layouts (AZERTY_FR par défaut)

---

## État des phases

### ✅ Phase 1 — Fondations
Monorepo, Docker, Prisma schema, seed, design system, composants UI de base, types, formatters.

### ✅ Phase 2 — Authentification
Login local (bcrypt + JWT) + SSO Azure AD. `AUTH_MODE=local` dans `.env` pour dev.
Azure App Registration différée (demande admin en cours).

### ✅ Phase 3 — Layout & Navigation
AppShell, Sidebar (mobile drawer), TopBar (recherche câblée), MobileNav.

### ✅ Phase 4 — CRUD Appareils
CRUD complet devices + users, audit auto, permissions par rôle.
DeviceTable, DeviceCard, DeviceFilters, DeviceForm (drawer), DeviceDetail (4 onglets).

### ✅ Phase 5 — Dashboard + Intune
- Dashboard bento grid : KPIs, BarChart types, DonutChart statuts, activité récente, garanties, derniers appareils
- IntuneSync : statut connexion, sync manuelle, liste devices avec compliance
- IntuneService : Microsoft Graph Client (GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET)

### ✅ Phase 6 — Finitions (en cours)
- ✅ Cron alertes stock (node-cron, toutes les heures)
- ✅ Export CSV/Excel (UTF-8 BOM, devices + audit)
- ✅ Page Paramètres : catalogue modèles + seuils stock (MANAGER)
- ✅ Catalogue modèles DeviceModel avec auto-remplissage dans DeviceForm
- ✅ AppSelect (Radix UI) pour tous les dropdowns de formulaire
- ✅ UserCombobox : recherche utilisateurs temps réel, sélection obligatoire
- ✅ Bouton Sync N° de série : Dell public API (cascade 3 endpoints) + TechDirect si DELL_API_KEY
- ✅ Refonte page Stock : inventaire par modèle, compteurs, barre dispo, bouton Réceptionner
- ✅ Séparation logique Stock vs Appareils (excludeStock=true par défaut dans Appareils)
- ⏳ PWA polish (service worker, manifest, icônes)
- ⏳ Azure App Registration + SSO Intune (en attente droits admin)

---

## Notes techniques diverses
- `pnpm dev` depuis la racine lance backend + frontend via `concurrently`
- Port backend : 3001 (configurable via `PORT` dans `backend/.env`)
- `AUTH_MODE=local` → pas besoin d'Azure AD pour tester
- `AUTH_MODE=sso` → nécessite app registration Azure AD (tenant ID, client ID, client secret)
- `DELL_API_KEY` dans `backend/.env` → active Dell TechDirect API (prioritaire sur les endpoints publics). Clé obtenue via Dell TechDirect (tdm.dell.com, compte business requis). Sans clé, 3 endpoints publics Dell en cascade sont utilisés en fallback.
- Migration active : `20260323111921_add_device_models_keyboard_layouts`
- KeyboardLayout enum étendu : QWERTY_ES, QWERTY_IT, QWERTY_RU, QWERTY_TR, QWERTY_AR ajoutés
