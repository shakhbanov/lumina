import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import viteCompression from 'vite-plugin-compression';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'sounds/*.mp3'],
      manifest: {
        name: 'Lumina',
        short_name: 'Lumina',
        description: 'Защищённые видеозвонки и конференции',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui', 'browser'],
        orientation: 'any',
        start_url: '/',
        scope: '/',
        id: '/',
        // Android Chrome 96+, Samsung Internet and Edge route in-scope links
        // straight into the installed PWA when handle_links: 'preferred' is
        // set. Combined with launch_handler navigate-existing, an incoming
        // /room/<code> link re-uses the already-open window instead of
        // spawning a new one.
        handle_links: 'preferred',
        launch_handler: {
          client_mode: ['navigate-existing', 'auto'],
        },
        prefer_related_applications: false,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        categories: ['communication', 'productivity'],
        shortcuts: [
          {
            name: 'Новая встреча',
            url: '/?action=create',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/ws/, /^\/livekit/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/lumina\.su\/api\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', expiration: { maxEntries: 50 } },
          },
        ],
      },
    }),
    // Emit pre-compressed .gz siblings for assets so nginx can serve them
    // via `gzip_static on;` without burning CPU on every request.
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
      deleteOriginFile: false,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': { target: 'ws://localhost:8080', ws: true },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      // SSR build for prerendering must be a single self-contained file
      // (loaded via dynamic import from Node). Client build keeps the
      // vendor chunk split for browser caching.
      output: isSsrBuild
        ? undefined
        : {
            manualChunks(id: string) {
              if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
                return 'vendor';
              }
            },
          },
    },
  },
}));
