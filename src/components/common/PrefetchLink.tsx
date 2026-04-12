/**
 * PrefetchLink — Preload route data on hover/focus for instant navigation
 *
 * Wraps react-router <Link> and triggers queryClient.prefetchQuery
 * on pointerEnter so the destination page data is already cached
 * before the user clicks.
 */

import { useCallback, useRef } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface PrefetchLinkProps extends LinkProps {
  /** Queries to prefetch when hovered — [{queryKey, url, staleTime?}] */
  prefetch?: Array<{
    queryKey: QueryKey
    url: string
    staleTime?: number
  }>
}

export function PrefetchLink({ prefetch, onPointerEnter, onFocus, ...props }: PrefetchLinkProps) {
  const queryClient = useQueryClient()
  const prefetched = useRef(false)

  const doPrefetch = useCallback(() => {
    if (prefetched.current || !prefetch?.length) return
    prefetched.current = true

    prefetch.forEach(({ queryKey, url, staleTime = 2 * 60 * 1000 }) => {
      queryClient.prefetchQuery({
        queryKey,
        queryFn: () => api.get(url).then((r) => r.data),
        staleTime,
      })
    })
  }, [prefetch, queryClient])

  return (
    <Link
      {...props}
      onPointerEnter={(e) => {
        doPrefetch()
        onPointerEnter?.(e)
      }}
      onFocus={(e) => {
        doPrefetch()
        onFocus?.(e)
      }}
    />
  )
}
