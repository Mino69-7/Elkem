import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, RefreshCw, CheckCircle, AlertTriangle, Shield, ShieldOff } from 'lucide-react';
import { AppSelect } from '../ui/AppSelect';
import { UserCombobox } from '../ui/UserCombobox';
import type { Device, DeviceModel } from '../../types';
import type { DeviceFormData } from '../../services/device.service';
import { KEYBOARD_LAYOUT_LABELS, ELKEM_SITES, DEVICE_TYPE_LABELS } from '../../utils/formatters';
import api from '../../services/api';

// ─── Constantes ───────────────────────────────────────────────

const KEYBOARD_FORM_OPTIONS = [
  'AZERTY_FR','QWERTY_ES','QWERTY_IT','QWERTZ_DE',
  'QWERTY_NO','QWERTY_UK','QWERTY_RU','QWERTY_TR','QWERTY_AR',
] as const;

const STATUS_OPTIONS = [
  { value: 'ASSIGNED',       label: 'Actif' },
  { value: 'IN_STOCK',       label: 'Stock' },
  { value: 'IN_MAINTENANCE', label: 'Maintenance' },
  { value: 'PENDING_RETURN', label: 'À récupérer' },
  { value: 'LOST',           label: 'Perdu' },
  { value: 'STOLEN',         label: 'Volé' },
  { value: 'RETIRED',        label: 'Rétention' },
];

// Types affichés dans le formulaire (hors périphériques purs)
const FORM_TYPE_KEYS = [
  'LAPTOP', 'DESKTOP', 'THIN_CLIENT', 'LAB_WORKSTATION',
  'SMARTPHONE', 'TABLET', 'MONITOR', 'PRINTER',
];
const TYPE_OPTIONS = FORM_TYPE_KEYS.map((value) => ({
  value,
  label: DEVICE_TYPE_LABELS[value] ?? value,
}));

const SITE_OPTIONS = ELKEM_SITES.map((s) => ({ value: s.code, label: s.label }));
const KEYBOARD_OPTIONS = KEYBOARD_FORM_OPTIONS.map((k) => ({
  value: k,
  label: KEYBOARD_LAYOUT_LABELS[k] ?? k,
}));

// Types avec identification complète obligatoire
const WORKSTATION_TYPES = ['LAPTOP', 'DESKTOP', 'THIN_CLIENT'];
const LAB_TYPE = 'LAB_WORKSTATION';
const ALL_WS_TYPES = [...WORKSTATION_TYPES, LAB_TYPE];
const HAS_KEYBOARD_LAYOUT = ['LAPTOP', 'DESKTOP', 'THIN_CLIENT', 'LAB_WORKSTATION'];
const HAS_SPECS = ['LAPTOP', 'DESKTOP', 'LAB_WORKSTATION'];

// Préfixes hostname par site (format : {PREFIX}-W-{SN})
const SITE_HOSTNAME_PREFIX: Record<string, string> = {
  SUD:  'SFS',
  NORD: 'SFS',
  SFC:  'SFC',
  ROU:  'ROU',
  SSS:  'SSS',
  GLD:  'GLD',
  CAR:  'CAR',
  SPA:  'SPA',
  LEV:  'LEV',
};

// ─── Schéma Zod (hors composant) ──────────────────────────────

