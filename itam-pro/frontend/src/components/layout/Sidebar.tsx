import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Laptop, Package, RefreshCw,
  BarChart3, Settings, LogOut, ChevronLeft, ChevronRight,
  Moon, Sun, X, ShoppingCart, ShieldCheck
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useStockNotifications } from '../../hooks/useStockNotifications';
import * as Tooltip from '@radix-ui/react-tooltip';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/devices',   icon: Laptop,          label: 'Appareils' },
  { to: '/stock',     icon: Package,         label: 'Stock' },
  { to: '/orders',    icon: ShoppingCart,    label: 'Commandes' },
  { to: '/users',     icon: ShieldCheck,     label: 'Admin' },
  { to: '/intune',    icon: RefreshCw,       label: 'Sync Intune' },
  { to: '/reports',   icon: BarChart3,       label: 'Rapports' },
];

/* Pill animée derrière l'item actif */
const ActivePill = ({ layoutId }: { layoutId: string }) => (
  <motion.div
    className="absolute inset-0 rounded-xl"
    layoutId={layoutId}
    style={{
      background: 'rgba(99, 102, 241, 0.13)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(99, 102, 241, 0.22)',
      boxShadow:
        'inset 0 1px 0 rgba(255,255,255,0.40), 0 2px 10px rgba(99,102,241,0.18)',
    }}
    transition={{ type: 'spring', stiffness: 480, damping: 36 }}
  />
);

