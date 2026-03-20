import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, Menu, LogOut, X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useDeviceStore } from '../../stores/deviceStore';
import { useAuth } from '../../hooks/useAuth';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export default function TopBar() {
  const { toggleSidebar, unreadCount } = useUIStore();
  const { setFilters } = useDeviceStore();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');

  const applySearch = (value: string) => {
    const q = value.trim();
    setFilters({ search: q || undefined, page: 1 });
    if (q) navigate('/devices');
  };

  const clearSearch = () => {
    setSearch('');
    setFilters({ search: undefined, page: 1 });
  };

  return (
    <header
      className="h-16 flex items-center gap-4 px-4 lg:px-6 border-b border-[var(--border-glass)] flex-shrink-0"
      style={{ background: 'var(--bg-secondary)' }}
      role="banner"
    >
      {/* Hamburger mobile */}
      <button
        className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
        onClick={toggleSidebar}
        aria-label="Ouvrir le menu"
      >
        <Menu size={20} />
      </button>

      {/* Recherche globale */}
      <div className="flex-1 max-w-md">
        <form
          onSubmit={(e) => { e.preventDefault(); applySearch(search); }}
          role="search"
        >
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') clearSearch();
              }}
              placeholder="Rechercher un appareil, utilisateur..."
              className="input-glass pl-9 pr-8 py-2 text-sm w-full"
              aria-label="Recherche globale"
            />
            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Effacer la recherche"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="flex-1" aria-hidden="true" />

      {/* Notifications */}
      <button
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center"
            aria-hidden="true"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Avatar + dropdown */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
            aria-label={`Profil de ${user?.displayName ?? 'Utilisateur'}`}
          >
            <div
              className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-sm font-semibold"
              aria-hidden="true"
            >
              {user?.displayName?.charAt(0) ?? 'U'}
            </div>
            <span className="hidden sm:block text-sm font-medium text-[var(--text-primary)] max-w-[120px] truncate">
              {user?.displayName ?? 'Utilisateur'}
            </span>
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-48 rounded-xl p-1.5 z-50"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-glass)',
              backdropFilter: 'blur(20px)',
              boxShadow: 'var(--shadow-glass)',
            }}
            sideOffset={8}
            align="end"
          >
            <div className="px-3 py-2 mb-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">{user?.displayName}</p>
              <p className="text-xs text-[var(--text-muted)]">{user?.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-medium">
                {user?.role}
              </span>
            </div>
            <DropdownMenu.Separator className="h-px my-1" style={{ background: 'var(--border-glass)' }} />
            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 cursor-pointer outline-none transition-colors"
              onClick={logout}
            >
              <LogOut size={14} aria-hidden="true" />
              Déconnexion
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </header>
  );
}
