/**
 * src/hooks/useStudentType.ts
 * ============================
 * Central hook for the Student Type System.
 *
 * Provides:
 *  - isHosteller / isDayScholar — synchronous boolean flags from the auth store
 *  - allowedFeatures — list of feature slugs this user can access
 *  - StudentTypeGate — JSX helper component for conditional rendering
 *
 * Usage:
 *   const { isHosteller } = useStudentType()
 *   if (!isHosteller) return <DayScholarBlock />
 *
 * Or with the gate:
 *   <HostellerOnly fallback={<DayScholarNotice />}>
 *     <RoomsPage />
 *   </HostellerOnly>
 */

import React from 'react'
import { useAuthStore } from '@/lib/store'
import type { User } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Feature slug lists (mirrors backend student_type_service.py)
// ─────────────────────────────────────────────────────────────────────────────

export const HOSTEL_FEATURES = [
  'room_allocation',
  'room_shifting',
  'mess',
  'hostel_complaints',
  'gate_pass_advanced',
  'hostel_dashboard',
  'attendance_hostel',
  'leaves',
  'visitors',
] as const

export const BASE_FEATURES = [
  'dashboard',
  'profile',
  'events',
  'sports',
  'notices',
  'notifications',
  'general_complaints',
  'digital_id',
  'resume_builder',
  'hall_booking',
] as const

export type FeatureSlug = (typeof HOSTEL_FEATURES)[number] | (typeof BASE_FEATURES)[number]

// ─────────────────────────────────────────────────────────────────────────────
// Core helpers (pure functions — no hooks, safe to use anywhere)
// ─────────────────────────────────────────────────────────────────────────────

export function checkIsHosteller(user: User | null | undefined): boolean {
  if (!user) return false
  if (user.role !== 'student') return true  // non-student staff always pass
  return user.student_type === 'hosteller'
}

export function checkIsDayScholar(user: User | null | undefined): boolean {
  if (!user) return false
  if (user.role !== 'student') return false
  return user.student_type === 'day_scholar'
}

export function getStudentFeatures(user: User | null | undefined): FeatureSlug[] {
  if (!user || user.role !== 'student') {
    return [...BASE_FEATURES, ...HOSTEL_FEATURES]
  }
  if (checkIsHosteller(user)) {
    return [...BASE_FEATURES, ...HOSTEL_FEATURES]
  }
  return [...BASE_FEATURES]
}

export function canAccessFeature(
  user: User | null | undefined,
  feature: FeatureSlug
): boolean {
  return getStudentFeatures(user).includes(feature)
}

// ─────────────────────────────────────────────────────────────────────────────
// React hook
// ─────────────────────────────────────────────────────────────────────────────

export interface StudentTypeState {
  /** Raw student_type string from the auth store */
  studentType: 'hosteller' | 'day_scholar' | undefined
  /** True if user is a hosteller (or non-student staff) */
  isHosteller: boolean
  /** True if user is a confirmed day scholar */
  isDayScholar: boolean
  /** Sorted list of feature slugs this user can access */
  allowedFeatures: FeatureSlug[]
  /** Check if a specific feature is accessible */
  canAccess: (feature: FeatureSlug) => boolean
}

export function useStudentType(): StudentTypeState {
  const user = useAuthStore((s) => s.user)

  const isHosteller = checkIsHosteller(user)
  const isDayScholar = checkIsDayScholar(user)
  const allowedFeatures = getStudentFeatures(user)

  return {
    studentType: user?.student_type as 'hosteller' | 'day_scholar' | undefined,
    isHosteller,
    isDayScholar,
    allowedFeatures,
    canAccess: (feature: FeatureSlug) => allowedFeatures.includes(feature),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gate Components
// ─────────────────────────────────────────────────────────────────────────────

interface GateProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Renders children ONLY for hostellers.
 * Day scholars see the optional fallback (or nothing).
 */
export function HostellerOnly({ children, fallback = null }: GateProps) {
  const { isHosteller } = useStudentType()
  return isHosteller
    ? React.createElement(React.Fragment, null, children)
    : React.createElement(React.Fragment, null, fallback)
}

/**
 * Renders children ONLY for day scholars.
 */
export function DayScholarOnly({ children, fallback = null }: GateProps) {
  const { isDayScholar } = useStudentType()
  return isDayScholar
    ? React.createElement(React.Fragment, null, children)
    : React.createElement(React.Fragment, null, fallback)
}

/**
 * Generic feature gate — renders children if the user can access the feature.
 */
export function FeatureGate({
  feature,
  children,
  fallback = null,
}: GateProps & { feature: FeatureSlug }) {
  const { canAccess } = useStudentType()
  return canAccess(feature)
    ? React.createElement(React.Fragment, null, children)
    : React.createElement(React.Fragment, null, fallback)
}
