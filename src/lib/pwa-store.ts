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
}

interface PWAState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallable: boolean;
  setDeferredPrompt: (prompt: BeforeInstallPromptEvent) => void;
  install: () => Promise<void>;
  dismiss: () => void;
}

export const usePWAStore = create<PWAState>((set, get) => ({
  deferredPrompt: null,
  isInstallable: false,
  setDeferredPrompt: (prompt: BeforeInstallPromptEvent) => set({ deferredPrompt: prompt, isInstallable: !!prompt }),
  install: async () => {
    const { deferredPrompt } = get();
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      set({ deferredPrompt: null, isInstallable: false });
    }
  },
  dismiss: () => set({ deferredPrompt: null, isInstallable: false })
}));
