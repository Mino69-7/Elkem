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
│                     AppSelect (Radix UI custom dropdown — JAMAIS de <select> natif)
│                     UserCombobox (search-as-you-type, appel /api/users?search=)
├── pages/            Dashboard, Devices, DeviceDetail, Stock, Orders,
│                     Users, IntuneSync, Reports, Settings
├── hooks/            useAuth, useDevices, usePurchaseOrders
├── services/         api (axios), auth.service, device.service, user.service,
│                     purchaseOrder.service
├── stores/           authStore, uiStore (Zustand persist), deviceStore
├── types/            index.ts — miroir du schéma Prisma
└── utils/            formatters.ts, validators.ts
```

## Architecture backend

```
backend/src/
├── controllers/   auth, device, user, stats, intune, stockAlert, reports,
│                  deviceModel, lookup, purchaseOrder
├── routes/        auth, device, user, stats, intune, stockAlert, reports,
│                  deviceModel, lookup, purchaseOrder
├── middleware/    auth.middleware (authenticate, requireRole), error.middleware
├── services/      intune.service (Microsoft Graph Client)
├── jobs/          stockAlert.job (node-cron, toutes les heures)
└── lib/           prisma, jwt, logger
```

---

## Conventions importantes

### Frontend
- **JAMAIS de `<select>` natif** — les selects natifs affichent fond blanc OS sur Windows. Toujours utiliser :
  - **AppSelect** : export nommé → `import { AppSelect } from '../components/ui/AppSelect'` — pour tous les dropdowns de formulaire
  - **FilterPill** (dans DeviceFilters) : basé sur Radix UI Select — pour les filtres pill-style
- **GlassCard** : export nommé → `import { GlassCard } from '../components/ui/GlassCard'`
- **Skeleton** : export nommé → `import { Skeleton } from '../components/ui/Skeleton'`
- **StatusBadge** : export nommé → `import { StatusBadge } from '../components/ui/StatusBadge'`
- **UserCombobox** : export nommé → `import { UserCombobox } from '../components/ui/UserCombobox'` — recherche utilisateurs avec debounce 300ms, sélection obligatoire depuis la liste
- **Icône DOCKING_STATION** : utiliser `Layers` (lucide-react n'a pas `Dock`)
- Le frontend proxie `/api` → `http://localhost:3001` via Vite (`vite.config.ts`)
- Toutes les pages sont **lazy-loaded** dans `App.tsx`
- Design system : classes `.glass-card`, `.btn-primary`, `.btn-secondary`, `.input-glass` définies dans `index.css`
- Variables CSS : `--text-primary`, `--text-secondary`, `--text-muted`, `--bg-primary`, `--bg-secondary`, `--border-glass`
- Dark/light mode : attribut `data-theme` sur `<html>`, géré par `uiStore`
- **AppSelect dropdown** : `background: 'var(--bg-secondary)'` + `color: 'var(--text-primary)'` — compatible light ET dark mode
- **Navigation contextuelle** : toujours passer `{ state: { from: '/stock' } }` (ou `/orders`, etc.) lors d'un `navigate('/devices/:id')` depuis une page autre que Appareils. DeviceDetail lit `location.state?.from ?? '/devices'` pour le bouton retour.

### Backend
- `req.currentUser` est typé dans `auth.middleware.ts` (id, email, displayName, role)
- **Cascade delete** configuré dans Prisma pour AuditLog, MaintenanceLog, Attachment → pas besoin de delete manuel
- Audit automatique à écrire dans chaque controller (pas de middleware séparé)
- Permissions par rôle : VIEWER = lecture, TECHNICIAN = CRUD, **MANAGER = superadmin** (bypass `requireRole` — accès à tout)
- Paramètre `excludeStock=true` sur `GET /api/devices` → exclut IN_STOCK et ORDERED (utilisé par la page Utilisateurs)
- **Zéro suppression** — aucun device ne peut être supprimé de la DB, uniquement changement de statut

