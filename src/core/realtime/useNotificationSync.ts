import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/core/query/keys'
import { updatesWS } from '@/lib/websocket'

export function useRealtimeNotificationSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const handler = (data: { delta?: number }) => {
      const delta = data?.delta || 0
      if (delta === 0) return

      queryClient.setQueryData(queryKeys.notifications.unreadCount(), (old: { unread_count: number } | undefined) => {
        if (!old) return { unread_count: Math.max(0, delta) }
        return {
          ...old,
          unread_count: Math.max(0, (old.unread_count || 0) + delta),
        }
      })
    }

    updatesWS.on('notification_unread_increment', handler)
    return () => updatesWS.off('notification_unread_increment', handler)
  }, [queryClient])
}
