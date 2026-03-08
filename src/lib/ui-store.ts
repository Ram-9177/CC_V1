
import { create } from 'zustand';

interface UIState {
  isDigitalIDOpen: boolean;
  setDigitalIDOpen: (open: boolean) => void;
  openDigitalID: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isDigitalIDOpen: false,
  setDigitalIDOpen: (open) => set({ isDigitalIDOpen: open }),
  openDigitalID: () => set({ isDigitalIDOpen: true }),
}));
