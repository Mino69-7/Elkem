import { Outlet } from 'react-router-dom';
import { Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MobileNav from './MobileNav';
import { useUIStore } from '../../stores/uiStore';

export default function AppShell() {
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  // Le preload de tous les chunks est garanti terminé avant que ce composant
  // monte : ProtectedRoute bloque sur AppLoadingSplash tant que preloadAllRoutes
  // n'est pas résolu. Donc ici, aucun Suspense fallback ne peut plus flasher.

  return (
    /* ─── Root : padding crée l'espace flottant autour de tout ─ */
    <div
      className="flex h-screen lg:p-3 lg:gap-3"
      style={{ background: 'transparent' }}
    >
      {/* ─── Sidebar desktop — flottante, arrondie ─────────────── */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* ─── Sidebar mobile (drawer overlay) ────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="lg:hidden fixed inset-0 z-30 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            {/* Drawer */}
            <motion.div
              className="lg:hidden fixed left-0 top-0 bottom-0 z-40"
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            >
              <Sidebar mobile onClose={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Zone principale — TopBar flottante + contenu arrondi ── */}
      <div className="flex-1 flex flex-col min-w-0 lg:gap-3">
        <TopBar />

        <main
          className="flex-1 overflow-y-auto overflow-x-hidden pb-16 lg:pb-0 lg:rounded-[20px]"
          style={{ scrollbarGutter: 'stable' }}
          id="main-content"
          aria-label="Contenu principal"
        >
          {/*
            ⚠ PAS de motion.div ici.
            - Un wrapper animé crée un stacking context (transform) → seam
              GPU sur les .glass-card enfants à chaque navigation.
            - Une SPA doit naviguer INSTANTANÉMENT. Les chunks sont preloadés
              (useRoutePreload) → la page suivante est déjà en mémoire.
            Rendu direct = zéro flash, zéro compositor artifact, zéro latence.
          */}
          {/*
            v7_startTransition sur BrowserRouter → React garde l'ancienne page
            visible pendant la transition. Le fallback ici ne devrait JAMAIS
            s'afficher à la navigation (startTransition supprime le Suspense
            pendant les transitions). On met null comme filet de sécurité.
          */}
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
