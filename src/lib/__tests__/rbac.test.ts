import { describe, expect, it } from 'vitest'
import {
  canAccessPath,
  canEditUser,
  getRoleHome,
  isHigherRole,
} from '@/lib/rbac'

describe('rbac', () => {
  describe('getRoleHome', () => {
    it('returns role-specific home route', () => {
      expect(getRoleHome('pd')).toBe('/sports-dashboard')
      expect(getRoleHome('gate_security')).toBe('/gate-passes')
    })

    it('falls back to dashboard for unknown/empty roles', () => {
      expect(getRoleHome(undefined)).toBe('/dashboard')
      expect(getRoleHome('unknown_role')).toBe('/dashboard')
    })
  })

  describe('canAccessPath', () => {
    it('allows common paths before role resolves', () => {
      expect(canAccessPath(undefined, '/dashboard')).toBe(true)
      expect(canAccessPath(null, '/profile')).toBe(true)
    })

    it('blocks day scholars from hosteller-only areas', () => {
      expect(canAccessPath('student', '/rooms', 'day_scholar')).toBe(false)
      expect(canAccessPath('student', '/gate-passes', 'day_scholar')).toBe(false)
    })

    it('allows student HR to access room mapping', () => {
      expect(canAccessPath('student', '/room-mapping', 'hosteller', true)).toBe(true)
      expect(canAccessPath('student', '/room-mapping/floor-1', 'hosteller', true)).toBe(true)
    })

    it('enforces role-specific restrictions', () => {
      expect(canAccessPath('gate_security', '/gate-passes')).toBe(true)
      expect(canAccessPath('gate_security', '/reports')).toBe(false)
    })
  })

  describe('hierarchy helpers', () => {
    it('compares role hierarchy correctly', () => {
      expect(isHigherRole('head_warden', 'warden')).toBe(true)
      expect(isHigherRole('pt', 'pd')).toBe(false)
      expect(isHigherRole(undefined, 'student')).toBe(false)
    })

    it('applies canEditUser policy', () => {
      expect(canEditUser('admin', 'super_admin')).toBe(true)
      expect(canEditUser('pt', 'pd')).toBe(false)
      expect(canEditUser('head_warden', 'warden')).toBe(true)
    })
  })
})
