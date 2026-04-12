import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from '@/lib/api'

/**
 * Prefetch data for common routes to speed up navigation
 */
export const useRoutePrefetch = () => {
  const queryClient = useQueryClient()

  // Prefetch dashboard data when app loads
  const prefetchDashboard = useCallback(async () => {
    try {
      // Prefetch multiple queries in parallel
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: ['notifications'],
          queryFn: () => api.get('/notifications/').then((res) => res.data),
          staleTime: 2 * 60 * 1000, // 2 minutes
        }),
        queryClient.prefetchQuery({
          queryKey: ['messages'],
          queryFn: () => api.get('/messages/').then((res) => res.data),
          staleTime: 2 * 60 * 1000,
        }),
      ]).catch(() => {
        // Silently fail - just prefetch optimization
      })
    } catch {
      // Silently fail
    }
  }, [queryClient])

  // Prefetch room data
  const prefetchRooms = useCallback(async () => {
    try {
      queryClient.prefetchQuery({
        queryKey: ['rooms'],
        queryFn: () => api.get('/rooms/').then((res) => res.data),
        staleTime: 5 * 60 * 1000,
      })
    } catch {
      // Silently fail
    }
  }, [queryClient])

  // Prefetch gate passes
  const prefetchGatePasses = useCallback(async () => {
    try {
      queryClient.prefetchQuery({
        queryKey: ['gate-passes'],
        queryFn: () => api.get('/gate-passes/').then((res) => res.data),
        staleTime: 5 * 60 * 1000,
      })
    } catch {
      // Silently fail
    }
  }, [queryClient])

  // Prefetch attendance
  const prefetchAttendance = useCallback(async () => {
    try {
      queryClient.prefetchQuery({
        queryKey: ['attendance'],
        queryFn: () => api.get('/attendance/').then((res) => res.data),
        staleTime: 5 * 60 * 1000,
      })
    } catch {
      // Silently fail
    }
  }, [queryClient])

  return {
    prefetchDashboard,
    prefetchRooms,
    prefetchGatePasses,
    prefetchAttendance,
  }
}

/**
 * Prefetch on user interaction (link hover, etc)
 */
export const useLinkPrefetch = (queryKey: string[], queryFn: () => Promise<unknown>) => {
  const queryClient = useQueryClient()

  const prefetch = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: 5 * 60 * 1000,
    })
  }, [queryClient, queryKey, queryFn])

  return { prefetch }
}
