import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import type { Device } from '../../types';
import type { DeviceFormData } from '../../services/device.service';

// ─── Schéma Zod ───────────────────────────────────────────────

const schema = z.object({
  assetTag:        z.string().regex(/^[A-Z0-9-]+$/, 'Majuscules, chiffres et tirets uniquement'),
  serialNumber:    z.string().min(1, 'Requis'),
  type:            z.string().min(1, 'Requis'),
  brand:           z.string().min(1, 'Requis'),
  model:           z.string().min(1, 'Requis'),
  keyboardLayout:  z.string().default('AZERTY_FR'),
  status:          z.string().default('IN_STOCK'),
  condition:       z.string().default('GOOD'),
  processor:       z.string().optional(),
  ram:             z.string().optional(),
  storage:         z.string().optional(),
  screenSize:      z.string().optional(),
  color:           z.string().optional(),
  location:        z.string().optional(),
  site:            z.string().optional(),
  purchaseDate:    z.string().optional(),
  warrantyExpiry:  z.string().optional(),
  purchasePrice:   z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : Number(v)),
    z.number().positive().optional()
  ),
  supplier:        z.string().optional(),
  invoiceNumber:   z.string().optional(),
  notes:           z.string().optional(),
  assignedUserId:  z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────

interface DeviceFormProps {
  device?:    Device | null;
  isOpen:     boolean;
  isSaving:   boolean;
  onClose:    () => void;
  onSubmit:   (data: DeviceFormData) => void;
}

// ─── Champ de formulaire ──────────────────────────────────────

