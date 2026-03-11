import { create } from 'zustand';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

interface PWAState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallable: boolean;
  isStandalone: boolean;
  setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => void;
  setStandalone: (isStandalone: boolean) => void;
  install: () => Promise<void>;
  dismiss: () => void;
}

export const usePWAStore = create<PWAState>((set, get) => ({
  deferredPrompt: null,
  isInstallable: false,
  isStandalone: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || false,
  
  setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => {
    // Only set if not already in standalone mode
    if (get().isStandalone) return;
    set({ deferredPrompt: prompt, isInstallable: !!prompt });
  },
  
  setStandalone: (isStandalone: boolean) => set({ isStandalone, isInstallable: isStandalone ? false : get().isInstallable }),
  
  install: async () => {
    const { deferredPrompt } = get();
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        set({ deferredPrompt: null, isInstallable: false });
      }
    } catch (err) {
      console.error('PWA Install failed:', err);
    }
  },
  
  dismiss: () => set({ deferredPrompt: null, isInstallable: false })
}));
