/**
 * Notices Feature Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Notice } from '@/types'

export const useNoticesList = () => {
  return useQuery({
    queryKey: ['notices'],
    queryFn: async () => {
      const { data } = await api.get('/notices/notices/')
      return (data.results || data) as Notice[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export const useUrgentNotices = () => {
  return useQuery({
    queryKey: ['notices', 'urgent'],
    queryFn: async () => {
      const { data } = await api.get('/notices/notices/urgent/')
      return (data.results || data) as Notice[]
    },
    staleTime: 2 * 60 * 1000,
  })
}

export const usePinnedNotices = () => {
  return useQuery({
    queryKey: ['notices', 'pinned'],
    queryFn: async () => {
      const { data } = await api.get('/notices/notices/?is_pinned=true')
      return (data.results || data) as Notice[]
    },
    staleTime: 30 * 60 * 1000,
  })
}

export const useCreateNotice = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: FormData) => {
      const { data } = await api.post('/notices/notices/', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] })
    },
  })
}

export const useDeleteNotice = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.delete(`/notices/notices/${id}/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] })
    },
  })
}
