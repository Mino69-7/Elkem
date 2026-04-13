# 🎨 Liquid Glass iOS 26 — Référence d'implémentation

> **Ce fichier documente l'implémentation réelle et validée** du thème Liquid Glass sur ITAM Pro.
> Il sert de référence pour les futures modifications et pour réappliquer le thème si besoin.

## Règle absolue et non négociable

> ⚠️ NE RIEN DÉPLACER, NE RIEN SUPPRIMER, NE RIEN RESTRUCTURER.
> Tous les boutons, tableaux, formulaires, menus, pages et fonctionnalités doivent rester exactement aux mêmes emplacements et continuer à fonctionner identiquement. Seul l'habillage visuel change.

---

## Architecture 3 couches (validée en production)

```
Layer 0 — body::before { position: fixed; z-index: -1 }
          ↳ Gradient radial multi-orbes, NE SCROLLE PAS avec le contenu
          ↳ backdrop-filter voit TOUJOURS la même couche de base

Layer 1 — .glass, .glass-card, .navbar-glass, .sidebar-glass
          ↳ background semi-transparent + backdrop-filter blur/saturate
          ↳ Les parents peuvent avoir overflow:hidden sans bloquer backdrop-filter

Layer 2 — Texte, icônes, boutons (nets, non floutés)
          ↳ position: relative; z-index: 1 (au-dessus du spéculaire ::before)
```

### Pourquoi `body::before { position: fixed }` et pas `body { background }`

Si on met le gradient directement sur `body { background }`, il scrolle avec le contenu. Le `backdrop-filter` floute alors une couche qui se déplace, ce qui donne un effet incohérent selon la position de scroll. Avec `position: fixed`, la couche de base est toujours stationnaire — le verre flou reste cohérent à n'importe quel endroit de la page.

---

## Système de thème — IMPORTANT

**L'app utilise un toggle manuel via `data-theme` sur `<html>`, PAS `prefers-color-scheme`.**

```css
/* ✅ CORRECT — à utiliser */
[data-theme="dark"] body::before { ... }
[data-theme="dark"] { --glass-bg: ...; }

/* ❌ FAUX — n'aura aucun effet sur cette app */
@media (prefers-color-scheme: dark) { ... }
```

Le thème est géré par `uiStore` (Zustand persist) et se traduit par `document.documentElement.dataset.theme = 'dark'|'light'`.

---

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `frontend/src/styles/liquid-glass.css` | **Créé** — source unique du thème |
| `frontend/src/main.tsx` | `import './styles/liquid-glass.css'` après `import './index.css'` |
| `frontend/index.html` | SVG filter `#liquid-distortion` dans `<body>` |
| `frontend/src/index.css` | `body { background: var(--bg-primary) }` (shorthand, pas background-color) |
| `frontend/src/components/layout/AppShell.tsx` | Root div → `style={{ background: 'transparent' }}` |
| `frontend/src/components/layout/Sidebar.tsx` | Classe `.sidebar-glass`, suppression inline style |
| `frontend/src/components/layout/TopBar.tsx` | Classe `.navbar-glass`, suppression inline style |
| `frontend/src/components/layout/MobileNav.tsx` | Classe `.navbar-glass`, suppression inline style |
| `frontend/src/components/ui/GlassCard.tsx` | Classes `glass glass-reveal` ajoutées |
| `frontend/src/components/devices/DeviceTable.tsx` | `<table>` → `.table-glass`, suppression `border-b` des `<tr>` |
| Dropdowns (AppSelect, UserCombobox, DeviceFilters) | `background: var(--surface-primary)` + backdropFilter |
| Modales (DeviceForm, DeviceDetail, Devices) | `background: var(--surface-primary)` + backdropFilter |

---

## Layer 0 — Fond fixe (liquid-glass.css)

