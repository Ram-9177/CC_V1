import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRoutePrefetch } from '@/hooks/useRoutePrefetch'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={window.queryClient!}>
      {children}
    </QueryClientProvider>
  )

  it('exports all prefetch functions', () => {
    const { result } = renderHook(() => useRoutePrefetch(), { wrapper })
    const { prefetchDashboard, prefetchRooms, prefetchGatePasses, prefetchAttendance } = result.current

    expect(typeof prefetchDashboard).toBe('function')
    expect(typeof prefetchRooms).toBe('function')
    expect(typeof prefetchGatePasses).toBe('function')
    expect(typeof prefetchAttendance).toBe('function')
  })

  it('prefetch functions are memoized', () => {
    const { result, rerender } = renderHook(() => useRoutePrefetch(), { wrapper })
    const hook1 = result.current
    rerender()
    const hook2 = result.current

    expect(hook1.prefetchDashboard).toBe(hook2.prefetchDashboard)
    expect(hook1.prefetchRooms).toBe(hook2.prefetchRooms)
  })
})
