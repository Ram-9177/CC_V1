import { describe, it, expect, beforeEach } from 'vitest'
import { useRoutePrefetch } from '@/hooks/useRoutePrefetch'
import { QueryClient } from '@tanstack/react-query'

/**
 * Route Prefetch Hook Tests
 * Tests intelligent data prefetching for routes
 */

// Extend window type to include queryClient
declare global {
  interface Window {
    queryClient?: QueryClient
  }
}

describe('useRoutePrefetch Hook', () => {
  beforeEach(() => {
    // Create isolated query client for tests
    window.queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
  })

  it('exports all prefetch functions', () => {
    const { prefetchDashboard, prefetchRooms, prefetchGatePasses, prefetchAttendance } =
      useRoutePrefetch()

    expect(typeof prefetchDashboard).toBe('function')
    expect(typeof prefetchRooms).toBe('function')
    expect(typeof prefetchGatePasses).toBe('function')
    expect(typeof prefetchAttendance).toBe('function')
  })

  it('prefetch functions are memoized', () => {
    const hook1 = useRoutePrefetch()
    const hook2 = useRoutePrefetch()

    expect(hook1.prefetchDashboard).toBe(hook2.prefetchDashboard)
    expect(hook1.prefetchRooms).toBe(hook2.prefetchRooms)
  })
})
