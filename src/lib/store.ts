import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'

// Re-export User from types for backward compatibility
export type { User }

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  hasHydrated: boolean
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  setHasHydrated: (value: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      hasHydrated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, token: null, isAuthenticated: false })
      },
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated,
        token: state.token 
      }),
    }
  )
)
