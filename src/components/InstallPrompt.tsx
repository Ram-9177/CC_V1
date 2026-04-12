import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePWAStore } from '@/lib/pwa-store';
import { Download, X, Smartphone, Sparkles, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';

export function InstallPrompt() {
  const { isInstallable, install, dismiss } = usePWAStore();
  const user = useAuthStore((state) => state.user);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissedPermanently, setIsDismissedPermanently] = useState(false);

  const dismissStorageKey = `pwa-prompt-dismissed:${user?.id ?? user?.role ?? 'guest'}`;

  useEffect(() => {
    const isDismissed = localStorage.getItem(dismissStorageKey);
    if (isDismissed) {
      setIsDismissedPermanently(true);
      return;
    }
    setIsDismissedPermanently(false);
  }, [dismissStorageKey]);

  useEffect(() => {
    // Show after 3 seconds if installable and not already in standalone mode
    if (isInstallable && !isDismissedPermanently && !window.matchMedia('(display-mode: standalone)').matches) {
      const timer = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isDismissedPermanently]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    localStorage.setItem(dismissStorageKey, 'true');
    setIsDismissedPermanently(true);
    dismiss();
  }, [dismissStorageKey, dismiss]);

  const handleInstall = async () => {
    await install();
    setIsVisible(false);
  };

  useEffect(() => {
    if (!isVisible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isVisible, handleDismiss]);

  if (!isVisible || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[380] flex flex-col md:items-center md:justify-center md:p-6" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
      {/* Dimmed backdrop: blocks clicks on dashboard until user dismisses */}
      <button
        type="button"
        className="absolute inset-0 bg-background/85 backdrop-blur-sm dark:bg-background/90"
        aria-label="Close install prompt"
        onClick={handleDismiss}
      />

      {/* Panel: opaque so underlying UI does not show through; bottom sheet on phones, centered card on md+ */}
      <div
        className="relative z-[1] mt-auto flex w-full max-w-lg justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-4 mb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:mt-0 md:px-0 md:pb-8 lg:mb-0 lg:pb-0"
      >
        <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-[hsl(var(--pastel-lilac)_/_0.35)] blur-3xl dark:opacity-50" />

          <button
            type="button"
            onClick={handleDismiss}
            className="absolute right-3 top-3 z-[2] flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Dismiss install prompt"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-start gap-4 pr-10">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 shadow-inner">
              <Smartphone className="h-7 w-7 text-primary" />
            </div>

            <div className="min-w-0 space-y-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 id="pwa-install-title" className="font-display text-lg font-extrabold tracking-tight text-foreground">
                  Install Campus Core
                </h3>
                <Sparkles className="h-4 w-4 shrink-0 animate-pulse text-primary" aria-hidden />
              </div>
              <p className="text-sm font-medium leading-snug text-muted-foreground">
                Home-screen app: faster reopen, offline-friendly shell, and room for future push alerts — same secure login you use in the browser.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                Secure
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
              <Download className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                Quick open
              </span>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <Button
              type="button"
              onClick={handleInstall}
              className="h-14 w-full rounded-xl border-0 bg-gradient-to-r from-primary to-primary/90 text-base font-black uppercase tracking-wide text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              Add to home screen
            </Button>
            <button
              type="button"
              onClick={handleDismiss}
              className="min-h-[44px] w-full rounded-xl py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
