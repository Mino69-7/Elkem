import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MobileNav from './MobileNav';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Coquille principale de l'application.
 * La protection auth est assurée par ProtectedRoute dans App.tsx.
 */
export default function AppShell() {

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <TopBar />

        <main
          className="flex-1 overflow-y-auto pb-16 lg:pb-0"
          id="main-content"
          aria-label="Contenu principal"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
