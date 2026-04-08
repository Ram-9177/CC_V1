/**
 * ProgressivePage — Load critical content first, secondary content after
 *
 * Renders the page shell instantly, loads critical sections first,
 * then lazy-loads secondary sections with staggered fade-in.
 *
 * Usage:
 *   <ProgressivePage
 *     header={<h1>Dashboard</h1>}
 *     critical={<StatCards />}
 *     secondary={[
 *       { key: 'chart', element: <ActivityChart /> },
 *       { key: 'table', element: <RecentTable /> },
 *     ]}
 *   />
 */

import { Suspense, type ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { FadeIn } from './FadeIn'

interface SecondarySection {
  key: string
  element: ReactNode
  skeleton?: ReactNode
}

interface ProgressivePageProps {
  /** Always-rendered page header (title, breadcrumbs, actions) */
  header: ReactNode
  /** High-priority content rendered first */
  critical: ReactNode
  /** Lower-priority sections loaded afterward with staggered fade-in */
  secondary?: SecondarySection[]
  className?: string
}

const defaultSkeleton = (
  <div className="space-y-3">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-48 w-full rounded" />
  </div>
)

export function ProgressivePage({ header, critical, secondary, className = '' }: ProgressivePageProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header renders instantly — no data dependency */}
      <FadeIn>{header}</FadeIn>

      {/* Critical content — loaded first, shown with short fade */}
      <FadeIn delay={50}>{critical}</FadeIn>

      {/* Secondary sections — staggered appearance */}
      {secondary?.map(({ key, element, skeleton }, index) => (
        <FadeIn key={key} delay={120 + index * 80}>
          <Suspense fallback={skeleton ?? defaultSkeleton}>
            {element}
          </Suspense>
        </FadeIn>
      ))}
    </div>
  )
}
