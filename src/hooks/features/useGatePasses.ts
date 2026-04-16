/**
 * Gate Passes Feature Hooks
 * Consolidated API and data management for gate passes and scanning
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/core/query/keys'
import type { GatePass, GateScan } from '@/types'

export const useGatePassesList = <T = unknown>(params: {
  status?: string
  hall_ticket?: string
  page?: number
}) => {
  const { status, hall_ticket, page = 1 } = params
  return useQuery<T>({
    queryKey: queryKeys.gatePasses.list({ status, hall_ticket, page }),
    queryFn: async () => {
      const qs = new URLSearchParams()
      qs.append('page', page.toString())
      if (status && status !== 'all') qs.append('status', status)
      if (hall_ticket) qs.append('hall_ticket', hall_ticket)
      const { data } = await api.get(`/gate-passes/?${qs.toString()}`)
      return data as T
    },
    staleTime: 30 * 1000,
  })
}

export const useStudentGatePasses = (studentId?: number) => {
  return useQuery({
    queryKey: queryKeys.gatePasses.student(studentId),
    queryFn: async () => {
      const { data } = await api.get(`/gate-passes/?student_id=${studentId}`)
      return (data.results || data) as GatePass[]
    },
    enabled: !!studentId,
    staleTime: 2 * 60 * 1000,
  })
}

export const useActivePass = () => {
  return useQuery({
    queryKey: queryKeys.gatePasses.active(),
    queryFn: async () => {
      const { data } = await api.get('/gate-passes/active_pass/')
      return data as GatePass | null
    },
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  })
}

export const useLastGateScan = () => {
  return useQuery({
    queryKey: queryKeys.gatePasses.lastScan(),
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
    mutationFn: async (payload: FormData) => {
      const { data } = await api.post('/gate-passes/', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gatePasses.all() })
      queryClient.invalidateQueries({ queryKey: ['student-bundle'] })
    },
  })
}

export const useApproveGatePass = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, remarks, parent_informed }: { id: number; remarks: string; parent_informed: boolean }) => {
      const { data } = await api.post(`/gate-passes/${id}/approve/`, { remarks, parent_informed })
      return data as GatePass
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gatePasses.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() })
    },
  })
}

export const useRejectGatePass = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, remarks }: { id: number; remarks: string }) => {
      const { data } = await api.post(`/gate-passes/${id}/reject/`, { remarks })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gatePasses.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() })
    },
  })
}

export const useScanQRCode = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ digital_qr, location }: { digital_qr: string; location?: string }) => {
      const { data } = await api.post('/gate-passes/scan/', { digital_qr, location })
      return data as GatePass
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gatePasses.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.gatePasses.lastScan() })
      queryClient.invalidateQueries({ queryKey: queryKeys.gatePasses.active() })
    },
  })
}

export const useVerifyGatePass = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, action, location }: { id: number; action: 'check_out' | 'check_in' | 'deny_exit'; location?: string }) => {
      const { data } = await api.post(`/gate-passes/${id}/verify/`, { action, location })
      return data as GatePass
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gatePasses.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.gatePasses.active() })
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
