/**
 * Admin Features Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SystemMetrics, HealthStatus } from '@/types'

export const useMetrics = (enabled = true) => {
  return useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: async () => {
      const { data } = await api.get('/health-check/health/status/')
      return data as SystemMetrics
    },
    enabled,
    refetchInterval: 120 * 1000, // Reduced from 30s to 120s for health monitoring
    staleTime: 60 * 1000,
  })
}

export const useHealthStatus = (enabled = true) => {
  return useQuery({
    queryKey: ['admin', 'health'],
    queryFn: async () => {
      const { data } = await api.get('/health-check/health/status/')
      return data as HealthStatus
    },
    enabled,
    refetchInterval: 120 * 1000, // Reduced from 30s to 120s
    staleTime: 60 * 1000,
  })
}

export const useSystemSettings = (enabled = true) => {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const { data } = await api.get('/core/settings/')
      return data
    },
    enabled,
    staleTime: 60 * 60 * 1000,
  })
}

export const useUpdateSystemSettings = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.put('/core/settings/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
    },
  })
}
