/**
 * StaleGuard — Stale-while-revalidate pattern for React Query
 *
 * Shows previously cached data instantly while refetching in the background.
 * Only falls back to a skeleton when there's zero cached data (first load).
 *
 * Usage:
 *   <StaleGuard query={complaintsQuery} skeleton={<PageSkeleton variant="list" />}>
 *     {(data) => <ComplaintsList data={data} />}
 *   </StaleGuard>
 */

import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'

interface StaleGuardProps<T> {
  /** The useQuery result object */
  query: UseQueryResult<T>
  /** Skeleton/loader shown only on first load (no cached data) */
  skeleton: ReactNode
  /** Render function that receives the (possibly stale) data */
  children: (data: T) => ReactNode
  /** Optional: component shown on error when no cached data exists */
  errorFallback?: ReactNode
}

export function StaleGuard<T>({ query, skeleton, children, errorFallback }: StaleGuardProps<T>) {
  const { data, isLoading, isError, isFetching } = query

  // Has data (possibly stale) — render it immediately
  if (data !== undefined) {
    return (
      <div className="relative">
        {/* Subtle refetch indicator — a thin animated bar at the top */}
        {isFetching && (
          <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden rounded-full bg-primary/10">
            <div className="h-full w-1/3 animate-[slide_1.5s_ease-in-out_infinite] bg-primary/40 rounded-full" />
          </div>
        )}
        {children(data)}
      </div>
    )
  }

  // First load — no cached data yet
  if (isLoading) return <>{skeleton}</>

  // Error with no cached data
  if (isError) {
    return (
      <>
        {errorFallback ?? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Couldn't load data — retrying…
          </div>
        )}
      </>
    )
  }

  return <>{skeleton}</>
}
