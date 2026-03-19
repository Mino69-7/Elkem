import { z } from 'zod';

/** Schéma de validation pour la création/édition d'un appareil */
export const deviceSchema = z.object({
  assetTag: z
    .string()
    .min(1, 'L\'asset tag est requis')
    .regex(/^[A-Z0-9-]+$/, 'Format invalide (ex: ELKEM-LT-001)'),
  serialNumber: z
    .string()
    .min(1, 'Le numéro de série est requis'),
  type: z.enum(['LAPTOP','DESKTOP','SMARTPHONE','TABLET','MONITOR','KEYBOARD','MOUSE','HEADSET','DOCKING_STATION','PRINTER','OTHER']),
  brand: z.string().min(1, 'La marque est requise'),
  model: z.string().min(1, 'Le modèle est requis'),
  processor: z.string().optional(),
  ram: z.string().optional(),
  storage: z.string().optional(),
  screenSize: z.string().optional(),
  color: z.string().optional(),
  keyboardLayout: z.enum(['AZERTY_FR','QWERTY_US','QWERTY_UK','QWERTY_NO','QWERTY_NL','QWERTZ_DE','QWERTZ_CH','OTHER']).default('AZERTY_FR'),
  keyboardLanguage: z.string().optional(),
  status: z.enum(['ORDERED','IN_STOCK','ASSIGNED','IN_MAINTENANCE','LOANER','LOST','STOLEN','RETIRED']).default('IN_STOCK'),
  condition: z.enum(['NEW','EXCELLENT','GOOD','FAIR','POOR']).default('GOOD'),
  location: z.string().optional(),
  site: z.string().optional(),
  assignedUserId: z.string().optional(),
  purchaseDate: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  purchasePrice: z.number().positive().optional(),
  supplier: z.string().optional(),
  invoiceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type DeviceFormData = z.infer<typeof deviceSchema>;

/** Schéma de connexion locale */
export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/** Schéma maintenance */
export const maintenanceSchema = z.object({
  type: z.string().min(1, 'Le type est requis'),
  description: z.string().min(10, 'Description trop courte (min 10 caractères)'),
  cost: z.number().optional(),
  provider: z.string().optional(),
  startDate: z.string().min(1, 'La date de début est requise'),
  endDate: z.string().optional(),
});
