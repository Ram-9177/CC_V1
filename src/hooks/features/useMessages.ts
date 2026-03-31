/**
 * Messages Feature Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Message } from '@/types'

export const useMessagesList = (limit = 50) => {
  return useQuery({
    queryKey: ['messages', 'list'],
    queryFn: async () => {
      const { data } = await api.get(`/messages/?limit=${limit}`)
      return (data.results || data) as Message[]
    },
    staleTime: 2 * 60 * 1000,
  })
}

export const useSendMessage = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: Partial<Message>) => {
      const { data } = await api.post('/messages/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
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
      queryClient.invalidateQueries({ queryKey: ['messages'] })
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
