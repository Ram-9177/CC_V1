import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import App from './App.tsx'
import './index.css'

const savedTheme = localStorage.getItem('theme')
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark')
} else if (savedTheme === 'light') {
  document.documentElement.classList.remove('dark')
} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark')
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,  // Prevents burst refetches on tab switch
      refetchOnReconnect: true,
      refetchOnMount: true,
      retry: (failureCount, error: unknown) => {
        if (!navigator.onLine) return false;
        if (error instanceof AxiosError && error.response && error.response.status >= 400 && error.response.status < 500) {
          return false; // Never retry client errors (401/403/404/422)
        }
        return failureCount < 2; // Max 2 retries for 5xx
      },
      // Cap at 10s: On a slow CPU, exponential backoff can exceed 15s which blocks the UI thread
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // 2min stale: data re-fetched only after 2 min. WS invalidations still propagate instantly.
      staleTime: 2 * 60 * 1000,
      // 5min gcTime: released from memory after 5 min of inactivity. Prevents cache bloat on 1-2GB RAM devices.
      gcTime: 5 * 60 * 1000,
      // offlineFirst: serve from cache immediately, then attempt network. Crucial for slow data connections.
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 0, // Never auto-retry mutations (idempotency not guaranteed)
      networkMode: 'online',
    },
  },
})

const OfflineBanner = () => {
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-2 z-[9999] text-sm font-bold flex items-center justify-center gap-2 shadow-md">
       ⚠️ You are currently offline. Some features may be unavailable.
    </div>
  );
};

// Handle Vite dynamic import errors (404s during deployments)
window.addEventListener('vite:preloadError', (event) => {
  console.log('Vite preload error, reloading page...', event);
  window.location.reload();
});

window.addEventListener('error', (e) => {
  const errMessage = e.message || '';
  const target = e.target as HTMLElement;
  
  const isChunkError = 
    errMessage.includes('Failed to fetch dynamically imported module') || 
    errMessage.includes('Importing a module script failed') ||
    (target?.tagName === 'LINK' && (target as HTMLLinkElement).href?.includes('assets/')) ||
    (target?.tagName === 'SCRIPT' && (target as HTMLScriptElement).src?.includes('assets/'));

  if (isChunkError) {
    console.log('Asset chunk load failed, reloading page to get latest version...');
    window.location.reload();
  }
}, true); // Use capture phase to catch resource load errors

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <OfflineBanner />
      <App />
    </QueryClientProvider>
  </StrictMode>,
)

// Requirement 4: Implement update detection
// @ts-expect-error - virtual module
import { registerSW } from 'virtual:pwa-register'

if (import.meta.env.PROD) {
  const updateSW = registerSW({
    onNeedRefresh() {
      // Requirement 4: Prompt the user to refresh
      const shouldUpdate = confirm('A new version of CampusCore is available. Click OK to update and refresh now.');
      if (shouldUpdate) {
        updateSW(true);
      }
    },
    onOfflineReady() {
      console.log('App is ready for offline use.');
    },
  });

  // Periodic update check — every 30min instead of 1hr to fit within device sleep cycles
  setInterval(() => {
    updateSW();
  }, 30 * 60 * 1000);
} else if ('serviceWorker' in navigator) {
  // Dev guard: remove stale SW registrations so localhost is never intercepted.
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });
}
