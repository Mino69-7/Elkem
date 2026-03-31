import { useEffect, useState } from 'react';
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
  modelId:         z.string().min(1, 'Requis'),
  assetTag:        z.string().optional(),
  serialNumber:    z.string().optional(),
  hostname:        z.string().optional(),
  vlan:            z.string().optional(),
  ipAddress:       z.string().optional(),
  macAddress:      z.string().optional(),
  bitlocker:       z.boolean().optional(),
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
    // Priorité 1 : ID exact (ex : sync Dell)
    if (pendingModelId && models.some((m) => m.id === pendingModelId)) {
      setValue('modelId', pendingModelId);
      onModelChange(pendingModelId);
      setPendingModelId(null);
      return;
    }
    // Priorité 2 : recherche par marque+nom (pré-remplissage édition)
    if (pendingModelSearch && models.length > 0) {
      const found = models.find(
        (m) =>
          m.brand.toLowerCase() === pendingModelSearch.brand.toLowerCase() &&
          m.name.toLowerCase()  === pendingModelSearch.model.toLowerCase()
      );
      if (found) setValue('modelId', found.id);
      setPendingModelSearch(null);
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
        modelId:         '',   // sera résolu par pendingModelSearch ci-dessous
        hostname:        device.hostname ?? '',
        vlan:            device.vlan ?? '',
        ipAddress:       device.ipAddress ?? '',
        macAddress:      device.macAddress ?? '',
        bitlocker:       device.bitlocker ?? false,
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
      // Déclenche la recherche de modèle par marque+nom une fois les modèles chargés
      setPendingModelSearch({ brand: device.brand, model: device.model });
    } else {
      reset({
        keyboardLayout:  'AZERTY_FR',
        status:          (requireUser || forcedUserId) ? 'ASSIGNED' : 'IN_STOCK',
        site:            'SUD',
        assignedUserId:  '',
        bitlocker:       false,
        type:            initialType ?? '',
        assetTag:        'IT-',
      });
      setAssignedUserDisplay(undefined);
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
      brand:           model?.brand ?? 'Dell',
      model:           model?.name ?? '',
      processor:       values.processor || undefined,
      ram:             values.ram || undefined,
      storage:         values.storage || undefined,
      screenSize:      values.screenSize || undefined,
      keyboardLayout:  values.keyboardLayout,
      notes:           values.notes || undefined,
      purchaseOrderId: values.purchaseOrderId || undefined,
      hostname:        values.hostname || undefined,
      vlan:            values.vlan || undefined,
      ipAddress:       values.ipAddress || undefined,
      macAddress:      values.macAddress || undefined,
      bitlocker:       values.bitlocker,
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
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-glass)] flex-shrink-0">
        <h2 className="font-semibold text-[var(--text-primary)]">{title}</h2>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Formulaire scrollable */}
      <form onSubmit={handleSubmit(handleFormSubmit)} className="flex-1 overflow-y-auto">
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
                  <input
                    {...register('serialNumber', {
                      onChange: (e) => {
                        if (hasHostname && siteVal) {
                          setValue('hostname', computeHostname(e.target.value, siteVal));
                        }
                      },
                    })}
                    placeholder="Ex : ABC1234"
                    className="input-glass py-2 text-sm"
                  />
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
                      className="input-glass py-2 text-sm"
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
                    <Field label="Bitlocker" className="col-span-2">
                      <button
                        type="button"
                        onClick={() => setValue('bitlocker', !bitlockerVal)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors text-sm font-medium w-full ${
                          bitlockerVal
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                            : 'border-[var(--border-glass)] text-[var(--text-muted)] hover:bg-white/5'
                        }`}
                      >
                        {bitlockerVal
                          ? <><Shield size={14} /> Bitlocker activé</>
                          : <><ShieldOff size={14} /> Bitlocker désactivé</>
                        }
                      </button>
                    </Field>
                  </>
                )}
              </div>
            </section>
          )}

          {/* ── 4. Spécifications — visible uniquement si le type a des specs ou un clavier ── */}
          {selectedType && (HAS_SPECS.includes(selectedType) || HAS_KEYBOARD_LAYOUT.includes(selectedType)) && (
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
        <div className="flex gap-3 px-5 py-4 border-t border-[var(--border-glass)] flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2 text-sm">
            Annuler
          </button>
          <button type="submit" disabled={isSaving} className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-2">
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </>
  );

  // ── Rendu : modal centrée OU drawer latéral ────────────────
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay commun */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {modal ? (
            /* ── Modal centrée ── */
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-lg flex flex-col rounded-2xl shadow-2xl pointer-events-auto overflow-hidden"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-glass)',
                  maxHeight: '90vh',
                }}
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ type: 'spring', stiffness: 400, damping: 38 }}
                onClick={(e) => e.stopPropagation()}
              >
                {formContent}
              </motion.div>
            </motion.div>
          ) : (
            /* ── Drawer latéral (défaut) ── */
            <motion.div
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg flex flex-col shadow-2xl"
              style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-glass)' }}
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            >
              {formContent}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
