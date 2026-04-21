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
    'glass-card glass',
    // PAS d'animation CSS par défaut. Animation opt-in via prop `animate`
    // (gérée par Framer Motion plus bas). Évite tout flash à la navigation :
    // quand une page se monte, les cartes apparaissent déjà à leur position
    // finale → rendu stable, zéro seam GPU.
    paddingClasses[padding],
    hoverable && 'cursor-pointer',
    className
  );

  if (animate) {
    return (
      /*
        ⚠ Pas d'opacity dans initial/animate.
        Ce composant a backdrop-filter → opacity < 1 crée un stacking
        context → artefacts blancs / seam dans le verre pendant la
        transition. translateY + scale uniquement = rendu stable.
      */
      <motion.div
        ref={ref}
        className={baseClasses}
        initial={{ y: 20, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ duration: 0.35, delay: index * 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
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
