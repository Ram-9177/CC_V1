/**
 * Complaints Feature Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Complaint } from '@/types'

export const useComplaintsList = (status?: string) => {
  return useQuery({
    queryKey: ['complaints', 'list', status],
    queryFn: async () => {
      const params = status ? `?status=${status}` : ''
      const { data } = await api.get(`/complaints/${params}`)
      return (data.results || data) as Complaint[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export const useStudentComplaints = (studentId?: number) => {
  return useQuery({
    queryKey: ['complaints', 'student', studentId],
    queryFn: async () => {
      const { data } = await api.get(`/complaints/?student_id=${studentId}`)
      return (data.results || data) as Complaint[]
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
  })
}

export const useCreateComplaint = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: Partial<Complaint>) => {
      const { data } = await api.post('/complaints/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
    },
  })
}

export const useUpdateComplaint = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Complaint> & { id: number }) => {
      const { data } = await api.patch(`/complaints/${id}/`, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
    },
  })
}

export const useResolveComplaint = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (complaintId: number) => {
      const { data } = await api.post(`/complaints/${complaintId}/resolve/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] })
    },
  })
}
