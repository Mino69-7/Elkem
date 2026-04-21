/**
 * Preload de TOUTES les routes — piloté post-authentification.
 *
 * Décision (2026-04-21) : on charge TOUS les chunks avant de sortir du splash,
 * en parallèle. Une phase « secondaire en idle » après sortie du splash laissait
 * une fenêtre de 500ms-2s où un clic utilisateur rapide tombait sur un chunk
 * non encore en cache → Suspense fallback (PageLoader skeleton) visible =
 * micro-flash que l'utilisateur observait sur chaque 1re visite de page.
 *
 * Comportement désormais équivalent à « j'ai déjà visité chaque page » dès le
 * 1er rendu : les 9 chunks sont tous dans le cache du module registry quand le
 * splash disparaît → React.lazy résout la promise synchroniquement → zéro
 * Suspense fallback, zéro flash.
 *
 * Coût : splash qui reste ~1.5-2s sur LAN (vs ~800ms avant). En contrepartie :
 * navigation 100% instantanée dès la 1re utilisation. Trade-off assumé.
 *
 * AppShell / Sidebar / TopBar / MobileNav sont déjà importés synchroniquement
 * par App.tsx → ils sont dans le bundle initial, pas besoin de les preload ici.
 *
 * IMPORTANT : aucun appel ne doit être fait AVANT authentification.
 */

let criticalPromise: Promise<unknown[]> | null = null;
let criticalDone = false;

/**
 * Charge en parallèle TOUS les chunks de pages accessibles à un user connecté.
 * À awaiter par le splash — quand la promesse résout, plus aucune page ne
 * pourra déclencher un Suspense fallback à la navigation.
 *
 * Mémoïsée : appeler 10 fois = 1 seul Promise.all (safe).
 *
 * Dans ITAM Pro, tous les rôles (MANAGER / TECHNICIAN / VIEWER) ont accès aux
 * mêmes routes côté UI — la différenciation se fait côté backend via
 * requireRole. Si plus tard certaines routes sont gated côté front, filtrer
 * cette liste en fonction du rôle utilisateur.
 */
export function preloadCriticalRoutes(): Promise<unknown[]> {
  if (criticalPromise) return criticalPromise;

  criticalPromise = Promise.all([
    import('../pages/Dashboard'),
    import('../pages/Devices'),
    import('../pages/DeviceDetail'),
    import('../pages/Stock'),
    import('../pages/Orders'),
    import('../pages/Users'),
    import('../pages/IntuneSync'),
    import('../pages/Reports'),
    import('../pages/Settings'),
  ]).then(
    (mods) => {
      criticalDone = true;
      return mods;
    },
    (err) => {
      // Fail-open : on reset pour permettre un retry. Le splash applique sa
      // guillotine MAX → l'utilisateur ne reste pas bloqué, et le premier
      // Suspense fallback prendra le relais si un chunk est toujours manquant.
      criticalPromise = null;
      throw err;
    }
  );

  return criticalPromise;
}

/**
 * Kept pour compat API — ancienne phase 2. Désormais no-op puisque
 * preloadCriticalRoutes() charge déjà tout. Safe à laisser les call sites
 * existants (App.tsx) en place : la fonction ne fait plus rien.
 */
export function preloadSecondaryRoutes(): void {
  // no-op intentionnel — conservé pour éviter les breaking changes d'imports.
}

export function isCriticalPreloadComplete(): boolean {
  return criticalDone;
}

/**
 * Utilitaire pour tests / debug — reset l'état module.
 * Ne pas utiliser en prod.
 */
export function __resetPreloadForTests(): void {
  criticalPromise = null;
  criticalDone = false;
}
