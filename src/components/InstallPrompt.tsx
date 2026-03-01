import { useState, useEffect } from 'react';
import { usePWAStore } from '@/lib/pwa-store';
import { Download, X, Smartphone, Sparkles, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function InstallPrompt() {
  const { isInstallable, install, dismiss } = usePWAStore();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissedPermanently, setIsDismissedPermanently] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (isDismissed) {
      setIsDismissedPermanently(true);
    }
  }, []);

  useEffect(() => {
    // Show after 3 seconds if installable and not already in standalone mode
    if (isInstallable && !isDismissedPermanently && !window.matchMedia('(display-mode: standalone)').matches) {
      const timer = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isDismissedPermanently]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
    setIsDismissedPermanently(true);
    dismiss();
  };

  const handleInstall = async () => {
    await install();
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-4 sm:p-6 lg:hidden animate-pwa-slide-up">
      <div className="mx-auto max-w-lg bg-card/95 backdrop-blur-2xl border border-primary/20 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] p-6 relative overflow-hidden ring-1 ring-white/20">
        {/* Background Sparkle Effect */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />

        <button 
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 shadow-inner border border-primary/10">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
          
          <div className="space-y-1 pt-1">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-lg tracking-tight">Install SMG Hostel</h3>
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            </div>
            <p className="text-sm text-muted-foreground font-medium leading-tight">
              Get the full experience with offline access and instant push notifications.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-8">
           <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-2xl border border-border/50">
              <ShieldCheck className="h-4 w-4 text-success" />
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Secure App</span>
           </div>
           <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-2xl border border-border/50">
              <Download className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Fast Load</span>
           </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button 
            onClick={handleInstall}
            className="w-full h-14 primary-gradient text-white font-black text-lg uppercase tracking-wider rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all border-0"
          >
            Add to Home Screen
          </Button>
          <button 
            onClick={handleDismiss}
            className="w-full py-3 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            Not right now
          </button>
        </div>
      </div>
    </div>
  );
}
