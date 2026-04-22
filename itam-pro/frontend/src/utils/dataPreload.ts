/**
 * Préfetch des queries critiques — piloté pendant le splash post-authentification.
 *
 * Le preload de routes (routePreload.ts) élimine le Suspense fallback.
 * Mais au 1er rendu d'une page, TanStack Query n'a rien en cache → `isLoading=true`
 * → chaque page affiche ses Skeleton / cards blanches pendant 200-600ms (cache miss +
 * latence réseau) avant que le vrai contenu arrive. C'est le "microflash" perçu
 * par l'utilisateur sur la 1re navigation de chaque page.
 *
 * Solution : on pré-chauffe les queries de TOUTES les pages DANS le splash, en
 * parallèle du chargement des chunks. Quand le splash sort, les caches sont tous
 * "hot" → toute page visitée pour la 1re fois a ses données déjà prêtes → rendu
 * direct, zéro Skeleton visible.
 *
 * Mémoïsée : appeler 10 fois = 1 seul Promise.allSettled (idempotent).
 */

import type { QueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { deviceService } from '../services/device.service';
import { purchaseOrderService } from '../services/purchaseOrder.service';
import { userService } from '../services/user.service';

let sharedQueryClient: QueryClient | null = null;
let prefetchPromise: Promise<unknown> | null = null;

/**
 * Exposé depuis main.tsx au moment de la création du QueryClient.
 * Permet d'accéder au même client depuis ce module (hors React).
 */
export function setSharedQueryClient(client: QueryClient): void {
  sharedQueryClient = client;
}

/**
 * Prefetche TOUTES les queries visibles sur les pages principales.
 *
 * Règle : toute page qui affiche un Skeleton ou un état isLoading au 1er rendu
 * doit avoir sa query (ou ses queries) listée ici avec la clé EXACTE qu'utilise
 * le hook TanStack Query correspondant.
 *
 * Clés preloadées et pages associées :
 *   ['stats']                  → Dashboard (KPIs, graphiques)
 *   ['stock-summary']          → Stock › Inventaire + notifications sidebar/topbar
 *   ['stockalerts']            → Stock › Règles alerte + notifications
 *   ['maintenance-devices']    → Stock › Maintenance + notifications
 *   ['retired-devices']        → Stock › Déchets + notifications
 *   ['device-models']          → Dropdowns partout (actifs uniquement)
 *   ['devices', laptopDefaults]→ Appareils, onglet LAPTOP par défaut
 *   ['orders']                 → Commandes › Onglet Commandes (actives)
 *   ['orders-history']         → Commandes › Historique
 *   ['device-models-all']      → Commandes › Catalogue (actifs + inactifs)
 *   ['users', '', '']          → Admin, recherche vide, tous rôles
 *
 * Fail-open : toute erreur réseau est swallowée — le splash ne doit JAMAIS
 * bloquer à cause d'une query. Le Skeleton de la page prendra le relais.
 */

/** Filtres par défaut de deviceStore — doit rester synchronisé avec stores/deviceStore.ts */
const DEFAULT_DEVICES_FILTERS = {
  page: 1,
  limit: 25,
  sortBy: 'updatedAt' as const,
  sortOrder: 'desc' as const,
  excludeStock: true,
};

/** Query key utilisée par Devices.tsx au 1er rendu (activeTab = 'LAPTOP', assigned = true) */
const DEVICES_LAPTOP_KEY = {
  ...DEFAULT_DEVICES_FILTERS,
  type: 'LAPTOP' as const,
  assigned: true,
};

export function prefetchCriticalData(): Promise<unknown> {
  if (prefetchPromise) return prefetchPromise;
  if (!sharedQueryClient) {
    return Promise.resolve();
  }
  const qc = sharedQueryClient;

  prefetchPromise = Promise.allSettled([

    // ── Dashboard ─────────────────────────────────────────────────────
    qc.prefetchQuery({
      queryKey: ['stats'],
      queryFn: () => api.get('/stats').then((r) => r.data),
      staleTime: 60_000,
    }),

    // ── Stock (tous les onglets) + notifications ───────────────────────
    qc.prefetchQuery({
      queryKey: ['stock-summary'],
      queryFn: () => api.get('/devicemodels/stock-summary').then((r) => r.data),
      staleTime: 30_000,
    }),
    qc.prefetchQuery({
      queryKey: ['stockalerts'],
      queryFn: () => api.get('/stockalerts').then((r) => r.data),
      staleTime: 30_000,
    }),
    qc.prefetchQuery({
      queryKey: ['maintenance-devices'],
      queryFn: () =>
        api
          .get('/devices?status=IN_MAINTENANCE&limit=200&sortBy=updatedAt&sortOrder=desc')
          .then((r) => r.data),
      staleTime: 30_000,
    }),
    qc.prefetchQuery({
      queryKey: ['retired-devices'],
      queryFn: () =>
        api
          .get('/devices?statuses=RETIRED,LOST,STOLEN&limit=200&sortBy=updatedAt&sortOrder=desc')
          .then((r) => r.data),
      staleTime: 30_000,
    }),

    // ── Dropdowns globaux ──────────────────────────────────────────────
    qc.prefetchQuery({
      queryKey: ['device-models'],
      queryFn: () => api.get('/devicemodels').then((r) => r.data),
      staleTime: 60_000,
    }),
    qc.prefetchQuery({
      queryKey: ['device-models-all'],
      queryFn: () => api.get('/devicemodels/all').then((r) => r.data),
      staleTime: 60_000,
    }),

    // ── Page Appareils — onglet LAPTOP par défaut ──────────────────────
    // queryKey doit correspondre EXACTEMENT à ['devices', merged] dans useDevices()
    // où merged = { ...defaultFilters, type: 'LAPTOP', assigned: true }
    qc.prefetchQuery({
      queryKey: ['devices', DEVICES_LAPTOP_KEY],
      queryFn: () => deviceService.list(DEVICES_LAPTOP_KEY),
      staleTime: 30_000,
    }),

    // ── Page Commandes ─────────────────────────────────────────────────
    qc.prefetchQuery({
      queryKey: ['orders'],
      queryFn: purchaseOrderService.list,
      staleTime: 30_000,
    }),
    qc.prefetchQuery({
      queryKey: ['orders-history'],
      queryFn: purchaseOrderService.history,
      staleTime: 30_000,
    }),

    // ── Page Admin ─────────────────────────────────────────────────────
    // queryKey = ['users', search, role] dans Users.tsx, initialisés à ''
    qc.prefetchQuery({
      queryKey: ['users', '', ''],
      queryFn: () => userService.list({ search: '', role: '' }),
      staleTime: 30_000,
    }),

  ]);

  return prefetchPromise;
}

export function __resetPrefetchForTests(): void {
  prefetchPromise = null;
}
