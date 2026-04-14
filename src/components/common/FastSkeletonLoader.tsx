/**
 * Ultra-fast skeleton that shows INSTANTLY
 * Used for Stage 1 (critical) dashboard data
 * Appears in <100ms, no delay
 * 
 * Usage:
 * <FastSkeletonLoader variant="cards" count={4} />
 */
import { Skeleton } from '@/components/ui/skeleton'

interface FastSkeletonLoaderProps {
  variant?: 'cards' | 'table' | 'list' | 'minimal'
  count?: number
}

export function FastSkeletonLoader({ variant = 'cards', count = 4 }: FastSkeletonLoaderProps) {
  // ⚡ Optimal pulse: 200ms (fast, visible feedback)
  const fastPulse = 'animate-pulse [animation-duration:200ms]'

  if (variant === 'cards') {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton 
            key={i} 
            className={`h-32 rounded bg-muted/30 ${fastPulse}`}
          />
        ))}
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton 
            key={i} 
            className={`h-12 w-full rounded bg-muted/30 ${fastPulse}`}
          />
        ))}
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className={`h-4 w-3/4 bg-muted/30 ${fastPulse}`} />
            <Skeleton className={`h-3 w-1/2 bg-muted/20 ${fastPulse}`} />
          </div>
        ))}
      </div>
    )
  }

  // Minimal: Just a single pulsing bar
  return <Skeleton className={`h-10 w-full rounded bg-muted/30 ${fastPulse}`} />
}
