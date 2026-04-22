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
- Design system : classes `.glass-card`, `.btn-primary`, `.btn-secondary`, `.input-glass`, `.modal-glass` définies dans `index.css`
- Variables CSS : `--text-primary`, `--text-secondary`, `--text-muted`, `--bg-primary`, `--bg-secondary`, `--border-glass`
- Dark/light mode : attribut `data-theme` sur `<html>`, géré par `uiStore`
- **AppSelect dropdown** : `background: 'var(--bg-secondary)'` + `color: 'var(--text-primary)'` — compatible light ET dark mode
- **Navigation contextuelle** : toujours passer `{ state: { from: '/stock' } }` (ou `/orders`, etc.) lors d'un `navigate('/devices/:id')` depuis une page autre que Appareils. DeviceDetail lit `location.state?.from ?? '/devices'` pour le bouton retour.

### Règles design system — popups & drawers (validées 2026-04-14)

**`createPortal` obligatoire pour TOUT élément `position: fixed`**
AppShell utilise `motion.div` avec `key={pathname}` pour les transitions de page → crée un CSS transform context → tout `position: fixed` dans ses descendants devient relatif à ce context, pas au viewport. Symptômes : backdrop ne couvre pas toute la hauteur, drawer ne sort pas du bon bord, AppSelect dropdown rogné.
**Fix universel** : `createPortal(content, document.body)` sur tous les overlays/drawers/popups.

**Backdrop léger pour vrai effet liquid glass**
Un backdrop `rgba(0,0,0,0.60)` + `blur(12px)` sur le backdrop lui-même tue le glass. Le `backdrop-filter` du `.modal-glass` doit avoir quelque chose de coloré à flouter (le gradient de la page). Règle :
- Backdrop : `rgba(0,0,10,0.42)` + `backdropFilter: 'blur(4px)'` — laisse les couleurs de la page passer
- Le card lui-même gère son glassmorphism via `.modal-glass`

**`.modal-glass` — classe CSS (index.css)**
- `backdrop-filter: blur(56px) saturate(180%)`
- Dark mode : gradient teinté `rgba(99,102,241,0.20)` indigo → `rgba(10,10,24,0.72)` → `rgba(6,182,212,0.08)` cyan — jamais un flat dark (= béton gris)
- Light mode : `linear-gradient rgba(255,255,255,0.92) → rgba(245,247,255,0.80)` — assez opaque pour le contraste texte
- Décors obligatoires dans chaque popup : ligne specular top (`h-[2px]`, gradient violet→cyan), reflet vertical gauche (`2px`, gradient blanc→transparent), orbe indigo haut-droite (radial-gradient + `filter:blur(8px)`)

**Z-index stack popups**
- Backdrop : `z-index: 150`
- Card popup : `z-index: 151`
- DeviceForm backdrop : `z-index: 200`
- DeviceForm drawer / modal : `z-index: 201`
- AppSelect dropdown (Radix UI, via `Select.Portal`) : `z-[210]` — **doit être > 201** pour passer au-dessus du drawer
- TopBar search portal : `z-index: 9999`

**DeviceForm drawer — widget flottant arrondi**
Pas un panneau plein bord. Position : `right:16px, top:16px, bottom:16px`, `width:440px`. Utilise `.modal-glass`. Animation spring `x: calc(100%+24px) → 0`. Les décorations (orbes, ligne specular) suivent le même pattern que les popups.

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
  - `20260407101852_add_keyboard_to_device_model` — champ `keyboardLayout KeyboardLayout? @default(AZERTY_FR)` sur DeviceModel
  - `20260407120000_bitlocker_string` — champ `bitlocker String?` (anciennement `Boolean?`) — clé de récupération libre

---

## Architecture logique des pages (décision validée)

| Page | Contenu | Statuts / Données |
|---|---|---|
| **Stock** › Inventaire | Pool de matériel disponible par modèle + liste individuelle | IN_STOCK, ORDERED |
| **Stock** › Maintenance | Appareils en maintenance (avec ou sans utilisateur assigné) | IN_MAINTENANCE |
| **Stock** › Déchets | Appareils retirés du parc | RETIRED, LOST, STOLEN (badge ⚠ Récent si via PO < 180j) |
| **Appareils** (/devices) | Appareils avec utilisateur réellement affecté (`assigned=true`) | Tous statuts avec `assignedUserId NOT NULL` |
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
2. **Appareils** (`/devices`, `Laptop`) — parc déployé (anciennement "Utilisateurs" / `BookUser`)
3. Stock (`/stock`, `Package`) — badge violet de notifications si alertes actives
4. Commandes (`/orders`, `ShoppingCart`)
5. **Admin** (`/users`, `ShieldCheck`) — comptes IT uniquement
6. Sync Intune (`/intune`, `RefreshCw`)
7. Rapports (`/reports`, `BarChart3`)

**Note** : `Laptop` est utilisé à la fois dans le logo sidebar ET dans l'item "Appareils" — ne pas supprimer.

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

### Pool de stock — règle fondamentale (validée 2026-03-31)
**Aucun appareil ne peut être créé directement depuis la page Utilisateurs.** Tout équipement doit d'abord passer par le flux : Commande → Réception → Pool IN_STOCK → Affectation.

### Pool Smartphones / Tablettes
- Téléphones et tablettes réceptionnés via PO entrent dans le pool `IN_STOCK` avec SN + IMEI
- Dans l'onglet Équipements d'un profil utilisateur → "Affecter" ouvre une **PhoneModal** de recherche dans ce pool
- Saisir ≥ 2 caractères dans le champ → dropdown progressif filtré par SN ou IMEI depuis `GET /devices?type=SMARTPHONE|TABLET&status=IN_STOCK&search=...`
- Sélection → `PATCH /devices/:id/assign { userId, assetTag? }` (le device existant est affecté, pas créé)
- **On ne peut pas inventer un téléphone** — il doit obligatoirement exister dans le pool réceptionné

### Pool Postes de travail (LAPTOP, DESKTOP, THIN_CLIENT, LAB_WORKSTATION)
- Même principe : réceptionnés via PO → pool IN_STOCK → affectation
- **WorkstationModal** (dans `DeviceDetail.tsx`) : recherche SN dès 1 caractère, `GET /devices?type={type}&status=IN_STOCK&search=...`
- **AssignFromPoolModal** (dans `Devices.tsx`) : même logique depuis le bouton "+ Nouveau" de la page Utilisateurs
- Après sélection, champs workstation supplémentaires :
  - **Tous WS** : Site dropdown + Hostname auto-calculé (éditable)
  - **LAB_WORKSTATION** : Toggle Labo/Indus + VLAN + IP + MAC + Bitlocker
- Submit en 2 appels : `PATCH /assign { userId, assetTag }` puis `PUT /devices/:id { site, hostname, ... }`

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
| PC Fixe (DESKTOP) | ✅ | ✅ | ✅ | — |
| PC Labo / Indus (LAB_WORKSTATION) | ✅ | ✅ | ✅ | — |
| Smartphone / Tablette | — | — | ✅ | — |
| Tous les autres types | — | — | — | — |

- **Taille écran : uniquement LAPTOP** — ni DESKTOP ni LAB_WORKSTATION n'ont ce champ
- Quand le type change dans le formulaire, les champs non applicables sont **vidés automatiquement**
- `handleSaveModel` n'envoie que les valeurs applicables au type (les autres sont `undefined`)
- La marque n'a pas de valeur par défaut — l'utilisateur saisit librement (Dell, Apple, HP, etc.)
- **TYPE_OPTIONS dans Orders.tsx** : MOUSE exclu (fusionné avec KEYBOARD sous label "Clavier / Souris")
- **Suppression de modèle** : bouton Trash2 sur chaque ligne → confirmation inline (`confirmDeleteId` state) → `DELETE /devicemodels/:id` (MANAGER only)

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

## Sites Elkem (référentiel validé — 2026-03-31)

Définis dans `frontend/src/utils/formatters.ts` → `ELKEM_SITES`.
Utilisés dans `DeviceForm.tsx` et `Devices.tsx` via `SITE_OPTIONS`.

| Code | Label affiché | Préfixe WS (`{P}-W-{SN}`) | Préfixe Labo/Indus (`{P}LAB{SN}` / `{P}INDUS{SN}`) |
|---|---|---|---|
| SUD *(défaut)* | SUD - Saint-Fons | SFS | FR |
| NORD | NORD - Saint-Fons | SFS | FR |
| SFC | SFC - ATRiON | SFC | FR |
| ROU | ROU - ROUSSILLON | ROU | FR |
| SSS | SSS - Salaise | SSS | FR |
| GLD | GLD - KORNER | GLD | FR |
| CAR | CAR - ITALIE | CAR | IT |
| SPA | SPA - ESPAGNE | SPA | ES |
| LEV | LEV - ALLEMAGNE | LEV | DE |

**Règles hostname :**
- LAPTOP / DESKTOP / THIN_CLIENT : `{WS_PREFIX}-W-{SN}` — ex : `SFS-W-ABC1234`
- LAB_WORKSTATION : `{COUNTRY}{LAB|INDUS}{SN}` — ex : `FRLABABC1234` ou `FRINDUSABC1234`
  - Toggle "Labo" / "Indus" dans le formulaire détermine LAB vs INDUS
  - Constantes `WS_PREFIX` et `LAB_COUNTRY` définies dans `Devices.tsx` (module-level)
  - Même logique dans `DeviceForm.tsx` via `SITE_HOSTNAME_PREFIX`

**Note DB** : les devices avec `site = 'ATRiON'` (ancien code) afficheront la valeur brute. Migration manuelle si nécessaire : `UPDATE "Device" SET site='SFC' WHERE site='ATRiON'`

---

## Routes API backend

| Méthode | Route | Rôle requis | Description |
|---|---|---|---|
| GET | `/api/devices?assigned=true` | AUTH | Appareils avec utilisateur affecté (page Utilisateurs) |
| GET | `/api/devices?status=IN_STOCK` | AUTH | Appareils en stock (Stock › Inventaire) |
| GET | `/api/devices?status=IN_MAINTENANCE` | AUTH | Appareils en maintenance (Stock › Maintenance) |
| GET | `/api/devices?statuses=RETIRED,LOST,STOLEN` | AUTH | Appareils hors service (Stock › Déchets) |
| PUT | `/api/devices/:id` | TECHNICIAN | Mise à jour complète |
| PATCH | `/api/devices/:id` | TECHNICIAN | Mise à jour partielle — modèle verrouillé si purchaseOrderId |
| PATCH | `/api/devices/:id/assign` | TECHNICIAN | Assigner à un user — accepte `{ userId, assetTag? }` |
| PATCH | `/api/devices/:id/unassign` | TECHNICIAN | Désassigner → status IN_STOCK + audit UNASSIGNED |
| DELETE | `/api/devices/:id` body `{ status }` | TECHNICIAN | Soft-retire : status IN_STOCK\|IN_MAINTENANCE\|RETIRED\|LOST\|STOLEN — jamais supprimé |
| GET | `/api/devicemodels/stock-summary` | AUTH | Inventaire par modèle avec compteurs IN_STOCK/ORDERED |
| DELETE | `/api/devicemodels/:id` | MANAGER | Supprimer un modèle du catalogue |
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
| LAPTOP, DESKTOP, THIN_CLIENT, LAB_WORKSTATION | Tag actif (requis), SN, Hostname (auto), Site |
| LAB_WORKSTATION uniquement | + VLAN, IP, MAC, Bitlocker |
| LAPTOP, DESKTOP, LAB_WORKSTATION | Clavier, Processeur, RAM, Stockage |
| LAPTOP uniquement | + Taille écran |
| SMARTPHONE, TABLET | Gérés via PhoneModal (pas via DeviceForm) |

