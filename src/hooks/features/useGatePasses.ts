/**
 * Gate Passes Feature Hooks
 * Consolidated API and data management for gate passes and scanning
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { GatePass, GateScan } from '@/types'

export const useGatePassesList = (status?: string, limit = 50) => {
  return useQuery({
    queryKey: ['gate-passes', 'list', status],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status) params.append('status', status)
      params.append('limit', limit.toString())
      
      const { data } = await api.get(`/gate-passes/?${params.toString()}`)
      return (data.results || data) as GatePass[]
    },
    staleTime: 2 * 60 * 1000,
  })
}

export const useStudentGatePasses = (studentId?: number) => {
  return useQuery({
    queryKey: ['gate-passes', 'student', studentId],
    queryFn: async () => {
      const { data } = await api.get(`/gate-passes/?student_id=${studentId}`)
      return (data.results || data) as GatePass[]
    },
    enabled: !!studentId,
    staleTime: 2 * 60 * 1000,
  })
}

export const useLastGateScan = () => {
  return useQuery({
    queryKey: ['gate-passes', 'last-scan'],
    queryFn: async () => {
      const { data } = await api.get('/gate-passes/last_scan/')
      return data as GateScan
    },
    refetchInterval: 30 * 1000,
    staleTime: 5 * 1000,
  })
}

export const useRequestGatePass = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: Partial<GatePass>) => {
      const { data } = await api.post('/gate-passes/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] })
    },
  })
}

export const useApproveGatePass = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (passId: number) => {
      const { data } = await api.post(`/gate-passes/${passId}/approve/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] })
    },
  })
}

export const useRejectGatePass = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (passId: number) => {
      const { data } = await api.post(`/gate-passes/${passId}/reject/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] })
    },
  })
}

export const useScanQRCode = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (qrData: string) => {
      const { data } = await api.post('/gate-passes/scan_qr/', { qr_code: qrData })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] })
      queryClient.invalidateQueries({ queryKey: ['gate-passes', 'last-scan'] })
    },
  })
}

export const useExportGatePassesCSV = () => {
  return useMutation({
    mutationFn: async (filters?: Record<string, unknown>) => {
      const params = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, String(value))
        })
      }
      
      const { data } = await api.get(`/gate-passes/export_csv/?${params.toString()}`, {
        responseType: 'blob',
      })
      return data
    },
  })
}
