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
- Sélection → `PATCH /devices/:id/assign { userId, assetTag? }` (le device existant est affecté, pas créé)
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
Champs obligatoires : Type + Marque + Nom du modèle.
**Champs conditionnels selon le type :**

| Type | Processeur | RAM | Stockage | Taille écran |
|---|:---:|:---:|:---:|:---:|
| PC Portable (LAPTOP) | ✅ | ✅ | ✅ | ✅ |
| Smartphone / Tablette | — | — | ✅ | — |
| Tous les autres types | — | — | — | — |

- Quand le type change dans le formulaire, les champs non applicables sont **vidés automatiquement**
- `handleSaveModel` n'envoie que les valeurs applicables au type (les autres sont `undefined`)
- La marque n'a pas de valeur par défaut — l'utilisateur saisit librement (Dell, Apple, HP, etc.)
- **TYPE_OPTIONS dans Orders.tsx** : MOUSE exclu (fusionné avec KEYBOARD sous label "Clavier / Souris")

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

## Sites Elkem (référentiel validé — 2026-03-29)

Définis dans `frontend/src/utils/formatters.ts` → `ELKEM_SITES`.
Utilisés dans `DeviceForm.tsx` via `SITE_OPTIONS`.

| Code | Label affiché | Préfixe hostname |
|---|---|---|
| SUD *(défaut)* | SUD - Saint-Fons | SFS |
| NORD | NORD - Saint-Fons | SFS |
| SFC | SFC - ATRiON | SFC |
| ROU | ROU - ROUSSILLON | ROU |
| SSS | SSS - Salaise | SSS |
| GLD | GLD - KORNER | GLD |
| CAR | CAR - ITALIE | CAR |
| SPA | SPA - ESPAGNE | SPA |
| LEV | LEV - ALLEMAGNE | LEV |

**Note DB** : les devices avec `site = 'ATRiON'` (ancien code) afficheront la valeur brute. Migration manuelle si nécessaire : `UPDATE "Device" SET site='SFC' WHERE site='ATRiON'`

---

## Routes API backend

| Méthode | Route | Rôle requis | Description |
|---|---|---|---|
| GET | `/api/devices?excludeStock=true` | AUTH | Liste appareils hors stock (page Utilisateurs) |
| GET | `/api/devices?status=IN_STOCK` | AUTH | Appareils en stock (page Stock) |
| PATCH | `/api/devices/:id` | TECHNICIAN | Mise à jour — modèle verrouillé si purchaseOrderId |
| PATCH | `/api/devices/:id/assign` | TECHNICIAN | Assigner à un user — accepte `{ userId, assetTag? }` |
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

### Props clés
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
- **Site** : 9 sites Elkem (SUD - Saint-Fons par défaut)
- **Clavier** : 9 layouts (AZERTY_FR par défaut)

### Hostname — génération automatique
- Champ Hostname présent pour TOUS les postes de travail : LAPTOP, DESKTOP, THIN_CLIENT, LAB_WORKSTATION
- Format : `{PREFIX}-W-{SN}` — ex: `SFS-W-ABC1234`
- Se remplit automatiquement quand l'utilisateur modifie le SN ou le Site (via `onChange`)
- Ne s'écrase pas à l'ouverture du formulaire en édition
- Mapping défini dans `SITE_HOSTNAME_PREFIX` dans `DeviceForm.tsx` — voir tableau Sites ci-dessus

### Champs conditionnels par type
| Types | Champs spécifiques |
|---|---|
| LAPTOP, DESKTOP, THIN_CLIENT, LAB_WORKSTATION | Tag actif (requis), SN, Hostname (auto) |
| LAB_WORKSTATION uniquement | + VLAN, IP, MAC, Bitlocker |
| LAPTOP, DESKTOP, THIN_CLIENT, LAB_WORKSTATION | Clavier, Processeur, RAM, Stockage, Écran |
| SMARTPHONE, TABLET | Gérés via PhoneModal (pas via DeviceForm) |

---

## Onglet Équipements (DeviceDetail — TabEquipements)

