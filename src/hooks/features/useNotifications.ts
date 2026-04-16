/**
 * Notifications Feature Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/core/query/keys'
import type { Notification } from '@/types'

const markNotificationRead = (
  notification: Notification,
  isRead: boolean,
) => (notification.is_read === isRead ? notification : { ...notification, is_read: isRead })

const decrementUnreadCount = (count: number, delta = 1) => Math.max(0, count - delta)

export const useNotificationsList = () => {
  return useQuery({
    queryKey: queryKeys.notifications.list(),
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
    queryKey: queryKeys.notifications.unread(),
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread/')
      return (data.results || data) as Notification[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export const useUnreadCount = (enabled = true) => {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread_count/')
      return data as { unread_count: number }
    },
    enabled,
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
    onSuccess: (_data, notificationId) => {
      queryClient.setQueryData(queryKeys.notifications.list(), (old: Notification[] | undefined) =>
        old?.map((notification) => (notification.id === notificationId ? markNotificationRead(notification, true) : notification)),
      )
      queryClient.setQueryData(queryKeys.notifications.unread(), (old: Notification[] | undefined) =>
        old?.filter((notification) => notification.id !== notificationId),
      )
      queryClient.setQueryData(queryKeys.notifications.unreadCount(), (old: { unread_count: number } | undefined) => {
        if (!old) return old
        return { ...old, unread_count: decrementUnreadCount(old.unread_count) }
      })
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
      queryClient.setQueryData(queryKeys.notifications.list(), (old: Notification[] | undefined) =>
        old?.map((notification) => markNotificationRead(notification, true)),
      )
      queryClient.setQueryData(queryKeys.notifications.unread(), [] as Notification[])
      queryClient.setQueryData(queryKeys.notifications.unreadCount(), { unread_count: 0 })
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
      queryClient.setQueryData(queryKeys.notifications.list(), [] as Notification[])
      queryClient.setQueryData(queryKeys.notifications.unread(), [] as Notification[])
      queryClient.setQueryData(queryKeys.notifications.unreadCount(), { unread_count: 0 })
    },
  })
}

export const useNotificationPreferences = () => {
  return useQuery({
    queryKey: queryKeys.notifications.preferences(),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.preferences() })
    },
  })
}
