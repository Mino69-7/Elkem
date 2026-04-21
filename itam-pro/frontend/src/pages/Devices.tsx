import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { useSearchParams, useLocation } from 'react-router-dom';
import {
  Plus, LayoutGrid, LayoutList, ChevronLeft, ChevronRight,
  Laptop, Monitor, Smartphone, Tablet, Cpu, Server, Tv, Printer,
  X, Loader2, Trash2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDevices, useUpdateDevice, useDeleteDevice } from '../hooks/useDevices';
import { useDeviceStore } from '../stores/deviceStore';
import { useAuthStore } from '../stores/authStore';
import DeviceFilters from '../components/devices/DeviceFilters';
import DeviceTable from '../components/devices/DeviceTable';
import DeviceCard from '../components/devices/DeviceCard';
import DeviceForm from '../components/devices/DeviceForm';
import { GlassCard } from '../components/ui/GlassCard';
import { AppSelect } from '../components/ui/AppSelect';
import { UserCombobox } from '../components/ui/UserCombobox';
import { DEVICE_TYPE_LABELS, ELKEM_SITES } from '../utils/formatters';
import api from '../services/api';
import type { Device, DeviceType } from '../types';
import type { DeviceFormData } from '../services/device.service';

// ─── Onglets de type ──────────────────────────────────────────

const TYPE_TABS: { type: DeviceType; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { type: 'LAPTOP',          label: 'PC Portable',    Icon: Laptop },
  { type: 'DESKTOP',         label: 'PC Fixe',         Icon: Cpu },
  { type: 'LAB_WORKSTATION', label: 'PC Labo / Indus', Icon: Server },
  { type: 'THIN_CLIENT',     label: 'Clients légers',  Icon: Tv },
  { type: 'SMARTPHONE',      label: 'Téléphones',      Icon: Smartphone },
  { type: 'TABLET',          label: 'Tablettes',       Icon: Tablet },
  { type: 'MONITOR',         label: 'Écrans',          Icon: Monitor },
  { type: 'PRINTER',         label: 'Imprimantes',     Icon: Printer },
];

// ─── Constantes hostname ──────────────────────────────────────

const SITE_OPTIONS = ELKEM_SITES.map((s) => ({ value: s.code, label: s.label }));

/** Préfixe pays pour les PC Labo/Indus */
const LAB_COUNTRY: Record<string, string> = {
  SUD: 'FR', NORD: 'FR', SFC: 'FR', ROU: 'FR', SSS: 'FR', GLD: 'FR',
  CAR: 'IT', SPA: 'ES', LEV: 'DE',
};

/** Préfixe hostname pour les autres postes de travail (SFS-W-SN) */
const WS_PREFIX: Record<string, string> = {
  SUD: 'SFS', NORD: 'SFS', SFC: 'SFC', ROU: 'ROU',
  SSS: 'SSS', GLD: 'GLD', CAR: 'CAR', SPA: 'SPA', LEV: 'LEV',
};

function buildHostname(type: string, site: string, sn: string, labType: 'LAB' | 'INDUS'): string {
  const cleanSN = sn.trim().toUpperCase();
  if (type === 'LAB_WORKSTATION') {
    const country = LAB_COUNTRY[site] ?? 'FR';
    return `${country}${labType}${cleanSN}`;
  }
  const prefix = WS_PREFIX[site] ?? site;
  return `${prefix}-W-${cleanSN}`;
}

const WORKSTATION_TYPES = new Set<DeviceType>(['LAPTOP', 'DESKTOP', 'THIN_CLIENT', 'LAB_WORKSTATION']);

// ─── Modal affectation depuis pool stock ──────────────────────

