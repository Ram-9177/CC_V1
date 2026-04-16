import { useEffect, useRef } from 'react'
import { updatesWS } from '@/lib/websocket'

export function useNotification(
  eventType: string,
  callback: (data: unknown) => void
) {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    let isMounted = true
    const handler = (data: unknown) => {
      if (callbackRef.current && isMounted) {
        callbackRef.current(data)
      }
    }

    updatesWS.on(eventType, handler)

    return () => {
      isMounted = false
      updatesWS.off(eventType, handler)
    }
  }, [eventType])
}
