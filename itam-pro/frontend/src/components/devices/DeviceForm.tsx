import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { AppSelect } from '../ui/AppSelect';
import { UserCombobox } from '../ui/UserCombobox';
import type { Device, DeviceModel, PurchaseOrder } from '../../types';
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
  { value: 'RETIRED',        label: 'Rétention' },
  { value: 'IN_MAINTENANCE', label: 'Maintenance' },
  { value: 'LOST',           label: 'Perdu' },
  { value: 'STOLEN',         label: 'Volé' },
];

const TYPE_OPTIONS = Object.entries(DEVICE_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const SITE_OPTIONS = ELKEM_SITES.map((s) => ({ value: s.code, label: s.label }));
const KEYBOARD_OPTIONS = KEYBOARD_FORM_OPTIONS.map((k) => ({
  value: k,
  label: KEYBOARD_LAYOUT_LABELS[k] ?? k,
}));

// ─── Props ────────────────────────────────────────────────────

interface DeviceFormProps {
  device?:     Device | null;
  isOpen:      boolean;
  isSaving:    boolean;
  isManager?:  boolean;
  requireUser?: boolean;   // Utilisateurs page : assignedUser obligatoire
  formTitle?:  string;     // Override titre (ex: "Nouvel utilisateur")
  onClose:     () => void;
  onSubmit:    (data: DeviceFormData) => void;
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
  device, isOpen, isSaving, isManager, requireUser, formTitle, onClose, onSubmit,
}: DeviceFormProps) {
  const isEdit = !!device;

  const [syncState, setSyncState] = useState<'idle' | 'loading' | 'found' | 'notfound' | 'duplicate'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [assignedUserDisplay, setAssignedUserDisplay] = useState<string | undefined>(undefined);
  const [pendingModelId, setPendingModelId] = useState<string | null>(null);

  // ── Schéma dynamique (assignedUserId obligatoire si requireUser) ──
  const schema = useMemo(() => z.object({
    assignedUserId: requireUser
      ? z.string().min(1, 'Utilisateur requis')
      : z.string().optional(),
    assetTag:       z.string().min(1, 'Requis').regex(/^[A-Z0-9-]+$/, 'Majuscules, chiffres et tirets uniquement'),
    serialNumber:   z.string().min(1, 'Requis'),
    site:           z.string().default('SUD'),
    status:         z.string().default(requireUser ? 'ASSIGNED' : 'IN_STOCK'),
    type:           z.string().min(1, 'Requis'),
    modelId:        z.string().min(1, 'Requis'),
    processor:      z.string().optional(),
    ram:            z.string().optional(),
    storage:        z.string().optional(),
    screenSize:     z.string().optional(),
    keyboardLayout: z.string().default('AZERTY_FR'),
    notes:          z.string().optional(),
    purchaseOrderId: z.string().optional(),
  }), [requireUser]);

  type FormValues = z.infer<typeof schema>;

  const { control, register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      keyboardLayout:  'AZERTY_FR',
      status:          requireUser ? 'ASSIGNED' : 'IN_STOCK',
      site:            'SUD',
      assignedUserId:  '',
    },
  });

  const selectedType   = watch('type');
  const serialNumber   = watch('serialNumber');

  // ── Chargement des modèles ────────────────────────────────
  const { data: models = [] } = useQuery<DeviceModel[]>({
    queryKey: ['device-models', selectedType],
    queryFn:  async () => {
      const url = selectedType ? `/devicemodels?type=${selectedType}` : '/devicemodels';
      const { data } = await api.get<DeviceModel[]>(url);
      return data;
    },
    enabled:  isOpen,
  });

  // ── Chargement des commandes (manager en mode édition) ────
  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase-orders-all'],
    queryFn:  () => api.get('/orders/history').then((r) => r.data),
    enabled:  isOpen && !!isManager && isEdit,
    staleTime: 60_000,
  });

  const poOptions = purchaseOrders.map((po) => ({
    value: po.id,
    label: `${po.reference} — ${po.deviceModel?.name ?? ''}`,
  }));

  const modelOptions = models.map((m) => ({ value: m.id, label: m.name }));

  // ── Applique le modèle après rechargement de la liste ────
  useEffect(() => {
    if (pendingModelId && models.some((m) => m.id === pendingModelId)) {
      setValue('modelId', pendingModelId);
      onModelChange(pendingModelId);
      setPendingModelId(null);
    }
  }, [models, pendingModelId]);

  // ── Pré-remplissage édition ───────────────────────────────
  useEffect(() => {
    if (device) {
      reset({
        assignedUserId:  device.assignedUserId ?? '',
        assetTag:        device.assetTag ?? '',
        serialNumber:    device.serialNumber,
        site:            device.site ?? 'SUD',
        status:          device.status ?? 'IN_STOCK',
        type:            device.type,
        modelId:         '',
        processor:       device.processor ?? '',
        ram:             device.ram ?? '',
        storage:         device.storage ?? '',
        screenSize:      device.screenSize ?? '',
        keyboardLayout:  device.keyboardLayout ?? 'AZERTY_FR',
        notes:           device.notes ?? '',
        purchaseOrderId: device.purchaseOrderId ?? '',
      });
      if (device.assignedUser) {
        setAssignedUserDisplay(`${device.assignedUser.displayName} (${device.assignedUser.email})`);
      } else {
        setAssignedUserDisplay(undefined);
      }
    } else {
      reset({
        keyboardLayout:  'AZERTY_FR',
        status:          requireUser ? 'ASSIGNED' : 'IN_STOCK',
        site:            'SUD',
        assignedUserId:  '',
      });
      setAssignedUserDisplay(undefined);
    }
    setSyncState('idle');
  }, [device, isOpen, reset]);

  // ── Auto-remplissage quand un modèle est sélectionné ─────
  const onModelChange = (modelId: string) => {
    const m = models.find((m) => m.id === modelId);
    if (m) {
      if (m.processor)  setValue('processor',  m.processor);
      if (m.ram)        setValue('ram',        m.ram);
      if (m.storage)    setValue('storage',    m.storage);
      if (m.screenSize) setValue('screenSize', m.screenSize);
    }
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
        const d = data.data;
        setSyncState('found');
        setSyncMessage(`Intune : ${d.model ?? ''}`);

      } else if (data.found && data.source === 'dell') {
        const d = data.data;
        if (d.processor) setValue('processor',  d.processor);
        if (d.ram)       setValue('ram',        d.ram);
        if (d.storage)   setValue('storage',    d.storage);
        if (d.screenSize) setValue('screenSize', d.screenSize);

        if (d.catalogModelId && d.catalogModelType) {
          const currentType = watch('type');
          if (currentType !== d.catalogModelType) {
            setValue('type', d.catalogModelType);
            setValue('modelId', '');
          }
          setPendingModelId(d.catalogModelId);
        }

        const filledSpecs = [d.processor, d.ram, d.storage].filter(Boolean).length;
        setSyncState('found');
        setSyncMessage(
          filledSpecs > 0
            ? `Dell : ${d.model} — config auto-remplie`
            : `Dell : ${d.model} (modèle non trouvé dans le catalogue local)`
        );

      } else {
        setSyncState('notfound');
        setSyncMessage(data.hint ?? 'Non trouvé sur Dell ni dans Intune');
      }
    } catch {
      setSyncState('notfound');
      setSyncMessage('Erreur de vérification');
    }
  };

  // ── Soumission ────────────────────────────────────────────
  const handleFormSubmit = (values: FormValues) => {
    const model = models.find((m) => m.id === values.modelId);
    onSubmit({
      assignedUserId:  values.assignedUserId || undefined,
      assetTag:        values.assetTag,
      serialNumber:    values.serialNumber,
      site:            values.site,
      status:          values.status,
      type:            values.type,
      brand:           model?.brand ?? 'Dell',
      model:           model?.name ?? '',
      processor:       values.processor,
      ram:             values.ram,
      storage:         values.storage,
      screenSize:      values.screenSize,
      keyboardLayout:  values.keyboardLayout,
      notes:           values.notes,
      purchaseOrderId: values.purchaseOrderId || undefined,
    } as DeviceFormData);
  };

  const title = formTitle ?? (isEdit ? `Modifier ${device?.assetTag ?? device?.serialNumber}` : 'Nouvel appareil');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg flex flex-col shadow-2xl"
            style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-glass)' }}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
          >
            {/* En-tête */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-glass)] flex-shrink-0">
              <h2 className="font-semibold text-[var(--text-primary)]">{title}</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSubmit(handleFormSubmit)} className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-5">

                {/* ── Utilisateur ── */}
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
                            if (user) {
                              setAssignedUserDisplay(`${user.displayName} (${user.email})`);
                            } else {
                              setAssignedUserDisplay(undefined);
                            }
                          }}
                        />
                      )}
                    />
                  </Field>
                </section>

                {/* ── Identification ── */}
                <section>
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-3">Identification</h3>
                  <div className="grid grid-cols-2 gap-3">

                    <Field label="Tag actif" error={errors.assetTag?.message} required>
                      <input
                        {...register('assetTag')}
                        placeholder="IT-00001"
                        className="input-glass py-2 text-sm uppercase"
                      />
                    </Field>

                    {/* N° de série + bouton Sync */}
                    <Field label="N° de série" error={errors.serialNumber?.message} required>
                      <input
                        {...register('serialNumber')}
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
                          : <RefreshCw size={11} />
                        }
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

                    <Field label="Site" error={errors.site?.message} required>
                      <Controller control={control} name="site" render={({ field }) => (
                        <AppSelect
                          value={field.value ?? 'SUD'}
                          onChange={field.onChange}
                          options={SITE_OPTIONS}
                          error={!!errors.site}
                        />
                      )} />
                    </Field>

                    <Field label="Statut" error={errors.status?.message} required>
                      <Controller control={control} name="status" render={({ field }) => (
                        <AppSelect
                          value={field.value ?? 'IN_STOCK'}
                          onChange={field.onChange}
                          options={STATUS_OPTIONS}
                          error={!!errors.status}
                        />
                      )} />
                    </Field>
                  </div>
                </section>

                {/* ── Matériel ── */}
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
                          placeholder={selectedType ? (modelOptions.length ? 'Modèle…' : 'Aucun modèle') : 'Choisir un type d\'abord'}
                          disabled={!selectedType || modelOptions.length === 0}
                          error={!!errors.modelId}
                        />
                      )} />
                    </Field>

                    <Field label="Processeur">
                      <input {...register('processor')} placeholder="Auto-rempli via modèle" className="input-glass py-2 text-sm" />
                    </Field>

                    <Field label="RAM">
                      <input {...register('ram')} placeholder="Auto-rempli via modèle" className="input-glass py-2 text-sm" />
                    </Field>

                    <Field label="Stockage">
                      <input {...register('storage')} placeholder="Auto-rempli via modèle" className="input-glass py-2 text-sm" />
                    </Field>

                    <Field label="Taille écran">
                      <input {...register('screenSize')} placeholder='Auto-rempli via modèle' className="input-glass py-2 text-sm" />
                    </Field>

                    <Field label="Clavier" className="col-span-2">
                      <Controller control={control} name="keyboardLayout" render={({ field }) => (
                        <AppSelect
                          value={field.value ?? 'AZERTY_FR'}
                          onChange={field.onChange}
                          options={KEYBOARD_OPTIONS}
                        />
                      )} />
                    </Field>
                  </div>
                </section>

                {/* ── N° commande (manager, édition seulement) ── */}
                {isManager && isEdit && (
                  <section>
                    <h3 className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-3">Commande</h3>
                    <Field label="N° commande">
                      <Controller control={control} name="purchaseOrderId" render={({ field }) => (
                        <AppSelect
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          options={[{ value: '', label: 'Non lié à une commande' }, ...poOptions]}
                          placeholder="Sélectionner une commande…"
                          disabled={!!(device?.purchaseOrderId)}
                        />
                      )} />
                      {device?.purchaseOrderId && (
                        <p className="text-[10px] text-amber-400 mt-1">Commande verrouillée — non modifiable</p>
                      )}
                    </Field>
                  </section>
                )}

                {/* ── Notes ── */}
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
