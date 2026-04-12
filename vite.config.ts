import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { visualizer } from 'rollup-plugin-visualizer'

import path from 'node:path'
import { fileURLToPath } from 'url'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const analyzeBundle = process.env.ANALYZE_BUNDLE === 'true'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    ...(analyzeBundle
      ? [
          visualizer({
            filename: 'dist/bundle-analysis.html',
            gzipSize: true,
            brotliSize: true,
            open: false,
            template: 'treemap',
          }),
        ]
      : []),
    VitePWA({
      devOptions: {
        enabled: false,
      },
      registerType: 'prompt', // Use prompt to allow manual refresh or auto-reload via main.tsx
      includeAssets: ['Logo.png', 'favicon.ico', 'favicon.png', 'apple-touch-icon.png', 'og-image.png', 'masked-icon.svg', 'pwa/*.png', 'pwa/*.svg'],
      manifest: {
        name: 'Campus Core',
        short_name: 'Campus Core',
        description: 'Campus Core Management System',
        // Aligned with src/index.css :root primary & background (indigo + cool white)
        theme_color: '#4B5DEE',
        background_color: '#F6F7FC',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/pwa/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
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
    cssMinify: true,
    chunkSizeWarningLimit: 800,
    reportCompressedSize: false, // Speed up builds
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,   // Remove console.log calls in prod
        drop_debugger: true,
        passes: 2,
      },
    },
    rollupOptions: {
      output: {
        // Stable chunk names for long-lived Service Worker cache hits
        manualChunks: {
          // Core React runtime — changes rarely, cache indefinitely
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Data fetching — changes independently from UI
          'vendor-query': ['@tanstack/react-query'],
          // UI primitives — rarely change
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-dropdown-menu'],
          // HTTP — stable
          'vendor-axios': ['axios'],
          // Date utilities used by several heavy pages
          'vendor-date': ['date-fns'],
          // Heavy visualization modules should stay out of app shell
          'vendor-charts': ['recharts'],
          // QR libraries are non-critical for initial dashboard paint
          'vendor-qr': ['qrcode.react'],
        },
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
