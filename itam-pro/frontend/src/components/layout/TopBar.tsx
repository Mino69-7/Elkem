import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Search, Menu, LogOut, X, Loader2,
  Laptop, Smartphone, Monitor, Package, User,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useDeviceStore } from '../../stores/deviceStore';
import { useAuth } from '../../hooks/useAuth';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import api from '../../services/api';
import type { Device, DeviceType, DeviceStatus } from '../../types';

// ─── Types ────────────────────────────────────────────────────

interface UserResult {
  id:          string;
  displayName: string;
  email:       string;
}

interface SearchResults {
  devices: Device[];
  users:   UserResult[];
}

// ─── Helpers ──────────────────────────────────────────────────

const STATUS_TAG: Partial<Record<DeviceStatus, { label: string; cls: string }>> = {
  // ── Page Utilisateurs (/devices) ──────────────────────────────────────────
  ASSIGNED:       { label: 'Actif',        cls: 'bg-emerald-500/15 text-emerald-400' },
  LOANER:         { label: 'Actif',        cls: 'bg-emerald-500/15 text-emerald-400' },
  PENDING_RETURN: { label: 'À récupérer',  cls: 'bg-amber-500/15  text-amber-400'   },
  // ── Stock › Inventaire ────────────────────────────────────────────────────
  IN_STOCK:       { label: 'Stock',        cls: 'bg-indigo-500/12 text-indigo-400'  },
  ORDERED:        { label: 'Stock',        cls: 'bg-indigo-500/12 text-indigo-400'  },
  // ── Stock › Maintenance ───────────────────────────────────────────────────
  IN_MAINTENANCE: { label: 'Maintenance',  cls: 'bg-orange-500/15 text-orange-400'  },
  // ── Stock › Déchets ───────────────────────────────────────────────────────
  RETIRED:        { label: 'Déchet',       cls: 'bg-red-500/15    text-red-400'     },
  LOST:           { label: 'Perdu',        cls: 'bg-red-500/15    text-red-400'     },
  STOLEN:         { label: 'Volé',         cls: 'bg-red-500/15    text-red-400'     },
};

/** Détermine le `from` et `fromTab` à passer en state lors de la navigation vers DeviceDetail */
function getDeviceNavState(device: Device): { from: string; fromTab?: string } {
  switch (device.status) {
    case 'ASSIGNED':
    case 'LOANER':
    case 'PENDING_RETURN':
      return { from: '/devices', fromTab: device.type };
    case 'IN_STOCK':
    case 'ORDERED':
      return { from: '/stock', fromTab: 'inventaire' };
    case 'IN_MAINTENANCE':
      return { from: '/stock', fromTab: 'maintenance' };
    case 'RETIRED':
    case 'LOST':
    case 'STOLEN':
      return { from: '/stock', fromTab: 'dechets' };
    default:
      return { from: '/devices', fromTab: device.type };
  }
}

function DeviceTypeIcon({ type }: { type: DeviceType }) {
  if (type === 'SMARTPHONE' || type === 'TABLET') return <Smartphone size={13} />;
  if (type === 'MONITOR') return <Monitor size={13} />;
  if (['LAPTOP', 'DESKTOP', 'THIN_CLIENT', 'LAB_WORKSTATION'].includes(type)) return <Laptop size={13} />;
  return <Package size={13} />;
}

// ─── Composant principal ──────────────────────────────────────

