/**
 * Reports Feature Hooks
 */

import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const useAttendanceReport = () => {
  return useMutation({
    mutationFn: async (payload: { start_date: string; end_date: string; format?: 'pdf' | 'excel' }) => {
      const { data } = await api.post('/reports/attendance/', payload, { responseType: 'blob' })
      return data
    },
  })
}

export const useOccupancyReport = () => {
  return useMutation({
    mutationFn: async (payload: { format?: 'pdf' | 'excel' } = {}) => {
      const { data } = await api.post('/reports/occupancy/', payload, { responseType: 'blob' })
      return data
    },
  })
}

export const useGatePassReport = () => {
  return useMutation({
    mutationFn: async (payload: { start_date: string; end_date: string; format?: 'pdf' | 'excel' }) => {
      const { data } = await api.post('/reports/gate-passes/', payload, { responseType: 'blob' })
      return data
    },
  })
}

export const useExportReport = () => {
  return useMutation({
    mutationFn: async (payload: { report_type: string; format: 'pdf' | 'excel' }) => {
      const { data } = await api.get(
        `/reports/${payload.report_type}/export/?format=${payload.format}`,
        { responseType: 'blob' }
      )
      return data
    },
  })
}
