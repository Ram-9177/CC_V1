/**
 * Backward-compatible export surface for realtime hooks.
 */

import { useEffect, useRef } from 'react'
import { updatesWS } from '@/lib/websocket'

export { realtimeEventAliases, expandRealtimeEventTypes } from '@/core/realtime/eventAliases'
export { useRealtimeQuery } from '@/core/realtime/useRealtimeQuery'
export { default } from '@/core/realtime/useRealtimeQuery'
export { useNotification } from '@/core/realtime/useNotification'
export { useWebSocketStatus } from '@/core/realtime/useWebSocketStatus'
export { useWebSocketEvent } from '@/core/realtime/useWebSocketEvent'
export { useRealtimeNotificationSync } from '@/core/realtime/useNotificationSync'
export { useRealtimeRoleSync } from '@/core/realtime/useRoleSync'

/**
 * Hook to subscribe to resource updates
 * @param resource - The resource type (e.g., 'room', 'gatepass')
 * @param id - The resource ID
 * @param callback - Optional callback for updates
 */
export function useResourceSubscription(
  resource: string | null,
  id: string | null,
  callback?: (data: unknown) => void
) {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!resource || !id) return

    let isMounted = true
    updatesWS.subscribe(resource, id)

    const handler = (data: unknown) => {
      if (callbackRef.current && isMounted) {
        callbackRef.current(data)
      }
    }

    updatesWS.on('data_updated', handler)

    return () => {
      isMounted = false
      updatesWS.unsubscribe(resource, id)
      updatesWS.off('data_updated', handler)
    }
  }, [resource, id])
}
