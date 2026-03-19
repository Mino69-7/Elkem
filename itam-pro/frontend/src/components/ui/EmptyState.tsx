import { PackageSearch } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * État vide illustré pour les listes sans données.
 */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      role="status"
      aria-label={title}
    >
      <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-4 text-[var(--text-muted)]" aria-hidden="true">
        {icon ?? <PackageSearch size={36} strokeWidth={1.5} />}
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--text-secondary)] max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant="primary"
          className="mt-6"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}
