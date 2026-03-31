import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

import path from 'node:path'
import { fileURLToPath } from 'url'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      devOptions: {
        enabled: false,
      },
      registerType: 'prompt', // Use prompt to allow manual refresh or auto-reload via main.tsx
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'pwa/*.png', 'pwa/*.svg'],
      manifest: {
        name: 'SMG CampusCore Management',
        short_name: 'SMG CampusCore',
        description: 'SMG CampusCore Management System',
        theme_color: '#FF9F68', // Pastel Orange
        background_color: '#FFFBF7', // Warm Cream
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa/icon-180.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        // Essential for versioning and lifecycle control
        importScripts: ['/service-worker.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/ws/], // Do not handle API/WS with fallback
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Requirement 5: Network First strategy for HTML files
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              expiration: {
                maxEntries: 50,
              },
              networkTimeoutSeconds: 3, // Fallback to cache fast if network is slow
            },
          },
          {
            // Requirement 5: Cache First for static assets like images and fonts
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|woff2?)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
             urlPattern: /\/api\/.*/i,
             handler: 'NetworkOnly',
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2015',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: false, // Speed up builds
    sourcemap: false,
    rollupOptions: {
      output: {
        // Let Vite handle chunk splitting automatically.
        // Manual chunks cause circular dependency errors with recharts/d3
        // ("Cannot access 'S' before initialization") → blank white page.
      },
    },
  },
  server: {
    host: '0.0.0.0', // Allow network access
    allowedHosts: true, // Allow tunnel hosts
    proxy: {
      '/api': {
        // Use IPv4 explicitly. Some environments resolve `localhost` to ::1 first,
        // causing proxy failures when the backend only binds IPv4.
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },

  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      },
    },
  },
})
