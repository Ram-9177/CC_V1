import { useEffect, useState } from 'react'
import { updatesWS } from '@/lib/websocket'

export function useWebSocketStatus() {
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(updatesWS.isConnected())
    }

    updatesWS.onConnect(checkConnection)
    updatesWS.onDisconnect(checkConnection)
    checkConnection()

    return () => {
      updatesWS.offConnect(checkConnection)
      updatesWS.offDisconnect(checkConnection)
    }
  }, [])

  return { isConnected }
}
