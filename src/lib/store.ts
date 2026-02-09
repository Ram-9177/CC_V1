import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: number
  username: string
  hall_ticket?: string
  first_name?: string
  last_name?: string
  name: string
  phone?: string
  role: 'student' | 'staff' | 'admin' | 'super_admin' | 'head_warden' | 'warden' | 'chef' | 'gate_security' | 'security_head'
  registration_number?: string
  profile_picture?: string
  room_number?: string
  room?: {
    id: number
    room_number: string
    floor: number
    building: string
  }
  college?: {
    id: number
    name: string
  }
  tenant?: {
    father_name?: string
    father_phone?: string
    emergency_contact?: string
    blood_group?: string
    address?: string
    college_code?: string
  }
  risk_status?: 'low' | 'medium' | 'high' | 'critical'
  risk_score?: number
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, token: null, isAuthenticated: false })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
