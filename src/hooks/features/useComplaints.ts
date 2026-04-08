/**
 * Complaints Feature Hooks (Phase 4 SLA & Operational)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Complaint } from '@/types'

export const useComplaintsList = (params?: Record<string, string | number>) => {
  return useQuery({
    queryKey: ['complaints', 'list', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, val]) => {
          if (val && val.toString().trim() !== '' && val !== 'all') searchParams.append(key, val.toString())
        })
      }
      const { data } = await api.get(`/complaints/?${searchParams.toString()}`)
      return (data.results || data) as Complaint[]
    },
    staleTime: 60 * 1000,
  })
}

export const useComplaintDetail = (id?: number) => {
  return useQuery({
    queryKey: ['complaints', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/complaints/${id}/`)
      return data as Complaint
    },
    enabled: !!id,
  })
}

export const useCreateComplaint = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: FormData) => {
      const { data } = await api.post('/complaints/', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
    },
  })
}

export const useUpdateComplaintStatus = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, status, comment }: { id: number; status: string; comment?: string }) => {
      const { data } = await api.post(`/complaints/${id}/update_status/`, { status, comment })
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
      queryClient.invalidateQueries({ queryKey: ['complaints', 'detail', data.id] })
    },
  })
}

export const useEscalateComplaint = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post(`/complaints/${id}/escalate/`)
      return data
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
      queryClient.invalidateQueries({ queryKey: ['complaints', 'detail', id] })
    },
  })
}

export const useComplaintFeedback = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, action, comment }: { id: number; action: 'close' | 'reopen'; comment?: string }) => {
      const { data } = await api.post(`/complaints/${id}/feedback/`, { action, comment })
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
      queryClient.invalidateQueries({ queryKey: ['complaints', 'detail', data.id] })
    },
  })
}
export const useComplaintAnalytics = () => {
  return useQuery({
    queryKey: ['complaints', 'analytics'],
    queryFn: async () => {
      const { data } = await api.get('/complaints/analytics/')
      return data
    }
  })
}
