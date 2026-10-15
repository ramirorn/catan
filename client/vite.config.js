import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Night-indigo theme: title/status bar like <meta name="theme-color"> in
// index.html, splash background = body background (--color-night)
const THEME_COLOR = '#10141d'
const BACKGROUND_COLOR = '#141c2c'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable PWA. The service worker is only generated/registered by
    // `vite build` (devOptions disabled), never in `vite dev`.
    VitePWA({
      // New versions wait until the player taps "Actualizar" (or every tab is
      // closed): never reloads the page in the middle of a game.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'Catán Shinobi',
        short_name: 'Catán',
        description:
          'Catan multijugador en tiempo real con estética ninja: comercia, construye y expande tu aldea oculta.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone'],
        orientation: 'any',
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        categories: ['games'],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell + every built chunk (the three.js chunk is included on
        // purpose: the 3D dice are used in every game, and keeping it cached
        // means a deploy mid-game never breaks its lazy import).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // big install-only icons are fetched by the browser itself
        globIgnores: ['**/pwa-512x512.png', '**/maskable-512x512.png', '**/app-icon.svg', '**/icons.svg'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        // Real-time server + health check are never served from the SW (no
        // route matches them either, so the SW does not even intercept them)
        navigateFallbackDenylist: [/^\/socket\.io/, /^\/health/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
