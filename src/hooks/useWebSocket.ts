/**
 * React hooks for WebSocket integration
 * Provides easy-to-use hooks for real-time updates
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notificationWS, updatesWS } from '../lib/websocket';

/**
 * Hook to listen for WebSocket events and trigger data refetches
 * @param eventType - The event type to listen for
 * @param queryKeys - Query keys to invalidate when event is received
 * @param callback - Optional callback to run when event is received
 */
export function useRealtimeQuery(
  eventType: string,
  queryKeys: string[] | string,
  callback?: (data: any) => void
) {
  const queryClient = useQueryClient();
  const callbackRef = useRef(callback);
  
  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = (data: any) => {
      // Invalidate queries to trigger refetch
      const keys = Array.isArray(queryKeys) ? queryKeys : [queryKeys];
      keys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
      
      // Run optional callback
      if (callbackRef.current) {
        callbackRef.current(data);
      }
    };

    updatesWS.on(eventType, handler);

    return () => {
      updatesWS.off(eventType, handler);
    };
  }, [eventType, queryKeys, queryClient]);
}

/**
 * Hook to listen for notification events
 * @param eventType - The notification event type
 * @param callback - Callback function to handle the notification
 */
export function useNotification(
  eventType: string,
  callback: (data: any) => void
) {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = (data: any) => {
      if (callbackRef.current) {
        callbackRef.current(data);
      }
    };

    notificationWS.on(eventType, handler);

    return () => {
      notificationWS.off(eventType, handler);
    };
  }, [eventType]);
}

/**
 * Hook to subscribe to resource updates
 * @param resource - The resource type (e.g., 'room', 'gatepass')
 * @param id - The resource ID
 * @param callback - Optional callback for updates
 */
export function useResourceSubscription(
  resource: string | null,
  id: string | null,
  callback?: (data: any) => void
) {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!resource || !id) return;

    // Subscribe to resource updates
    updatesWS.subscribe(resource, id);

    const handler = (data: any) => {
      if (callbackRef.current) {
        callbackRef.current(data);
      }
    };

    updatesWS.on('data_updated', handler);

    return () => {
      updatesWS.unsubscribe(resource, id);
      updatesWS.off('data_updated', handler);
    };
  }, [resource, id]);
}

/**
 * Hook to get WebSocket connection status
 */
export function useWebSocketStatus() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(updatesWS.isConnected());
    };

    updatesWS.onConnect(checkConnection);
    updatesWS.onDisconnect(checkConnection);

    // Initial check
    checkConnection();

    return () => {
      // Cleanup handlers if needed
    };
  }, []);

  return { isConnected };
}

/**
 * Generic hook for WebSocket events with automatic cleanup
 */
export function useWebSocketEvent(
  eventType: string,
  handler: (data: any) => void,
  dependencies: any[] = []
) {
  const handlerRef = useRef(handler);
  
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const wrappedHandler = (data: any) => {
      handlerRef.current(data);
    };

    updatesWS.on(eventType, wrappedHandler);

    return () => {
      updatesWS.off(eventType, wrappedHandler);
    };
  }, [eventType, ...dependencies]);
}

export default useRealtimeQuery;