```css
body {
  background: transparent; /* index.css est surchargé ici */
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;

  /* LIGHT MODE — orbes pastels sur base lavande */
  background:
    radial-gradient(ellipse 72% 62% at 18% 28%,  rgba(99, 102, 241, 0.38) 0%, transparent 58%),
    radial-gradient(ellipse 62% 56% at 82% 16%,  rgba(6,  182, 212, 0.28) 0%, transparent 54%),
    radial-gradient(ellipse 68% 58% at 62% 88%,  rgba(245,158,  11, 0.20) 0%, transparent 52%),
    radial-gradient(ellipse 58% 52% at  8% 76%,  rgba(167,139, 250, 0.30) 0%, transparent 54%),
    radial-gradient(ellipse 52% 48% at 90% 70%,  rgba(236, 72, 153, 0.16) 0%, transparent 50%),
    radial-gradient(ellipse 40% 40% at 50% 50%,  rgba(99, 102, 241, 0.08) 0%, transparent 70%),
    #dae1ff;
}

[data-theme="dark"] body::before {
  /* DARK MODE — espace profond + orbes vives (VisionOS) */
  background:
    radial-gradient(ellipse 80% 72% at 18% 36%,  rgba(99,  66, 245, 0.70) 0%, transparent 58%),
    radial-gradient(ellipse 66% 62% at 82% 14%,  rgba(6,  182, 212, 0.52) 0%, transparent 56%),
    radial-gradient(ellipse 74% 64% at 65% 86%,  rgba(245,158,  11, 0.40) 0%, transparent 54%),
    radial-gradient(ellipse 62% 60% at 10% 82%,  rgba(139, 92, 246, 0.50) 0%, transparent 56%),
    radial-gradient(ellipse 56% 54% at 92% 68%,  rgba(236, 72, 153, 0.28) 0%, transparent 50%),
    radial-gradient(ellipse 45% 45% at 48% 50%,  rgba(99,  66, 245, 0.12) 0%, transparent 70%),
    #02020a;
}
```

---

## Variables CSS (valeurs validées)

### Light mode (`:root`)

```css
:root {
  /* Glass core */
  --glass-bg:        rgba(255, 255, 255, 0.28);   /* PAS 0.55, trop opaque */
  --glass-bg-hover:  rgba(255, 255, 255, 0.42);
  --glass-bg-active: rgba(255, 255, 255, 0.58);
  --glass-border:        rgba(255, 255, 255, 0.65);
  --glass-border-hover:  rgba(255, 255, 255, 0.90);

  /* Navigation (glass plus épais pour lisibilité) */
  --nav-glass-bg:   rgba(255, 255, 255, 0.52);
  --nav-glass-blur: 48px;

  /* Blur & filter */
  --glass-blur:        20px;
  --glass-blur-heavy:  36px;
  --glass-blur-light:   8px;
  --glass-saturation:  1.8;
  --glass-brightness:  1.04;

  /* Surfaces (modales, dropdowns) */
  --surface-primary:   rgba(255, 255, 255, 0.76);
  --surface-secondary: rgba(255, 255, 255, 0.52);
  --surface-tertiary:  rgba(255, 255, 255, 0.32);

  /* Chaînage de variables — index.css lit ces variables */
  /* .glass-card, .btn-secondary, .input-glass en bénéficient automatiquement */
  --bg-glass:       var(--glass-bg);
  --bg-glass-hover: var(--glass-bg-hover);
  --border-glass:   var(--glass-border);
  --shadow-glass:   var(--glass-shadow), var(--glass-shadow-inset);
  --blur: blur(var(--glass-blur)) saturate(var(--glass-saturation)) brightness(var(--glass-brightness));
}
```

### Dark mode (`[data-theme="dark"]`)