interface SidebarProps {
  mobile?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobile = false, onClose }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebarCollapse, theme, toggleTheme } = useUIStore();
  const { logout } = useAuthStore();
  const { totalCount: stockNotifCount } = useStockNotifications();
  const location = useLocation();

  const collapsed = mobile ? false : sidebarCollapsed;
  const sidebarWidth = collapsed ? 64 : 240;

  const fromState = (location.state as { from?: string } | null)?.from;
  const isDeviceDetail = /^\/devices\/[a-zA-Z0-9-]+$/.test(location.pathname);
  const effectivePath = isDeviceDetail && fromState ? fromState : location.pathname;

  const handleNavClick = () => { if (mobile) onClose?.(); };

  /* layoutId de la pill — séparé entre mobile et desktop pour éviter
     les conflits Framer Motion quand les deux existent simultanément */
  const pillId = mobile ? 'nav-pill-mobile' : 'nav-pill';

  return (
    <Tooltip.Provider delayDuration={200}>
      <motion.aside
        className={clsx(
          'sidebar-glass flex flex-col flex-shrink-0 overflow-hidden',
          /* Desktop flottant : arrondi, ne touche pas les bords (le parent a p-3) */
          mobile
            ? 'h-screen rounded-none'
            : 'h-full rounded-[28px]'
        )}
        animate={{ width: sidebarWidth }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        aria-label="Navigation principale"
      >
        {/* ─── Header logo ──────────────────────────────────────── */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-[var(--glass-border)] flex-shrink-0">
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                key="logo-full"
                className="flex items-center gap-3 overflow-hidden"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex-shrink-0 flex items-center justify-center shadow-lg"
                  aria-hidden="true"
                >
                  <Laptop size={16} className="text-white" />
                </div>
                <span className="font-bold text-[var(--text-primary)] whitespace-nowrap">ITAM Pro</span>
              </motion.div>
            )}
            {collapsed && (
              <motion.div
                key="logo-icon"
                className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center mx-auto shadow-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                aria-hidden="true"
              >
                <Laptop size={16} className="text-white" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bouton fermer / collapse */}
          {mobile ? (
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-200 flex-shrink-0"
              style={{
                background: 'var(--bg-glass)',
                backdropFilter: 'var(--blur)',
                WebkitBackdropFilter: 'var(--blur)',
                border: '1px solid var(--border-glass)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20), 0 2px 8px rgba(0,0,0,0.10)',
              }}
              aria-label="Fermer le menu"
            >
              <X size={16} />
            </motion.button>
          ) : (
            <motion.button
              onClick={toggleSidebarCollapse}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-200 flex-shrink-0"
              style={{
                background: 'var(--bg-glass)',
                backdropFilter: 'var(--blur)',
                WebkitBackdropFilter: 'var(--blur)',
                border: '1px solid var(--border-glass)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20), 0 2px 8px rgba(0,0,0,0.10)',
              }}
              aria-label={collapsed ? 'Agrandir la sidebar' : 'Réduire la sidebar'}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </motion.button>
          )}
        </div>


        {/* ─── Navigation ────────────────────────────────────────── */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto" aria-label="Menu principal">
          {NAV_ITEMS.map((item) => {
            const isActive = effectivePath.startsWith(item.to);
            const Icon = item.icon;
            const badgeCount = item.to === '/stock' ? stockNotifCount : 0;

            if (collapsed) {
              return (
                <Tooltip.Root key={item.to}>
                  <Tooltip.Trigger asChild>
                    <NavLink
                      to={item.to}
                      onClick={handleNavClick}
                      className="relative flex items-center justify-center w-full h-10 rounded-xl"
                      style={{
                        color: isActive ? 'var(--color-primary)' : 'var(--text-muted)',
                      }}
                      aria-label={item.label}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {isActive && <ActivePill layoutId={pillId} />}
                      <Icon size={18} className="relative z-10" />
                      {badgeCount > 0 && (
                        <span
                          className="absolute top-1 right-1 min-w-[14px] h-3.5 px-0.5 rounded-full text-[8px] font-bold text-white flex items-center justify-center z-20"
                          style={{
                            background: 'rgba(99,102,241,0.80)',
                            backdropFilter: 'blur(4px)',
                            WebkitBackdropFilter: 'blur(4px)',
                            border: '1px solid rgba(139,120,255,0.55)',
                            boxShadow: '0 2px 6px rgba(99,102,241,0.35)',
                          }}
                        >
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                    </NavLink>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="right"
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white z-50"
                      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
                    >
                      {item.label}
                      <Tooltip.Arrow className="fill-black/80" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={handleNavClick}
                className={clsx(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'text-primary'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && <ActivePill layoutId={pillId} />}
                <Icon size={18} className="relative z-10 flex-shrink-0" />
                <span className="relative z-10 flex-1">{item.label}</span>
                {badgeCount > 0 && (
                  <span
                    className="relative z-10 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[9px] font-bold text-white leading-none"
                    style={{
                      background: 'rgba(99,102,241,0.70)',
                      backdropFilter: 'blur(4px)',
                      WebkitBackdropFilter: 'blur(4px)',
                      border: '1px solid rgba(139,120,255,0.55)',
                      boxShadow: '0 2px 6px rgba(99,102,241,0.28)',
                    }}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* ─── Section basse ─────────────────────────────────────── */}
        <div className="px-2 py-3 border-t border-[var(--glass-border)] space-y-0.5 flex-shrink-0">
          <NavLink
            to="/settings"
            onClick={handleNavClick}
            className={({ isActive }) => clsx(
              'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150',
              isActive
                ? 'text-primary'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
            aria-label="Paramètres"
          >
            {({ isActive }) => (
              <>
                {isActive && <ActivePill layoutId={pillId} />}
                <Settings size={18} className="relative z-10 flex-shrink-0" />
                {!collapsed && <span className="relative z-10">Paramètres</span>}
              </>
            )}
          </NavLink>

          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/6 transition-colors duration-150"
            aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {!collapsed && (
              <span className="flex-1 text-left">
                {theme === 'dark' ? 'Mode clair' : 'Mode nuit'}
              </span>
            )}
          </button>

          <button
            onClick={() => { logout(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/8 transition-colors duration-150"
            aria-label="Se déconnecter"
          >
            <LogOut size={18} />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </motion.aside>
    </Tooltip.Provider>
  );
}
