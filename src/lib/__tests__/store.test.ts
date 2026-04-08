import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useAuthStore } from '@/lib/store'
import type { User } from '@/types'

/**
 * Auth Store Tests
 * Tests Zustand authentication state management
 */

describe('Auth Store (Zustand)', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Reset store state
    useAuthStore.getState().logout()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('initializes with empty state', () => {
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
  })

  it('sets user and token on login', () => {
    const mockUser: User = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'student',
      name: 'Test User',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const mockToken = 'test-jwt-token'

    useAuthStore.getState().setUser(mockUser)
    useAuthStore.getState().setToken(mockToken)

    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(state.token).toBe(mockToken)
    expect(state.isAuthenticated).toBe(true)
  })

  it('clears state on logout', () => {
    const mockUser: User = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'student',
      name: 'Test User',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    useAuthStore.getState().setUser(mockUser)
    useAuthStore.getState().setToken('test-token')

    expect(useAuthStore.getState().isAuthenticated).toBe(true)

    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
  })

  it('persists state to localStorage', () => {
    const mockUser: User = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'student',
      name: 'Test User',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    useAuthStore.getState().setUser(mockUser)
    useAuthStore.getState().setToken('ephemeral-token')

    const stored = localStorage.getItem('auth-storage')
    expect(stored).toBeTruthy()

    const parsed = JSON.parse(stored!)
    expect(parsed.state.user).toEqual(mockUser)
    expect(parsed.state.token).toBeUndefined()
  })

  it('updates user partial data', () => {
    const mockUser: User = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'student',
      name: 'Test User',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    useAuthStore.getState().setUser(mockUser)

    const updated: User = {
      ...mockUser,
      email: 'newemail@example.com',
    }
    useAuthStore.getState().setUser(updated)

    expect(useAuthStore.getState().user?.email).toBe('newemail@example.com')
  })
})