function Field({ label, error, required, className, children }: {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
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

export default function DeviceForm({ device, isOpen, isSaving, onClose, onSubmit }: DeviceFormProps) {
  const isEdit = !!device;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      keyboardLayout: 'AZERTY_FR',
      status:         'IN_STOCK',
      condition:      'GOOD',
    },
  });

  // Pré-remplissage en mode édition
  useEffect(() => {
    if (device) {
      reset({
        ...device,
        purchaseDate:   device.purchaseDate   ? new Date(device.purchaseDate).toISOString().slice(0, 10)   : '',
        warrantyExpiry: device.warrantyExpiry ? new Date(device.warrantyExpiry).toISOString().slice(0, 10) : '',
        purchasePrice:  device.purchasePrice  ?? undefined,
        assignedUserId: device.assignedUserId ?? '',
      } as FormValues);
    } else {
      reset({ keyboardLayout: 'AZERTY_FR', status: 'IN_STOCK', condition: 'GOOD' });
    }
  }, [device, reset]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl flex flex-col shadow-2xl"
            style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-glass)' }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
          >
            {/* En-tête */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-glass)] flex-shrink-0">
              <h2 className="font-semibold text-[var(--text-primary)]">
                {isEdit ? `Modifier ${device?.assetTag}` : 'Nouvel appareil'}
              </h2>
              <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors" aria-label="Fermer">
                <X size={16} />
              </button>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSubmit(onSubmit as never)} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">

                {/* ── Identification ── */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Identification</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Tag actif" error={errors.assetTag?.message} required>
                      <input {...register('assetTag')} placeholder="ELKEM-LT-001" className="input-glass py-2 text-sm uppercase" />
                    </Field>
                    <Field label="N° de série" error={errors.serialNumber?.message} required>
                      <input {...register('serialNumber')} placeholder="SN-XXXXXXXXX" className="input-glass py-2 text-sm" />
                    </Field>
                  </div>
                </section>

                {/* ── Matériel ── */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Matériel</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Type" error={errors.type?.message} required>
                      <select {...register('type')} className="input-glass py-2 text-sm">
                        <option value="">Sélectionner...</option>
                        {[
                          ['LAPTOP','Ordinateur portable'],['DESKTOP','Ordinateur fixe'],
                          ['SMARTPHONE','Smartphone'],['TABLET','Tablette'],
                          ['MONITOR','Écran'],['KEYBOARD','Clavier'],['MOUSE','Souris'],
                          ['HEADSET','Casque'],['DOCKING_STATION','Station d\'accueil'],
                          ['PRINTER','Imprimante'],['OTHER','Autre'],
                        ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </Field>
                    <Field label="Marque" error={errors.brand?.message} required>
                      <input {...register('brand')} placeholder="Dell, Apple, HP..." className="input-glass py-2 text-sm" />
                    </Field>
                    <Field label="Modèle" error={errors.model?.message} required className="col-span-2">
                      <input {...register('model')} placeholder="Latitude 5540" className="input-glass py-2 text-sm" />
                    </Field>
                    <Field label="Processeur">
                      <input {...register('processor')} placeholder="Intel Core i7-1365U" className="input-glass py-2 text-sm" />
                    </Field>
                    <Field label="RAM">
                      <input {...register('ram')} placeholder="16 Go DDR5" className="input-glass py-2 text-sm" />
                    </Field>
                    <Field label="Stockage">
                      <input {...register('storage')} placeholder="512 Go SSD NVMe" className="input-glass py-2 text-sm" />
                    </Field>
                    <Field label="Taille écran">
                      <input {...register('screenSize')} placeholder='15.6"' className="input-glass py-2 text-sm" />
                    </Field>
                    <Field label="Couleur">
                      <input {...register('color')} placeholder="Noir, Argent..." className="input-glass py-2 text-sm" />
                    </Field>
                    <Field label="Clavier">
                      <select {...register('keyboardLayout')} className="input-glass py-2 text-sm">
                        {[
                          ['AZERTY_FR','AZERTY (FR)'],['QWERTY_US','QWERTY (US)'],
                          ['QWERTY_UK','QWERTY (UK)'],['QWERTY_NO','QWERTY (NO)'],
                          ['QWERTY_NL','QWERTY (NL)'],['QWERTZ_DE','QWERTZ (DE)'],
                          ['QWERTZ_CH','QWERTZ (CH)'],['OTHER','Autre'],
                        ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </Field>
                  </div>
                </section>

                {/* ── Statut ── */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Statut</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Statut">
                      <select {...register('status')} className="input-glass py-2 text-sm">
                        {[
                          ['ORDERED','Commandé'],['IN_STOCK','En stock'],['ASSIGNED','Assigné'],
                          ['IN_MAINTENANCE','En maintenance'],['LOANER','Prêt'],
                          ['LOST','Perdu'],['STOLEN','Volé'],['RETIRED','Retraité'],
                        ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </Field>
                    <Field label="État">
                      <select {...register('condition')} className="input-glass py-2 text-sm">
                        {[
                          ['NEW','Neuf'],['EXCELLENT','Excellent'],['GOOD','Bon'],
                          ['FAIR','Passable'],['POOR','Mauvais'],
                        ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </Field>
                    <Field label="Localisation">
                      <input {...register('location')} placeholder="Bureau 3A, Salle serveur..." className="input-glass py-2 text-sm" />
                    </Field>
                    <Field label="Site">
                      <input {...register('site')} placeholder="Paris, Lyon, Kristiansand..." className="input-glass py-2 text-sm" />
                    </Field>
                  </div>
                </section>

                {/* ── Cycle de vie ── */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Cycle de vie</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Date d'achat">
                      <input type="date" {...register('purchaseDate')} className="input-glass py-2 text-sm" />
                    </Field>
                    <Field label="Fin de garantie">
                      <input type="date" {...register('warrantyExpiry')} className="input-glass py-2 text-sm" />
                    </Field>
                    <Field label="Prix d'achat (€)" error={errors.purchasePrice?.message}>
                      <input type="number" step="0.01" min="0" {...register('purchasePrice')} placeholder="1299.99" className="input-glass py-2 text-sm" />
                    </Field>
                    <Field label="Fournisseur">
                      <input {...register('supplier')} placeholder="CDW, Dell Direct..." className="input-glass py-2 text-sm" />
                    </Field>
                    <Field label="N° de facture">
                      <input {...register('invoiceNumber')} placeholder="FAC-2024-001" className="input-glass py-2 text-sm" />
                    </Field>
                  </div>
                </section>

                {/* ── Notes ── */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Notes</h3>
                  <textarea
                    {...register('notes')}
                    rows={3}
                    placeholder="Informations complémentaires..."
                    className="input-glass w-full py-2 text-sm resize-none"
                  />
                </section>
              </div>

              {/* Pied */}
              <div className="flex gap-3 px-6 py-4 border-t border-[var(--border-glass)] flex-shrink-0">
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
