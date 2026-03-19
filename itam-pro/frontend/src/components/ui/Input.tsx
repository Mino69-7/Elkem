import { forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  helper?: string;
}

/**
 * Champ texte avec effet glass, label, icônes et messages d'erreur.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  leftIcon,
  rightIcon,
  helper,
  className,
  id,
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).slice(2)}`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-[var(--text-secondary)]"
        >
          {label}
          {props.required && <span className="text-red-400 ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'input-glass',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/15',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
      {helper && !error && (
        <p id={`${inputId}-helper`} className="text-xs text-[var(--text-muted)]">
          {helper}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