---

## Onglet Équipements (DeviceDetail — TabEquipements)

### Constants clés dans DeviceDetail.tsx
```typescript
const WORKSTATION_TYPES:     DeviceType[] = ['LAPTOP', 'DESKTOP', 'THIN_CLIENT', 'LAB_WORKSTATION'];
const WORKSTATION_CAT_TYPES: DeviceType[] = ['LAPTOP', 'DESKTOP', 'THIN_CLIENT', 'LAB_WORKSTATION'];
const PHONE_CAT_TYPES:       DeviceType[] = ['SMARTPHONE', 'TABLET'];
// WORKSTATION_CAT_TYPES → Ajouter : WorkstationModal (pool stock)
//                       → Modifier : wsModal + DeviceForm modal=true
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
- **Notes** (section dédiée, éditable via le formulaire)
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
- Sidebar renommée : "Appareils" (Laptop) = parc déployé, "Admin" (ShieldCheck) = comptes IT

### ✅ Phase 7 — Cohérence navigation & architecture (2026-03-24)
- Sidebar lit `location.state.from` → item actif correct quelle que soit la page d'origine
- Onglet Fichiers supprimé de DeviceDetail
- N° commande visible dans DeviceDetail (section Cycle de vie → maintenant dans widget Matériel)
- State explicite sur tous les `<Link>` / `navigate()` vers `/devices/:id`

**Règle de navigation validée (mise à jour Phase 19) :**
> Tout `navigate()` vers `/devices/:id` DOIT passer `state={{ from: '<route>', fromTab: '<tab>' }}`.
> `DeviceDetail` lit `from` + `fromTab`, les renvoie via `goBack()` → `navigate(backTo, { state: { tab: fromTab } })`.
> La Sidebar lit `from` pour l'item actif. Les pages réceptrices lisent `location.state?.tab` pour restaurer le bon onglet.
> Voir tableau complet des valeurs `fromTab` en Phase 19.

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
- Synchronisation invalidation cache : toute mutation qui change le `status` d'un device DOIT invalider `['stock-summary']`, `['stock-devices']`, `['stockalerts']`, `['maintenance-devices']`
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

### ✅ Phase 13 — Pool stock obligatoire + hostname Labo/Indus (2026-03-31)

#### Règle architecturale fondamentale
- **Plus aucune création directe depuis la page Utilisateurs** — `useCreateDevice` supprimé de `Devices.tsx`
- Workflow imposé : Commande → Réception → Pool IN_STOCK → Affectation utilisateur
- Toutes les pages sont maintenant liées et synchronisées via le pool de stock

#### Catalogue modèles (Orders.tsx) — suppression
- Bouton **Trash2** sur chaque ligne → confirmation inline (state `confirmDeleteId`)
- Confirmation : texte "Confirmer ?" + bouton Check (valider) + bouton X (annuler)
- `deleteModelMut` → `DELETE /devicemodels/:id` → invalide `['device-models-all']` et `['device-models']`
- **`Check` ajouté aux imports lucide dans Orders.tsx**

#### Champ "Taille écran" restreint à LAPTOP
- **Orders.tsx** : formulaire catalogue → `screenSize` visible uniquement si `modelForm.type === 'LAPTOP'`
- **Orders.tsx** : `handleSaveModel` → `screenSize` envoyé uniquement si `t === 'LAPTOP'`
- **Orders.tsx** : onChange type → `screenSize` préservé uniquement si `next === 'LAPTOP'`
- **DeviceForm.tsx** : champ "Taille écran" rendu uniquement si `selectedType === 'LAPTOP'`

#### WorkstationModal (DeviceDetail.tsx) — affectation postes de travail depuis onglet Équipements
- Nouveau composant `WorkstationModal` dans `DeviceDetail.tsx` (juste avant `TabEquipements`)
- Recherche SN dans pool IN_STOCK **dès le 1er caractère** → `GET /devices?type={type}&status=IN_STOCK&search=...`
- Dropdown affiche : marque/modèle, SN, specs (processeur/RAM/stockage) si disponibles
- Sélection → carte verte confirmation + SN readonly + champ ticket IT-XXXXX
- Validation : `PATCH /devices/:id/assign { userId, assetTag }` → invalide cache stock
- `wsAssignModal` state ajouté à `TabEquipements` : `{ type: DeviceType } | null`
- `wsModal` : type changé de `{ device: Device | null }` à `{ device: Device }` (édition seulement)
- Bouton "Ajouter" workstation → `setWsAssignModal` (plus `setWsModal({ device: null, ... })`)
- `createEquipMut` supprimé de TabEquipements
- DeviceForm wsModal conservé **uniquement pour l'édition** des workstations existants

#### AssignFromPoolModal (Devices.tsx) — bouton "+ Nouveau" page Utilisateurs
- Nouveau composant `AssignFromPoolModal` remplace DeviceForm create dans `Devices.tsx`
- **UserCombobox** en tête du formulaire (sélection utilisateur obligatoire)
- Recherche SN depuis 1 caractère → dropdown dynamique pool IN_STOCK
- **Champs adaptatifs selon le type d'équipement** :
  - **Téléphones/Tablettes** : IMEI affiché readonly après sélection
  - **Postes de travail (LAPTOP/DESKTOP/THIN_CLIENT/LAB_WORKSTATION)** :
    - Site dropdown (SUD par défaut)
    - Hostname auto-calculé dès sélection device + éditable manuellement
  - **LAB_WORKSTATION uniquement** :
    - **Toggle "Labo" / "Indus"** en haut → détermine préfixe hostname
    - VLAN, Adresse IP, Adresse MAC, Bitlocker toggle (Shield/ShieldOff)
- Ticket IT-XXXXX obligatoire pour tous les types
- Submit en 2 appels séquentiels :
  1. `PATCH /devices/:id/assign { userId, assetTag }`
  2. (si workstation) `PUT /devices/:id { site, hostname, [vlan, ipAddress, macAddress, bitlocker] }`
- Invalide : `['devices']`, `['stock-summary']`, `['stock-devices']`, `['stockalerts']`
- `assignOpen` state dans `Devices()` contrôle l'ouverture
- DeviceForm conservé dans `Devices.tsx` **uniquement pour l'édition** (`isOpen={formOpen && !!editing}`)

#### Constantes hostname dans Devices.tsx (module-level)
```typescript
const WS_PREFIX: Record<string, string> = {
  SUD: 'SFS', NORD: 'SFS', SFC: 'SFC', ROU: 'ROU',
  SSS: 'SSS', GLD: 'GLD', CAR: 'CAR', SPA: 'SPA', LEV: 'LEV',
};
const LAB_COUNTRY: Record<string, string> = {
  SUD: 'FR', NORD: 'FR', SFC: 'FR', ROU: 'FR', SSS: 'FR', GLD: 'FR',
  CAR: 'IT', SPA: 'ES', LEV: 'DE',
};
function buildHostname(type, site, sn, labType): string {
  if (type === 'LAB_WORKSTATION') return `${LAB_COUNTRY[site]}${labType}${sn}`;
  return `${WS_PREFIX[site]}-W-${sn}`;
}
```

### ✅ Phase 14 — Traçabilité, synchronisation & onglet Maintenance (2026-04-01)

#### Système de désaffectation avec choix de destination
- **Popup "Désaffecter"** dans `Devices.tsx` et `DeviceDetail.tsx` : sélecteur AppSelect avec 4 options :
  - **Stock** (`IN_STOCK`) — retour inventaire
  - **Déchet** (`RETIRED`) — mise au rebut
  - **Perdu** (`LOST`) — signalement perte
  - **Volé** (`STOLEN`) — signalement vol
- Hook `useDeleteDevice` signature : `{ id: string; status: string }` (plus `id` seul)
- Service : `deviceService.retire(id, status)` → `DELETE /devices/:id` avec `{ data: { status } }` (Axios)

#### Backend — soft-retire `deleteDevice`
- `DELETE /devices/:id` body `{ status }` → valide parmi `['IN_STOCK', 'IN_MAINTENANCE', 'RETIRED', 'LOST', 'STOLEN']`
- Efface `assignedUserId` et `assignedAt` dans tous les cas (désaffectation)
- Pose `retiredAt` uniquement pour RETIRED, LOST, STOLEN
- Crée 2 audits si l'appareil était assigné : `UNASSIGNED` + `STATUS_CHANGED`
- Crée 1 audit si non assigné : `STATUS_CHANGED` uniquement
- `DELETE /devices/:id/unassign` → `PATCH /devices/:id/unassign` → `IN_STOCK` + audit `UNASSIGNED`
- Permissions : TECHNICIAN + MANAGER (plus MANAGER uniquement)

#### Page Appareils (/devices) — filtre corrigé
- **Filtre** : `useDevices({ type: activeTab, assigned: true })` → `GET /devices?assigned=true&type=...`
- Avant : `statuses: 'ASSIGNED,LOST,STOLEN'` → causait l'apparition de devices sans utilisateur
- Désormais : seuls les appareils avec `assignedUserId NOT NULL` s'affichent, quel que soit leur statut

#### Stock — trois onglets
- **Inventaire** : pool IN_STOCK par modèle + table individuelle "Appareils disponibles" (triée `updatedAt` desc) — visibilité immédiate après retour en stock
- **Maintenance** : nouveauté — tous les appareils `IN_MAINTENANCE`, avec colonne Utilisateur ("Non assigné" si sans user), cliquable vers DeviceDetail + historique
- **Déchets** : RETIRED + LOST + STOLEN (tous trois, plus seulement RETIRED)
  - Colonne "Statut" avec badges colorés : Déchet / Perdu / Volé
  - Badge ⚠ Récent si `retiredAt < 180j` ET lié à un PO

#### Cache — clés TanStack Query à invalider
| Clé | Contenu |
|---|---|
| `['devices']` | Liste paginée (page Utilisateurs) |
| `['device', id]` | Détail d'un appareil |
| `['stock-summary']` | Compteurs IN_STOCK/ORDERED par modèle |
| `['stock-devices']` | Tous les appareils IN_STOCK |
| `['ordered-devices']` | Appareils ORDERED |
| `['retired-devices']` | Appareils RETIRED/LOST/STOLEN |
| `['maintenance-devices']` | Appareils IN_MAINTENANCE |
| `['stockalerts']` | Alertes seuil stock |

Toutes les queries Stock ont `staleTime: 0` + `refetchOnMount: true` pour fraîcheur immédiate.

#### Navigation & transitions de pages
- **JAMAIS d'`AnimatePresence` sur les routes** → écran noir garanti avec lazy loading
- Pattern validé dans `AppShell.tsx` : `motion.div` avec `key={location.pathname}` uniquement — pas d'`AnimatePresence` wrappant les routes
- `AnimatePresence` conservé uniquement pour les drawers/modaux à position fixe

#### Notes — sauvegarde correcte
- `DeviceForm.tsx` : `notes: values.notes ?? ''` (jamais `|| undefined`) — sinon une note vide ne s'enregistre pas (Prisma ignore `undefined`)

#### Seed — données de test supprimées
- `backend/prisma/seed.ts` : aucun device créé dans le seed — uniquement les 3 comptes utilisateurs IT

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
- **WorkstationModal** est un composant indépendant dans `DeviceDetail.tsx` — même logique que PhoneModal mais sans IMEI, avec champs réseau pour LAB
- **AssignFromPoolModal** est dans `Devices.tsx` — version enrichie de WorkstationModal avec UserCombobox en tête
- **Retrait supprimer/désassigner device Équipements** : devices avec SN préfixé `PERIPH-` ou `MON-` → `DELETE`, vrais devices → `PATCH /unassign` (zéro suppression)
- **TYPE_ICONS dans DeviceTable et Orders** : toujours inclure THIN_CLIENT et LAB_WORKSTATION — sinon erreur TypeScript sur le Record complet
- **GET /devices?type={type}&status=IN_STOCK&search=** : utilisé par PhoneModal, WorkstationModal et AssignFromPoolModal pour filtrer le pool disponible à l'affectation — recherche à partir de 1 caractère (workstations) ou 2 (phones)
- **Règle invalidation cache** : toute mutation changeant le `status` d'un device DOIT invalider `['stock-summary']`, `['stock-devices']`, `['stockalerts']`
- **AssignFromPoolModal submit séquentiel** : pour les workstations, toujours 2 appels — `/assign` puis `PUT /:id` pour les champs réseau/site/hostname — ne jamais fusionner en un seul appel car `/assign` a sa logique d'audit séparée
- **Pool search dans DeviceForm** : `data.data ?? []` (PAS `data.devices`) — le backend renvoie `{ data: [...], total, ... }`. Utiliser ce format partout.
- **DeviceForm SN en édition workstation** : pool search via `useEffect` + debounce 300ms → `GET /devices?type={type}&status=IN_STOCK&search={q}` → `data.data`. État: `snSearch`, `snResults`, `snLoading`, `swappedDevice`, `showSnSearch`. Le `swappedDeviceId` est inclus dans le payload `onSubmit`.
- **Swap device dans Devices.tsx** : `swapMut` → 3 appels séquentiels : `DELETE /devices/{oldId}` `{status:'IN_STOCK'}` + `PATCH /devices/{newId}/assign` + `PUT /devices/{newId}`. Le `handleSubmit` vérifie `data.swappedDeviceId` pour décider entre swap et update normal.
- **DeviceForm hostname en édition** : `readOnly={isEdit}` — se met à jour via `setValue` si swap mais non éditable manuellement.
- **DeviceForm SN non-workstation en édition** : `readOnly={isEdit}` (SMARTPHONE, TABLET, MONITOR, etc.).
- **SPA navigation flash** : React.lazy() throw toujours une Promise au 1er rendu même si chunk en cache → fix = `future={{ v7_startTransition: true }}` sur `BrowserRouter` + `fallback={null}` sur Suspense AppShell. Ne jamais retirer ces deux éléments.
- **routePreload.ts** (`frontend/src/utils/`) : charge tous les 9 chunks en parallèle pendant le splash. Mémoïsé. Appelé dans `ProtectedRoute` de `App.tsx`.
- **dataPreload.ts** (`frontend/src/utils/`) : pré-chauffe le cache TanStack Query pendant le splash (11 queries en parallèle — voir Phase 27). Nécessite `setSharedQueryClient(queryClient)` dans `main.tsx` avant usage. Fail-open. **Règle** : toute nouvelle page avec un `isLoading` au 1er rendu DOIT avoir sa query listée ici avec la clé exacte utilisée par le hook.
- **Pill animée (layoutId) — règle GPU** : ne jamais ajouter `backdropFilter` / `WebkitBackdropFilter` à un `motion.div` pill à l'intérieur d'un conteneur qui a déjà `backdrop-filter` (`.tabs-glass`, `.toggle-glass`, `.navbar-glass`, `.sidebar-glass`, `.glass-card`). Cela crée deux layers GPU compositor dont les frontières génèrent une barre verticale (seam GPU) visible au hover. Le blur du conteneur suffit.
- **Animations par-item interdites** : ne jamais mettre `motion.tr`/`motion.div` avec `initial: opacity 0` sur des éléments dans un `.map()` — stagger déclenché à chaque montage = flash visible. Utiliser des `<tr>`/`<div>` plain à la place.

---

### ✅ Phase 15 — Traçabilité complète & swap PC (session 2026-04-02)

#### SN verrouillé / pool search en édition (DeviceForm.tsx)
- **Non-workstation** : SN `readOnly={isEdit}`, visuellement grisé
- **Workstation (LAPTOP/DESKTOP/THIN_CLIENT/LAB_WORKSTATION)** : SN devient un pool search :
  - Badge read-only affichant le SN actuel ou le SN sélectionné
  - Bouton "Changer de PC" → ouvre un champ de recherche
  - Debounce 300ms → `GET /devices?type={type}&status=IN_STOCK&search={q}` → `data.data ?? []`
  - Sélection → hostname auto-recalculé, `swappedDevice` state mis à jour
  - Bouton ✕ pour annuler et revenir au PC original
- **Hostname** : `readOnly={isEdit}` dans tous les cas (auto-calculé)
- `DeviceFormData` : ajout `swappedDeviceId?: string`

#### Swap device (Devices.tsx)
- `swapMut` : 3 appels séquentiels — `DELETE /devices/{oldId} {status:'IN_STOCK'}` + `PATCH /assign` + `PUT /:id`
- `handleSubmit` : si `data.swappedDeviceId && editing.assignedUserId` → swap, sinon update normal
- `isSaving={updateMut.isPending || swapMut.isPending}`
- Cache invalidé : `['devices']`, `['stock-summary']`, `['stock-devices']`, `['stockalerts']`

#### Hostname dans DeviceDetail header
- Quand `backTo === '/devices'` : sous le nom de l'utilisateur, affiche `{hostname} | {brand} {model}` si hostname présent, sinon `{brand} {model}`

#### Audit complet sur tous les mouvements (device.controller.ts)
| Endpoint | Action | Commentaire |
|---|---|---|
| `PATCH /assign` | ASSIGNED | `Assigné à [user] par [tech]` |
| `PATCH /unassign` | UNASSIGNED | `Désaffecté de [user] par [tech]` |
| `DELETE /:id` (si assigné) | UNASSIGNED | `Désaffecté de [user] par [tech]` |
| `DELETE /:id` | STATUS_CHANGED | `[user] → [statut] — par [tech]` (ou `Statut : [statut] — par [tech]` si non assigné) |
| `PUT /:id` STATUS_CHANGED | STATUS_CHANGED | `[ancien statut FR] → [nouveau statut FR] — par [tech]` |
| `PUT /:id` sans statut | UPDATED | `Mis à jour par [tech]` |
| `PUT /:id` assignedUserId change | UNASSIGNED + ASSIGNED | Deux entrées séparées avec les deux noms |

#### Changement d'utilisateur assigné via PUT (updateDevice)
- `updateDevice` intègre maintenant `assignedUserId` dans la mise à jour Prisma (avant : ignoré silencieusement)
- Si `assignedUserId` change : met à jour `assignedUserId + assignedAt` + crée UNASSIGNED (ancien) + ASSIGNED (nouveau)
- `findUnique` inclut `assignedUser` pour avoir le `displayName` sans appel supplémentaire

#### Stock › Déchets (Stock.tsx)
- Colonne "Tag IT" (assetTag) supprimée
- Remplacée par "Hostname" → `device.hostname ?? '—'`

---

### ✅ Phase 16 — Cohérence données, statuts & scan code-barres (2026-04-07)

#### Statut IN_MAINTENANCE dans les popups de désaffectation
- **Backend** `device.controller.ts` : `RETIRE_STATUS_LABELS` étendu — `IN_MAINTENANCE: 'En maintenance'` ajouté entre IN_STOCK et RETIRED
- `ALLOWED_RETIRE_STATUSES = Object.keys(RETIRE_STATUS_LABELS)` → inclut automatiquement IN_MAINTENANCE
- `retiredAt` **non posé** pour IN_MAINTENANCE (uniquement RETIRED, LOST, STOLEN)
- **Frontend** : AppSelect dans les 3 popups de désaffectation mis à jour :
  - `Devices.tsx` popup désaffectation (`retireStatus`)
  - `DeviceDetail.tsx` popup TabEquipements (`removeStatus`)
  - `DeviceDetail.tsx` popup principale (`retireStatus`)
  - Option insérée entre Stock et Déchet : `{ value: 'IN_MAINTENANCE', label: 'Maintenance — envoi en atelier' }`
  - Description : "L'équipement est envoyé en atelier et apparaîtra dans l'onglet Maintenance."
- **Important** : après modification du backend, **redémarrer le serveur** (`Ctrl+C` puis `pnpm dev`) pour que le changement soit pris en compte (tsx watch ne recharge pas toujours les constantes module-level)

#### Scan code-barres ReceiveModal (Orders.tsx)
**Problème** : sur la boite d'un iPhone, le scanner GS1 Apple ajoute un préfixe "S" devant le SN (Application Identifier GS1-128) et l'IMEI est encodé en GTIN-14 ("0" + IMEI = 16 chiffres).

**Corrections** :
- `cleanSN(raw)` : fonction module-level — strip le "S" initial si suivi de 8+ alphanum (`/^[A-Z0-9]+$/`)
- Champ SN en mode smartphone : `onChange` → `if (isPhone && cleaned.length > 12) return` (rejet silencieux > 12 chars) + `maxLength={isPhone ? 12 : undefined}` sur l'input
- Validation minimum (< 10 chars) déplacée dans `handleSubmit` — **ne pas mettre dans onChange** car les scanners envoient les caractères un par un (comme frappe clavier) et chaque état intermédiaire aurait été rejeté
- Champ IMEI : `d.length > 15 ? d.slice(-15) : d` — prend les 15 **derniers** chiffres (le "0" GTIN-14 est en tête, `slice(0,15)` prenait le mauvais côté)

**Règles longueur iPhone** :
| Barcode | Longueur | Traitement |
|---|---|---|
| SN Apple | 10–12 alphanum | cleanSN → accepté |
| IMEI | 15 chiffres | slice(-15) si > 15 |
| EID (eSIM) | 32 hex | > 12 → rejeté champ SN |

#### Champ keyboardLayout dans le catalogue DeviceModel
- Migration `20260407101852_add_keyboard_to_device_model` : `keyboardLayout KeyboardLayout? @default(AZERTY_FR)` sur `DeviceModel`
- `deviceModel.controller.ts` : `keyboardLayout: z.enum(KEYBOARD_LAYOUTS).optional()` dans le schema Zod
- `purchaseOrder.controller.ts` : `receiveDevice` passe `keyboardLayout: (dm as any).keyboardLayout ?? 'AZERTY_FR'` au device créé
- `Orders.tsx` catalogue : AppSelect keyboard layout conditionnel sur `HAS_KEYBOARD_TYPES` dans le formulaire modèle
- `DeviceForm.tsx` : section Spécifications masquée en mode édition (`!isEdit`) — valeurs préservées dans le state

#### Champ Bitlocker Boolean → String (clé de récupération)
**Décision** : Bitlocker n'est pas un toggle on/off mais une **clé de récupération numérique** à stocker.

- Migration `20260407120000_bitlocker_string` : `ALTER TABLE "Device" ALTER COLUMN "bitlocker" TYPE TEXT USING NULL`
  - Valeurs existantes (true/false) → NULL (aucune clé connue à conserver)
- Fichiers mis à jour : `schema.prisma`, `device.controller.ts` (Zod), `types/index.ts`, `device.service.ts`
- UI : toggle Activé/Désactivé remplacé par `<input>` texte chiffres uniquement (`replace(/\D/g, '')`) dans `DeviceForm.tsx`, `Devices.tsx` (AssignFromPoolModal), `DeviceDetail.tsx` (affichage `InfoRow` simple)
- Imports `Shield`, `ShieldOff` retirés des usages Bitlocker (peuvent subsister pour d'autres usages)
- **Procédure après migration** : arrêter le backend → `npx prisma generate` → redémarrer

#### Widget Matériel conditionnel par type d'appareil (DeviceDetail.tsx)
Avant : tous les devices affichaient Processeur/RAM/Écran/Clavier. Un iPhone montrait "Clavier: AZERTY_FR".

Logique corrigée — champs affichés par type :
| Champ | Types concernés |
|---|---|
| N° de série | Tous |
| IMEI | SMARTPHONE, TABLET |
| Processeur + RAM + Stockage | LAPTOP, DESKTOP, LAB_WORKSTATION (**pas THIN_CLIENT**) |
| Stockage | + SMARTPHONE, TABLET |
| Écran | LAPTOP uniquement |
| Taille | MONITOR uniquement |
| Clavier | LAPTOP, DESKTOP, LAB_WORKSTATION |
| Hostname | LAPTOP, DESKTOP, THIN_CLIENT, LAB_WORKSTATION |
| Réseau (VLAN/IP/MAC/Bitlocker) | LAB_WORKSTATION uniquement |

**THIN_CLIENT** : affiche N° série + Hostname uniquement (pas de specs — matériel sans disque ni mémoire significatifs).

#### Badge "Modèle actif" dans l'onglet Déchets (Stock.tsx)
**Logique** : si un device retraité a un modèle encore `isActive: true` dans le catalogue, un badge alerte s'affiche sur sa ligne.

- `TabDechets` charge `GET /devicemodels` (actifs uniquement, `staleTime: 60s`)
- Set `brand|name` construit pour lookup O(1) : `activeModelKeys.has(\`${device.brand}|${device.model}\`)`
- **Badge "Modèle actif"** (amber) : modèle encore déployé/commandé → alerte manager
- **Badge "Récent"** (orange) existant conservé : retiré < 180j ET lié à un PO
- Les deux badges peuvent coexister sur la même ligne (affichés en colonne)

---

### ✅ Phase 17 — FK modelId & pré-remplissage modèle robuste (2026-04-08)

#### Problème investigué
**Bug** : le champ "Modèle" dans DeviceForm apparaissait vide lors de l'édition d'un équipement mis en maintenance (ou stock, perte, vol), même si la page Informations affichait correctement le modèle.

**Deux causes racines identifiées :**

1. **Absence de FK `modelId` sur Device** — le formulaire retrouvait le modèle via `pendingModelSearch` (recherche textuelle `brand+name`). Cette recherche échouait :
   - Pour les périphériques créés via `QuickAddForm` sans sélectionner de modèle : `brand = '—'`, `model = DEVICE_TYPE_LABELS[type]` (ex : "Écran") → jamais dans le catalogue
   - Pour tout device dont le `DeviceModel` a été désactivé depuis la création

2. **`pendingModelSearch` se vidait même si non trouvé** — si la liste de modèles du mauvais type (tous modèles, avant que `selectedType` soit actualisé) était chargée en premier et que la recherche échouait, `setPendingModelSearch(null)` était appelé inconditionnellement → abandon définitif de la recherche

#### Décisions techniques

- **Ajout de `modelId String?`** sur `Device` (FK vers `DeviceModel`, `onDelete: SetNull`) — solution pérenne qui élimine la dépendance à la correspondance textuelle
- **`receiveDevice`** (PO) stocke désormais `modelId: dm.id` → tous les appareils reçus via commande ont le lien FK dès la réception
- **`QuickAddForm.basePayload`** inclut `modelId: model?.id` si un modèle est sélectionné
- **`DeviceForm`** : en édition, si `device.modelId` est présent → `setPendingModelId(device.modelId)` (mécanisme Priorité 1 existant, résolution par ID exact) ; sinon → `setPendingModelSearch` (fallback texte)
- **`pendingModelSearch` ne se vide plus si non trouvé** — il réessaie à chaque nouveau chargement de modèles (changement de type, refetch)
- **`.trim().toLowerCase()`** ajouté dans la comparaison brand+name pour couvrir les espaces parasites

#### Règle importante — résolution modèle en édition
```
device.modelId présent → setPendingModelId(modelId)  → Priorité 1 (ID exact)
device.modelId absent  → setPendingModelSearch({brand, model})  → Priorité 2 (texte)
```
- Si le modèle est inactif (désactivé) : `models.some()` échoue → `pendingModelId` reste set mais modelId reste vide → dropdown vide (comportement correct : modèle non sélectionnable)
- En mode création : `setPendingModelId(null)` ET `setPendingModelSearch(null)` pour éviter toute interférence avec un état résiduel de la session d'édition précédente

#### Fichiers modifiés
| Fichier | Changement |
|---|---|
| `schema.prisma` | `modelId String?` + `DeviceModel? @relation(... onDelete: SetNull)` + `devices Device[]` sur DeviceModel |
| `migrations/20260408000000_add_model_id_to_device/migration.sql` | `ALTER TABLE "Device" ADD COLUMN "modelId" TEXT` + FK constraint |
| `backend/controllers/purchaseOrder.controller.ts` | `receiveDevice` : `modelId: dm.id` |
| `backend/controllers/device.controller.ts` | `deviceSchema` : `modelId: z.string().optional()` ; `updateDevice` : lock `modelId` si PO-linked |
| `frontend/src/types/index.ts` | `modelId?: string` sur `Device` |
| `frontend/src/services/device.service.ts` | `modelId?: string` dans `DeviceFormData` |
| `frontend/src/components/devices/DeviceForm.tsx` | Logique `pendingModelId` vs `pendingModelSearch` ; fix "ne pas vider si non trouvé" ; `modelId` dans payload submit ; reset création vide les deux états |
| `frontend/src/pages/DeviceDetail.tsx` | `QuickAddForm.basePayload` : `modelId: model?.id` |
| `frontend/src/pages/Devices.tsx` | `setBitlocker(false)` → `setBitlocker('')` (bug Bitlocker string résiduel) |

#### Procédure après migration (EPERM Windows)
```bash
# 1. Arrêter le backend (Ctrl+C dans le terminal pnpm dev)
# 2. Depuis itam-pro/backend/
npx prisma generate
# 3. Relancer
cd .. && pnpm dev
```
La migration `20260408000000_add_model_id_to_device` a été appliquée avec succès via `prisma migrate deploy`.

---

### ✅ Phase 18 — PO Drawer + Recherche Historique (2026-04-09)

#### `npx prisma generate` — résolu
- Migration `20260408000000_add_model_id_to_device` avait été appliquée mais le client Prisma n'était pas régénéré (EPERM Windows — backend tourné)
- **Symptôme** : drawer PO vide même avec `receivedCount > 0` (include `devices` silencieusement échoué)
- **Fix** : arrêter le backend → `npx prisma generate` → relancer `pnpm dev` ✅
- **Règle** : après toute migration `prisma migrate deploy`, toujours vérifier que `prisma generate` a bien tourné avant de déboguer des données manquantes

#### `PO_LIST_INCLUDE` (purchaseOrder.controller.ts)
- Nouveau const séparé de `PO_INCLUDE` — inclut `devices` avec select lean (id, serialNumber, status, type, brand, model, assetTag, hostname, assignedUser)
- `listOrders` et `listHistory` utilisent `PO_LIST_INCLUDE` — create/update/cancel gardent `PO_INCLUDE` sans devices
- `useOrderHistory` : `staleTime: 0` + `refetchOnMount: true` (évite cache périmé)

#### `PODetailDrawer` (Orders.tsx)
- Slide-over depuis la droite (Framer Motion spring `stiffness: 400, damping: 40`)
- Liste tous les appareils reçus : SN mono, badge assetTag indigo, assignedUser, StatusBadge, ChevronRight
- **Tous les statuts naviguent vers `/devices/{id}`** avec `state: { from: '/orders', fromTab }` — cohérence totale
- Exception : `IN_STOCK` → `from: '/stock', fromTab: 'inventaire'` (l'appareil vit dans Stock)
- Cartes non-navigables uniquement si statut `ORDERED` (cas théorique)
- Prop `fromTab: string` passée depuis TabOrders (`'orders'`) ou TabHistory (`'history'`)

#### TabHistory — barre de recherche
- Input compact avec icône `Search` + bouton clear `X`
- Filtre `useMemo` par référence CMD OU par SN d'un appareil lié
- Badge "SN trouvé" (indigo) sur la commande si match vient du SN uniquement (pas de la référence)
- `snMatchIds: Set<string>` calculé séparément pour distinguer ref-match vs SN-match
- Cartes cliquables si `receivedCount > 0` → ouvre drawer

#### TabOrders — drawer depuis commandes actives
- Cartes PARTIAL (receivedCount > 0) cliquables → ouvre drawer
- `e.stopPropagation()` sur boutons "Réceptionner" et "Annuler" — évite ouverture accidentelle
- `selectedOrderId: string | null` (pas `PurchaseOrder`) → `selectedOrder` via `useMemo` depuis cache live — évite données périmées si refetch pendant que le drawer est ouvert

---

### ✅ Phase 19 — Navigation contextuelle avec restauration de tab (2026-04-09)

#### Problème résolu
Quand un utilisateur navigue vers la fiche d'un appareil depuis un onglet précis (ex: Stock › Maintenance), le bouton retour ramenait bien à la bonne page mais pas au bon onglet — l'utilisateur se retrouvait sur l'onglet par défaut.

#### Pattern `fromTab` — règle de navigation mise à jour

> Tout `navigate('/devices/:id')` DOIT passer `state={{ from: '<route>', fromTab: '<tab>' }}`.
> `DeviceDetail` lit `fromTab` et le renvoie via `goBack()` → `navigate(backTo, { state: { tab: fromTab } })`.
> Chaque page réceptrice lit `location.state?.tab` pour restaurer l'onglet actif.

| Origine | `from` | `fromTab` |
|---|---|---|
| Stock › Inventaire | `/stock` | `inventaire` |
| Stock › Maintenance | `/stock` | `maintenance` |
| Stock › Déchets | `/stock` | `dechets` |
| Appareils (DeviceTable) | `/devices` | type actif (`LAPTOP`, `DESKTOP`…) |
| Commandes › Onglet Commandes | `/orders` | `orders` |
| Commandes › Historique | `/orders` | `history` |
| Dashboard | `/dashboard` | — (pas de tab) |

#### Pages réceptrices — tabs contrôlés
- **Stock.tsx** : `useState` initialisé depuis `location.state?.tab ?? 'inventaire'` + `useEffect` de sync sur `location.state` — évite tab figé si l'utilisateur navigue vers `/stock` via la Sidebar sans état
- **Orders.tsx** : même pattern, `Tabs.Root value={activeTab}` (était `defaultValue`) + `useEffect` sync
- **Devices.tsx** : déjà contrôlé depuis session précédente ✅

#### `DeviceTable.tsx`
- Prop optionnelle `fromTab?: string` ajoutée
- Passée depuis `Devices.tsx` : `fromTab={activeTab}` (le type d'appareil actif)

#### `DeviceDetail.tsx`
- `goBack()` helper : `navigate(backTo, { state: fromTab ? { tab: fromTab } : undefined })`
- Remplace les 3 `navigate(backTo)` directs (bouton retour, état erreur, handleDelete)
- `handleDelete` : wrapped dans `try/catch` — si la mutation échoue, pas de navigation fantôme (erreur visible via `deleteMut.error`)

---

### ✅ Phase 20 — Performance DB, assignation améliorée & UX Stock (2026-04-11)

#### Index de performance — migration `20260411203816_add_performance_indexes`
**Contexte** : Elkem compte ~15 000 utilisateurs et ~10 000 postes actifs, +400 postes/an en déchets. Sans index, PostgreSQL faisait des full table scans sur chaque requête.

**39 index créés** sur 7 modèles :

| Modèle | Index clés |
|---|---|
| `Device` | `[status]`, `[type]`, `[assignedUserId]`, `[status, type]`, `[assignedUserId, type]`, `[status, updatedAt]`, `[status, model]`, `[purchaseOrderId]`, `[modelId]`, `[warrantyExpiry]`, `[status, warrantyExpiry]`, `[updatedAt]`, `[createdAt]`, `[site]` |
| `AuditLog` | `[deviceId]` *(critique)*, `[deviceId, createdAt]`, `[userId]`, `[action]`, `[createdAt]` |
| `MaintenanceLog` | `[deviceId]`, `[deviceId, createdAt]`, `[resolved]` |
| `Attachment` | `[deviceId]` |
| `DeviceModel` | `[isActive]`, `[type, isActive]`, `[type]`, `[order]` |
| `StockAlert` | `[deviceType]`, `[isActive]` |
| `PurchaseOrder` | `[status]`, `[status, createdAt]`, `[createdAt]`, `[deviceModelId]`, `[createdById]` |
| `User` | `[isActive]`, `[role]`, `[isActive, role]` |

**Règle** : Prisma ne crée pas d'index automatiques sur les FK en PostgreSQL — toujours les déclarer explicitement avec `@@index`.

**Procédure appliquée** :
```bash
cd itam-pro/backend
npx prisma migrate dev --name add_performance_indexes
# EPERM normal si backend tourne → arrêter backend → npx prisma generate → relancer
```

---

#### Assign modal DeviceDetail — UserCombobox + Site

**Problème** : le modal "Assigner" chargeait tous les utilisateurs via `userService.list()` et les affichait dans un `AppSelect` statique — incompatible avec 15 000 users.

**Fix** :
- `userService.list()` + `useQuery(['users'])` **supprimés** de `DeviceDetail.tsx`
- Remplacés par `UserCombobox` (search-as-you-type, debounce 300ms, `GET /users?search=...`, 8 résultats max)
- `UserCombobox` reçoit `inline` prop → résultats dans le flux du modal, pas en `absolute` (évite overflow hors modal et scroll forcé)
- **Site ajouté** : `AppSelect` avec `SITE_OPTIONS` (9 sites Elkem, défaut `SUD`)
- `handleAssign` fait 2 appels séquentiels : `PATCH /assign { userId }` puis `PUT /devices/:id { site }` + `qcMain.invalidateQueries(['device', id])`
- Reset complet à la fermeture : `setSelectedUser('')` + `setAssignSite('SUD')`

**Prop `inline` ajoutée à `UserCombobox`** :
- `inline=false` (défaut) : dropdown `absolute` — comportement classique dans les formulaires
- `inline=true` : résultats dans le flux normal — le conteneur parent grandit naturellement
- Couleurs migrées de hardcoded `#1a1a2e` vers `var(--bg-secondary)` — compatible light/dark

**État `qcMain`** : `useQueryClient()` ajouté dans le composant principal `DeviceDetail` (séparé des `qc` des sous-composants `Tab*` pour éviter confusion).

---

#### Bouton "Réinitialiser" — onglets Déchets et Maintenance (Stock.tsx)

- Même pattern que `DeviceFilters.tsx` (page Utilisateurs) : bouton `RotateCcw` visible uniquement si `isFiltered === true`
- **Déchets** : remet `typeFilter`, `modelFilter`, `statusFilter` à `'ALL'`
- **Maintenance** : remet `typeFilter`, `modelFilter` à `'ALL'`
- `RotateCcw` ajouté aux imports lucide de `Stock.tsx`

---

## Vérifications architecturales confirmées (2026-04-11)

- **Zéro doublon de données** : chaque appareil physique = 1 ligne `Device`. Toutes les pages (Utilisateurs, Stock, Commandes, Déchets) sont des **vues filtrées** de la même table. Les commandes utilisent une FK `purchaseOrderId`, pas une copie.
- **`prisma.device.create`** n'est appelé que dans 2 endroits : `createDevice` (controller direct) et `receiveDevice` (réception PO). Aucune création parasite.

---

### ✅ Phase 21 — UX globale, recherche intelligente & Admin (2026-04-13)

#### TopBar — dropdown recherche globale via React Portal

**Problème** : le dropdown de recherche apparaissait derrière le contenu des pages.  
**Cause** : `<main overflow-y-auto>` + `<motion.div opacity>` créent des stacking contexts CSS qui écrasent tout `z-index` interne à TopBar.  
**Fix** : `createPortal(..., document.body)` pour les deux dropdowns (résultats + "aucun résultat"), positionnés en `fixed` via `containerRef.getBoundingClientRect()`. `z-index: 9999`.

**Second bug** : les clics sur les résultats ne déclenchaient rien.  
**Cause** : le handler `mousedown` sur `document` vérifiait `containerRef.contains(target)` → le portal est hors de l'arbre DOM de containerRef → `setDropdownOpen(false)` avant que `click` arrive.  
**Fix** : `portalRef` ajouté sur le div portal, handler exclut `containerRef` ET `portalRef`.

#### TopBar — affichage et tags des résultats

- **Affichage appareil** : SN (police mono, ligne principale) + `{brand} {model} · {utilisateur}` (ligne secondaire). Avant : `{brand} {model}` uniquement.
- **Tags de statut** corrigés — tous affichaient "Stock" :

| Statut | Tag | Couleur | Destination clic | Retour |
|---|---|---|---|---|
| ASSIGNED / LOANER | Actif | Vert émeraude | DeviceDetail | Utilisateurs, onglet type |
| PENDING_RETURN | À récupérer | Ambre | DeviceDetail | Utilisateurs, onglet type |
| IN_STOCK / ORDERED | Stock | Indigo | DeviceDetail | Stock › Inventaire |
| IN_MAINTENANCE | **Maintenance** | **Orange** | DeviceDetail | Stock › Maintenance |
| RETIRED | **Déchet** | **Rouge** | DeviceDetail | Stock › Déchets |
| LOST | **Perdu** | **Rouge** | DeviceDetail | Stock › Déchets |
| STOLEN | **Volé** | **Rouge** | DeviceDetail | Stock › Déchets |

La navigation (`getDeviceNavState`) était déjà correcte — seuls les labels/couleurs ont changé.

#### Recherche "commence par" — tous les dropdowns dynamiques

**Problème** : taper "484" remontait tous les SN contenant un 4 ou un 8.  
**Fix backend** : `contains` → `startsWith` dans `device.controller.ts` et `user.controller.ts`.  
**Cas spécial `displayName`** : deux clauses — `startsWith: search` (prénom en premier) + `contains: ' ' + search` (nom de famille) — pour trouver "Jean **Dupont**" en tapant "Dup".  
**Portée** : TopBar, UserCombobox, WorkstationModal, AssignFromPoolModal, PhoneModal — tous ces dropdowns passent par les mêmes deux endpoints.

#### Dark mode — fond violet / bleu marine

Deux orbes chaudes supprimées du gradient `[data-theme="dark"] body::before` :
- Orange `rgba(245,158,11,0.40)` → Indigo profond `rgba(79,70,229,0.40)`
- Rose `rgba(236,72,153,0.28)` → Bleu marine `rgba(30,58,138,0.35)`

Les effets liquid glass, variables CSS, widgets et mode clair sont inchangés.

#### Page Admin (Users.tsx)

- Titre `Utilisateurs` → **`Admin`**
- Filtre rôle : `AppSelect` pleine largeur → `FilterPill` compact (icône `ShieldCheck`, option "Tous" intégrée nativement, réinitialisation possible)
- Recherche : style pill compact `w-44 → focus:w-56` avec clear button, identique aux autres pages
- Badge département **supprimé** des cartes (non utilisé, non configurable)

---

## Architecture SSO / synchronisation utilisateurs — décisions validées (2026-04-13)

### Prérequis obligatoire : App Registration Azure / Entra ID

Il est impossible de se connecter avec un compte @elkem.com sans une **App Registration** préalable dans Entra ID. Cette étape nécessite un admin du tenant Elkem.

Permissions Graph à déclarer :
| Permission | Type | Usage |
|---|---|---|
| `User.Read` | Delegated | Lire son propre profil à la connexion |
| `User.Read.All` | Application | Importer tous les users AD (sync complète) |
| `DeviceManagementManagedDevices.Read.All` | Application | Lire les appareils Intune |

Variables `.env` backend à renseigner : `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`, puis `AUTH_MODE=sso`.

### Deux populations distinctes — règle fondamentale

| Population | Rôle | Peut se connecter | Source |
|---|---|---|---|
| Équipe IT (3-5 personnes) | MANAGER / TECHNICIAN / VIEWER | ✅ Oui — login Microsoft | Créés manuellement page Admin |
| Employés Elkem (tout le parc) | Bénéficiaires d'appareils | ❌ Non | Importés depuis AD/Graph API |

**Mécanisme de sécurité** : Microsoft confirme l'identité, mais le backend vérifie que l'email existe dans la table `User` (IT uniquement) avant d'émettre le JWT. Un @elkem.com non dans cette liste = 403 immédiat même avec token Microsoft valide.

### À implémenter côté backend (non fait)

1. **Provisioning à la connexion** (`auth.controller.ts`) : si l'email entrant est dans la table `User` IT, mettre à jour `displayName` depuis le token Microsoft.
2. **Import employés depuis Graph** (`intune.service.ts`) : `GET /graph/v1.0/users` → upsert dans la table des bénéficiaires (≠ table `User` IT). Bouton dans page Sync Intune + cron nightly.
3. **Page Login** : remplacer formulaire email/mdp par un unique bouton "Se connecter avec Microsoft" quand `AUTH_MODE=sso`.

---

### ✅ Phase 22 — Liquid glass UI, popups & drawer redesign (2026-04-14)

#### Problèmes résolus

**1. Popup désaffectation "Équipements" (DeviceDetail) — 4 bugs simultanés**

| Symptôme | Cause racine | Fix |
|---|---|---|
| Backdrop ne couvre pas toute la page (découpe en haut) | `position:fixed` dans AppShell `motion.div` (transform context) | `createPortal(…, document.body)` |
| AppSelect uncliquable après sélection | `AnimatePresence + IIFE + fragment` = unstable re-mount sur chaque state change | Remplacé par `{removeConfirm && createPortal(…)}` conditionnel stable |
| Popup non fonctionnelle (stock/déchet) | Même cause + z-index backdrop (z-90) conflit avec AppSelect (z-200) | z-150/151 pour backdrop/card, AppSelect reste z-200 |
| Fond trop gris, pas d'effet glass | `.modal-glass` dark mode = `rgba(14,14,28,0.55)` flat + backdrop 0.60 opaque = blur sur fond noir = gris | Voir redesign ci-dessous |

**2. Redesign `.modal-glass` (index.css)**
- **Avant** : dark `rgba(14,14,28,0.55)` flat — `backdrop-filter` floutait un fond presque noir = résultat gris uniforme
- **Après** : gradient teinté indigo/cyan en dark, plus opaque en light, bordure et highlight specular renforcés
- **Insight clé** : le `backdrop-filter` du card a besoin de couleur derrière lui. Backdrop `rgba(0,0,10,0.42)` + `blur(4px)` léger laisse le gradient violet/bleu de la page traverser → blur coloré = vrai liquid glass.

**3. DeviceForm drawer — floating widget arrondi**
- **Avant** : panneau plein hauteur `fixed right-0 top-0 bottom-0`, fond opaque `var(--surface-primary)`, carré
- **Après** : widget flottant `right:16px, top:16px, bottom:16px, width:440px`, classe `.modal-glass`, décorations specular identiques aux popups
- `createPortal` ajouté à `DeviceForm.tsx` — même raison que les popups (transform context AppShell)
- Bouton "Enregistrer" : gradient indigo plein avec glow, cohérent avec bouton "Confirmer" amber des popups
- Bouton modal centrée (`modal=true`) : même upgrade glass

**4. Popup désaffectation Devices.tsx alignée**
- Migrée de `AnimatePresence` inline → `createPortal` stable (même pattern que DeviceDetail)
- Design aligné : backdrop 0.42, orbes renforcés, séparateur indigo/cyan, bouton amber gradient plein

#### Fichiers modifiés
| Fichier | Changement |
|---|---|
| `frontend/src/index.css` | `.modal-glass` dark/light redesign — gradient teinté, highlights renforcés |
| `frontend/src/pages/DeviceDetail.tsx` | `createPortal` import + popup Équipements migrée (z-150/151, stable conditional) |
| `frontend/src/pages/Devices.tsx` | `createPortal` import + popup désaffectation migrée + design aligné |
| `frontend/src/components/devices/DeviceForm.tsx` | `createPortal` import + drawer → widget flottant arrondi `.modal-glass` |

---

### ✅ Phase 23 — Design system complet liquid glass (2026-04-16)

#### SN combobox en mode édition (DeviceForm.tsx)
- Champ SN workstation en édition : plus grisé, affiche le SN actuel comme vraie valeur
- `ChevronDown` visible permanent (rotate 180° quand ouvert), icône `X` uniquement quand `swappedDevice` sélectionné
- Logique ternaire : `swappedDevice?.sn` → `snOpen ? snSearch` → `device?.serialNumber`
- `onMouseDown e.preventDefault()` sur les résultats dropdown — empêche le `blur` de fermer avant le `click`
- Timeout 150ms sur le `onBlur` pour laisser le `onMouseDown` se déclencher en premier
- `snOpen` state resetté à `false` dans les deux branches du `useEffect([device, isOpen])`

#### btn-primary et btn-secondary upgrades (index.css)
- `.btn-primary` : gradient indigo `→ #4f46e5`, glow `rgba(99,102,241,0.35)`, specular inset, `:hover` scale(1.02), `:active` scale(0.97)
- `.btn-secondary` : `background: var(--bg-glass)`, `backdrop-filter: var(--blur)`, `border: var(--border-glass)`, specular `inset 0 1px 0 rgba(255,255,255,0.12)`, `:hover` scale(1.02) + border indigo teintée, `:active` scale(0.97)

#### motion.button + scale sur tous les boutons d'action
- **Règle** : tout bouton d'action dans un formulaire, modale ou popup = `motion.button` avec `whileHover={{ scale: 1.02 }}` + `whileTap={{ scale: 0.97 }}`
- Appliqué à : boutons "Annuler" dans DeviceForm, "+Nouveau" dans Devices.tsx, footer de AssignFromPoolModal, footer de PODetailDrawer, tous les modaux/popups de DeviceDetail (PhoneModal, WorkstationModal, popup assign, popup delete) et Orders.tsx
- Bouton "Confirmer" suppression : amber gradient `linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)` + glow amber
- "+Nouveau" : `whileHover={{ scale: 1.03 }}` (légèrement plus fort car bouton primaire de la page)

#### AssignFromPoolModal redesign glass (Devices.tsx)
- `createPortal` obligatoire (AppShell transform context)
- `AnimatePresence` supprimé du composant — utiliser `{assignOpen && createPortal(...)}` conditionnel stable
- Card : `.modal-glass max-w-lg`, 3 décorations specular, header/footer `borderColor: rgba(139,120,255,0.20)`
- Section headers : `text-[10px] font-semibold uppercase tracking-widest text-primary`
- Résultats dropdown : `bg-secondary` + `hover:bg-indigo-600/20`
- Spring modal : `stiffness: 460, damping: 36, mass: 0.72`

#### PODetailDrawer redesign glass (Orders.tsx)
- `createPortal` obligatoire — même raison que les autres overlays
- Drawer droit flottant : `right:16px, top:16px, bottom:16px, width:480px`, classe `.modal-glass`
- 4 décorations : ligne specular top, reflet vertical gauche, orbe indigo haut-droite, orbe cyan bas-gauche
- Header + device list : séparateurs `rgba(139,120,255,0.15)`, hover indigo via `onMouseEnter/Leave`
- Spring drawer : `stiffness: 420, damping: 40, mass: 0.85`
- `import { createPortal } from 'react-dom'` ajouté à Orders.tsx ; `ArrowRight` + `DEVICE_STATUS_LABELS` supprimés (inutilisés)

#### Toggle/tab bar glass (liquid-glass.css)
- `.toggle-glass` et `.tabs-glass` : `border: 1px solid var(--table-border)` → `var(--border-glass)` (bordure blanche translucide, identique à `btn-secondary`)
- Specular : `inset 0 1.5px 0 rgba(255,255,255,0.65)` → `inset 0 1px 0 rgba(255,255,255,0.12)` (même valeur que `btn-secondary`)
- `border-top-color` override supprimé de `.tabs-glass` (redondant avec `var(--border-glass)`)
- Dark mode : overrides `border-color` supprimés des deux classes — `var(--border-glass)` gère les deux thèmes via ses variables CSS
- Specular dark mode : `rgba(255,255,255,0.09)` → `rgba(255,255,255,0.12)` — aligné sur `btn-secondary`
- La pill animée (Framer Motion `layoutId`) est inchangée dans tous les cas

#### Bouton retour et bouton collapse sidebar (DeviceDetail.tsx + Sidebar.tsx)
- `<button>` → `<motion.button>` avec `whileHover={{ scale: 1.05 }}` + `whileTap={{ scale: 0.95 }}`
- Style glass permanent (visible sans hover) :
  ```jsx
  style={{
    background: 'var(--bg-glass)',
    backdropFilter: 'var(--blur)',         // ← obligatoire, inclut brightness(1.04)
    WebkitBackdropFilter: 'var(--blur)',
    border: '1px solid var(--border-glass)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20), 0 2px 8px rgba(0,0,0,0.10)',
  }}
  ```
- **Specular 0.20 (pas 0.12)** sur les petits boutons icône (≤32px) — compense la taille réduite
- Appliqué à : bouton `ArrowLeft` retour dans DeviceDetail, bouton `ChevronLeft/Right` collapse sidebar desktop, bouton `X` close sidebar mobile

#### Règles CSS liquid glass consolidées
- **`backdropFilter: 'var(--blur)'`** — TOUJOURS utiliser la variable CSS, jamais les valeurs hardcodées `blur(20px) saturate(1.8)`. Le `var(--blur)` inclut `brightness(1.04)` en light (effet verre éclairé) et `brightness(0.95)` en dark. Sans ce `brightness`, l'effet glass est terne.
- **Specular par taille** : bouton large (btn-secondary, modaux) = `0.12` ; bouton icône compact (≤32px) = `0.20`
- **Backdrop des modaux** : `rgba(0,0,10,0.42)` + `backdropFilter: blur(4px)` — laisser les couleurs de la page traverser pour que le `backdrop-filter` du `.modal-glass` ait quelque chose de coloré à flouter
- **Variables CSS actives** :
  - `--bg-glass` = `var(--glass-bg)` (liquid-glass.css override sur index.css) : `rgba(255,255,255,0.28)` light / `rgba(5,5,18,0.36)` dark
  - `--border-glass` = `var(--glass-border)` : `rgba(255,255,255,0.65)` light / `rgba(255,255,255,0.13)` dark
  - `--blur` = `blur(20px) saturate(1.8) brightness(1.04)` light / `blur(22px) saturate(1.5) brightness(0.95)` dark

---

### ✅ Phase 24 — UX navigation, bouton Désaffecter & système de notifications (2026-04-17)

#### Suppression bouton Trash2 — fusion dans "Désaffecter" (DeviceDetail.tsx)
- Bouton Trash2 dans le header de DeviceDetail supprimé — redondant avec "Désaffecter"
- "Désaffecter" (`UserMinus`) visible en permanence pour tout `canEdit`, même sans utilisateur assigné
- Comportement absorbé : ouvre la même popup de choix de destination (IN_STOCK / RETIRED / LOST / STOLEN)

#### Style bouton "Désaffecter" — liquid glass orange hover
- `motion.button` avec `whileHover={{ scale: 1.03 }}` + `whileTap={{ scale: 0.97 }}`
- État repos : fond `rgba(245,158,11,0.08)`, border `rgba(245,158,11,0.30)`, texte `text-amber-400`
- Hover : gradient plein `linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)` via span `opacity-0 group-hover:opacity-100`
- **Pattern obligatoire** pour hover gradient sur bouton avec `style.background` inline : utiliser une `<span>` absolue avec `opacity-0 group-hover:opacity-100` + classe `group` sur le bouton — Tailwind `hover:bg-*` ne peut pas overrider un `style.background` inline

#### Renommage "Utilisateurs" → "Appareils"
- Sidebar item `/devices` : label `'Utilisateurs'` → `'Appareils'`, icône `BookUser` → `Laptop`
- MobileNav item `/devices` : même changement
- `Devices.tsx` : titre `<h1>Appareils</h1>`
- `Users.tsx` : texte modal désactivation "page Utilisateurs" → "page Appareils"
- **Ne pas changer** : section "Utilisateurs" du dropdown de recherche TopBar (réfère aux personnes, pas à la page)

#### Système de notifications stock

**Architecture**

`uiStore.ts` — 3 états vus persistés en localStorage :
- `viewedInventaireAlerts: Record<string, number>` — `{ [deviceType]: stockAtView }` — ré-notifie si stock baisse encore
- `viewedMaintenanceDevices: string[]` — IDs devices vus (cap 200 entrées)
- `viewedDechetsDevices: string[]` — IDs devices vus (cap 200 entrées)
- 3 actions `markInventaireAlertViewed`, `markMaintenanceDeviceViewed`, `markDechetsDeviceViewed`
- Ajoutés au `partialize` — persistés entre sessions

`hooks/useStockNotifications.ts` — hook central (nouveau fichier) :
- Fetche `['stockalerts']`, `['maintenance-devices']`, `['retired-devices']`, `['device-models']`
- TanStack Query déduplique — zéro fetch supplémentaire si les tabs Stock sont ouverts en même temps
- Retourne : `inventaireCount`, `maintenanceCount`, `dechetsCount`, `totalCount`
- Retourne : `unviewedAlertTypes: Set<string>` (types avec alerte non lue), `overdueUnviewedDeviceIds`, `activeModelUnviewedDeviceIds`
- Retourne : `triggeredAlerts[]`, `overdueDevices[]`, `activeModelDevices[]` pour le dropdown TopBar

**Logique par onglet**
| Onglet | Condition de notification | Disparaît quand |
|---|---|---|
| Inventaire | `alert.isActive && alert.triggered && (jamais vu OU currentStock < stockAtView)` | Clic sur la carte du modèle concerné (granularité par modelId — voir Phase 25) |
| Maintenance | Device avec `maintenanceDeadline < now` et non vu | Clic sur la ligne du device |
| Déchets | Device retraité dont le modèle est encore `isActive` dans le catalogue et non vu | Clic sur la ligne du device |

**Affichage**
- `Stock.tsx` : badges count (glass indigo) sur chaque onglet + point violet par carte/ligne concernée
- `Sidebar.tsx` : badge `totalCount` (glass indigo) à droite de "Stock" — version expanded et collapsed
- `TopBar.tsx` : cloche avec badge indigo + dropdown panel (`createPortal z-9999`) — 3 sections cliquables, chaque section navigue vers le bon onglet Stock via `navigate('/stock', { state: { tab } })`

> ⚠️ La granularité inventaire et les alertes par modèle ont été refactorisées en Phase 25 — voir ci-dessous.

**Règle design — pastilles de notification**
- **JAMAIS d'amber/jaune** pour les pastilles de notification — violets/indigo uniquement
- Badge count : `background: rgba(99,102,241,0.70)`, `border: rgba(139,120,255,0.55)`, `boxShadow: 0 2px 6px rgba(99,102,241,0.30)`, texte blanc
- Dot par item : `background: rgba(139,92,246,0.80)` avec glow `0 0 6px rgba(139,92,246,0.35)`
- Cette règle s'applique partout : Sidebar, tabs, lignes de table, dropdown
- L'amber reste acceptable pour les badges de **contenu** existants (stock vide, KPI Ruptures, badge "Modèle actif")

#### Fichiers créés/modifiés
| Fichier | Changement |
|---|---|
| `frontend/src/stores/uiStore.ts` | Viewed states + mark actions + partialize étendu |
| `frontend/src/hooks/useStockNotifications.ts` | **Nouveau** — hook central notifications |
| `frontend/src/pages/Stock.tsx` | Import hook + mark actions + badges tabs + dots per-item |
| `frontend/src/components/layout/Sidebar.tsx` | Import hook + badge sur item "Stock" |
| `frontend/src/components/layout/TopBar.tsx` | Import hook + bell fonctionnelle + dropdown panel portal |
| `frontend/src/pages/DeviceDetail.tsx` | Suppression Trash2, "Désaffecter" permanent, style orange hover |
| `frontend/src/components/layout/MobileNav.tsx` | BookUser → Laptop, label "Appareils" |
| `frontend/src/pages/Devices.tsx` | Titre "Appareils" |
| `frontend/src/pages/Users.tsx` | Texte modal "page Appareils" |

---

### ✅ Phase 25 — Alertes stock par modèle, notifications corrigées & UX contextuelle (2026-04-20)

#### 1. Alertes stock par modèle — full stack

**Problème** : les règles d'alerte ne s'appliquaient qu'au niveau du type d'appareil. Impossible de fixer un seuil spécifique à un modèle (ex : Dell Pro 14 < 5).

**Migration Prisma** `20260420000000_add_model_id_to_stock_alert` :
```sql
ALTER TABLE "StockAlert" ADD COLUMN "deviceModelId" TEXT;
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_deviceModelId_fkey"
  FOREIGN KEY ("deviceModelId") REFERENCES "DeviceModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "StockAlert_deviceModelId_idx" ON "StockAlert"("deviceModelId");
```
`DeviceModel` reçoit `stockAlerts StockAlert[]` en retour.

**Backend** `stockAlert.controller.ts` :
- `listAlerts` : compte le stock par type ET par modelId, inclut la relation `deviceModel`
- `createAlert` : accepte `deviceModelId` optionnel, upsert intelligent (cherche alerte existante par `deviceModelId` ou `deviceType + deviceModelId IS NULL`)
- Toutes les réponses incluent `deviceModel: { id, brand, name, type }`

**Frontend** `Orders.tsx` — onglet Règles d'alerte :
- Sentinel `MODEL_ALL = '__ALL__'` (jamais `value=""` — crash Radix UI)
- Dropdown modèle filtré par type sélectionné, reset à `MODEL_ALL` à chaque changement de type
- Query key `['device-models']` + `/devicemodels` (actifs uniquement — ne pas confondre avec `['device-models-all']` + `/devicemodels/all`)
- Rendu en deux sections distinctes : "Par type d'appareil" et "Par modèle" avec badge indigo
- `handleAdd` : `deviceModelId: addingModelId === MODEL_ALL ? null : addingModelId`

---

#### 2. Granularité notifications inventaire — par modelId (refacto Phase 24)

**Bug** : cliquer sur un modèle Dell Pro 14 faisait disparaître les pastilles de **tous** les modèles du même type.

**Cause** : `viewedInventaireAlerts` était indexé par `deviceType` → `markInventaireAlertViewed(model.type, ...)` marquait tout le type comme vu.

**Fix** :
- `uiStore.ts` : `viewedInventaireAlerts: Record<string, number>` (clé=type) → **`viewedInventaireModels: Record<string, number>`** (clé=modelId)
- Action renommée `markInventaireAlertViewed` → **`markInventaireModelViewed(modelId, inStock)`**
- `Stock.tsx` : click handler → `markInventaireModelViewed(model.id, model.inStock)` ; hasNotif → `unviewedInventaireModelIds.has(model.id)`
- `useStockNotifications.ts` : fetche `['stock-summary']` pour avoir les modèles par type ; calcule `unviewedInventaireModelIds: Set<string>` (granularité modelId) ; expose `unviewedModelsWithStock: { id, inStock }[]`

**Logique de l'alerte par modèle dans le hook** :
```typescript
const candidates = alert.deviceModelId
  ? stockSummary.filter((m) => m.id === alert.deviceModelId)   // alerte par modèle
  : stockSummary.filter((m) => m.type === alert.deviceType);   // alerte par type

for (const model of candidates) {
  const seenAt = viewedInventaireModels[model.id];
  if (seenAt === undefined || model.inStock < seenAt) {
    unviewedInventaireModelIds.add(model.id);
  }
}
```

---

#### 3. Pastilles bloquées après création/modification d'alerte

**Problème** : si l'utilisateur avait cliqué sur un modèle (ex : Dell Pro 14, stock=1) avant la création d'une alerte, `viewedInventaireModels["id"] = 1` était posé. Après création de l'alerte avec seuil=5 : `1 < 1 = false` → aucune notification, même si le stock est sous le seuil.

**Fix** — `uiStore.ts` :
```typescript
clearInventaireModelsViewed: (modelIds: string[]) =>
  set((s) => {
    const next = { ...s.viewedInventaireModels };
    modelIds.forEach((id) => delete next[id]);
    return { viewedInventaireModels: next };
  }),
```

**Câblage** `Orders.tsx` `TabAlerts` :
- `upsertAlertMut.onSuccess` : appelle `clearInventaireModelsViewed([modelId])` si alerte par modèle, ou `clearInventaireModelsViewed(ids de tous les modèles du type)` si alerte par type
- `updateAlertMut.onSuccess` : si `variables.data.threshold !== undefined` → même clear → pastille réapparaît immédiatement si le stock est toujours sous le nouveau seuil

---

#### 4. Cloche notifications — corrections & bouton "Tout vider"

**Bug** : les sous-lignes inventaire affichaient `DEVICE_TYPE_LABELS[alert.deviceType]` (ex : "PC Portable") même pour les alertes par modèle.
- **Cause** : `StockAlertRow` dans `useStockNotifications.ts` n'avait pas le champ `deviceModel`.
- **Fix** : ajout de `deviceModel: { id, brand, name, type } | null` à l'interface `StockAlertRow` du hook.
- **Affichage corrigé** : `alert.deviceModel ? \`${brand} ${name}\` : DEVICE_TYPE_LABELS[type]`

**Bouton corbeille dans le header du panel** :
- Visible uniquement si `totalCount > 0`
- Action `clearAllNotifications` :
  - Inventaire : `unviewedModelsWithStock.forEach(({ id, inStock }) => markInventaireModelViewed(id, inStock))`
  - Maintenance : `overdueDevices.forEach((d) => markMaintenanceDeviceViewed(d.id))`
  - Déchets : `activeModelDevices.forEach((d) => markDechetsDeviceViewed(d.id))`
- Style : fond rouge `rgba(239,68,68,0.08)`, hover `0.18`, icône `Trash2` rouge — cohérent avec le design glass

---

#### 5. Renommage des rôles — VIEWER → "Technicien Proximité"

**Décision** : le rôle `VIEWER` (valeur DB inchangée) est renommé partout en "Technicien Proximité". Mêmes droits que TECHNICIAN, titre différent pour des attributions de tâches distinctes.

| Rôle DB | Label affiché |
|---|---|
| `MANAGER` | Manager |
| `TECHNICIAN` | Technicien |
| `VIEWER` | **Technicien Proximité** |

Fichiers mis à jour : `formatters.ts` (`ROLE_LABELS`), `Users.tsx` (filtre FilterPill + badge cartes), `Settings.tsx` (widget Mon compte), `Login.tsx` (comptes de test).

---

#### 6. DeviceDetail — boutons contextuels selon la page d'origine

**Problème** : le bouton "Désaffecter" n'avait pas de sens depuis la page Stock (appareils sans utilisateur, en maintenance, en déchets).

**Règle** : `backTo = location.state?.from` détermine les boutons affichés.

| Origine (`backTo`) | Boutons |
|---|---|
| `/stock` | Assigner (si pas d'user) + Modifier + Trash2 icône (rouge, icon-only, `setDeleting`) |
| `/devices` | Désaffecter (amber, `setDeleting`) + Modifier |

- Le modal de déplacement (`setDeleting`) est **identique** dans les deux cas — seule l'apparence du déclencheur change.
- Trash2 depuis Stock : `w-36px h-36px`, `border-radius:10px`, fond rouge `rgba(239,68,68,0.08)`, hover via `onMouseEnter/Leave`, `whileHover scale(1.05)`.
- Depuis Stock, `Assigner` n'est visible que si `!device.assignedUser` (appareil sans utilisateur).

---

---

### ✅ Phase 26 — Flash navigation SPA — fix définitif (2026-04-21)

#### Diagnostic — cause racine du micro-flash

Le flash "cards blanches / micro rafraichissement à droite" à chaque 1re navigation de page venait de **trois sources superposées** :

1. **React.lazy() throw synchrone** — La cause principale. React.lazy() lance **toujours** une exception Promise au premier rendu, même si le chunk est déjà en cache (preloaded). Suspense affiche son fallback pour ~1-3 frames avant de reconnaître le chunk. Le preload réduit de 500ms à 3ms mais ne supprime pas le flash.

2. **Animations mount par-item (`delay: i * X`)** — `motion.tr` / `motion.div` avec `initial: opacity 0` sur les `.map()` → à chaque premier montage de page, les lignes/cartes s'affichent en fondu décalé = "cards blanches" visibles.

3. **Layout shift scrollbar** — Le scrollbar droit apparaît quand le contenu dépasse le viewport → reflow de ~16px → flash "à droite".

#### Fix appliqué

**`future={{ v7_startTransition: true }}` sur `BrowserRouter` (App.tsx)** — fix principal.
Disponible depuis react-router-dom v6.8+ (projet en v6.26). Enveloppe toutes les navigations dans `startTransition` React 18 → React garde l'ancienne page visible jusqu'à ce que la nouvelle soit prête → le fallback Suspense n'est **jamais** montré pendant une transition.

```tsx
<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
```

**`fallback={null}` sur Suspense dans AppShell.tsx** — filet de sécurité. `PageLoader` skeleton supprimé.

**`scrollbarGutter: 'stable'` sur `<main>`** — réserve l'espace du scrollbar en permanence, élimine le layout shift.

**Suppression de toutes les animations mount par-item** :
- `DeviceTable.tsx` : `motion.tr` → `<tr>`, prop `(device, i)` → `(device)`
- `DeviceCard.tsx` : `motion.div` → `<div>`, prop `index` supprimée de l'interface et de l'appel dans `Devices.tsx`
- `Stock.tsx` : progress bar `motion.div width:0→X%` → `<div style={{ width }}>`  + map `(model, i)` → `(model)`
- `Orders.tsx` (PODetailDrawer) : `motion.div` stagger → `<div>`, `(device, i)` → `(device)`
- `DeviceDetail.tsx` : `motion.div` stagger écrans moniteur → `<div>`

**Préchauffage du cache TanStack Query pendant le splash** (`src/utils/dataPreload.ts` — nouveau fichier) :
- Exporte `setSharedQueryClient(client)` — appelé dans `main.tsx` après création du QueryClient
- Exporte `prefetchCriticalData()` — appelé dans `ProtectedRoute` en parallèle de `preloadCriticalRoutes()`
- Pré-charge 6 queries initiales (Phase 26) — étendu à 11 en Phase 27 (voir ci-dessous)
- Fail-open : toute erreur réseau swallowée — le splash ne bloque jamais sur une requête API

#### Règles à ne jamais enfreindre

- **Ne jamais** ajouter `motion.tr` / `motion.div` avec `initial: opacity 0` sur des éléments rendus en `.map()` — le stagger s'exécute à chaque montage de page
- **Ne jamais** retirer `future: { v7_startTransition: true }` de `BrowserRouter` — le flash revient immédiatement
- **Ne jamais** remettre un `fallback` visible (skeleton) dans le `<Suspense>` d'AppShell — avec startTransition il ne devrait jamais s'afficher, mais si c'est un composant non-null il flasherait sur les rares cas de chunk manquant

#### Fichiers créés / modifiés

| Fichier | Changement |
|---|---|
| `frontend/src/App.tsx` | `BrowserRouter future` flags + import/appel `prefetchCriticalData` |
| `frontend/src/components/layout/AppShell.tsx` | `fallback={null}` + `scrollbarGutter:stable` + suppression `PageLoader` |
| `frontend/src/utils/dataPreload.ts` | **Nouveau** — `setSharedQueryClient` + `prefetchCriticalData` |
| `frontend/src/main.tsx` | `setSharedQueryClient(queryClient)` après création client |
| `frontend/src/components/devices/DeviceTable.tsx` | `motion.tr` → `<tr>` |
| `frontend/src/components/devices/DeviceCard.tsx` | `motion.div` → `<div>`, prop `index` supprimée |
| `frontend/src/pages/Devices.tsx` | Retrait prop `index` du call `<DeviceCard>` |
| `frontend/src/pages/Stock.tsx` | Progress bar + `i` inutilisés supprimés |
| `frontend/src/pages/Orders.tsx` | `motion.div` stagger drawer supprimé |
| `frontend/src/pages/DeviceDetail.tsx` | `motion.div` stagger moniteur supprimé |

#### CSS — body background GPU layer

`body::before` → couleur plate uniquement (sans gradient). `body::after` → gradients sur layer GPU promu (`transform: translate3d(0,0,0)` + `will-change: transform`). Pas de `contain: strict` (fragmente le paint). Défini dans `frontend/src/styles/liquid-glass.css`.

---

### ✅ Phase 27 — Preload complet 11 queries + bouton retour glass + seam GPU pills (2026-04-22)

#### 1. dataPreload.ts — extension à 11 queries (zéro flash sur toutes les pages)

**Problème** : après la Phase 26, Stock et Rapports étaient flash-free mais Appareils, Commandes, Admin et Dashboard affichaient encore un Skeleton / micro-flash sur la 1re navigation. Cause : leurs queries n'étaient pas dans `dataPreload.ts`.

**Fix** : 5 queries ajoutées — total 11 prefetchées en parallèle pendant le splash :

| Query key | Page |
|---|---|
| `['stats']` | Dashboard |
| `['stock-summary']` | Stock › Inventaire + notifications |
| `['stockalerts']` | Stock › Règles alerte + notifications |
| `['maintenance-devices']` | Stock › Maintenance + notifications |
| `['retired-devices']` | Stock › Déchets + notifications |
| `['device-models']` | Dropdowns (actifs uniquement) |
| `['device-models-all']` | Commandes › Catalogue |
| `['devices', { page:1, limit:25, sortBy:'updatedAt', sortOrder:'desc', excludeStock:true, type:'LAPTOP', assigned:true }]` | Appareils (onglet LAPTOP par défaut) |
| `['orders']` | Commandes › onglet Commandes actives |
| `['orders-history']` | Commandes › Historique |
| `['users', '', '']` | Admin (recherche vide, tous rôles) |

**Règle critique query Appareils** : la clé `['devices', merged]` est construite par `useDevices()` en fusionnant `deviceStore.filters` (defaultFilters) avec `extraFilters`. Au 1er render : `{ page:1, limit:25, sortBy:'updatedAt', sortOrder:'desc', excludeStock:true, type:'LAPTOP', assigned:true }`. Le préfetch doit utiliser cet objet exact. TanStack Query v5 compare par sérialisation JSON stable (ordre alphabétique des clés) → l'ordre des propriétés ne compte pas.

**Comportement avec `staleTime: 0`** (orders-history, device-models-all) : même stale, si la donnée est en cache `isLoading = false` → rendu immédiat, background refetch silencieux. Pas de Skeleton.

**Règle** : toute nouvelle page qui affiche un Skeleton au 1er rendu DOIT avoir sa query dans `dataPreload.ts` avec la clé **identique** à celle du hook. Utiliser TanStack Query DevTools pour vérifier la clé exacte.

**Constante dans dataPreload.ts** :
```typescript
const DEVICES_LAPTOP_KEY = {
  page: 1, limit: 25, sortBy: 'updatedAt', sortOrder: 'desc',
  excludeStock: true, type: 'LAPTOP', assigned: true,
};
```
Doit rester synchronisée avec `deviceStore.ts` defaultFilters + Devices.tsx extraFilters.

---

#### 2. Bouton retour glass — Stock.tsx

Le bouton `ArrowLeft` au-dessus des tables de Stock.tsx était invisible (pas de bordure). Style glass appliqué identique au bouton retour de DeviceDetail (Phase 23) :
- `<button>` → `<motion.button>` avec `whileHover={{ scale: 1.05 }}` + `whileTap={{ scale: 0.95 }}`
- `background: 'var(--bg-glass)'`, `backdropFilter: 'var(--blur)'`, `border: '1px solid var(--border-glass)'`
- `boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20), 0 2px 8px rgba(0,0,0,0.10)'`
- Specular 0.20 (pas 0.12) pour les boutons icône compacts ≤32px

---

#### 3. Seam GPU — backdropFilter sur pills imbriqués

**Symptôme** : une barre verticale subtile apparaissait sur toute la hauteur de la page au hover sur les onglets/toggles de Appareils, Commandes, DeviceDetail, Settings. La page Stock n'était pas affectée (sa toggle-bar est plus étroite et ne franchit pas les frontières de tiles GPU ~512px).

**Cause racine** : Chromium crée un layer GPU compositor distinct pour chaque élément avec `backdrop-filter`. Les `motion.div` pills animées (layoutId) avaient `backdropFilter: 'blur(12px)'` ET étaient à l'intérieur d'un conteneur qui avait lui-même `backdrop-filter` (`.tabs-glass`, `.toggle-glass`, `.navbar-glass`, `.sidebar-glass`, `glass-card`). Deux layers GPU imbriqués → leurs frontières horizontales s'alignent sur les seams de tiles Chromium → barre visible.

**Fix** : suppression de `backdropFilter` / `WebkitBackdropFilter` sur tous les `motion.div` pills imbriqués. Le blur du conteneur suffit.

| Fichier | layoutId |
|---|---|
| `Devices.tsx` | `assign-labtype-pill`, `view-mode-pill`, `type-tab-bg` |
| `Orders.tsx` | `orders-tabs-pill` |
| `MobileNav.tsx` | `mobile-nav-pill` |
| `Sidebar.tsx` | `nav-pill` / `nav-pill-mobile` (via `ActivePill`) |
| `DeviceDetail.tsx` | `detail-tabs-pill` |
| `Settings.tsx` | `settings-theme-pill` |

**Règle définitive** : **ne jamais ajouter `backdropFilter` à un `motion.div` pill** (`layoutId`, `absolute inset-0`) quand il est enfant d'un conteneur avec `backdrop-filter`. Conserver uniquement `background`, `border`, `boxShadow`.

---

## En attente

- ⏳ App Registration Azure Entra ID (action admin IT Elkem requise)
- ⏳ Backend SSO : provisioning à la connexion + import employés Graph API
- ⏳ Page Login : bouton Microsoft uniquement en mode SSO
- ⏳ PWA polish (service worker, manifest, icônes complètes)
- ⏳ Page Dashboard — révision finale
- ⏳ Permissions VIEWER (Technicien Proximité) : restreindre création commande et modification règles d'alerte côté backend