### Prisma
- Générer le client : `npx prisma generate` (depuis `backend/`)
- Studio : `npx prisma studio` ou `pnpm db:studio` depuis la racine
- Seed : `pnpm db:seed` depuis la racine ou `npx tsx prisma/seed.ts` depuis `backend/`
- **Le seed utilise `update:` pour mettre à jour les specs** — toujours rejouer après modification des modèles Dell
- **Migrations appliquées** :
  - `20260323212250_add_purchase_orders_pending_return`
  - `20260324132314_remove_assettag_unique_make_nullable` — `assetTag` est maintenant `String?` (nullable, non-unique)
  - `20260326115957_add_thin_client_lab_network_fields` — DeviceType THIN_CLIENT + LAB_WORKSTATION, champs réseau (hostname, vlan, ipAddress, macAddress, bitlocker)
  - `20260326134956_add_has_docking` — champ `hasDocking Boolean?` sur Device (écrans)
  - `20260326145425_add_imei` — champ `imei String?` sur Device (smartphones/tablettes)

---

## Architecture logique des pages (décision validée)

| Page | Contenu | Statuts / Données |
|---|---|---|
| **Stock** › Inventaire | Pool de matériel disponible par modèle | IN_STOCK, ORDERED |
| **Stock** › Déchets | Appareils retirés du parc | RETIRED (badge ⚠ Récent si via PO < 180j) |
| **Utilisateurs** (/devices) | Master registry du parc déployé | ASSIGNED, PENDING_RETURN, IN_MAINTENANCE, LOANER, LOST, STOLEN, RETIRED |
| **Commandes** › Commandes | Bons de commande actifs (PENDING/PARTIAL) | PurchaseOrder |
| **Commandes** › Historique | Toutes les commandes tous statuts + manager | PurchaseOrder (tous) |
| **Commandes** › Catalogue | CRUD modèles DeviceModel (MANAGER) | — |
| **Commandes** › Règles alerte | Seuils stock par modèle (MANAGER) | StockAlert |
| **Admin** (/users) | Comptes IT uniquement (MANAGER, TECHNICIAN, VIEWER) | — |
| **Paramètres** | Thème dark/light + Mon compte | — |

**Règles fondamentales :**
1. Aucun appareil n'est jamais supprimé — uniquement changement de statut. Zéro suppression = zéro perte.
2. Un device lié à un PO a son `brand/model/type` **verrouillés** (immutables en édition).
3. Un doublon = utilisateur avec ≥ 2 appareils en `{ASSIGNED, PENDING_RETURN, LOANER}` simultanément.

---

## Navigation — Sidebar & MobileNav (état actuel)

Ordre des entrées dans la sidebar :
1. Dashboard (`/dashboard`, `LayoutDashboard`)
2. **Utilisateurs** (`/devices`, `BookUser`) — parc déployé
3. Stock (`/stock`, `Package`)
4. Commandes (`/orders`, `ShoppingCart`)
5. **Admin** (`/users`, `ShieldCheck`) — comptes IT uniquement
6. Sync Intune (`/intune`, `RefreshCw`)
7. Rapports (`/reports`, `BarChart3`)

**Important** : l'icône `Laptop` doit rester importée dans `Sidebar.tsx` — elle est utilisée dans le logo de la sidebar (lignes ~70 et ~84). Ne pas la supprimer même si elle n'apparaît pas dans les nav items.

---

## Logique PurchaseOrder (Bon de Commande)

### Principe anti-fraude
- Le **MANAGER** crée une commande : type → modèle → quantité (filtrage par type dans le formulaire)
- Le **TECHNICIEN** (ou MANAGER) réceptionne les appareils un par un via `/orders/:id/receive` — saisit le **numéro de série** (+ **IMEI** si type SMARTPHONE ou TABLET)
- Le modèle est **verrouillé** sur celui de la commande — impossible à modifier
- `assetTag` = référence de la commande (identique pour tout le lot, ex: `CMD-2026-001`) — unicité par `serialNumber`
- Un compteur `receivedCount / quantity` visible en temps réel
- Modal de réception **reste ouverte** entre chaque réception (fermeture auto quand commande complète)
- Si un technicien met un appareil récent en RETIRED → badge ⚠ rouge dans l'onglet Déchets
- Rien n'est supprimable → tout va en RETIRED dans le pire des cas

### Pool Smartphones / Tablettes
- Téléphones et tablettes réceptionnés via PO entrent dans le pool `IN_STOCK` avec SN + IMEI
- Dans l'onglet Équipements d'un profil utilisateur → "Affecter" ouvre une **PhoneModal** de recherche dans ce pool
- Saisir ≥ 2 caractères dans le champ → dropdown progressif filtré par SN ou IMEI depuis `GET /devices?type=SMARTPHONE|TABLET&status=IN_STOCK&search=...`
- Sélection → `PATCH /devices/:id/assign { userId }` (le device existant est affecté, pas créé)
- **On ne peut pas inventer un téléphone** — il doit obligatoirement exister dans le pool réceptionné

