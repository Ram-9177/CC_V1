/**
 * RefetchBar — Subtle top-of-section indicator during background refetch
 *
 * A thin animated bar that communicates "we're syncing" without
 * blocking the UI or showing a spinner. The user sees stale data
 * with a barely-visible progress hint.
 *
 * Usage:
 *   <RefetchBar active={query.isFetching && !query.isLoading} />
 */

import { cn } from '@/lib/utils'

interface RefetchBarProps {
  /** Whether to show the bar */
  active: boolean
  className?: string
}

export function RefetchBar({ active, className }: RefetchBarProps) {
  if (!active) return null

  return (
    <div
      className={cn(
        'h-0.5 w-full overflow-hidden rounded-full bg-primary/10',
        className,
      )}
      role="progressbar"
      aria-label="Updating data"
    >
      <div className="h-full w-1/3 animate-slide rounded-full bg-primary/40" />
    </div>
  )
}
