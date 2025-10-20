import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pwaIcon = "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3e%3crect width='100' height='100' rx='20' fill='%233b82f6'/%3e%3ctext x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' font-family='sans-serif' font-size='50' fill='white' font-weight='bold'%3eTRG%3c/text%3e%3c/svg%3e";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      
      manifest: {
        name: "TR Genius PWA",
        short_name: "TR Genius",
        description: "Assistente de IA para criar Estudos Técnicos Preliminares e Termos de Referência, alinhado à Lei de Licitações 14.133/21.",
        lang: 'pt-BR',
        start_url: "/",
        scope: '/',
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        background_color: "#f8fafc",
        theme_color: "#3b82f6",
        orientation: "portrait-primary",
        categories: ["business", "productivity", "government"],
        icons: [
          { "src": pwaIcon, "sizes": "48x48", "type": "image/svg+xml" },
          { "src": pwaIcon, "sizes": "72x72", "type": "image/svg+xml" },
          { "src": pwaIcon, "sizes": "96x96", "type": "image/svg+xml" },
          { "src": pwaIcon, "sizes": "128x128", "type": "image/svg+xml" },
          { "src": pwaIcon, "sizes": "144x144", "type": "image/svg+xml" },
          { "src": pwaIcon, "sizes": "152x152", "type": "image/svg+xml" },
          { "src": pwaIcon, "sizes": "192x192", "type": "image/svg+xml", "purpose": "any" },
          { "src": pwaIcon, "sizes": "384x384", "type": "image/svg+xml" },
          { "src": pwaIcon, "sizes": "512x512", "type": "image/svg+xml", "purpose": "any maskable" }
        ]
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({url}) => url.origin.startsWith('https://aistudiocdn.com'),
            handler: 'CacheFirst',
            options: { cacheName: 'aistudio-cdn-cache', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          },
          {
            urlPattern: ({url}) => url.origin === 'https://cdn.tailwindcss.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'tailwind-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          },
          {
            urlPattern: ({url}) => url.origin === 'https://cdnjs.cloudflare.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'cdnjs-cache', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          },
          {
            urlPattern: ({url}) => url.origin === 'https://unpkg.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'unpkg-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          },
          {
            urlPattern: ({url}) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets-cache', expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          },
          {
            urlPattern: ({url}) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-webfonts-cache', expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          }
        ],
      },
    }),
  ],

  build: {
    minify: true,
    outDir: 'dist',
  },
});
