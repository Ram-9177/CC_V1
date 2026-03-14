/**
 * Admin Features Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SystemMetrics, HealthStatus } from '@/types'

export const useMetrics = () => {
  return useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: async () => {
      const { data } = await api.get('/health-check/health/status/')
      return data as SystemMetrics
    },
    refetchInterval: 30 * 1000,
    staleTime: 5 * 1000,
  })
}

export const useHealthStatus = () => {
  return useQuery({
    queryKey: ['admin', 'health'],
    queryFn: async () => {
      const { data } = await api.get('/health-check/health/status/')
      return data as HealthStatus
    },
    refetchInterval: 30 * 1000,
    staleTime: 5 * 1000,
  })
}

export const useSystemSettings = () => {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const { data } = await api.get('/core/settings/')
      return data
    },
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
