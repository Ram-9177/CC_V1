/**
 * Reports Feature Hooks
 */

import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const useAttendanceReport = <T = unknown>(period: string, enabled = true) => {
  return useQuery<T[]>({
    queryKey: ['reports-attendance', period],
    queryFn: async () => {
      const { data } = await api.get('/reports/attendance/', { params: { period } })
      return data as T[]
    },
    enabled,
    staleTime: 60 * 1000,
  })
}

export const useOccupancyReport = <T = unknown>(enabled = true) => {
  return useQuery<T[]>({
    queryKey: ['reports-rooms'],
    queryFn: async () => {
      const { data } = await api.get('/reports/rooms/')
      return data as T[]
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export const useGatePassReport = <T = unknown>(period: string, enabled = true) => {
  return useQuery<T[]>({
    queryKey: ['reports-gate-passes', period],
    queryFn: async () => {
      const { data } = await api.get('/reports/gate-passes/', { params: { period } })
      return data as T[]
    },
    enabled,
    staleTime: 60 * 1000,
  })
}

export const useExportReport = () => {
  return useMutation({
    mutationFn: async (reportType: string) => {
      const { data } = await api.get(`/reports/${reportType}/export/`, { responseType: 'blob' })
      return { data, reportType }
    },
  })
}