### Flux statut PurchaseOrder
```
PENDING → PARTIAL (premier appareil reçu) → COMPLETE (tous reçus)
        → CANCELLED (annulation manager, jamais supprimé)
```

### Flux statut Device — passation
```
ASSIGNED (nouveau PC) + ASSIGNED (ancien PC) → doublon détecté
Technicien marque ancien PC → PENDING_RETURN
Récupération physique → IN_STOCK ou RETIRED
```

---

## Catalogue DeviceModel — champs

Le catalogue supporte **tous les types de matériel** (pas uniquement les laptops Dell).
Champs du formulaire : Type + Marque (requis), Nom (requis), Processeur, RAM, Stockage, Taille écran, Notes.
La marque n'a pas de valeur par défaut — l'utilisateur saisit librement (Dell, Apple, HP, etc.).

---

## Catalogue Dell (specs validées par l'utilisateur)

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

| Méthode | Route | Rôle requis | Description |
|---|---|---|---|
| GET | `/api/devices?excludeStock=true` | AUTH | Liste appareils hors stock (page Utilisateurs) |
| GET | `/api/devices?status=IN_STOCK` | AUTH | Appareils en stock (page Stock) |
| PATCH | `/api/devices/:id` | TECHNICIAN | Mise à jour — modèle verrouillé si purchaseOrderId |
| GET | `/api/devicemodels/stock-summary` | AUTH | Inventaire par modèle avec compteurs IN_STOCK/ORDERED |
| GET | `/api/lookup/serial/:sn` | AUTH | Lookup SN : local → Intune → Dell |
| GET | `/api/users?search=xxx` | AUTH | Recherche utilisateurs (UserCombobox) |
| GET | `/api/stats` | AUTH | KPIs dashboard |
| GET | `/api/reports/devices` | AUTH | Export CSV appareils |
| GET | `/api/reports/audit` | AUTH | Export CSV audit |
| GET | `/api/orders` | AUTH | Liste bons de commande actifs (PENDING + PARTIAL) |
| GET | `/api/orders/history` | AUTH | Toutes les commandes tous statuts |
| POST | `/api/orders` | MANAGER | Créer un bon de commande |
| PUT | `/api/orders/:id` | MANAGER | Modifier un bon de commande |
| DELETE | `/api/orders/:id` | MANAGER | Annuler un bon de commande (status → CANCELLED) |
| POST | `/api/orders/:orderId/receive` | TECHNICIAN | Réceptionner un appareil (crée Device lié au PO) |

---

## DeviceForm — comportement attendu

### Props clés (session 2026-03-26)
```typescript
interface DeviceFormProps {
  device?:        Device | null;
  isOpen:         boolean;
  isSaving:       boolean;
  isManager?:     boolean;
  requireUser?:   boolean;
  formTitle?:     string;
  modal?:         boolean;       // true = popup centré, false = drawer latéral (défaut)
  hideUserField?: boolean;       // cache la section "Utilisateur" (ex: depuis onglet Équipements)
  forcedUserId?:  string;        // injecte assignedUserId sans l'afficher
  initialType?:   string;        // pré-remplit le type à la création
  onClose:        () => void;
  onSubmit:       (data: DeviceFormData) => void;
}
```

### Comportement des champs
- **Tag actif** : pré-rempli `IT-` à la création — l'utilisateur ajoute uniquement les chiffres du ticket. Majuscules/chiffres/tirets uniquement.
- **N° de série + bouton Sync** : appelle `/api/lookup/serial/:sn`
  - Source `local` → alerte doublon (amber)
  - Source `intune` → affiche modèle trouvé (vert)
  - Source `dell` → auto-remplit processeur/RAM/stockage/écran + sélectionne type+modèle si dans catalogue