### Constants clés dans DeviceDetail.tsx
```typescript
const WORKSTATION_TYPES:     DeviceType[] = ['LAPTOP', 'DESKTOP', 'THIN_CLIENT', 'LAB_WORKSTATION'];
const WORKSTATION_CAT_TYPES: DeviceType[] = ['LAPTOP', 'DESKTOP', 'THIN_CLIENT', 'LAB_WORKSTATION'];
const PHONE_CAT_TYPES:       DeviceType[] = ['SMARTPHONE', 'TABLET'];
// WORKSTATION_CAT_TYPES → ouvre wsModal (DeviceForm modal=true)
// PHONE_CAT_TYPES       → ouvre PhoneModal
// autres périphériques  → QuickAddForm inline ou editingDevice (drawer)
```

### Tickets (N° de ticket) — règle validée 2026-03-28
Chaque équipement doit avoir un ticket associé, stocké dans `device.assetTag`.
- **Obligatoire** : Smartphone, Tablette, Écran, Casque, Station d'accueil
- **Optionnel** : Clavier / Souris
- Champ pré-rempli `IT-` dans tous les formulaires
- Tag bleu `IT-XXXXX` affiché dans la ligne de chaque équipement (tous types, pas seulement workstations)

### QuickAddForm (périphériques inline)
- **Branche WORKSTATION** : SN + assetTag (tag actif) + modèle optionnel + hostname (lab)
- **Branche MONITOR** : ticket requis + quantité + modèle optionnel + toggle docking
- **Branche SIMPLE** (Casque, Clavier/Souris, Station d'accueil) :
  - Ticket (requis sauf KEYBOARD/MOUSE) + modèle optionnel + bouton Ajouter
  - Remplace les anciens "chips de modèles" qui créaient instantanément
  - `ticketRequired = type !== 'KEYBOARD' && type !== 'MOUSE'`
- **Station d'accueil** : n'est plus créée via inline `api.post` direct — passe par `setAddingType('DOCKING_STATION')` → QuickAddForm branche SIMPLE

### PhoneModal (Smartphone / Tablette)
- Mode **Affecter** (`device=null`) : recherche SN/IMEI → pool IN_STOCK → sélection → champ ticket (requis) → `PATCH /devices/:id/assign { userId, assetTag }`
- Mode **Modifier** (`device=Device`) : SN + IMEI + ticket (pré-rempli avec `device.assetTag`) → `PUT /devices/:id`
- `canSubmit` bloqué tant que ticket non rempli (longueur > 3 = plus que `IT-`)
- Bouton "Changer de smartphone/tablette" remet `ticketRef` à `IT-`
- Composant autonome dans `DeviceDetail.tsx` — ne pas fusionner avec DeviceForm

---

## DeviceDetail — Onglet Informations (état actuel 2026-03-29)

**2 widgets** (grille `lg:grid-cols-2`) :

### Widget "Matériel"
- N° commande (PO lié ou avertissement ⚠)
- Type, Marque, Modèle, Processeur, RAM, Stockage, Écran, Clavier
- Réseau (hostname, VLAN, IP, MAC, Bitlocker) — uniquement LAB_WORKSTATION
- Notes (si présentes)
- ~~Couleur~~ → supprimée

### Widget "Statut"
- Badge de statut
- Site (= localisation)
- Affectation (avatar + nom + email) ou "Non assigné"
- Depuis (date d'assignation)
- ~~État (condition)~~ → supprimé
- ~~Localisation~~ → supprimé (remplacé par Site)

### ~~Widget "Cycle de vie"~~ → supprimé entièrement
Les champs Achat, Garantie, Prix, Fournisseur, N° facture, Créé le, Modifié le ne sont plus affichés dans Informations.

---

## DeviceDetail — Onglet Historique (état actuel 2026-03-29)

- Liste tous les `auditLogs` du device : action + auteur (technicien/manager) + commentaire + date
- **Entrée "Enregistrement créé"** toujours visible en bas de liste, grisée (opacity-50), avec `device.createdAt`
  - Présente même si aucun auditLog n'existe → garantit que la date de création est toujours visible
  - Sert de baseline chronologique sous tous les mouvements
- Plus d'état vide "Aucun historique" — au minimum la date de création est affichée

---

## État des phases

### ✅ Phases 1 à 5 — Fondations, Auth, Layout, CRUD, Dashboard + Intune

### ✅ Phase 6 — Finitions & Production (2026-03-24)
- MANAGER = superadmin (bypass `requireRole`)
- Tag IT auto-généré à la réception : `{reference}-{NNN}`
- Onglet "Historique" dans Commandes, `listOrders` = PENDING + PARTIAL uniquement
- Filtres pills compactes page Utilisateurs (Radix UI)
- Fix global : tous les `<select>` natifs → AppSelect
- PENDING_RETURN ("À récupérer") ajouté comme statut DeviceStatus
- PurchaseOrder (Bon de Commande) : modèle Prisma avec compteur anti-fraude
- Page Commandes (/orders) : 4 onglets — Commandes, Historique, Catalogue, Règles alerte
- Page Stock : inventaire par modèle, vue grille/liste, onglet Déchets
- Détection doublons dans DeviceTable (badge orange)
- Sidebar renommée : "Utilisateurs" (BookUser) = parc déployé, "Admin" (ShieldCheck) = comptes IT

### ✅ Phase 7 — Cohérence navigation & architecture (2026-03-24)
- Sidebar lit `location.state.from` → item actif correct quelle que soit la page d'origine
- Onglet Fichiers supprimé de DeviceDetail
- N° commande visible dans DeviceDetail (section Cycle de vie → maintenant dans widget Matériel)
- State explicite sur tous les `<Link>` / `navigate()` vers `/devices/:id`

**Règle de navigation validée :**
> Tout `<Link>` ou `navigate()` vers `/devices/:id` DOIT passer `state={{ from: '<route_origine>' }}`.
> DeviceDetail lit `location.state?.from ?? '/devices'` pour le bouton retour.
> La Sidebar lit ce même `from` pour l'item actif quand on est sur `/devices/:id`.

### ✅ Phase 8 — Gestion utilisateurs inactive + édition équipement (2026-03-25)
- Soft-delete utilisateurs : bouton "Désactiver" (MANAGER), `isActive: false`, avatar rouge + badge
- DeviceTable : avatar rouge + badge "Inactif" si `assignedUser.isActive === false`
- DeviceDetail onglet Équipements : icône crayon par ligne → DeviceForm en édition
- Détection doublon workstation dans onglet Équipements
- DeviceForm refactorisé : props `isManager`, `requireUser`, `formTitle`, `modal`, `hideUserField`, `forcedUserId`, `initialType`
- PO section en lecture seule dans DeviceForm (plus de dropdown → évite crash Radix `value=""`)

### ✅ Phase 9 — Types d'appareils, DeviceForm refacto & onglet Équipements complet (2026-03-26)
- `THIN_CLIENT` + `LAB_WORKSTATION` ajoutés à DeviceType (migration)
- Champs réseau : hostname, vlan, ipAddress, macAddress, bitlocker (migration)
- `hasDocking Boolean?` sur Device (migration)
- `imei String?` sur Device (migration)
- DeviceForm : `modal=true` (popup) vs drawer latéral, hostname auto sur tous workstations
- QuickAddForm : 3 branches (workstation / monitor / simple périphérique)
- PhoneModal : mode Affecter (pool) + mode Modifier (SN + IMEI)
- PHONE_CAT_TYPES = ['SMARTPHONE', 'TABLET'] — remontés en tête des périphériques
- Docking badge orange uniquement si `hasDocking === true`
- IMEI affiché sous chaque item Smartphone/Tablette
- Orders.tsx : champ IMEI obligatoire dans réception si type SMARTPHONE/TABLET

### ✅ Phase 10 — Corrections stock & formulaire smartphone (2026-03-27)
- PhoneModal : SN + IMEI affichés en read-only après sélection, bouton "Changer"
- Backend : recherche par IMEI dans le pool (`listDevices`)
- Synchronisation invalidation cache : toute mutation qui change le `status` d'un device DOIT invalider `['stock-summary']`, `['stock-devices']`, `['stockalerts']`
- DeviceTable : ligne entière cliquable (`<tr onClick>` + `e.stopPropagation()` sur les boutons)

### ✅ Phase 11 — Tickets pour tous les équipements (2026-03-28)
- **Champ ticket (assetTag)** ajouté à tous les formulaires d'équipement périphérique
- Pré-rempli `IT-`, obligatoire sauf Clavier/Souris
- `QuickAddForm` branche SIMPLE : remplace chips instantanés par formulaire ticket + modèle
- `QuickAddForm` branche MONITOR : ticket requis en tête du formulaire
- `PhoneModal` : ticket requis dans les deux modes (assign + edit), pré-rempli depuis `device.assetTag` en édition
- `assignDevice` backend : accepte `assetTag` optionnel dans le body
- `renderDeviceItem` : tag bleu affiché pour **tous les types** (plus uniquement workstations)
- Station d'accueil : passe par `setAddingType('DOCKING_STATION')` + QuickAddForm (plus de création inline directe)

### ✅ Phase 12 — Corrections UI diverses (2026-03-29)

#### Orders.tsx — Catalogue modèles
- `TYPE_OPTIONS` : MOUSE exclu, KEYBOARD label → "Clavier / Souris" (fusion visuelle)
- Formulaire modèle : champs Processeur/RAM/Taille écran visibles **uniquement LAPTOP**
- Stockage visible uniquement pour LAPTOP, SMARTPHONE, TABLET
- Changement de type dans le formulaire → vide automatiquement les champs non applicables
- `handleSaveModel` n'envoie que les valeurs pertinentes au type sélectionné

#### DeviceDetail — Onglet Informations
- Widget "Cycle de vie" **supprimé**
- Widget "Matériel" : ligne Couleur supprimée, Notes déplacées ici
- Widget "Statut" : lignes État et Localisation supprimées, Site conservé
- Grille : `lg:grid-cols-3` → `lg:grid-cols-2`
- Import `DEVICE_CONDITION_LABELS` supprimé (devenu inutile)

#### DeviceDetail — Onglet Historique
- Entrée "Enregistrement créé" toujours affichée en bas (depuis `device.createdAt`)
- Plus d'état vide "Aucun historique"

#### Sites Elkem
- Code `ATRiON` renommé `SFC` dans `ELKEM_SITES` (formatters.ts) et `SITE_HOSTNAME_PREFIX` (DeviceForm.tsx)
- Labels mis à jour : "SFC - ATRiON", "ROU - ROUSSILLON", "CAR - ITALIE", "SPA - ESPAGNE", "LEV - ALLEMAGNE"

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
- **SITE_HOSTNAME_PREFIX** défini dans `DeviceForm.tsx` (module-level) — SUD/NORD → SFS, SFC → SFC, ROU/SSS/GLD/CAR/SPA/LEV → inchangés
- **DeviceForm `pendingModelSearch`** : à l'ouverture en édition, `reset()` positionne `modelId=''` + déclenche une recherche `{ brand, model }` → quand les modèles chargent, le bon `modelId` est sélectionné automatiquement. Ne jamais enlever ce mécanisme.
- **PhoneModal** est un composant indépendant dans `DeviceDetail.tsx` — ne pas fusionner avec `DeviceForm` (logiques très différentes : assign depuis pool vs create)
- **Retrait supprimer/désassigner device Équipements** : devices avec SN préfixé `PERIPH-` ou `MON-` → `DELETE`, vrais devices → `PATCH /unassign` (zéro suppression)
- **TYPE_ICONS dans DeviceTable et Orders** : toujours inclure THIN_CLIENT et LAB_WORKSTATION — sinon erreur TypeScript sur le Record complet
- **GET /devices?type=SMARTPHONE&status=IN_STOCK&search=** : utilisé par PhoneModal pour filtrer le pool de téléphones disponibles à l'affectation
- **Règle invalidation cache** : toute mutation changeant le `status` d'un device DOIT invalider `['stock-summary']`, `['stock-devices']`, `['stockalerts']`

---

## En attente

- ⏳ PWA polish (service worker, manifest, icônes complètes)
- ⏳ Azure App Registration + SSO Intune (en attente droits admin)
- ⏳ Page Dashboard — révision finale
