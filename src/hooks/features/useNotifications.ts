/**
 * Notifications Feature Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Notification } from '@/types'

export const useNotificationsList = () => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/')
      const raw = (data.results || data) as Notification[]
      // Deduplicate by id
      const seen = new Map<number, Notification>()
      for (const n of raw) {
        if (!seen.has(n.id)) seen.set(n.id, n)
      }
      return Array.from(seen.values())
    },
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000,
  })
}

export const useUnreadNotifications = () => {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread/')
      return (data.results || data) as Notification[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export const useUnreadCount = () => {
  return useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread_count/')
      return data as { unread_count: number }
    },
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000,
  })
}

export const useMarkAsRead = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (notificationId: number) => {
      const { data } = await api.post(`/notifications/${notificationId}/mark_as_read/`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
  })
}

export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/notifications/mark_all_as_read/')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
  })
}

export const useClearAllNotifications = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete('/notifications/clear_all/')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    },
  })
}

export const useNotificationPreferences = () => {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/preferences/my_preferences/')
      return data
    },
    staleTime: 60 * 60 * 1000,
  })
}

export const useUpdateNotificationPreferences = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.put('/notifications/preferences/my_preferences/', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
    },
  })
}
