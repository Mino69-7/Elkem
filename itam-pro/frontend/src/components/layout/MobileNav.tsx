import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Laptop, Package, Users, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';

const MOBILE_NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/devices',   icon: Laptop,          label: 'Appareils' },
  { to: '/stock',     icon: Package,         label: 'Stock' },
  { to: '/users',     icon: Users,           label: 'Utilisateurs' },
  { to: '/reports',   icon: BarChart3,       label: 'Rapports' },
];

/**
 * Navigation bas de page pour mobile (<768px).
 */
export default function MobileNav() {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border-glass)]"
      style={{
        background: 'var(--bg-secondary)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
      aria-label="Navigation mobile"
    >
      <div className="flex items-center justify-around h-16 px-2 safe-area-inset-bottom">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => clsx(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200',
                isActive
                  ? 'text-primary'
                  : 'text-[var(--text-muted)]'
              )}
              aria-label={item.label}
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" aria-hidden="true" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
