import { motion } from 'framer-motion';

/**
 * Écran de chargement plein écran affiché entre le login et l'arrivée
 * dans l'app. Bloque le rendu de l'AppShell tant que TOUS les chunks
 * de pages n'ont pas été téléchargés — garantie : quand il disparaît,
 * toute navigation interne est instantanée (zéro flash, zéro skeleton).
 *
 * Le fond (body::before) est déjà en place côté CSS — on n'y touche pas.
 * On n'ajoute que le contenu central : logo + ring de progression + texte.
 */
export default function AppLoadingSplash() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 overflow-hidden">
      {/* Orbes décoratifs animés — mêmes que le Login pour cohérence visuelle */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <motion.div
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{ scale: [1, 1.15, 1], x: [0, 40, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(6,182,212,0.20) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{ scale: [1, 1.2, 1], y: [0, -30, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
      </div>

      {/* Carte centrale */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="modal-glass relative z-10 flex flex-col items-center gap-6 px-10 py-12"
        style={{ minWidth: 320, maxWidth: 400 }}
      >
        {/* Logo centré avec double anneau de progression rotatif */}
        <div className="relative flex items-center justify-center" style={{ width: 96, height: 96 }}>
          {/* Anneau extérieur — rotation indigo */}
          <motion.svg
            className="absolute inset-0"
            width="96"
            height="96"
            viewBox="0 0 96 96"
            animate={{ rotate: 360 }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="ring1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="1" />
                <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
            </defs>
            <circle
              cx="48"
              cy="48"
              r="42"
              fill="none"
              stroke="url(#ring1)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="180 264"
            />
          </motion.svg>

          {/* Anneau intérieur — contre-rotation cyan */}
          <motion.svg
            className="absolute inset-0"
            width="96"
            height="96"
            viewBox="0 0 96 96"
            animate={{ rotate: -360 }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="ring2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
                <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="1" />
              </linearGradient>
            </defs>
            <circle
              cx="48"
              cy="48"
              r="34"
              fill="none"
              stroke="url(#ring2)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="120 214"
            />
          </motion.svg>

          {/* Logo ITAM Pro — pulse doux */}
          <motion.div
            className="relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500"
            style={{ width: 56, height: 56, boxShadow: '0 8px 24px rgba(99,102,241,0.45)' }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="6" width="28" height="18" rx="3" stroke="white" strokeWidth="2" fill="none" />
              <path d="M10 24v3M22 24v3M7 27h18" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path
                d="M8 12h4M8 16h8M8 19h6"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.7"
              />
            </svg>
          </motion.div>
        </div>

        {/* Texte */}
        <div className="text-center space-y-1">
          <p className="text-base font-semibold text-[var(--text-primary)]">
            Préparation de l'application
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Chargement des modules en cours…
          </p>
        </div>

        {/* Barre de progression indéterminée */}
        <div
          className="w-full h-1 rounded-full overflow-hidden"
          style={{ background: 'rgba(99,102,241,0.12)' }}
          role="progressbar"
          aria-label="Chargement"
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #6366f1 0%, #06b6d4 50%, #6366f1 100%)',
              width: '40%',
            }}
            animate={{ x: ['-100%', '250%'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </div>
  );
}