```css
[data-theme="dark"] {
  /* Verre sombre ET TRANSPARENT — laisse les orbes colorées visibles */
  --glass-bg:        rgba(5,  5, 18, 0.36);   /* PAS 0.55, trop opaque masque les orbes */
  --glass-bg-hover:  rgba(8,  8, 26, 0.52);
  --glass-bg-active: rgba(12,12, 34, 0.66);
  --glass-border:        rgba(255, 255, 255, 0.13);
  --glass-border-hover:  rgba(255, 255, 255, 0.28);

  --nav-glass-bg:   rgba(3, 3, 14, 0.64);

  --glass-blur:        22px;
  --glass-saturation:  1.5;
  --glass-brightness:  0.95;

  --surface-primary:   rgba(6,  6, 20, 0.82);
  --surface-secondary: rgba(10,10, 28, 0.68);
  --surface-tertiary:  rgba(14,14, 36, 0.50);
}
```

---

## Classes CSS principales

### `.glass` — container générique

```css
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation)) brightness(var(--glass-brightness));
  -webkit-backdrop-filter: ...;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-shadow), var(--glass-shadow-inset);
  position: relative;
  overflow: hidden;
}

/* Reflet spéculaire — impression de surface courbe */
.glass::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--glass-specular);
  pointer-events: none;
  z-index: 0;
}

/* IMPORTANT : le contenu doit être z-index: 1 pour passer au-dessus du spéculaire */
.glass > * {
  position: relative;
  z-index: 1;
}
```

### `.navbar-glass` / `.sidebar-glass` — navigation

```css
.navbar-glass {
  background: var(--nav-glass-bg) !important;
  backdrop-filter: blur(var(--nav-glass-blur, 48px)) saturate(2) brightness(var(--glass-brightness)) !important;
}

.sidebar-glass {
  background: var(--nav-glass-bg) !important;
  backdrop-filter: blur(var(--nav-glass-blur, 48px)) saturate(2) brightness(var(--glass-brightness)) !important;
  box-shadow: 2px 0 24px rgba(0, 0, 0, 0.12) !important;
}
```

### `.table-glass` — tableaux card-per-row

```css
.table-glass {
  width: 100%;
  border-collapse: separate;   /* OBLIGATOIRE — sinon border-spacing ignoré */
  border-spacing: 0 5px;       /* espacement vertical entre les lignes */
}
/* Chaque <td> reçoit border-top/bottom/left(first)/right(last) + border-radius aux extrémités */
/* NE PAS mettre border-b sur les <tr> — ça entre en conflit avec border-spacing */
```

### Dropdowns et modales

```css
/* Utiliser --surface-primary (plus opaque que --glass-bg) pour les éléments "au-dessus" */
style={{
  background: 'var(--surface-primary)',
  backdropFilter: 'blur(var(--glass-blur-heavy)) saturate(var(--glass-saturation))',
  WebkitBackdropFilter: '...',
  border: '1px solid var(--glass-border)',
}}
```

---

## SVG Filter (index.html)

```html
<!-- Dans <body>, juste après l'ouverture, avant <div id="root"> -->
<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
  <defs>
    <filter id="liquid-distortion">
      <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" result="noise" seed="2"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>
</svg>
```

Utilisation CSS : `filter: url(#liquid-distortion)` sur les éléments devant avoir l'effet liquide animé.

---

## Pièges connus et solutions

### 1. AppShell.tsx — fond transparent
```tsx
// ✅ OBLIGATOIRE — sinon le gradient body::before est masqué
<div className="flex h-screen overflow-hidden" style={{ background: 'transparent' }}>
```

### 2. Sidebar / TopBar — supprimer les inline styles
```tsx
// ❌ À supprimer
style={{ background: 'var(--bg-secondary)' }}

// ✅ Remplacer par la classe CSS
className="sidebar-glass"
```

### 3. DeviceTable — border-b interdit sur `<tr>`
```tsx
// ❌ Entre en conflit avec border-collapse: separate
<motion.tr className="border-b border-[var(--border-glass)] ...">

// ✅ .table-glass CSS gère les bordures sur <td>
<motion.tr className="transition-colors group cursor-pointer">
```

