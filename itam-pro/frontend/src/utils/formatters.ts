/** Formate une date en français */
export function formatDate(date: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  }).format(new Date(date));
}

/** Formate une date avec l'heure */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/** Formate un prix en euros */
export function formatPrice(price: number | null | undefined): string {
  if (price == null) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price);
}

/** Labels affichage des statuts */
export const DEVICE_STATUS_LABELS: Record<string, string> = {
  ORDERED: 'Commandé',
  IN_STOCK: 'En stock',
  ASSIGNED: 'Attribué',
  IN_MAINTENANCE: 'En maintenance',
  LOANER: 'Prêt',
  LOST: 'Perdu',
  STOLEN: 'Volé',
  RETIRED: 'Réformé',
};

/** Labels types d'appareils */
export const DEVICE_TYPE_LABELS: Record<string, string> = {
  LAPTOP: 'Ordinateur portable',
  DESKTOP: 'Ordinateur fixe',
  SMARTPHONE: 'Smartphone',
  TABLET: 'Tablette',
  MONITOR: 'Écran',
  KEYBOARD: 'Clavier',
  MOUSE: 'Souris',
  HEADSET: 'Casque',
  DOCKING_STATION: 'Station d\'accueil',
  PRINTER: 'Imprimante',
  OTHER: 'Autre',
};

/** Labels conditions */
export const DEVICE_CONDITION_LABELS: Record<string, string> = {
  NEW: 'Neuf',
  EXCELLENT: 'Excellent',
  GOOD: 'Bon',
  FAIR: 'Passable',
  POOR: 'Mauvais',
};

/** Labels layouts clavier */
export const KEYBOARD_LAYOUT_LABELS: Record<string, string> = {
  AZERTY_FR: 'AZERTY (FR)',
  QWERTY_US: 'QWERTY (US)',
  QWERTY_UK: 'QWERTY (UK)',
  QWERTY_NO: 'QWERTY (NO)',
  QWERTY_NL: 'QWERTY (NL)',
  QWERTZ_DE: 'QWERTZ (DE)',
  QWERTZ_CH: 'QWERTZ (CH)',
  OTHER: 'Autre',
};

/** Labels rôles */
export const ROLE_LABELS: Record<string, string> = {
  MANAGER: 'Manager',
  TECHNICIAN: 'Technicien',
  VIEWER: 'Lecteur',
};

/** Labels actions audit */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATED: 'Créé',
  UPDATED: 'Modifié',
  STATUS_CHANGED: 'Statut changé',
  ASSIGNED: 'Attribué',
  UNASSIGNED: 'Désattribué',
  DELETED: 'Supprimé',
  INTUNE_SYNCED: 'Synchronisé Intune',
  MAINTENANCE_ADDED: 'Maintenance ajoutée',
  ATTACHMENT_ADDED: 'Pièce jointe ajoutée',
};

/** Couleurs par statut (classes Tailwind) */
export const DEVICE_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  ORDERED:        { bg: 'bg-blue-500/15',   text: 'text-blue-400',   dot: 'bg-blue-400' },
  IN_STOCK:       { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  ASSIGNED:       { bg: 'bg-indigo-500/15',  text: 'text-indigo-400',  dot: 'bg-indigo-400' },
  IN_MAINTENANCE: { bg: 'bg-amber-500/15',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  LOANER:         { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    dot: 'bg-cyan-400' },
  LOST:           { bg: 'bg-red-500/15',     text: 'text-red-400',     dot: 'bg-red-400' },
  STOLEN:         { bg: 'bg-red-600/15',     text: 'text-red-500',     dot: 'bg-red-500' },
  RETIRED:        { bg: 'bg-slate-500/15',   text: 'text-slate-400',   dot: 'bg-slate-400' },
};

/** Icône Lucide selon le type d'appareil (nom de l'icône) */
export const DEVICE_TYPE_ICONS: Record<string, string> = {
  LAPTOP: 'Laptop',
  DESKTOP: 'Monitor',
  SMARTPHONE: 'Smartphone',
  TABLET: 'Tablet',
  MONITOR: 'Monitor',
  KEYBOARD: 'Keyboard',
  MOUSE: 'Mouse',
  HEADSET: 'Headphones',
  DOCKING_STATION: 'Dock',
  PRINTER: 'Printer',
  OTHER: 'Package',
};
