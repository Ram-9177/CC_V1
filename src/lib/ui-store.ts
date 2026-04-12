/**
 * CampusCore UI Store
 * ====================
 * Global UI state that is NOT user-data — layout, modal management, loading flags.
 * Separate from auth store so auth state changes don't re-render UI components.
 *
 * Budget server benefit: fewer cross-slice re-renders per state update.
 */
import { create } from 'zustand'

interface UIState {
  /** Sidebar open/closed on mobile */
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void

  /** Global full-screen loading (e.g., during session restore) */
  globalLoading: boolean
  setGlobalLoading: (loading: boolean) => void

  /** Stack of open modal IDs — allows nested modals and proper z-index */
  modalStack: string[]
  openModal: (id: string) => void
  closeModal: (id: string) => void
  isModalOpen: (id: string) => boolean

  /** Digital ID Dialog state */
  isDigitalIDOpen: boolean
  setDigitalIDOpen: (open: boolean) => void

  /** Command Palette (Cmd+K) state */
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
  toggleCommandPalette: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),

  globalLoading: false,
  setGlobalLoading: (loading) => set({ globalLoading: loading }),

  modalStack: [],
  openModal: (id) => set(s => ({
    modalStack: s.modalStack.includes(id) ? s.modalStack : [...s.modalStack, id]
  })),
  closeModal: (id) => set(s => ({
    modalStack: s.modalStack.filter(m => m !== id)
  })),
  isModalOpen: (id) => get().modalStack.includes(id),

  isDigitalIDOpen: false,
  setDigitalIDOpen: (open) => set({ isDigitalIDOpen: open }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleCommandPalette: () => set(s => ({ commandPaletteOpen: !s.commandPaletteOpen })),
}))
