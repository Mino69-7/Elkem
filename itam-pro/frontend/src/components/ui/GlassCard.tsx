import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Active l'animation au survol */
  hoverable?: boolean;
  /** Animation d'entrée Framer Motion */
  animate?: boolean;
  /** Index pour les animations en stagger */
  index?: number;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

/**
 * Carte à effet Liquid Glass — composant de base du design system ITAM Pro.
 * Utilise backdrop-blur et fond translucide pour l'effet glassmorphism.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(({
  children,
  className,
  hoverable = false,
  animate = false,
  index = 0,
  padding = 'md',
  ...props
}, ref) => {
  const baseClasses = clsx(
    'glass-card',
    paddingClasses[padding],
    hoverable && 'cursor-pointer',
    className
  );

  if (animate) {
    return (
      <motion.div
        ref={ref}
        className={baseClasses}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.05, ease: 'easeOut' }}
        {...(props as React.ComponentProps<typeof motion.div>)}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div ref={ref} className={baseClasses} {...props}>
      {children}
    </div>
  );
});

GlassCard.displayName = 'GlassCard';