export default function TopBar() {
  const { toggleSidebar, unreadCount } = useUIStore();
  const { setFilters } = useDeviceStore();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState<SearchResults | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef    = useRef<HTMLDivElement>(null);

  // Met à jour la position du dropdown quand il s'ouvre ou que la fenêtre change de taille
  useEffect(() => {
    if (!dropdownOpen || !containerRef.current) return;
    const update = () => {
      if (containerRef.current) setDropdownRect(containerRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [dropdownOpen]);

  // ── Fermeture sur clic extérieur ──────────────────────────
  // IMPORTANT : exclure aussi le portal (hors arbre DOM de containerRef)
  // sinon le mousedown sur le portal déclenche la fermeture avant que le click arrive
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target) ?? false;
      const inPortal    = portalRef.current?.contains(target)    ?? false;
      if (!inContainer && !inPortal) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Recherche debounced — déclenche à 3 caractères minimum ─
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults(null);
      setDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const q = encodeURIComponent(query.trim());
        const [devRes, usrRes] = await Promise.all([
          api.get(`/devices?search=${q}&limit=6`),
          api.get(`/users?search=${q}&limit=4`),
        ]);
        // Le backend renvoie { data: [...] } pour les devices
        const devices: Device[]      = devRes.data.data ?? devRes.data ?? [];
        const users:   UserResult[]  = Array.isArray(usrRes.data) ? usrRes.data : [];

        setResults({ devices, users });
        setDropdownOpen(true);
      } catch {
        setResults(null);
        setDropdownOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // ── Handlers ──────────────────────────────────────────────
  const clearSearch = () => {
    setQuery('');
    setResults(null);
    setDropdownOpen(false);
  };

  const handleDeviceClick = (device: Device) => {
    const navState = getDeviceNavState(device);
    navigate(`/devices/${device.id}`, { state: navState });
    clearSearch();
  };

  const handleUserClick = (u: UserResult) => {
    setFilters({ search: u.displayName, page: 1 });
    navigate('/devices');
    clearSearch();
  };

  const hasResults = results && (results.devices.length > 0 || results.users.length > 0);

  return (
    <header
      className="navbar-glass flex-shrink-0 h-16 flex items-center gap-4 px-4 lg:px-6 border-b lg:border border-[var(--glass-border)] lg:rounded-[20px]"
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

      {/* ── Recherche globale intelligente ──────────────────── */}
      <div ref={containerRef} className="flex-1 max-w-md relative">
        <div className="relative">
          {loading ? (
            <Loader2
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-primary)] animate-spin pointer-events-none"
              aria-hidden="true"
            />
          ) : (
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
              aria-hidden="true"
            />
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') clearSearch(); }}
            onFocus={() => { if (hasResults) setDropdownOpen(true); }}
            placeholder="Rechercher un appareil, utilisateur…"
            className="input-glass pl-9 pr-8 py-2 text-sm w-full"
            aria-label="Recherche globale"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Effacer la recherche"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* ── Dropdown résultats — rendu via portal pour passer au-dessus de tout ── */}
        {dropdownOpen && hasResults && dropdownRect && createPortal(
          <div
            ref={portalRef}
            style={{
              position: 'fixed',
              top: dropdownRect.bottom + 8,
              left: dropdownRect.left,
              width: dropdownRect.width,
              zIndex: 9999,
              overflow: 'hidden',
              background: 'var(--surface-primary)',
              backdropFilter: 'blur(var(--glass-blur-heavy)) saturate(var(--glass-saturation))',
              WebkitBackdropFilter: 'blur(var(--glass-blur-heavy)) saturate(var(--glass-saturation))',
              border: '1px solid var(--glass-border)',
              borderRadius: '16px',
              boxShadow: 'var(--glass-shadow)',
            }}
          >
            {/* ── Section Appareils ── */}
            {results!.devices.length > 0 && (
              <div>
                <div className="px-3 pt-2.5 pb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Appareils
                  </p>
                </div>
                {results!.devices.map((device) => {
                  const tag = STATUS_TAG[device.status];
                  return (
                    <button
                      key={device.id}
                      onClick={() => handleDeviceClick(device)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(99,102,241,0.12)' }}>
                        <span className="text-[var(--color-primary)]">
                          <DeviceTypeIcon type={device.type} />
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate font-mono tracking-wide">
                          {device.serialNumber}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">
                          {device.brand} {device.model}
                          {device.assignedUser && ` · ${device.assignedUser.displayName}`}
                        </p>
                      </div>
                      {tag && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${tag.cls}`}>
                          {tag.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Séparateur si les deux sections sont présentes */}
            {results!.devices.length > 0 && results!.users.length > 0 && (
              <div className="mx-3 my-1 h-px" style={{ background: 'var(--glass-border)' }} />
            )}

            {/* ── Section Utilisateurs ── */}
            {results!.users.length > 0 && (
              <div>
                <div className="px-3 pt-1.5 pb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Utilisateurs
                  </p>
                </div>
                {results!.users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleUserClick(u)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400/20 to-cyan-400/20 flex items-center justify-center flex-shrink-0">
                      <User size={13} className="text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {u.displayName}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="pb-1.5" />
          </div>
        , document.body)}

        {/* Message "aucun résultat" — portal pour rester au premier plan */}
        {dropdownOpen && !loading && results && !hasResults && dropdownRect && createPortal(
          <div
            style={{
              position: 'fixed',
              top: dropdownRect.bottom + 8,
              left: dropdownRect.left,
              width: dropdownRect.width,
              zIndex: 9999,
              padding: '16px',
              textAlign: 'center',
              background: 'var(--surface-primary)',
              backdropFilter: 'blur(var(--glass-blur-heavy)) saturate(var(--glass-saturation))',
              WebkitBackdropFilter: 'blur(var(--glass-blur-heavy)) saturate(var(--glass-saturation))',
              border: '1px solid var(--glass-border)',
              borderRadius: '16px',
              boxShadow: 'var(--glass-shadow)',
            }}
          >
            <p className="text-sm text-[var(--text-muted)]">Aucun résultat pour « {query} »</p>
          </div>
        , document.body)}
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

      {/* Avatar + dropdown profil */}
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
              background: 'var(--surface-primary)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'blur(var(--glass-blur-heavy)) saturate(var(--glass-saturation))',
              WebkitBackdropFilter: 'blur(var(--glass-blur-heavy)) saturate(var(--glass-saturation))',
              boxShadow: 'var(--glass-shadow)',
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
