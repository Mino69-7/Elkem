/**
 * Préfetch des queries critiques — piloté pendant le splash post-authentification.
 *
 * Le preload de routes (routePreload.ts) élimine le Suspense fallback.
 * Mais au 1er rendu d'une page, TanStack Query n'a rien en cache → `isLoading=true`
 * → chaque page affiche ses Skeleton / cards blanches pendant 200-600ms (cache miss +
 * latence réseau) avant que le vrai contenu arrive. C'est le "microflash" perçu
 * par l'utilisateur sur la 1re navigation de chaque page.
 *
 * Solution : on pré-chauffe les queries les plus vues DANS le splash, en parallèle
 * du chargement des chunks. Quand le splash sort, les caches sont tous "hot" →
 * toute page visitée pour la 1re fois a ses données déjà prêtes → rendu direct,
 * zéro Skeleton visible.
 *
 * Mémoïsée : appeler 10 fois = 1 seul Promise.all (idempotent).
 */

import type { QueryClient } from '@tanstack/react-query';
import api from '../services/api';

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
 * Prefetche toutes les queries critiques visibles sur les pages principales.
 *
 * Choix des clés — celles qui feraient un cache-miss visible à la 1re visite :
 *   - `['stats']`              → Dashboard (KPIs, graphs)
 *   - `['stock-summary']`      → Stock (cartes par modèle) + notifications
 *   - `['stockalerts']`        → Notifications TopBar + Règles alerte
 *   - `['maintenance-devices']`→ Stock › Maintenance + notifications
 *   - `['retired-devices']`    → Stock › Déchets + notifications
 *   - `['device-models']`      → Notifications + dropdowns Orders
 *
 * Les pages `/devices` et `/users` ne sont pas préfetchées : leurs queries sont
 * paginées et paramétrées (type actif, filtres) → prefetch donnerait un set qui
 * ne correspond pas à ce que l'utilisateur verra effectivement → cache-miss
 * quand même au 1er click. Laissons ces pages fetch au mount.
 *
 * Fail-open : toute erreur réseau est swallowée — le splash ne doit JAMAIS
 * bloquer à cause d'une query. Le Skeleton de la page prendra le relais.
 */
export function prefetchCriticalData(): Promise<unknown> {
  if (prefetchPromise) return prefetchPromise;
  if (!sharedQueryClient) {
    // Si main.tsx n'a pas encore wiré le client (ne devrait pas arriver), no-op.
    return Promise.resolve();
  }
  const qc = sharedQueryClient;

  prefetchPromise = Promise.allSettled([
    qc.prefetchQuery({
      queryKey: ['stats'],
      queryFn: () => api.get('/stats').then((r) => r.data),
      staleTime: 60_000,
    }),
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
    qc.prefetchQuery({
      queryKey: ['device-models'],
      queryFn: () => api.get('/devicemodels').then((r) => r.data),
      staleTime: 60_000,
    }),
  ]);

  return prefetchPromise;
}

export function __resetPrefetchForTests(): void {
  prefetchPromise = null;
}