- **Type** → charge la liste de modèles filtrée (hors périphériques purs : KEYBOARD, MOUSE, HEADSET, DOCKING_STATION)
- **Modèle** → auto-remplit les specs via `onModelChange()`. **En édition** : le modèle existant est pré-sélectionné via `pendingModelSearch` (recherche par brand+name quand les modèles chargent)
- **Utilisateur assigné** : UserCombobox obligatoire par clic (pas de saisie libre)
- **Statut** : Actif / Stock / À récupérer / Maintenance / Perdu / Volé / Rétention
- **Site** : 9 sites Elkem (Saint-Fons SUD par défaut)
- **Clavier** : 9 layouts (AZERTY_FR par défaut)

### Hostname — génération automatique
- Champ Hostname présent pour TOUS les postes de travail : LAPTOP, DESKTOP, THIN_CLIENT, LAB_WORKSTATION
- Format : `{PREFIX}-W-{SN}` — ex: `SFS-W-ABC1234`
- Se remplit automatiquement quand l'utilisateur modifie le SN ou le Site (via `onChange`, ne s'écrase pas à l'ouverture du formulaire en édition)
- Mapping site → préfixe hostname :

| Site | Préfixe |
|---|---|
| SUD | SFS |
| NORD | SFS |
| ATRiON | SFC |
| ROU | ROU |
| SSS | SSS |
| GLD | GLD |
| CAR | CAR |
| SPA | SPA |
| LEV | LEV |

### Champs conditionnels par type
| Types | Champs spécifiques |
|---|---|
| LAPTOP, DESKTOP, THIN_CLIENT, LAB_WORKSTATION | Tag actif (requis), SN, Hostname (auto) |
| LAB_WORKSTATION uniquement | + VLAN, IP, MAC, Bitlocker |
| LAPTOP, DESKTOP, THIN_CLIENT, LAB_WORKSTATION | Clavier, Processeur, RAM, Stockage, Écran |
| SMARTPHONE, TABLET | Gérés via PhoneModal (pas via DeviceForm) |

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
DeviceTable, DeviceCard, DeviceFilters, DeviceForm (drawer), DeviceDetail (3 onglets : Informations, Maintenance, Historique).

### ✅ Phase 5 — Dashboard + Intune
- Dashboard bento grid : KPIs, BarChart types, DonutChart statuts, activité récente, garanties, derniers appareils
- IntuneSync : statut connexion, sync manuelle, liste devices avec compliance
- IntuneService : Microsoft Graph Client (GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET)

### ✅ Phase 6 — Finitions (complétée — session 2026-03-24)
- ✅ Cron alertes stock (node-cron, toutes les heures)
- ✅ Export CSV/Excel (UTF-8 BOM, devices + audit)
- ✅ Page Paramètres : thème dark/light + Mon compte (catalogue et alertes déplacés dans Commandes)
- ✅ Catalogue modèles DeviceModel : tous types, toutes marques, auto-remplissage dans DeviceForm
- ✅ AppSelect (Radix UI) pour TOUS les dropdowns — jamais <select> natif
- ✅ UserCombobox : recherche utilisateurs temps réel, sélection obligatoire
- ✅ Bouton Sync N° de série : Dell public API (cascade 3 endpoints) + TechDirect si DELL_API_KEY
- ✅ Page Stock : inventaire par modèle, vue grille/liste toggle, clic modèle → liste appareils (SN, Tag, Site, Statut), onglet Déchets (RETIRED)
- ✅ Séparation logique Stock vs Utilisateurs (excludeStock=true par défaut dans Utilisateurs)
- ✅ Page Utilisateurs (/devices) — filtres pills compactes (Radix UI)
- ✅ Fix complet selects natifs → AppSelect (DeviceDetail, Reports, Users, DeviceFilters)
- ✅ Statut PENDING_RETURN ("À récupérer") — migration appliquée
- ✅ Page Commandes (/orders) : 4 onglets — Commandes (actives), Historique (tous statuts + manager), Catalogue (CRUD modèles), Règles alerte
- ✅ PurchaseOrder : réception SN uniquement, modal reste ouverte, assetTag = référence commande, type → modèle filtré dans formulaire création
- ✅ MANAGER = superadmin (bypass requireRole dans auth.middleware)
- ✅ assetTag rendu nullable et non-unique (migration appliquée)
- ✅ Détection doublons dans DeviceTable (badge orange si user ≥ 2 devices actifs)
- ✅ Renommage pages : "Appareils" → "Utilisateurs" (BookUser), "Utilisateurs" → "Admin" (ShieldCheck)
- ✅ Navigation contextuelle : DeviceDetail retourne à la page d'origine (Stock, Commandes, Utilisateurs)

