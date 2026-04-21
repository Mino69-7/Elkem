import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { lazy, Suspense } from 'react';
import { useUIStore } from './stores/uiStore';
import { useAuthStore } from './stores/authStore';
import AppShell from './components/layout/AppShell';
import AppLoadingSplash from './components/layout/AppLoadingSplash';
import {
  preloadCriticalRoutes,
  preloadSecondaryRoutes,
  isCriticalPreloadComplete,
} from './utils/routePreload';
import { prefetchCriticalData } from './utils/dataPreload';

// Timing splash post-authentification.
// MIN : perception de marque (éviter un flash « invisible »). 800ms = sweet spot UX.
// MAX : guillotine absolue. Le preload charge 9 chunks en parallèle avant de
//       sortir → sur LAN Elkem ~1.5-2s typique. 5s = marge confortable pour
//       connexion dégradée sans frustrer l'utilisateur. Au-delà, fail-open et
//       Suspense prendra le relais page par page.
const MIN_SPLASH_DISPLAY_MS = 800;
const MAX_SPLASH_DISPLAY_MS = 5000;

const Login = lazy(() => import('./pages/Login'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Devices = lazy(() => import('./pages/Devices'));
const DeviceDetailPage = lazy(() => import('./pages/DeviceDetail'));
const Stock = lazy(() => import('./pages/Stock'));
const Users = lazy(() => import('./pages/Users'));
const IntuneSync = lazy(() => import('./pages/IntuneSync'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Orders = lazy(() => import('./pages/Orders'));

/**
 * Route protégée — garde l'app bloquée sur AppLoadingSplash tant que TOUS
 * les chunks de pages ne sont pas dans le cache. Quand le splash disparaît,
 * navigation instantanée garantie sur toutes les pages (aucun Suspense
 * fallback ne peut plus être déclenché).
 *
 * Couvre 2 scénarios :
 *   1. Après login : navigate('/dashboard') déclenché par useAuth → ici →
 *      splash le temps du preload → AppShell.
 *   2. F5 direct sur une route auth : token persisté → isAuthenticated=true
 *      → ici → splash le temps du preload → AppShell.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  // Si le preload critique est déjà terminé (navigation interne après 1er login,
  // retour sur une route protégée depuis /login sans refresh), skip direct.
  const [isReady, setIsReady] = useState(isCriticalPreloadComplete());

  useEffect(() => {
    if (!isAuthenticated || isReady) return;
    let cancelled = false;

    // 3 courses en parallèle :
    //   - preloadCriticalRoutes() : la vérité (chunks en cache)
    //   - minDelay : garantit 800ms d'exposition splash (perception marque)
    //   - maxDelay : guillotine 3s (fail-open)
    // On attend `Promise.all([critical, minDelay])` ET on race avec `maxDelay`.
    const minDelay = new Promise<void>((res) => setTimeout(res, MIN_SPLASH_DISPLAY_MS));
    const maxDelay = new Promise<void>((res) => setTimeout(res, MAX_SPLASH_DISPLAY_MS));

    // Préchauffage cache données : parallèle aux chunks. Fail-open — on ne bloque
    // jamais le splash sur une requête API (le Skeleton prendra le relais sinon).
    const criticalThenMin = Promise.all([
      preloadCriticalRoutes().catch(() => { /* fail-open : on sort quand même */ }),
      prefetchCriticalData().catch(() => { /* fail-open : cache vide → Skeleton */ }),
      minDelay,
    ]).then(() => undefined);

    Promise.race([criticalThenMin, maxDelay]).then(() => {
      if (cancelled) return;
      setIsReady(true);
      // Phase 2 non-bloquante : préfetch toutes les autres routes en idle.
      // Sûr car preloadSecondaryRoutes est idempotent (mémoïsé).
      preloadSecondaryRoutes();
    });

    return () => { cancelled = true; };
  }, [isAuthenticated, isReady]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isReady) return <AppLoadingSplash />;
  return <>{children}</>;
}

export default function App() {
  const { theme } = useUIStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Routes publiques — Suspense local pour Login/AuthCallback */}
        <Route path="/login" element={<Suspense fallback={null}><Login /></Suspense>} />
        <Route path="/auth/callback" element={<Suspense fallback={null}><AuthCallback /></Suspense>} />

        {/* Routes protégées — Suspense géré dans AppShell */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="devices" element={<Devices />} />
          <Route path="devices/:id" element={<DeviceDetailPage />} />
          <Route path="stock" element={<Stock />} />
          <Route path="orders" element={<Orders />} />
          <Route path="users" element={<Users />} />
          <Route path="intune" element={<IntuneSync />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
