import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Laptop, Package, RefreshCw,
  BarChart3, Settings, LogOut, ChevronLeft, ChevronRight,
  Moon, Sun, X, ShoppingCart, BookUser, ShieldCheck
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import * as Tooltip from '@radix-ui/react-tooltip';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/devices',   icon: BookUser,        label: 'Utilisateurs' },
  { to: '/stock',     icon: Package,         label: 'Stock' },
  { to: '/orders',    icon: ShoppingCart,    label: 'Commandes' },
  { to: '/users',     icon: ShieldCheck,     label: 'Admin' },
  { to: '/intune',    icon: RefreshCw,       label: 'Sync Intune' },
  { to: '/reports',   icon: BarChart3,       label: 'Rapports' },
];

interface SidebarProps {
  /** Mode drawer mobile — toujours étendu, sans bouton collapse */
  mobile?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobile = false, onClose }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebarCollapse, theme, toggleTheme } = useUIStore();
  const { user, logout } = useAuthStore();
  const location = useLocation();

  // En mode mobile le drawer est toujours étendu
  const collapsed = mobile ? false : sidebarCollapsed;
  const sidebarWidth = collapsed ? 64 : 240;

  const handleNavClick = () => {
    if (mobile) onClose?.();
  };

  return (
    <Tooltip.Provider delayDuration={200}>
      <motion.aside
        className={clsx(
          'flex flex-col flex-shrink-0 h-screen overflow-hidden border-r border-[var(--border-glass)]',
          mobile ? 'flex z-40' : 'hidden lg:flex relative z-20'
        )}
        style={{ background: 'var(--bg-secondary)' }}
        animate={{ width: sidebarWidth }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        aria-label="Navigation principale"
      >
        {/* ─── Header logo ─────────────────────────────────── */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-[var(--border-glass)] flex-shrink-0">
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
                  className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex-shrink-0 flex items-center justify-center"
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
                className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center mx-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                aria-hidden="true"
              >
                <Laptop size={16} className="text-white" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bouton fermer (mobile) ou collapse (desktop) */}
          {mobile ? (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors flex-shrink-0"
              aria-label="Fermer le menu"
            >
              <X size={16} />
            </button>
          ) : (
            <button
              onClick={toggleSidebarCollapse}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors flex-shrink-0"
              aria-label={collapsed ? 'Agrandir la sidebar' : 'Réduire la sidebar'}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          )}
        </div>

        {/* ─── Profil utilisateur ──────────────────────────── */}
        {!collapsed && (
          <motion.div
            className="px-4 py-3 border-b border-[var(--border-glass)] flex-shrink-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                aria-hidden="true"
              >
                {user?.displayName?.charAt(0) ?? 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {user?.displayName ?? 'Utilisateur'}
                </p>
                <p className="text-xs text-[var(--text-muted)] truncate">
                  {user?.role ?? 'VIEWER'} · {user?.department ?? 'IT'}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Navigation ──────────────────────────────────── */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto" aria-label="Menu principal">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            const Icon = item.icon;

            if (collapsed) {
              return (
                <Tooltip.Root key={item.to}>
                  <Tooltip.Trigger asChild>
                    <NavLink
                      to={item.to}
                      onClick={handleNavClick}
                      className={clsx(
                        'flex items-center justify-center w-full h-10 rounded-xl transition-all duration-200',
                        isActive
                          ? 'bg-primary/15 text-primary'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
                      )}
                      aria-label={item.label}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon size={18} />
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
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {isActive && (
                  <motion.div
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                    layoutId={mobile ? 'activeIndicatorMobile' : 'activeIndicator'}
                    aria-hidden="true"
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* ─── Section basse ───────────────────────────────── */}
        <div className="px-2 py-3 border-t border-[var(--border-glass)] space-y-1 flex-shrink-0">
          <NavLink
            to="/settings"
            onClick={handleNavClick}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-primary/15 text-primary'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
            )}
            aria-label="Paramètres"
          >
            <Settings size={18} />
            {!collapsed && <span>Paramètres</span>}
          </NavLink>

          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all duration-200"
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
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/5 transition-all duration-200"
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