### ✅ Phase 7 — Cohérence navigation & architecture (session 2026-03-24)
- ✅ **Sidebar contexte** : active item correct selon l'origine — `location.state.from` lu dans `Sidebar.tsx` via `effectivePath`. Depuis Stock → "Stock" actif. Depuis Dashboard → "Dashboard" actif. Depuis Utilisateurs → "Utilisateurs" actif.
- ✅ **Onglet Fichiers supprimé** de DeviceDetail — plus affiché nulle part. Reste : Informations · Maintenance · Historique.
- ✅ **N° commande visible dans DeviceDetail** — champ `N° commande` (= `device.purchaseOrder?.reference`, ex: `CMD-2026-001`) ajouté dans la section "Cycle de vie". Séparation claire : Tag IT (assetTag individuel) dans le tableau, N° commande dans la fiche.
- ✅ **State explicite sur tous les `<Link>` vers DeviceDetail** :
  - `DeviceTable.tsx` : `state={{ from: '/devices' }}`
  - `DeviceCard.tsx` : `state={{ from: '/devices' }}`
  - `Dashboard.tsx` (×3 liens) : `state={{ from: '/dashboard' }}`
  - `Stock.tsx` (déjà en place) : `state={{ from: '/stock' }}`

**Règle de navigation validée :**
> Tout `<Link>` ou `navigate()` vers `/devices/:id` DOIT passer un `state={{ from: '<route_origine>' }}`.
> DeviceDetail lit `location.state?.from ?? '/devices'` pour le bouton retour.
> La Sidebar lit ce même `from` pour l'item actif quand on est sur `/devices/:id`.

- ⏳ PWA polish (service worker, manifest, icônes)
- ⏳ Azure App Registration + SSO Intune (en attente droits admin)
- ⏳ Page Dashboard — révision finale (dépend des autres pages)

### ✅ Phase 8 — Équipements utilisateur & CRUD amélioré (session 2026-03-26)

#### DeviceType & schéma
- ✅ `THIN_CLIENT` et `LAB_WORKSTATION` ajoutés à l'enum `DeviceType` (migration appliquée)
- ✅ Champs réseau sur Device : `hostname`, `vlan`, `ipAddress`, `macAddress`, `bitlocker` (migration)
- ✅ `hasDocking Boolean?` sur Device — toggle par écran dans l'onglet Équipements (migration)
- ✅ `imei String?` sur Device — pour smartphones et tablettes (migration)

#### Onglet Équipements (DeviceDetail — TabEquipements)
- ✅ **Postes de travail** (LAPTOP, DESKTOP, THIN_CLIENT, LAB_WORKSTATION) : bouton Ajouter/Modifier → modal centré DeviceForm avec `modal hideUserField forcedUserId`
- ✅ **Workstation item** : affiche assetTag (pill), hostname, SN, N° commande
- ✅ **Smartphones & Tablettes** : remontés en tête des périphériques — bouton Ajouter → `PhoneModal` (recherche pool IN_STOCK), bouton Modifier → `PhoneModal` édition SN + IMEI
- ✅ **Écrans** : badge Docking affiché **uniquement si `hasDocking === true`** (clic = désactiver). Fix : le tag ne s'affichait pas conditionnellement avant.
- ✅ **Clavier / Souris** : catégorie KEYBOARD affiche aussi les MOUSE dans la même ligne
- ✅ Retrait du type "Autre poste" (OTHER) de la section Postes de travail
- ✅ Boutons `×` (retirer/désassigner) et crayon (éditer) au survol sur chaque item

#### Constants clés dans DeviceDetail.tsx
```typescript
const WORKSTATION_TYPES:     DeviceType[] = ['LAPTOP', 'DESKTOP', 'THIN_CLIENT', 'LAB_WORKSTATION'];
const WORKSTATION_CAT_TYPES: DeviceType[] = ['LAPTOP', 'DESKTOP', 'THIN_CLIENT', 'LAB_WORKSTATION'];
const PHONE_CAT_TYPES:       DeviceType[] = ['SMARTPHONE', 'TABLET'];
// WORKSTATION_CAT_TYPES → ouvre wsModal (DeviceForm modal=true)
// PHONE_CAT_TYPES       → ouvre PhoneModal
// autres périphériques  → QuickAddForm inline ou editingDevice (drawer)
```

