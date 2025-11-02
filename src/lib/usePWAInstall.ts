import { useEffect, useState, useCallback } from 'react';

// Hook to capture and trigger the PWA install prompt
// Returns { canInstall, promptInstall, installed, platformHints }
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any | null>(null);
  const [installed, setInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  // Basic platform hints
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone;

  useEffect(() => {
    const onBIP = (e: any) => {
      // Prevent the mini-infobar on mobile
      e.preventDefault?.();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', onBIP as any);
    window.addEventListener('appinstalled', onInstalled as any);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP as any);
      window.removeEventListener('appinstalled', onInstalled as any);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return { outcome: 'unavailable' } as const;
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setCanInstall(false);
      return choiceResult as { outcome: 'accepted' | 'dismissed' };
    } catch {
      return { outcome: 'dismissed' as const };
    }
  }, [deferredPrompt]);

  return {
    canInstall: canInstall && !installed && !isStandalone,
    promptInstall,
    installed: installed || isStandalone,
    platformHints: { isIOS, isStandalone },
  } as const;
}
