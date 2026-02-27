import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Avoid bandwidth-heavy tab-switch refetches
      refetchOnReconnect: 'always', // Refetch when internet reconnects
      retry: (failureCount, error: unknown) => {
        // Don't retry if offline
        if (!navigator.onLine) return false;
        
        // Don't retry on 4xx errors (client errors)
        if (error instanceof AxiosError && error.response && error.response.status >= 400 && error.response.status < 500) {
          return false;
        }
        // Retry up to 3 times for 5xx errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), 
      staleTime: 5 * 60 * 1000, // 5 minutes (faster cache refresh)
      gcTime: 30 * 60 * 1000, // 30 minutes
      networkMode: 'always', // Allow cached reads even when offline
    },
    mutations: {
      retry: 1, // Retry mutations once on failure
      networkMode: 'online',
      onError: (error: unknown) => {
        console.error('Mutation error:', error);
      },
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
  if (e.message?.includes('Failed to fetch dynamically imported module') || e.message?.includes('Importing a module script failed')) {
    console.log('Dynamic import failed, reloading page...');
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <OfflineBanner />
      <App />
    </QueryClientProvider>
  </StrictMode>,
)

// PWA Update handling
// @ts-expect-error - virtual module not found in TS
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
  },
})
