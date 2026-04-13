import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Loader2, User } from 'lucide-react';
import api from '../../services/api';

interface UserOption {
  id: string;
  displayName: string;
  email: string;
  department?: string;
}

interface UserComboboxProps {
  value: string;          // userId sélectionné
  displayValue?: string;  // "Jean Dupont (jean@elkem.com)" pour affichage initial
  onChange: (userId: string, user?: UserOption) => void;
  error?: boolean;
  placeholder?: string;
  /** inline=true : résultats dans le flux normal (pour modals) — le conteneur grandit au lieu de déborder */
  inline?: boolean;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function UserCombobox({ value, displayValue, onChange, error, placeholder = 'Rechercher un utilisateur…', inline = false }: UserComboboxProps) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<UserOption[]>([]);
  const [isOpen, setIsOpen]         = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [selected, setSelected]     = useState<UserOption | null>(null);

  const inputRef    = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Initialise l'affichage si on édite un device existant
  useEffect(() => {
    if (value && displayValue && !selected) {
      // displayValue = "Jean Dupont (jean@elkem.com)"
      setSelected({ id: value, displayName: displayValue, email: '' });
    }
    if (!value) {
      setSelected(null);
      setQuery('');
    }
  }, [value, displayValue]);

  // Recherche utilisateurs
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    api.get<UserOption[]>(`/users?search=${encodeURIComponent(debouncedQuery)}&limit=8`)
      .then(({ data }) => {
        if (!cancelled) {
          setResults(Array.isArray(data) ? data : (data as any).data ?? []);
          setIsOpen(true);
        }
      })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Ferme la liste si clic en dehors
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // Si l'utilisateur a tapé sans sélectionner → reset
        if (!selected) setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selected]);

  const handleSelect = useCallback((user: UserOption) => {
    setSelected(user);
    setQuery('');
    setIsOpen(false);
    onChange(user.id, user);
  }, [onChange]);

  const handleClear = useCallback(() => {
    setSelected(null);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    onChange('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Si on retape après avoir sélectionné → désélectionne
    if (selected) {
      setSelected(null);
      onChange('');
    }
    setQuery(e.target.value);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Chip sélectionné */}
      {selected ? (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
          error
            ? 'border-red-400/50 bg-red-400/5'
            : 'border-[var(--border-glass)] bg-[var(--bg-glass)]'
        }`}>
          <User size={14} className="text-[var(--color-primary)] flex-shrink-0" />
          <span className="flex-1 text-[var(--text-primary)] text-sm truncate">
            {selected.displayName}
            {selected.email && (
              <span className="text-[var(--text-muted)] ml-1 text-xs">({selected.email})</span>
            )}
          </span>
          <button
            type="button"
            onClick={handleClear}
            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        /* Champ de recherche */
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 ${
          error
            ? 'border-red-400/50 bg-red-400/5'
            : 'border-[var(--border-glass)] bg-[var(--bg-glass)]'
        } focus-within:border-[var(--color-primary)] focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]`}>
          {isLoading
            ? <Loader2 size={14} className="text-[var(--text-muted)] animate-spin flex-shrink-0" />
            : <Search size={14} className="text-[var(--text-muted)] flex-shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => { if (results.length > 0) setIsOpen(true); }}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults([]); setIsOpen(false); }}
              className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Résultats — mode inline (dans le flux) ou dropdown absolu */}
      {isOpen && results.length > 0 && (
        <div
          className={
            inline
              ? 'mt-1 rounded-xl border border-[var(--border-glass)] overflow-hidden'
              : 'absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-[var(--border-glass)] overflow-hidden shadow-xl'
          }
          style={{ background: 'var(--surface-primary)', backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))', WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))' }}
        >
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(user); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/10 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-indigo-300">
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--text-primary)] font-medium truncate">{user.displayName}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">{user.email}</div>
              </div>
              {user.department && (
                <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">{user.department}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Aucun résultat */}
      {isOpen && !isLoading && results.length === 0 && debouncedQuery.length >= 2 && (
        <div
          className={
            inline
              ? 'mt-1 rounded-xl border border-[var(--border-glass)] px-3 py-3 text-sm text-[var(--text-muted)]'
              : 'absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-[var(--border-glass)] px-3 py-3 text-sm text-[var(--text-muted)] shadow-xl'
          }
          style={{ background: 'var(--surface-primary)', backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))', WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturation))' }}
        >
          Aucun utilisateur trouvé pour « {debouncedQuery} »
        </div>
      )}
    </div>
  );
}
