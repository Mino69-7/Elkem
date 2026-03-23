import * as Select from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

interface AppSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
}

/**
 * Select custom basé sur Radix UI.
 * Fond sombre, texte blanc, compatible react-hook-form via Controller.
 */
export function AppSelect({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner…',
  disabled = false,
  className,
  error = false,
}: AppSelectProps) {
  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <Select.Root value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <Select.Trigger
        className={clsx(
          'input-glass flex items-center justify-between gap-2 text-sm cursor-pointer select-none',
          'data-[placeholder]:text-[var(--text-muted)]',
          error && 'border-red-500/50',
          className
        )}
      >
        <Select.Value placeholder={placeholder}>
          {selectedLabel ?? <span className="text-[var(--text-muted)]">{placeholder}</span>}
        </Select.Value>
        <Select.Icon className="flex-shrink-0 text-[var(--text-muted)]">
          <ChevronDown size={14} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className={clsx(
            'z-[200] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl shadow-2xl',
            'border border-[var(--border-glass)]',
            'animate-in fade-in-0 zoom-in-95'
          )}
          style={{
            background: 'var(--bg-secondary)',
            maxHeight: '280px',
          }}
        >
          <Select.Viewport className="p-1 overflow-y-auto max-h-[272px]">
            {options.map((opt) => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                className={clsx(
                  'relative flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none select-none',
                  'text-[var(--text-primary)]',
                  'data-[highlighted]:bg-indigo-600/20 data-[highlighted]:text-[var(--text-primary)]',
                  'data-[state=checked]:text-indigo-400',
                  'transition-colors'
                )}
              >
                <Select.ItemText>{opt.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check size={12} className="text-indigo-400 flex-shrink-0" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
