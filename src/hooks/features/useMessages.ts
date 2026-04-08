/**
 * Messages Feature Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const useMessagesList = <T = unknown>(box: 'inbox' | 'sent' = 'inbox') => {
  return useQuery<T[]>({
    queryKey: ['messages', box],
    queryFn: async () => {
      const { data } = await api.get(`/messages/?box=${box}`)
      return (data.results || data) as T[]
    },
    staleTime: 2 * 60 * 1000,
  })
}

export const useBroadcasts = <T = unknown>() => {
  return useQuery<T[]>({
    queryKey: ['broadcasts'],
    queryFn: async () => {
      const { data } = await api.get('/messages/broadcasts/')
      return (data.results || data) as T[]
    },
    staleTime: 2 * 60 * 1000,
  })
}

export const useSendMessage = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const isBroadcast = payload._broadcast === true
      const { _broadcast, ...body } = payload
      if (isBroadcast) {
        const { data } = await api.post('/messages/broadcasts/', body)
        return data
      }
      const { data } = await api.post('/messages/', body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] })
    },
  })
}

export const useMarkMessageAsRead = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (messageId: number) => {
      const { data } = await api.post(`/messages/${messageId}/mark_read/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] })
    },
  })
}

export const useMessageThreads = () => {
  return useQuery({
    queryKey: ['messages', 'threads'],
    queryFn: async () => {
      const { data } = await api.get('/messages/threads/')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}
