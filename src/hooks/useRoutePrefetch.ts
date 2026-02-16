import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Prefetch data for common routes to speed up navigation
 */
export const useRoutePrefetch = () => {
  const queryClient = useQueryClient()

  // Prefetch dashboard data when app loads
  const prefetchDashboard = async () => {
    try {
      // Prefetch multiple queries in parallel
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: ['profile'],
          queryFn: () => api.get('/auth/profile/').then((res) => res.data),
          staleTime: 5 * 60 * 1000, // 5 minutes
        }),
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
  }

  // Prefetch room data
  const prefetchRooms = async () => {
    try {
      queryClient.prefetchQuery({
        queryKey: ['rooms'],
        queryFn: () => api.get('/rooms/').then((res) => res.data),
        staleTime: 5 * 60 * 1000,
      })
    } catch {
      // Silently fail
    }
  }

  // Prefetch gate passes
  const prefetchGatePasses = async () => {
    try {
      queryClient.prefetchQuery({
        queryKey: ['gate-passes'],
        queryFn: () => api.get('/gate-passes/').then((res) => res.data),
        staleTime: 5 * 60 * 1000,
      })
    } catch {
      // Silently fail
    }
  }

  // Prefetch attendance
  const prefetchAttendance = async () => {
    try {
      queryClient.prefetchQuery({
        queryKey: ['attendance'],
        queryFn: () => api.get('/attendance/').then((res) => res.data),
        staleTime: 5 * 60 * 1000,
      })
    } catch {
      // Silently fail
    }
  }

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

  const prefetch = () => {
    queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: 5 * 60 * 1000,
    })
  }

  return { prefetch }
}