function AssignFromPoolModal({ type, onClose }: { type: DeviceType; onClose: () => void }) {
  const qc        = useQueryClient();
  const typeLabel = DEVICE_TYPE_LABELS[type] ?? type;
  const isPhone   = type === 'SMARTPHONE' || type === 'TABLET';
  const isWS      = WORKSTATION_TYPES.has(type);
  const isLab     = type === 'LAB_WORKSTATION';

  // ── Sélection utilisateur ──────────────────────────────────
  const [userId,      setUserId]      = useState('');
  const [userDisplay, setUserDisplay] = useState<string | undefined>(undefined);

  // ── Recherche pool ─────────────────────────────────────────
  const [search,   setSearch]   = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const [selected, setSelected] = useState<Device | null>(null);

  // ── Ticket ────────────────────────────────────────────────
  const [ticketRef, setTicketRef] = useState('IT-');

  // ── Champs workstation ────────────────────────────────────
  const [labType,    setLabType]    = useState<'LAB' | 'INDUS'>('LAB');
  const [site,       setSite]       = useState('SUD');
  const [hostname,   setHostname]   = useState('');
  const [vlan,       setVlan]       = useState('');
  const [ipAddress,  setIpAddress]  = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [bitlocker,  setBitlocker]  = useState('');

  // Auto-calcul hostname quand site / labType / device sélectionné change
  useEffect(() => {
    if (selected && isWS) {
      setHostname(buildHostname(type, site, selected.serialNumber, labType));
    }
  }, [site, labType, selected, type, isWS]);

  // Pré-remplissage quand on sélectionne un device du pool
  const handleSelect = (d: Device) => {
    setSelected(d);
    setShowDrop(false);
    const deviceSite = d.site ?? 'SUD';
    setSite(deviceSite);
    if (isLab) {
      setVlan(d.vlan ?? '');
      setIpAddress(d.ipAddress ?? '');
      setMacAddress(d.macAddress ?? '');
      setBitlocker(d.bitlocker ?? '');
    }
  };

  const handleReset = () => {
    setSelected(null);
    setSearch('');
    setTicketRef('IT-');
    setSite('SUD');
    setHostname('');
    setVlan('');
    setIpAddress('');
    setMacAddress('');
    setBitlocker('');
  };

  // ── Requête pool ──────────────────────────────────────────
  const { data: pool = [], isFetching } = useQuery<Device[]>({
    queryKey: ['assign-pool', type, search],
    queryFn: async () => {
      const r = await api.get(`/devices?type=${type}&status=IN_STOCK&search=${encodeURIComponent(search)}&limit=20`);
      return r.data.data as Device[];
    },
    enabled: search.length >= 1,
    staleTime: 0,
  });

  // ── Auto-scroll vers la dropdown quand les résultats arrivent ──
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showDrop && !isFetching && bodyRef.current) {
      requestAnimationFrame(() => {
        bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [showDrop, isFetching, pool.length]);

  // ── Mutation affectation ──────────────────────────────────
  const assignMut = useMutation({
    mutationFn: async (deviceId: string) => {
      // 1. Assigner l'utilisateur
      await api.patch(`/devices/${deviceId}/assign`, {
        userId,
        ...(ticketRef.trim().length > 3 ? { assetTag: ticketRef.trim().toUpperCase() } : {}),
      });
      // 2. Mettre à jour les champs workstation
      if (isWS) {
        const extra: Record<string, unknown> = {
          site,
          hostname: hostname.trim() || undefined,
        };
        if (isLab) {
          extra.vlan       = vlan.trim()                     || undefined;
          extra.ipAddress  = ipAddress.trim()                || undefined;
          extra.macAddress = macAddress.trim().toUpperCase() || undefined;
          extra.bitlocker  = bitlocker;
        }
        await api.put(`/devices/${deviceId}`, extra);
      }
    },
    onSuccess: (_data, deviceId) => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['device', deviceId] });
      qc.invalidateQueries({ queryKey: ['stock-summary'] });
      qc.invalidateQueries({ queryKey: ['stock-devices'] });
      qc.invalidateQueries({ queryKey: ['stockalerts'] });
      qc.invalidateQueries({ queryKey: ['maintenance-devices'] });
      onClose();
    },
  });

  const canSubmit = !!userId && !!selected && ticketRef.trim().length > 3 && !assignMut.isPending;

  return createPortal(
    <>
      {/* Backdrop léger — même style que DeviceForm */}
      <motion.div
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,10,0.42)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', cursor: 'pointer' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.20 }}
        onClick={onClose}
      />

      {/* Wrapper centré */}
      <motion.div
        style={{ position: 'fixed', inset: 0, zIndex: 201, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', pointerEvents: 'none' }}
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: 'spring', stiffness: 460, damping: 36, mass: 0.72 }}
      >
        <div
          className="modal-glass w-full max-w-lg flex flex-col pointer-events-auto relative"
          style={{ maxHeight: '90vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Décorations liquid glass ── */}
          {/* Ligne specular supérieure */}
          <div className="absolute inset-x-0 top-0 h-[2px] pointer-events-none" style={{ borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', background: 'linear-gradient(90deg, transparent 5%, rgba(180,160,255,0.80) 35%, rgba(99,200,255,0.60) 65%, transparent 95%)' }} />
          {/* Reflet vertical gauche */}
          <div className="absolute top-0 left-0 pointer-events-none" style={{ width: '2px', height: '60%', background: 'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, transparent 100%)' }} />
          {/* Orbe indigo haut-droite */}
          <div className="absolute pointer-events-none" style={{ top: '-40px', right: '-32px', width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.28) 0%, rgba(6,182,212,0.10) 45%, transparent 70%)', filter: 'blur(8px)' }} />

          {/* En-tête */}
          <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 relative z-10" style={{ borderBottom: '1px solid rgba(139,120,255,0.20)' }}>
            <div className="min-w-0 flex-1 pr-3">
              <h2 className="font-bold text-[15px] truncate" style={{ color: 'var(--text-primary)' }}>
                Affecter — {typeLabel}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-150"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
            >
              <X size={15} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>

          {/* Corps scrollable */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto p-5 space-y-5 relative z-10">

            {/* ── Utilisateur ── */}
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-3">Utilisateur</h3>
              <UserCombobox
                value={userId}
                displayValue={userDisplay}
                onChange={(id, user) => {
                  setUserId(id ?? '');
                  setUserDisplay(user ? `${user.displayName} (${user.email})` : undefined);
                }}
              />
            </section>

            <div className="h-px" style={{ background: 'rgba(139,120,255,0.15)' }} />

            {/* ── Appareil depuis le pool ── */}
            <section className="space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-3">Appareil du stock</h3>

              {!selected ? (
                /* ── Recherche ── */
                <div className="relative">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                      {isPhone ? 'Rechercher par SN ou IMEI' : 'Numéro de série'}
                    </label>
                    <input
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setShowDrop(true); }}
                      onFocus={() => setShowDrop(true)}
                      placeholder="Ex : ABC1234…"
                      className="input-glass py-2 text-sm w-full font-mono"
                    />
                  </div>
                  {showDrop && search.length >= 1 && (
                    <div
                      className="absolute z-10 top-full left-0 right-0 mt-1 rounded-xl border border-[var(--border-glass)] shadow-xl overflow-hidden"
                      style={{ background: 'var(--bg-secondary)', backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))', WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))' }}
                    >
                      {isFetching ? (
                        <div className="flex items-center justify-center py-3 gap-2 text-[var(--text-muted)]">
                          <Loader2 size={13} className="animate-spin" />
                          <span className="text-xs">Recherche…</span>
                        </div>
                      ) : pool.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-[var(--text-muted)] text-center">
                          Aucun {typeLabel.toLowerCase()} disponible en stock
                        </div>
                      ) : (
                        <div className="p-1 max-h-48 overflow-y-auto">
                          {pool.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => handleSelect(p)}
                              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-indigo-600/20 transition-colors"
                            >
                              <p className="text-xs font-semibold text-[var(--text-primary)]">{p.brand} {p.model}</p>
                              <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                                SN: {p.serialNumber}
                                {p.imei ? ` · IMEI: ${p.imei}` : ''}
                                {[p.processor, p.ram, p.storage].filter(Boolean).length > 0 && (
                                  <span> · {[p.processor, p.ram, p.storage].filter(Boolean).join(' · ')}</span>
                                )}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Device sélectionné ── */
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

                  {/* Carte appareil — confirmation visuelle */}
                  <div className="rounded-xl px-4 py-3" style={{ border: '1px solid rgba(16,185,129,0.30)', background: 'rgba(16,185,129,0.06)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400 mb-1">Appareil sélectionné</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.brand} {selected.model}</p>
                    {[selected.processor, selected.ram, selected.storage].filter(Boolean).length > 0 && (
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {[selected.processor, selected.ram, selected.storage].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>

                  {/* SN (lecture seule) */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">N° de série</label>
                    <input readOnly value={selected.serialNumber}
                      className="input-glass py-2 text-sm w-full font-mono opacity-60 cursor-default" />
                  </div>

                  {/* IMEI phones uniquement */}
                  {isPhone && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-[var(--text-secondary)]">IMEI</label>
                      <input readOnly value={selected.imei ?? '—'}
                        className="input-glass py-2 text-sm w-full font-mono tracking-widest opacity-60 cursor-default" />
                    </div>
                  )}

                  {/* ── Champs workstation ───────────────── */}
                  {isWS && (
                    <>
                      <div className="h-px" style={{ background: 'rgba(139,120,255,0.15)' }} />

                      {/* Toggle Labo / Indus — LAB_WORKSTATION uniquement */}
                      {isLab && (
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-[var(--text-secondary)]">Type de poste</label>
                          <div className="toggle-glass">
                            {(['LAB', 'INDUS'] as const).map((lt) => (
                              <button
                                key={lt}
                                type="button"
                                onClick={() => setLabType(lt)}
                                className={`relative flex-1 py-2 text-xs font-medium transition-colors duration-150 ${
                                  labType === lt
                                    ? 'text-primary'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                              >
                                {labType === lt && (
                                  <motion.div
                                    className="absolute inset-0 rounded-[12px]"
                                    layoutId="assign-labtype-pill"
                                    style={{
                                      background: 'rgba(99,102,241,0.13)',
                                      backdropFilter: 'blur(12px)',
                                      WebkitBackdropFilter: 'blur(12px)',
                                      border: '1px solid rgba(99,102,241,0.22)',
                                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
                                    }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                                  />
                                )}
                                <span className="relative z-10">{lt === 'LAB' ? 'Labo' : 'Indus'}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Site */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-[var(--text-secondary)]">Site <span className="text-red-400">*</span></label>
                        <AppSelect
                          value={site}
                          onChange={(v) => setSite(v)}
                          options={SITE_OPTIONS}
                        />
                      </div>

                      {/* Hostname (auto-calculé, éditable) */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-[var(--text-secondary)]">Hostname</label>
                        <input
                          value={hostname}
                          onChange={(e) => setHostname(e.target.value.toUpperCase())}
                          placeholder="Auto-calculé…"
                          className="input-glass py-2 text-sm w-full font-mono uppercase"
                        />
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {isLab
                            ? `Format : ${LAB_COUNTRY[site] ?? 'FR'}${labType}${selected.serialNumber.trim().toUpperCase()}`
                            : `Format : ${WS_PREFIX[site] ?? site}-W-${selected.serialNumber.trim().toUpperCase()}`
                          }
                        </p>
                      </div>

                      {/* Champs réseau — LAB uniquement */}
                      {isLab && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-[var(--text-secondary)]">VLAN</label>
                            <input
                              value={vlan}
                              onChange={(e) => setVlan(e.target.value)}
                              placeholder="Ex : VLAN-10"
                              className="input-glass py-2 text-sm w-full"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-[var(--text-secondary)]">Adresse IP</label>
                            <input
                              value={ipAddress}
                              onChange={(e) => setIpAddress(e.target.value)}
                              placeholder="192.168.1.100"
                              className="input-glass py-2 text-sm w-full font-mono"
                            />
                          </div>
                          <div className="col-span-2 flex flex-col gap-1">
                            <label className="text-xs font-medium text-[var(--text-secondary)]">Adresse MAC</label>
                            <input
                              value={macAddress}
                              onChange={(e) => setMacAddress(e.target.value.toUpperCase())}
                              placeholder="AA:BB:CC:DD:EE:FF"
                              className="input-glass py-2 text-sm w-full font-mono uppercase"
                            />
                          </div>
                          <div className="col-span-2 flex flex-col gap-1">
                            <label className="text-xs font-medium text-[var(--text-secondary)]">Clé Bitlocker</label>
                            <input
                              value={bitlocker}
                              onChange={(e) => setBitlocker(e.target.value.replace(/\D/g, ''))}
                              placeholder="Clé de récupération (chiffres uniquement)"
                              className="input-glass py-2 text-sm w-full font-mono"
                              inputMode="numeric"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* N° ticket */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                      N° ticket <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={ticketRef}
                      onChange={(e) => setTicketRef(e.target.value.toUpperCase())}
                      placeholder="IT-XXXXX"
                      className="input-glass py-2 text-sm w-full font-mono uppercase"
                    />
                  </div>

                  <button
                    onClick={handleReset}
                    className="text-xs transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
                  >
                    ← Changer d'appareil
                  </button>
                </motion.div>
              )}
            </section>
          </div>

          {/* Pied */}
          <div className="flex gap-3 px-5 py-4 flex-shrink-0 relative z-10" style={{ borderTop: '1px solid rgba(139,120,255,0.20)' }}>
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="btn-secondary flex-1 py-2.5 text-sm"
            >
              Annuler
            </motion.button>
            <motion.button
              onClick={() => selected && assignMut.mutate(selected.id)}
              disabled={!canSubmit}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 py-2.5 text-[13px] rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                border: '1px solid rgba(99,102,241,0.45)',
                color: '#ffffff',
                boxShadow: '0 4px 20px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.20)',
              }}
            >
              {assignMut.isPending && <Loader2 size={14} className="animate-spin" />}
              Affecter
            </motion.button>
          </div>
        </div>
      </motion.div>
    </>,
    document.body
  );
}

// ─── Page Utilisateurs ────────────────────────────────────────

export default function Devices() {
  const [searchParams] = useSearchParams();
  const externalSearch = searchParams.get('search') ?? undefined;
  const location = useLocation();

  const { filters, setFilters, viewMode, setViewMode } = useDeviceStore();
  const { user } = useAuthStore();
  const canEdit = user?.role === 'MANAGER' || user?.role === 'TECHNICIAN';

  const [activeTab, setActiveTab] = useState<DeviceType>(
    ((location.state as any)?.tab as DeviceType) ?? 'LAPTOP'
  );

  const { data, isLoading } = useDevices({ type: activeTab, assigned: true });

  const [assignOpen, setAssignOpen] = useState(false);
  const [formOpen,     setFormOpen]     = useState(false);
  const [editing,      setEditing]      = useState<Device | null>(null);
  const [deleting,             setDeleting]             = useState<Device | null>(null);
  const [retireStatus,         setRetireStatus]         = useState('IN_STOCK');
  const [maintenanceDeadline,  setMaintenanceDeadline]  = useState('');

  const qc        = useQueryClient();
  const updateMut = useUpdateDevice(editing?.id ?? '');
  const deleteMut = useDeleteDevice();

  const swapMut = useMutation({
    mutationFn: async ({
      oldId, newId, userId, assetTag, site, hostname, vlan, ipAddress, macAddress, bitlocker,
    }: {
      oldId: string; newId: string; userId: string;
      assetTag: string; site: string; hostname: string;
      vlan?: string; ipAddress?: string; macAddress?: string; bitlocker?: string;
    }) => {
      await api.delete(`/devices/${oldId}`, { data: { status: 'IN_STOCK' } });
      await api.patch(`/devices/${newId}/assign`, { userId, assetTag });
      await api.put(`/devices/${newId}`, { site, hostname, vlan, ipAddress, macAddress, bitlocker });
    },
    onSuccess: (_data, { oldId, newId }) => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['device', oldId] });
      qc.invalidateQueries({ queryKey: ['device', newId] });
      qc.invalidateQueries({ queryKey: ['stock-summary'] });
      qc.invalidateQueries({ queryKey: ['stock-devices'] });
      qc.invalidateQueries({ queryKey: ['stockalerts'] });
      qc.invalidateQueries({ queryKey: ['maintenance-devices'] });
    },
  });

  const handleTabChange = (type: DeviceType) => {
    setActiveTab(type);
    setFilters({ type: undefined, model: undefined, page: 1 });
  };

  const openEdit  = (d: Device) => { setEditing(d); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); };

  const handleSubmit = async (data: DeviceFormData) => {
    if (editing) {
      if (data.swappedDeviceId && editing.assignedUserId) {
        await swapMut.mutateAsync({
          oldId:      editing.id,
          newId:      data.swappedDeviceId,
          userId:     editing.assignedUserId,
          assetTag:   data.assetTag,
          site:       data.site ?? 'SUD',
          hostname:   data.hostname ?? '',
          vlan:       data.vlan,
          ipAddress:  data.ipAddress,
          macAddress: data.macAddress,
          bitlocker:  data.bitlocker,
        });
      } else {
        await updateMut.mutateAsync(data);
      }
    }
    closeForm();
  };

  const handleDeleteConfirm = async () => {
    if (!deleting) return;
    await deleteMut.mutateAsync({
      id: deleting.id,
      status: retireStatus,
      maintenanceDeadline: retireStatus === 'IN_MAINTENANCE' ? maintenanceDeadline || undefined : undefined,
    });
    setDeleting(null);
    setRetireStatus('IN_STOCK');
    setMaintenanceDeadline('');
  };

  const devices    = data?.data       ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const activeTabMeta = TYPE_TABS.find((t) => t.type === activeTab)!;

  return (
    <div className="p-4 lg:p-6 space-y-4">

      {/* ─── En-tête ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Appareils</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {isLoading ? '…' : `${total} appareil${total > 1 ? 's' : ''} · ${activeTabMeta.label}`}
          </p>
        </div>

        <div className="sm:ml-auto flex items-center gap-2">
          <div className="toggle-glass">
            {([
              { mode: 'table', Icon: LayoutList, label: 'Vue tableau' },
              { mode: 'grid',  Icon: LayoutGrid,  label: 'Vue grille' },
            ] as const).map(({ mode, Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`relative p-2 transition-colors duration-150 ${
                  viewMode === mode ? 'text-primary' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                aria-label={label}
                aria-pressed={viewMode === mode}
              >
                {viewMode === mode && (
                  <motion.div
                    className="absolute inset-0 rounded-[10px]"
                    layoutId="view-mode-pill"
                    style={{
                      background: 'rgba(99,102,241,0.13)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(99,102,241,0.22)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon size={16} className="relative z-10" />
              </button>
            ))}
          </div>

          {canEdit && (
            <motion.button
              onClick={() => setAssignOpen(true)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
            >
              <Plus size={16} />
              Nouveau
            </motion.button>
          )}
        </div>
      </div>

      {/* ─── Toggle types d'équipements ──────────────────────── */}
      <div className="overflow-x-auto pb-1">
        <div className="tabs-glass" style={{ display: 'flex', gap: '3px', width: 'fit-content' }}>
          {TYPE_TABS.map(({ type, label, Icon }) => {
            const isActive = activeTab === type;
            return (
              <button
                key={type}
                onClick={() => handleTabChange(type)}
                data-state={isActive ? 'active' : 'inactive'}
                className={clsx(
                  'relative flex items-center gap-2 px-3.5 py-2 rounded-[18px] text-xs font-medium',
                  'transition-colors whitespace-nowrap select-none outline-none',
                  isActive
                    ? 'text-primary'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="type-tab-bg"
                    className="absolute inset-0 rounded-[18px]"
                    style={{
                      background: 'rgba(99,102,241,0.13)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(99,102,241,0.22)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 8px rgba(99,102,241,0.12)',
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon size={13} className="relative z-10 flex-shrink-0" />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Filtres ─────────────────────────────────────────── */}
      <DeviceFilters externalSearch={externalSearch} activeType={activeTab} />

      {/* ─── Liste ───────────────────────────────────────────── */}
      <GlassCard padding="none">
        {viewMode === 'table' ? (
          <DeviceTable
            devices={devices}
            isLoading={isLoading}
            onEdit={openEdit}
            onDelete={setDeleting}
            fromTab={activeTab}
          />
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="glass-card p-4 h-40 animate-pulse" style={{ background: 'var(--bg-glass)' }} />
                ))
              : devices.map((d) => (
                  <DeviceCard key={d.id} device={d} onEdit={openEdit} onDelete={setDeleting} />
                ))
            }
          </div>
        )}
      </GlassCard>

      {/* ─── Pagination ──────────────────────────────────────── */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-[var(--text-muted)]">Page {filters.page} sur {totalPages}</p>
          <div className="flex gap-2">
            <button
              disabled={(filters.page ?? 1) <= 1}
              onClick={() => setFilters({ page: (filters.page ?? 1) - 1 })}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} /> Précédent
            </button>
            <button
              disabled={(filters.page ?? 1) >= totalPages}
              onClick={() => setFilters({ page: (filters.page ?? 1) + 1 })}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Suivant <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ─── Modal affectation depuis pool ───────────────────── */}
      {canEdit && assignOpen && (
        <AssignFromPoolModal
          type={activeTab}
          onClose={() => setAssignOpen(false)}
        />
      )}

      {/* ─── Formulaire édition ──────────────────────────────── */}
      {canEdit && (
        <DeviceForm
          device={editing}
          isOpen={formOpen && !!editing}
          isSaving={updateMut.isPending || swapMut.isPending}
          isManager={user?.role === 'MANAGER'}
          onClose={closeForm}
          onSubmit={handleSubmit}
        />
      )}

      {/* ─── Confirmation désaffectation — portal pour échapper le transform context ── */}
      {deleting && createPortal((() => {
        const closePopup = () => { setDeleting(null); setRetireStatus('IN_STOCK'); setMaintenanceDeadline(''); };
        return (
          <>
            {/* Backdrop léger */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,10,0.42)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', cursor: 'pointer' }}
              onClick={closePopup}
            />

            {/* Carte modale */}
            <motion.div
              style={{ position: 'fixed', inset: 0, zIndex: 151, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', pointerEvents: 'none' }}
              initial={{ opacity: 0, scale: 0.82, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', stiffness: 500, damping: 36, mass: 0.72 }}
            >
              <div className="modal-glass w-full max-w-sm pointer-events-auto p-6 space-y-5">

                {/* ── Décorations specular liquid glass ── */}
                <div className="absolute inset-x-0 top-0 h-[2px] pointer-events-none" style={{ borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', background: 'linear-gradient(90deg, transparent 5%, rgba(180,160,255,0.80) 35%, rgba(99,200,255,0.60) 65%, transparent 95%)' }} />
                <div className="absolute top-0 left-0 pointer-events-none" style={{ width: '2px', height: '60%', background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)' }} />
                <div className="absolute pointer-events-none" style={{ top: '-40px', right: '-32px', width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.28) 0%, rgba(6,182,212,0.10) 45%, transparent 70%)', filter: 'blur(8px)' }} />
                <div className="absolute pointer-events-none" style={{ bottom: '-20px', left: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.14) 0%, transparent 70%)', filter: 'blur(6px)' }} />

                {/* ── En-tête ── */}
                <div className="flex items-start gap-3 relative z-10">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.20) 0%, rgba(234,88,12,0.12) 100%)', border: '1px solid rgba(245,158,11,0.40)', boxShadow: '0 0 12px rgba(245,158,11,0.20), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
                    <Trash2 size={17} style={{ color: 'rgb(251,191,36)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-[15px] leading-tight" style={{ color: 'var(--text-primary)' }}>
                      Désaffecter cet équipement
                    </h3>
                    <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {deleting.assetTag || deleting.serialNumber}
                      </span>
                      {' '}<span style={{ opacity: 0.70 }}>— {deleting.brand} {deleting.model}</span>
                    </p>
                    {deleting.assignedUser && (
                      <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-secondary)', opacity: 0.80 }}>
                        Affecté à <span className="font-medium">{deleting.assignedUser.displayName}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Séparateur lumineux */}
                <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,120,255,0.50) 30%, rgba(99,200,255,0.35) 70%, transparent)' }} />

                {/* ── Sélecteur de statut ── */}
                <div className="space-y-2 relative z-10">
                  <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)', letterSpacing: '0.10em' }}>
                    Nouveau statut <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <AppSelect
                    value={retireStatus}
                    onChange={setRetireStatus}
                    options={[
                      { value: 'IN_STOCK',       label: 'Stock — retour en inventaire' },
                      { value: 'IN_MAINTENANCE', label: 'Maintenance — envoi en atelier' },
                      { value: 'RETIRED',        label: 'Déchet — mise au rebut' },
                      { value: 'LOST',           label: 'Perdu — signalement perte' },
                      { value: 'STOLEN',         label: 'Volé — signalement vol' },
                    ]}
                  />
                  <p className="text-[11.5px] leading-relaxed min-h-[1.25rem]" style={{ color: 'var(--text-secondary)', opacity: 0.85 }}>
                    {retireStatus === 'IN_STOCK'       && "L'équipement retourne dans le pool de stock disponible."}
                    {retireStatus === 'IN_MAINTENANCE' && "L'équipement est envoyé en atelier et apparaîtra dans l'onglet Maintenance."}
                    {retireStatus === 'RETIRED'        && "L'équipement est mis au rebut et apparaîtra dans l'onglet Déchets."}
                    {retireStatus === 'LOST'           && "L'équipement est signalé perdu et apparaîtra dans l'onglet Déchets."}
                    {retireStatus === 'STOLEN'         && "L'équipement est signalé volé et apparaîtra dans l'onglet Déchets."}
                  </p>
                </div>

                {/* ── Deadline maintenance ── */}
                {retireStatus === 'IN_MAINTENANCE' && (
                  <div className="space-y-2 pt-1 relative z-10">
                    <label className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)', letterSpacing: '0.10em' }}>
                      Deadline de retour{' '}
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optionnel)</span>
                    </label>
                    <input type="date" value={maintenanceDeadline} onChange={(e) => setMaintenanceDeadline(e.target.value)} className="input-glass w-full text-sm" />
                  </div>
                )}

                {/* Note traçabilité */}
                <p className="text-[11px] leading-relaxed relative z-10 pt-3" style={{ color: 'var(--text-muted)', borderTop: '1px solid rgba(139,120,255,0.20)' }}>
                  L'action sera tracée dans l'historique avec votre nom et la date.
                </p>

                {/* ── Boutons ── */}
                <div className="flex gap-3 relative z-10">
                  <motion.button
                    onClick={closePopup}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="btn-secondary flex-1 py-2.5 text-sm"
                  >
                    Annuler
                  </motion.button>
                  <motion.button
                    onClick={handleDeleteConfirm}
                    disabled={deleteMut.isPending}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex-1 py-2.5 text-[13px] rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)', border: '1px solid rgba(245,158,11,0.45)', color: '#ffffff', boxShadow: '0 4px 20px rgba(245,158,11,0.35), inset 0 1px 0 rgba(255,255,255,0.20)' }}
                  >
                    {deleteMut.isPending ? <><Loader2 size={14} className="animate-spin" />En cours…</> : 'Confirmer'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        );
      })(), document.body)}
    </div>
  );
}
