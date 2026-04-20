import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Search, Menu, LogOut, X, Loader2,
  Laptop, Smartphone, Monitor, Package, User,
  AlertTriangle, Wrench, Trash2, ChevronRight,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useDeviceStore } from '../../stores/deviceStore';
import { useAuth } from '../../hooks/useAuth';
import { useStockNotifications } from '../../hooks/useStockNotifications';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import api from '../../services/api';
import { DEVICE_TYPE_LABELS } from '../../utils/formatters';
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
  const {
    toggleSidebar,
    markInventaireModelViewed,
    markMaintenanceDeviceViewed,
    markDechetsDeviceViewed,
  } = useUIStore();
  const { setFilters } = useDeviceStore();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const {
    totalCount, inventaireCount, maintenanceCount, dechetsCount,
    triggeredAlerts, overdueDevices, activeModelDevices, unviewedModelsWithStock,
  } = useStockNotifications();

  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState<SearchResults | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef    = useRef<HTMLDivElement>(null);

  // Bell panel state
  const [bellOpen, setBellOpen]   = useState(false);
  const [bellRect,  setBellRect]  = useState<DOMRect | null>(null);
  const bellRef     = useRef<HTMLButtonElement>(null);
  const bellPanelRef = useRef<HTMLDivElement>(null);

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

  // ── Bell — position + fermeture sur clic extérieur ──────────
  useEffect(() => {
    if (!bellOpen || !bellRef.current) return;
    const update = () => {
      if (bellRef.current) setBellRect(bellRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [bellOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inBell  = bellRef.current?.contains(target) ?? false;
      const inPanel = bellPanelRef.current?.contains(target) ?? false;
      if (!inBell && !inPanel) setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleBellClick = () => {
    setBellOpen((o) => !o);
    if (!bellOpen && bellRef.current) setBellRect(bellRef.current.getBoundingClientRect());
  };

  const goToStock = (tab: string) => {
    setBellOpen(false);
    navigate('/stock', { state: { tab } });
  };

  const clearAllNotifications = () => {
    unviewedModelsWithStock.forEach(({ id, inStock }) => markInventaireModelViewed(id, inStock));
    overdueDevices.forEach((d) => markMaintenanceDeviceViewed(d.id));
    activeModelDevices.forEach((d) => markDechetsDeviceViewed(d.id));
    setBellOpen(false);
  };

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

      {/* Cloche de notifications */}
      <button
        ref={bellRef}
        onClick={handleBellClick}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
        aria-label={`Notifications${totalCount > 0 ? ` (${totalCount})` : ''}`}
      >
        <Bell size={20} />
        {totalCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full text-white text-[8px] font-bold flex items-center justify-center"
            aria-hidden="true"
            style={{
              background: 'rgba(99,102,241,0.85)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              border: '1px solid rgba(139,120,255,0.60)',
              boxShadow: '0 2px 8px rgba(99,102,241,0.45)',
            }}
          >
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {/* Panel notifications — portal pour passer au-dessus de tout */}
      {bellOpen && bellRect && createPortal(
        <div
          ref={bellPanelRef}
          style={{
            position: 'fixed',
            top: bellRect.bottom + 8,
            right: window.innerWidth - bellRect.right,
            width: 340,
            zIndex: 9999,
          }}
        >
          <div
            className="modal-glass p-0 overflow-hidden"
            style={{ borderRadius: '16px' }}
          >
            {/* Décorations specular */}
            <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[16px] pointer-events-none"
              style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(139,120,255,0.60) 40%, rgba(34,211,238,0.50) 100%)' }} />
            <div className="absolute top-0 left-0 bottom-0 w-[2px] rounded-l-[16px] pointer-events-none"
              style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.20) 0%, transparent 100%)' }} />

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'rgba(139,120,255,0.15)' }}>
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-[var(--text-muted)]" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Alertes Stock</p>
                {totalCount > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white"
                    style={{
                      background: 'rgba(99,102,241,0.70)',
                      backdropFilter: 'blur(4px)',
                      WebkitBackdropFilter: 'blur(4px)',
                      border: '1px solid rgba(139,120,255,0.55)',
                      boxShadow: '0 2px 8px rgba(99,102,241,0.30)',
                    }}
                  >
                    {totalCount}
                  </span>
                )}
              </div>
              {totalCount > 0 && (
                <button
                  onClick={clearAllNotifications}
                  title="Tout marquer comme lu"
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.20)',
                    color: 'rgba(248,113,113,0.80)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.18)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgb(248,113,113)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(248,113,113,0.80)';
                  }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            {/* Corps */}
            {totalCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 gap-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.20)' }}
                >
                  <Bell size={18} className="text-indigo-400" />
                </div>
                <p className="text-sm text-[var(--text-muted)] text-center">Aucune alerte active</p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">

                {/* ── Inventaire ─────────────────────────────── */}
                {inventaireCount > 0 && (
                  <div>
                    <button
                      onClick={() => goToStock('inventaire')}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.05] transition-colors text-left group"
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(99,102,241,0.13)', border: '1px solid rgba(99,102,241,0.22)' }}
                      >
                        <AlertTriangle size={13} className="text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">Inventaire</p>
                        <p className="text-[11px] text-indigo-300">
                          {inventaireCount} alerte{inventaireCount > 1 ? 's' : ''} de rupture
                        </p>
                      </div>
                      <ChevronRight size={13} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors flex-shrink-0" />
                    </button>
                    {triggeredAlerts.slice(0, 3).map((alert) => (
                      <button
                        key={alert.id}
                        onClick={() => goToStock('inventaire')}
                        className="w-full flex items-center gap-2 px-4 py-2 pl-14 hover:bg-white/[0.04] transition-colors text-left"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: 'rgba(99,102,241,0.75)' }}
                        />
                        <span className="text-[11px] text-[var(--text-secondary)] truncate">
                          {alert.deviceModel
                            ? `${alert.deviceModel.brand} ${alert.deviceModel.name}`
                            : (DEVICE_TYPE_LABELS[alert.deviceType] ?? alert.deviceType)}
                        </span>
                        <span className="ml-auto text-[10px] font-semibold text-indigo-300 flex-shrink-0">
                          {alert.currentStock} / {alert.threshold}
                        </span>
                      </button>
                    ))}
                    {triggeredAlerts.length > 3 && (
                      <p className="text-[10px] text-[var(--text-muted)] px-14 pb-2">
                        +{triggeredAlerts.length - 3} autre{triggeredAlerts.length - 3 > 1 ? 's' : ''}…
                      </p>
                    )}
                  </div>
                )}

                {inventaireCount > 0 && (maintenanceCount > 0 || dechetsCount > 0) && (
                  <div className="mx-4 my-1 h-px" style={{ background: 'rgba(139,120,255,0.12)' }} />
                )}

                {/* ── Maintenance ────────────────────────────── */}
                {maintenanceCount > 0 && (
                  <div>
                    <button
                      onClick={() => goToStock('maintenance')}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.05] transition-colors text-left group"
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.20)' }}
                      >
                        <Wrench size={13} className="text-indigo-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">Maintenance</p>
                        <p className="text-[11px] text-violet-300">
                          {maintenanceCount} deadline{maintenanceCount > 1 ? 's' : ''} dépassée{maintenanceCount > 1 ? 's' : ''}
                        </p>
                      </div>
                      <ChevronRight size={13} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors flex-shrink-0" />
                    </button>
                    {overdueDevices.slice(0, 3).map((device) => (
                      <button
                        key={device.id}
                        onClick={() => { navigate(`/devices/${device.id}`, { state: { from: '/stock', fromTab: 'maintenance' } }); setBellOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2 pl-14 hover:bg-white/[0.04] transition-colors text-left"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: 'rgba(139,92,246,0.75)' }}
                        />
                        <span className="text-[11px] text-[var(--text-secondary)] truncate font-mono">
                          {device.serialNumber}
                        </span>
                        <span className="ml-auto text-[10px] text-[var(--text-muted)] flex-shrink-0 truncate max-w-[80px]">
                          {device.brand} {device.model}
                        </span>
                      </button>
                    ))}
                    {overdueDevices.length > 3 && (
                      <p className="text-[10px] text-[var(--text-muted)] px-14 pb-2">
                        +{overdueDevices.length - 3} autre{overdueDevices.length - 3 > 1 ? 's' : ''}…
                      </p>
                    )}
                  </div>
                )}

                {maintenanceCount > 0 && dechetsCount > 0 && (
                  <div className="mx-4 my-1 h-px" style={{ background: 'rgba(139,120,255,0.12)' }} />
                )}

                {/* ── Déchets ─────────────────────────────────── */}
                {dechetsCount > 0 && (
                  <div>
                    <button
                      onClick={() => goToStock('dechets')}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.05] transition-colors text-left group"
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(139,92,246,0.13)', border: '1px solid rgba(139,92,246,0.22)' }}
                      >
                        <Trash2 size={13} className="text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">Déchets</p>
                        <p className="text-[11px] text-violet-300">
                          {dechetsCount} modèle{dechetsCount > 1 ? 's' : ''} actif{dechetsCount > 1 ? 's' : ''} en déchets
                        </p>
                      </div>
                      <ChevronRight size={13} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors flex-shrink-0" />
                    </button>
                    {activeModelDevices.slice(0, 3).map((device) => (
                      <button
                        key={device.id}
                        onClick={() => { navigate(`/devices/${device.id}`, { state: { from: '/stock', fromTab: 'dechets' } }); setBellOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2 pl-14 hover:bg-white/[0.04] transition-colors text-left"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: 'rgba(139,92,246,0.75)' }}
                        />
                        <span className="text-[11px] text-[var(--text-secondary)] truncate">
                          {device.brand} {device.model}
                        </span>
                        <span className="ml-auto text-[10px] font-mono text-[var(--text-muted)] flex-shrink-0">
                          {device.serialNumber}
                        </span>
                      </button>
                    ))}
                    {activeModelDevices.length > 3 && (
                      <p className="text-[10px] text-[var(--text-muted)] px-14 pb-2">
                        +{activeModelDevices.length - 3} autre{activeModelDevices.length - 3 > 1 ? 's' : ''}…
                      </p>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* Footer */}
            {totalCount > 0 && (
              <div className="px-4 py-2.5 border-t" style={{ borderColor: 'rgba(139,120,255,0.15)' }}>
                <button
                  onClick={() => goToStock('inventaire')}
                  className="text-[11px] text-primary hover:underline transition-colors"
                >
                  Voir l'inventaire →
                </button>
              </div>
            )}
          </div>
        </div>
      , document.body)}

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
