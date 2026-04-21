import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'ITAM Pro — IT Asset Management',
        short_name: 'ITAM Pro',
        description: 'Gestion de parc informatique Elkem',
        theme_color: '#6366f1',
        background_color: '#0a0a0f',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Précache CacheFirst implicite : à l'install du SW, tous les chunks
        // JS/CSS/fonts/icônes versionnés du build sont placés en cache. Les
        // hash dans le nom de fichier (index-abc123.js) garantissent qu'un
        // nouveau deploy invalide proprement sans conflit de cache.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          // API : NetworkFirst → données fraîches si en ligne, fallback cache si offline.
          {
            urlPattern: /^https?:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 300 },
            },
          },
          // Chunks JS/CSS chargés dynamiquement (code-splitting React.lazy).
          // CacheFirst car les chunks sont versionnés par hash → jamais
          // besoin de revalider, le cache est authoritative.
          // Couvre le cas des chunks qui échapperaient au précache (ex: nouveaux
          // assets ajoutés entre deux build sans rafraîchissement du SW).
          {
            urlPattern: ({ request }: { request: Request }) =>
              request.destination === 'script' || request.destination === 'style',
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-chunks-v1',
              expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          // Fonts : CacheFirst long — polices ne changent quasi jamais.
          {
            urlPattern: ({ request }: { request: Request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-fonts-v1',
              expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