#### PhoneModal (DeviceDetail.tsx)
- Mode **Affecter** (`device=null`) : input de recherche SN/IMEI → dropdown progressif `GET /devices?type=SMARTPHONE|TABLET&status=IN_STOCK&search=...` → sélection → `PATCH /devices/:id/assign`
- Mode **Modifier** (`device=Device`) : champs SN + IMEI éditables → `PUT /devices/:id`
- Composant autonome, pas de DeviceForm, logique minimaliste adaptée aux téléphones

#### DeviceForm améliorations
- ✅ **Pré-remplissage modèle en édition** : `pendingModelSearch` trouve le modèle par `brand + name` quand les modèles chargent après reset
- ✅ **Tag actif** : valeur par défaut `IT-` à la création
- ✅ **Hostname auto-généré** pour LAPTOP, DESKTOP, THIN_CLIENT, LAB_WORKSTATION via `onChange` (SN ou Site) — format `{PREFIX}-W-{SN}`
- ✅ Hostname présent sur **tous les postes de travail** (pas seulement LAB_WORKSTATION)
- ✅ VLAN / IP / MAC / Bitlocker uniquement sur LAB_WORKSTATION

#### DeviceTable (page Utilisateurs)
- ✅ Nouveau ordre des colonnes : **Site → Affecté à → Type → Appareil → Statut → Modifié → Actions**
- ✅ `TYPE_ICONS` complété : THIN_CLIENT (`Tv`), LAB_WORKSTATION (`Server`), DESKTOP (`Cpu`)

#### Orders.tsx — Réception SMARTPHONE/TABLET
- ✅ Champ **IMEI** (15 chiffres, saisie numérique uniquement) ajouté dans le modal de réception quand `order.deviceModel.type === SMARTPHONE | TABLET`
- ✅ Bouton "Réceptionner" désactivé tant que SN + IMEI non remplis pour les téléphones
- ✅ `ReceiveDeviceData` mis à jour : `imei?: string`
- ✅ `purchaseOrder.controller.ts` : accepte et stocke `imei` sur le device créé

---

## Notes techniques diverses
- `pnpm dev` depuis la racine lance backend + frontend via `concurrently`
- Port backend : 3001 (configurable via `PORT` dans `backend/.env`)
- `AUTH_MODE=local` → pas besoin d'Azure AD pour tester
- `AUTH_MODE=sso` → nécessite app registration Azure AD (tenant ID, client ID, client secret)
- `DELL_API_KEY` dans `backend/.env` → active Dell TechDirect API (prioritaire sur les endpoints publics)
- KeyboardLayout enum étendu : QWERTY_ES, QWERTY_IT, QWERTY_RU, QWERTY_TR, QWERTY_AR ajoutés
- Après migration Prisma, redémarrer le backend pour recharger le binaire `.dll.node` Prisma
- **lucide-react v0.441** : `size` prop accepte `string | number` — Vite ignore les erreurs TS2322 en dev, pas bloquant
- **SITE_HOSTNAME_PREFIX** défini dans `DeviceForm.tsx` (module-level) — SUD/NORD → SFS, ATRiON → SFC, ROU → ROU, SSS → SSS, GLD → GLD, CAR → CAR, SPA → SPA, LEV → LEV
- **DeviceForm `pendingModelSearch`** : à l'ouverture en édition, `reset()` positionne `modelId=''` + déclenche une recherche `{ brand, model }` → quand les modèles chargent, le bon `modelId` est sélectionné automatiquement. Ne jamais enlever ce mécanisme.
- **PhoneModal** est un composant indépendant dans `DeviceDetail.tsx` — ne pas fusionner avec `DeviceForm` (logiques très différentes : assign depuis pool vs create)
- **Retrait supprimer/désassigner device Équipements** : devices avec SN préfixé `PERIPH-` ou `MON-` → `DELETE`, vrais devices → `PATCH /unassign` (zéro suppression)
- **TYPE_ICONS dans DeviceTable et Orders** : toujours inclure THIN_CLIENT et LAB_WORKSTATION — sinon erreur TypeScript sur le Record complet
- **GET /devices?type=SMARTPHONE&status=IN_STOCK&search=** : utilisé par PhoneModal pour filtrer le pool de téléphones disponibles à l'affectation