### 4. `overflow: hidden` ne bloque pas backdrop-filter
`overflow: hidden` sur un parent n'empêche pas `backdrop-filter` de voir à travers. La règle est : les parents doivent être **transparents** (pas avoir leur propre background opaque) pour que la couche fixed soit visible.

### 5. Variables CSS — chaînage obligatoire
Sans le chaînage dans `:root`, les classes existantes de `index.css` (`.glass-card`, `.btn-secondary`, `.input-glass`) continuent à lire les anciennes variables et n'adoptent pas le thème.
```css
/* Dans :root de liquid-glass.css */
--bg-glass:     var(--glass-bg);       /* .glass-card l'utilise */
--border-glass: var(--glass-border);   /* plusieurs composants */
--blur: blur(var(--glass-blur)) saturate(...) brightness(...);  /* .glass-card backdrop-filter */
```

---

## Étape 1 — Audit préalable (si réapplication)

Avant de toucher au moindre fichier de style :

1. Lister tous les fichiers CSS / Tailwind config actuellement utilisés.
2. Lister tous les composants (boutons, cards, navbars, modales, tableaux, etc.).
3. Identifier le système de thème actuel (variables CSS, dark mode — `data-theme` ou `prefers-color-scheme`).
4. Vérifier la stack exacte (React / Vue / Next.js / Vite / etc.).
5. Vérifier si `body::before { position: fixed }` est déjà en place.

---

## Étape 2 — Installation (si nécessaire)

Le package `@creativoma/liquid-glass` est optionnel — le thème actuel est implémenté en CSS pur.
Si des effets de réfraction avancés sont souhaités sur certains composants uniquement :

```bash
pnpm add @creativoma/liquid-glass
```

```jsx
import { LiquidGlass } from '@creativoma/liquid-glass';
import '@creativoma/liquid-glass/dist/style.css';

// Enveloppe un composant existant sans en changer le contenu
<LiquidGlass borderRadius={22} blur={18} saturation={1.8} brightness={1.05}>
  {/* Contenu existant intact */}
</LiquidGlass>
```

Utiliser uniquement sur les éléments statiques qui n'ont pas déjà un `backdrop-filter`.

---

## Étape 3 — Responsive

```css
@media (max-width: 1024px) {
  :root {
    --glass-blur: 16px;
    --glass-blur-heavy: 28px;
    --nav-glass-blur: 36px;
  }
}

@media (max-width: 768px) {
  :root {
    --glass-blur: 12px;
    --glass-blur-heavy: 24px;
    --nav-glass-blur: 28px;
    --radius-lg: 14px;
    --radius-xl: 20px;
    --radius-2xl: 28px;
  }
  .btn-glass { padding: 12px 18px; min-height: 44px; min-width: 44px; }
  .modal-glass { border-radius: var(--radius-xl); margin: 12px; }
}

@media (max-width: 390px) {
  :root { --glass-blur: 8px; --radius-lg: 12px; }
}
```

---

## Contraintes finales

- ✅ Tous les éléments de navigation, boutons, tableaux, formulaires et fonctionnalités restent en place.
- ✅ Aucune route, page ou logique métier n'est modifiée.
- ✅ Les classes CSS existantes ne sont pas supprimées — les nouvelles s'ajoutent en complément.
- ✅ `[data-theme="dark"]` uniquement — jamais `@media (prefers-color-scheme: dark)`.
- ✅ Les couleurs de texte restent lisibles (contraste minimum WCAG AA).
- ✅ `prefers-reduced-motion` est respecté (animations désactivées si préférence system).
- ✅ `backdrop-filter` nécessite des parents transparents (pas d'`overflow: hidden` bloquant + pas de background opaque sur les parents).
- ✅ Tester sur Chrome, Safari (iOS) et Firefox avant de valider.
