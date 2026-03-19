import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'inline-flex items-center justify-center gap-2 rounded-xl font-medium text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
  danger: 'inline-flex items-center justify-center gap-2 rounded-xl font-medium text-sm text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-red-500 hover:bg-red-600 shadow-[0_4px_14px_rgba(239,68,68,0.3)]',
  success: 'inline-flex items-center justify-center gap-2 rounded-xl font-medium text-sm text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-600 shadow-[0_4px_14px_rgba(16,185,129,0.3)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
  icon: 'p-2.5',
};

/**
 * Composant bouton avec variantes, états de chargement et animations.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  className,
  variant = 'secondary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}, ref) => {
  return (
    <motion.button
      ref={ref}
      className={clsx(variantClasses[variant], sizeClasses[size], className)}
      disabled={disabled || loading}
      whileTap={{ scale: 0.97 }}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      ) : leftIcon ? (
        <span aria-hidden="true">{leftIcon}</span>
      ) : null}
      {children}
      {rightIcon && !loading && (
        <span aria-hidden="true">{rightIcon}</span>
      )}
    </motion.button>
  );
});

Button.displayName = 'Button';