const schema = z.object({
  assignedUserId:  z.string().optional(),
  type:            z.string().min(1, 'Requis'),
  modelId:         z.string().optional(),
  assetTag:        z.string().optional(),
  serialNumber:    z.string().optional(),
  hostname:        z.string().optional(),
  vlan:            z.string().optional(),
  ipAddress:       z.string().optional(),
  macAddress:      z.string().optional(),
  bitlocker:       z.string().optional(),
  processor:       z.string().optional(),
  ram:             z.string().optional(),
  storage:         z.string().optional(),
  screenSize:      z.string().optional(),
  keyboardLayout:  z.string().default('AZERTY_FR'),
  site:            z.string().default('SUD'),
  status:          z.string().default('IN_STOCK'),
  notes:           z.string().optional(),
  purchaseOrderId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────

interface DeviceFormProps {
  device?:        Device | null;
  isOpen:         boolean;
  isSaving:       boolean;
  isManager?:     boolean;
  requireUser?:   boolean;
  formTitle?:     string;
  /** Rendu centré (modal) au lieu du drawer latéral */
  modal?:         boolean;
  /** Cache la section Utilisateur (ex: depuis l'onglet Équipements) */
  hideUserField?: boolean;
  /** userId injecté dans le submit quand hideUserField=true */
  forcedUserId?:  string;
  /** Pré-remplit le type lors de la création */
  initialType?:   string;
  onClose:        () => void;
  onSubmit:       (data: DeviceFormData) => void;
}

// ─── Champ de formulaire ──────────────────────────────────────

function Field({ label, error, required, className, children }: {
  label: string; error?: string; required?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1${className ? ` ${className}` : ''}`}>
      <label className="text-xs font-medium text-[var(--text-secondary)]">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────

export default function DeviceForm({
  device, isOpen, isSaving, isManager: _isManager, requireUser, formTitle,
  modal, hideUserField, forcedUserId, initialType,
  onClose, onSubmit,
}: DeviceFormProps) {
  const isEdit = !!device;

  const [syncState, setSyncState] = useState<'idle' | 'loading' | 'found' | 'notfound' | 'duplicate'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [assignedUserDisplay, setAssignedUserDisplay] = useState<string | undefined>(undefined);
  const [pendingModelId, setPendingModelId] = useState<string | null>(null);
  const [pendingModelSearch, setPendingModelSearch] = useState<{ brand: string; model: string } | null>(null);

  // Pool search pour le swap de PC en mode édition
  const [snSearch,      setSnSearch]      = useState('');
  const [snResults,     setSnResults]     = useState<Array<{ id: string; serialNumber: string; brand: string; model: string }>>([]);
  const [snLoading,     setSnLoading]     = useState(false);
  const [swappedDevice, setSwappedDevice] = useState<{ id: string; sn: string } | null>(null);
  const [showSnSearch,  setShowSnSearch]  = useState(false);

  const {
    control, register, handleSubmit, reset, watch, setValue, setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { keyboardLayout: 'AZERTY_FR', status: 'IN_STOCK', site: 'SUD', assignedUserId: '' },
  });

  const selectedType = watch('type');
  const serialNumber = watch('serialNumber');
  const siteVal      = watch('site');
  const bitlockerVal = watch('bitlocker');

  const isWorkstation = WORKSTATION_TYPES.includes(selectedType);
  const isLab         = selectedType === LAB_TYPE;
  const hasHostname   = ALL_WS_TYPES.includes(selectedType);

  // Génère le hostname automatiquement depuis le SN + site
  const computeHostname = (sn: string, site: string) => {
    const prefix = SITE_HOSTNAME_PREFIX[site] ?? site;
    return `${prefix}-W-${sn.trim().toUpperCase()}`;
  };

  // ── Chargement des modèles ────────────────────────────────
  const { data: models = [] } = useQuery<DeviceModel[]>({
    queryKey: ['device-models', selectedType],
    queryFn:  async () => {
      const url = selectedType ? `/devicemodels?type=${selectedType}` : '/devicemodels';
      const { data } = await api.get<DeviceModel[]>(url);
      return data;
    },
    enabled: isOpen,
  });

  const modelOptions = models.map((m) => ({ value: m.id, label: m.name }));

  // ── Applique le modèle après rechargement de la liste ────
  useEffect(() => {
    // Priorité 1 : ID exact (ex : sync Dell, ou device.modelId FK direct)
    if (pendingModelId && models.some((m) => m.id === pendingModelId)) {
      setValue('modelId', pendingModelId);
      onModelChange(pendingModelId);
      setPendingModelId(null);
      return;
    }
    // Priorité 2 : recherche par marque+nom (pré-remplissage édition, fallback)
    if (pendingModelSearch && models.length > 0) {
      const found = models.find(
        (m) =>
          m.brand.trim().toLowerCase() === pendingModelSearch.brand.trim().toLowerCase() &&
          m.name.trim().toLowerCase()  === pendingModelSearch.model.trim().toLowerCase()
      );
      if (found) {
        setValue('modelId', found.id);
        setPendingModelSearch(null); // trouvé → on arrête
      }
      // Si non trouvé, on ne vide PAS pendingModelSearch — une autre série de modèles
      // (ex: après changement de type) pourrait réussir la recherche
    }
  }, [models, pendingModelId, pendingModelSearch]); // eslint-disable-line

  // ── Pré-remplissage édition / reset création ──────────────
  useEffect(() => {
    if (device) {
      reset({
        assignedUserId:  device.assignedUserId ?? '',
        assetTag:        device.assetTag ?? '',
        serialNumber:    device.serialNumber,
        type:            device.type,
        modelId:         '',   // sera résolu par pendingModelId (FK) ou pendingModelSearch (fallback)
        hostname:        device.hostname ?? '',
        vlan:            device.vlan ?? '',
        ipAddress:       device.ipAddress ?? '',
        macAddress:      device.macAddress ?? '',
        bitlocker:       device.bitlocker ?? '',
        processor:       device.processor ?? '',
        ram:             device.ram ?? '',
        storage:         device.storage ?? '',
        screenSize:      device.screenSize ?? '',
        keyboardLayout:  device.keyboardLayout ?? 'AZERTY_FR',
        site:            device.site ?? 'SUD',
        status:          device.status ?? 'IN_STOCK',
        notes:           device.notes ?? '',
        purchaseOrderId: device.purchaseOrderId ?? '',
      });
      setAssignedUserDisplay(
        device.assignedUser
          ? `${device.assignedUser.displayName} (${device.assignedUser.email})`
          : undefined
      );
      // Résolution du modèle : FK directe en priorité, sinon recherche par marque+nom
      if (device.modelId) {
        setPendingModelId(device.modelId);   // Priorité 1 dans l'effet ci-dessous
        setPendingModelSearch(null);
      } else {
        setPendingModelSearch({ brand: device.brand, model: device.model });
      }
    } else {
      reset({
        keyboardLayout:  'AZERTY_FR',
        status:          (requireUser || forcedUserId) ? 'ASSIGNED' : 'IN_STOCK',
        site:            'SUD',
        assignedUserId:  '',
        bitlocker:       '',
        type:            initialType ?? '',
        assetTag:        'IT-',
      });
      setAssignedUserDisplay(undefined);
      setPendingModelId(null);
      setPendingModelSearch(null);
    }
    setSyncState('idle');
  }, [device, isOpen]); // eslint-disable-line

  // ── Auto-remplissage quand un modèle est sélectionné ─────
  const onModelChange = (modelId: string) => {
    const m = models.find((m) => m.id === modelId);
    if (!m) return;
    if (m.processor)  setValue('processor',  m.processor);
    if (m.ram)        setValue('ram',        m.ram);
    if (m.storage)    setValue('storage',    m.storage);
    if (m.screenSize) setValue('screenSize', m.screenSize);
  };

  // ── Recherche pool stock pour swap SN en édition ─────────
  useEffect(() => {
    if (!isEdit || !hasHostname || !showSnSearch || snSearch.length < 1) {
      setSnResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSnLoading(true);
      try {
        const { data } = await api.get('/devices', {
          params: { type: device!.type, status: 'IN_STOCK', search: snSearch },
        });
        setSnResults(data.data ?? []);
      } catch {
        setSnResults([]);
      } finally {
        setSnLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [snSearch, isEdit, hasHostname, showSnSearch]); // eslint-disable-line

  // ── Sync numéro de série ──────────────────────────────────
  const handleSync = async () => {
    if (!serialNumber?.trim()) return;
    setSyncState('loading');
    try {
      const { data } = await api.get(`/lookup/serial/${encodeURIComponent(serialNumber.trim())}`);
      if (data.found && data.source === 'local') {
        setSyncState('duplicate');
        setSyncMessage(data.warning ?? 'Numéro de série déjà enregistré');
      } else if (data.found && data.source === 'intune') {
        setSyncState('found');
        setSyncMessage(`Intune : ${data.data?.model ?? ''}`);
      } else if (data.found && data.source === 'dell') {
        const d = data.data;
        if (d.processor)  setValue('processor',  d.processor);
        if (d.ram)        setValue('ram',        d.ram);
        if (d.storage)    setValue('storage',    d.storage);
        if (d.screenSize) setValue('screenSize', d.screenSize);
        if (d.catalogModelId && d.catalogModelType) {
          if (watch('type') !== d.catalogModelType) {
            setValue('type', d.catalogModelType);
            setValue('modelId', '');
          }
          setPendingModelId(d.catalogModelId);
        }
        setSyncState('found');
        setSyncMessage(
          [d.processor, d.ram, d.storage].filter(Boolean).length > 0
            ? `Dell : ${d.model} — config auto-remplie`
            : `Dell : ${d.model}`
        );
      } else {
        setSyncState('notfound');
        setSyncMessage(data.hint ?? 'Non trouvé');
      }
    } catch {
      setSyncState('notfound');
      setSyncMessage('Erreur de vérification');
    }
  };

  // ── Soumission ────────────────────────────────────────────
  const handleFormSubmit = (values: FormValues) => {
    let hasError = false;

    // Utilisateur requis (si pas caché et pas forcé)
    if (requireUser && !hideUserField && !forcedUserId && !values.assignedUserId) {
      setError('assignedUserId', { message: 'Utilisateur requis' });
      hasError = true;
    }

    if (!values.serialNumber?.trim()) {
      setError('serialNumber', { message: 'Requis' });
      hasError = true;
    }

    if (isWorkstation || isLab) {
      if (!values.assetTag?.trim()) {
        setError('assetTag', { message: 'Requis' });
        hasError = true;
      } else if (!/^[A-Z0-9-]+$/.test(values.assetTag)) {
        setError('assetTag', { message: 'Majuscules, chiffres et tirets uniquement' });
        hasError = true;
      }
    }

    if (hasError) return;

    const model = models.find((m) => m.id === values.modelId);
    onSubmit({
      assignedUserId:  forcedUserId ?? values.assignedUserId ?? undefined,
      assetTag:        values.assetTag?.trim() || '',
      serialNumber:    values.serialNumber?.trim() ?? '',
      site:            values.site,
      status:          values.status,
      type:            values.type,
      brand:           model?.brand ?? device?.brand ?? 'Dell',
      model:           model?.name ?? device?.model ?? '',
      modelId:         values.modelId || undefined,
      processor:       values.processor || undefined,
      ram:             values.ram || undefined,
      storage:         values.storage || undefined,
      screenSize:      values.screenSize || undefined,
      keyboardLayout:  values.keyboardLayout,
      notes:           values.notes ?? '',
      purchaseOrderId: values.purchaseOrderId || undefined,
      hostname:        values.hostname || undefined,
      vlan:            values.vlan || undefined,
      ipAddress:       values.ipAddress || undefined,
      macAddress:      values.macAddress || undefined,
      bitlocker:       values.bitlocker,
      ...(swappedDevice ? { swappedDeviceId: swappedDevice.id } : {}),
    } as DeviceFormData);
  };

  // ── Titre ─────────────────────────────────────────────────
  const defaultTitle = isEdit
    ? `Modifier — ${device?.assignedUser?.displayName ?? device?.assetTag ?? device?.serialNumber}`
    : initialType
      ? `Ajouter — ${DEVICE_TYPE_LABELS[initialType] ?? initialType}`
      : 'Nouvel utilisateur';
  const title = formTitle ?? defaultTitle;

  // ── Contenu du formulaire (partagé entre drawer et modal) ─
  const formContent = (
    <>
      {/* En-tête */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 relative z-10" style={{ borderBottom: '1px solid rgba(139,120,255,0.20)' }}>
        <div className="min-w-0 flex-1 pr-3">
          <h2 className="font-bold text-[15px] truncate" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          {isEdit && device && (
            <p className="text-[11px] mt-0.5 font-mono" style={{ color: 'var(--text-secondary)', opacity: 0.80 }}>
              {device.serialNumber}
            </p>
          )}
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

      {/* Formulaire scrollable */}
      <form onSubmit={handleSubmit(handleFormSubmit)} className="flex-1 overflow-y-auto relative z-10">
        <div className="p-5 space-y-5">

          {/* ── 1. Utilisateur (caché si hideUserField) ── */}
          {!hideUserField && (
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-3">Utilisateur</h3>
              <Field label="Utilisateur assigné" error={errors.assignedUserId?.message} required={requireUser}>
                <Controller
                  control={control}
                  name="assignedUserId"
                  render={({ field }) => (
                    <UserCombobox
                      value={field.value ?? ''}
                      displayValue={assignedUserDisplay}
                      onChange={(userId, user) => {
                        field.onChange(userId);
                        setAssignedUserDisplay(
                          user ? `${user.displayName} (${user.email})` : undefined
                        );
                      }}
                    />
                  )}
                />
              </Field>
            </section>
          )}

          {/* ── 2. Matériel — Type & Modèle ── */}
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-3">Matériel</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type" error={errors.type?.message} required>
                <Controller control={control} name="type" render={({ field }) => (
                  <AppSelect
                    value={field.value ?? ''}
                    onChange={(v) => { field.onChange(v); setValue('modelId', ''); }}
                    options={TYPE_OPTIONS}
                    placeholder="Type…"
                    error={!!errors.type}
                  />
                )} />
              </Field>

              <Field label="Modèle" error={errors.modelId?.message} required>
                <Controller control={control} name="modelId" render={({ field }) => (
                  <AppSelect
                    value={field.value ?? ''}
                    onChange={(v) => { field.onChange(v); onModelChange(v); }}
                    options={modelOptions}
                    placeholder={selectedType ? (modelOptions.length ? 'Modèle…' : 'Aucun modèle') : "Choisir un type d'abord"}
                    disabled={!selectedType || modelOptions.length === 0}
                    error={!!errors.modelId}
                  />
                )} />
              </Field>
            </div>
          </section>

          {/* ── 3. Identification (conditionnel selon le type) ── */}
          {selectedType && (
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-3">Identification</h3>
              <div className="grid grid-cols-2 gap-3">

                <Field label="N° de série" error={errors.serialNumber?.message} required>
                  {isEdit && hasHostname ? (
                    /* ── Edit workstation : pool search pour swap ── */
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border-glass)] bg-white/[0.02]">
                        <span className="text-sm font-mono text-[var(--text-primary)] flex-1 truncate">
                          {swappedDevice ? swappedDevice.sn : (device?.serialNumber ?? '—')}
                        </span>
                        {swappedDevice && (
                          <button
                            type="button"
                            onClick={() => {
                              setSwappedDevice(null);
                              setShowSnSearch(false);
                              setSnSearch('');
                              setSnResults([]);
                              setValue('serialNumber', device!.serialNumber);
                              setValue('hostname', device!.hostname ?? '');
                            }}
                            className="text-[var(--text-muted)] hover:text-red-400 transition-colors flex-shrink-0"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      {!swappedDevice && !showSnSearch && (
                        <button
                          type="button"
                          onClick={() => setShowSnSearch(true)}
                          className="text-[10px] text-[var(--text-muted)] hover:text-primary transition-colors"
                        >
                          Changer de PC
                        </button>
                      )}
                      {showSnSearch && !swappedDevice && (
                        <div className="relative">
                          <div className="relative">
                            <input
                              value={snSearch}
                              onChange={(e) => setSnSearch(e.target.value)}
                              placeholder="Rechercher un SN dans le pool..."
                              className="input-glass py-2 text-sm w-full pr-7"
                              autoFocus
                            />
                            {snLoading && (
                              <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--text-muted)]" />
                            )}
                          </div>
                          {snResults.length > 0 && (
                            <div
                              className="absolute z-20 mt-1 w-full rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-xl max-h-44 overflow-y-auto"
                              style={{ background: 'var(--surface-primary)', backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))', WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))' }}
                            >
                              {snResults.map((r) => (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() => {
                                    setSwappedDevice({ id: r.id, sn: r.serialNumber });
                                    setValue('serialNumber', r.serialNumber);
                                    if (siteVal) setValue('hostname', computeHostname(r.serialNumber, siteVal));
                                    setShowSnSearch(false);
                                    setSnSearch('');
                                    setSnResults([]);
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors flex items-center justify-between gap-4"
                                >
                                  <span className="font-mono text-[var(--text-primary)]">{r.serialNumber}</span>
                                  <span className="text-[10px] text-[var(--text-muted)] shrink-0">{r.brand} {r.model}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {snSearch.length >= 1 && snResults.length === 0 && !snLoading && (
                            <p className="mt-1 text-[10px] text-[var(--text-muted)]">Aucun PC disponible dans le pool</p>
                          )}
                          <button
                            type="button"
                            onClick={() => { setShowSnSearch(false); setSnSearch(''); setSnResults([]); }}
                            className="mt-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            Annuler
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── Création ou périphérique non-WS ── */
                    <>
                      <input
                        {...register('serialNumber', {
                          onChange: (e) => {
                            if (hasHostname && siteVal) {
                              setValue('hostname', computeHostname(e.target.value, siteVal));
                            }
                          },
                        })}
                        placeholder="Ex : ABC1234"
                        readOnly={isEdit}
                        className={`input-glass py-2 text-sm font-mono${isEdit ? ' opacity-60 cursor-not-allowed' : ''}`}
                      />
                      {!isEdit && (
                        <>
                          <button
                            type="button"
                            onClick={handleSync}
                            disabled={syncState === 'loading' || !serialNumber?.trim()}
                            className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] hover:text-primary transition-colors disabled:opacity-40"
                          >
                            {syncState === 'loading'
                              ? <Loader2 size={11} className="animate-spin" />
                              : <RefreshCw size={11} />}
                            Sync
                          </button>
                          {syncState !== 'idle' && syncState !== 'loading' && (
                            <p className={`text-[10px] flex items-center gap-1 ${
                              syncState === 'duplicate' ? 'text-amber-400' :
                              syncState === 'found'     ? 'text-emerald-400' : 'text-[var(--text-muted)]'
                            }`}>
                              {syncState === 'duplicate' && <AlertTriangle size={10} />}
                              {syncState === 'found'     && <CheckCircle size={10} />}
                              {syncMessage}
                            </p>
                          )}
                        </>
                      )}
                    </>
                  )}
                </Field>

                <Field
                  label="Tag actif"
                  error={errors.assetTag?.message}
                  required={isWorkstation || isLab}
                >
                  <input
                    {...register('assetTag')}
                    placeholder="IT-00001"
                    className="input-glass py-2 text-sm uppercase"
                  />
                </Field>

                {hasHostname && (
                  <Field label="Hostname" className="col-span-2">
                    <input
                      {...register('hostname')}
                      placeholder={serialNumber?.trim() && siteVal
                        ? computeHostname(serialNumber, siteVal)
                        : 'Ex : SFS-W-ABC1234 (auto)'}
                      readOnly={isEdit}
                      className={`input-glass py-2 text-sm${isEdit ? ' opacity-60 cursor-not-allowed' : ''}`}
                    />
                  </Field>
                )}

                {isLab && (
                  <>
                    <Field label="VLAN">
                      <input {...register('vlan')} placeholder="Ex : VLAN-10" className="input-glass py-2 text-sm" />
                    </Field>
                    <Field label="Adresse IP">
                      <input {...register('ipAddress')} placeholder="Ex : 192.168.1.100" className="input-glass py-2 text-sm" />
                    </Field>
                    <Field label="Adresse MAC">
                      <input {...register('macAddress')} placeholder="Ex : AA:BB:CC:DD:EE:FF" className="input-glass py-2 text-sm uppercase" />
                    </Field>
                    <Field label="Clé Bitlocker" className="col-span-2">
                      <input
                        {...register('bitlocker')}
                        placeholder="Clé de récupération (chiffres uniquement)"
                        className="input-glass py-2 text-sm font-mono"
                        inputMode="numeric"
                        onChange={(e) => setValue('bitlocker', e.target.value.replace(/\D/g, ''))}
                      />
                    </Field>
                  </>
                )}
              </div>
            </section>
          )}

          {/* ── 4. Spécifications — création uniquement (gérées par le catalogue en édition) ── */}
          {!isEdit && selectedType && (HAS_SPECS.includes(selectedType) || HAS_KEYBOARD_LAYOUT.includes(selectedType)) && (
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-3">Spécifications</h3>
              <div className="grid grid-cols-2 gap-3">
                {HAS_SPECS.includes(selectedType) && (
                  <>
                    <Field label="Processeur">
                      <input {...register('processor')} placeholder="Auto-rempli via modèle" className="input-glass py-2 text-sm" />
                    </Field>
                    <Field label="RAM">
                      <input {...register('ram')} placeholder="Auto-rempli via modèle" className="input-glass py-2 text-sm" />
                    </Field>
                    <Field label="Stockage">
                      <input {...register('storage')} placeholder="Auto-rempli via modèle" className="input-glass py-2 text-sm" />
                    </Field>
                    {selectedType === 'LAPTOP' && (
                      <Field label="Taille écran">
                        <input {...register('screenSize')} placeholder="Auto-rempli via modèle" className="input-glass py-2 text-sm" />
                      </Field>
                    )}
                  </>
                )}
                {HAS_KEYBOARD_LAYOUT.includes(selectedType) && (
                  <Field label="Clavier" className={HAS_SPECS.includes(selectedType) ? 'col-span-2' : ''}>
                    <Controller control={control} name="keyboardLayout" render={({ field }) => (
                      <AppSelect
                        value={field.value ?? 'AZERTY_FR'}
                        onChange={field.onChange}
                        options={KEYBOARD_OPTIONS}
                      />
                    )} />
                  </Field>
                )}
              </div>
            </section>
          )}

          {/* ── 5. Statut & Localisation ── */}
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-3">Statut & Localisation</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Site" error={errors.site?.message} required>
                <Controller control={control} name="site" render={({ field }) => (
                  <AppSelect
                    value={field.value ?? 'SUD'}
                    onChange={(v) => {
                      field.onChange(v);
                      if (hasHostname && serialNumber?.trim()) {
                        setValue('hostname', computeHostname(serialNumber, v));
                      }
                    }}
                    options={SITE_OPTIONS}
                    error={!!errors.site}
                  />
                )} />
              </Field>
              <Field label="Statut" error={errors.status?.message} required>
                <Controller control={control} name="status" render={({ field }) => (
                  <AppSelect value={field.value ?? 'IN_STOCK'} onChange={field.onChange} options={STATUS_OPTIONS} error={!!errors.status} />
                )} />
              </Field>
            </div>
          </section>

          {/* ── 6. N° commande (lecture seule si PO lié) ── */}
          {isEdit && device?.purchaseOrder?.reference && (
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-3">Commande</h3>
              <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-[var(--border-glass)] bg-white/[0.02]">
                <span className="text-xs text-[var(--text-muted)]">N° commande</span>
                <span className="text-xs font-mono font-semibold text-primary">{device.purchaseOrder.reference}</span>
              </div>
            </section>
          )}

          {/* ── 7. Notes ── */}
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-3">Notes</h3>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Informations complémentaires…"
              className="input-glass w-full py-2 text-sm resize-none"
            />
          </section>
        </div>

        {/* Pied */}
        <div className="flex gap-3 px-5 py-4 flex-shrink-0 relative z-10" style={{ borderTop: '1px solid rgba(139,120,255,0.20)' }}>
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">
            Annuler
          </button>
          <motion.button
            type="submit"
            disabled={isSaving}
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
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Enregistrer' : 'Créer'}
          </motion.button>
        </div>
      </form>
    </>
  );

  // ── Rendu via portal (échappe le transform context d'AppShell) ─
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop léger — laisse les couleurs de la page traverser le blur du panel */}
          <motion.div
            key="form-backdrop"
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,10,0.42)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', cursor: 'pointer' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.20 }}
            onClick={onClose}
          />

          {modal ? (
            /* ── Modal centrée (ex: depuis l'onglet Équipements) ── */
            <motion.div
              key="form-modal"
              style={{ position: 'fixed', inset: 0, zIndex: 201, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', pointerEvents: 'none' }}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', stiffness: 460, damping: 36, mass: 0.72 }}
            >
              <div
                className="modal-glass w-full max-w-lg flex flex-col pointer-events-auto"
                style={{ maxHeight: '90vh' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Décorations specular */}
                <div className="absolute inset-x-0 top-0 h-[2px] pointer-events-none" style={{ borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', background: 'linear-gradient(90deg, transparent 5%, rgba(180,160,255,0.80) 35%, rgba(99,200,255,0.60) 65%, transparent 95%)' }} />
                <div className="absolute top-0 left-0 pointer-events-none" style={{ width: '2px', height: '60%', background: 'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, transparent 100%)' }} />
                <div className="absolute pointer-events-none" style={{ top: '-40px', right: '-32px', width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.28) 0%, rgba(6,182,212,0.10) 45%, transparent 70%)', filter: 'blur(8px)' }} />
                {formContent}
              </div>
            </motion.div>
          ) : (
            /* ── Drawer flottant arrondi (défaut) ── */
            <motion.div
              key="form-drawer"
              className="modal-glass flex flex-col pointer-events-auto"
              style={{
                position: 'fixed',
                right: '16px',
                top: '16px',
                bottom: '16px',
                width: '440px',
                maxWidth: 'calc(100vw - 32px)',
                zIndex: 201,
              }}
              initial={{ x: 'calc(100% + 24px)', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 'calc(100% + 24px)', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.85 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Décorations liquid glass ── */}
              {/* Ligne specular supérieure */}
              <div className="absolute inset-x-0 top-0 h-[2px] pointer-events-none flex-shrink-0" style={{ borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', background: 'linear-gradient(90deg, transparent 5%, rgba(180,160,255,0.80) 30%, rgba(99,200,255,0.65) 70%, transparent 95%)' }} />
              {/* Reflet vertical gauche */}
              <div className="absolute top-0 left-0 pointer-events-none" style={{ width: '2px', height: '45%', background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)' }} />
              {/* Orbe indigo haut-droite */}
              <div className="absolute pointer-events-none" style={{ top: '-50px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(6,182,212,0.08) 45%, transparent 68%)', filter: 'blur(10px)' }} />
              {/* Orbe subtil bas-gauche */}
              <div className="absolute pointer-events-none" style={{ bottom: '-30px', left: '-30px', width: '140px', height: '140px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', filter: 'blur(8px)' }} />
              {formContent}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
