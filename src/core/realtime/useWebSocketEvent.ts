import { useEffect, useRef } from 'react'
import { updatesWS } from '@/lib/websocket'

export function useWebSocketEvent<T = unknown>(
  eventType: string,
  handler: (data: T) => void,
  dependencies: unknown[] = []
) {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    const wrappedHandler = (data: unknown) => {
      handlerRef.current(data as T)
    }

    updatesWS.on(eventType, wrappedHandler)

    return () => {
      updatesWS.off(eventType, wrappedHandler)
    }
  }, [eventType, ...dependencies])
}
