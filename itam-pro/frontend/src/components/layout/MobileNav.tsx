import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Laptop, Package, ShieldCheck, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';

const MOBILE_NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/devices',   icon: Laptop,          label: 'Appareils' },
  { to: '/stock',     icon: Package,         label: 'Stock' },
  { to: '/users',     icon: ShieldCheck,     label: 'Admin' },
  { to: '/reports',   icon: BarChart3,       label: 'Rapports' },
];

export default function MobileNav() {
  return (
    /* Flottante : ne touche pas les bords, arrondie */
    <nav
      className="navbar-glass lg:hidden fixed bottom-3 left-3 right-3 z-30 rounded-[22px]"
      style={{
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
      }}
      aria-label="Navigation mobile"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => clsx(
                'relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors duration-150',
                isActive ? 'text-primary' : 'text-[var(--text-muted)]'
              )}
              aria-label={item.label}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-xl"
                      layoutId="mobile-nav-pill"
                      style={{
                        background: 'rgba(99, 102, 241, 0.13)',
                        border: '1px solid rgba(99, 102, 241, 0.22)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.40)',
                      }}
                      transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                    />
                  )}
                  <Icon size={20} className="relative z-10" />
                  <span className="text-[10px] font-medium relative z-10">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
