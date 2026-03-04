/**
 * React hooks for WebSocket integration
 * Provides easy-to-use hooks for real-time updates
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updatesWS } from '../lib/websocket';
import { useAuthStore } from '../lib/store';
import { Role } from '../types';
import { queryBatcher } from '../lib/query-batcher';

/**
 * Hook to listen for WebSocket events and trigger data refetches
 * @param eventType - The event type to listen for
 * @param queryKeys - Query keys to invalidate when event is received
 * @param callback - Optional callback to run when event is received
 */
export function useRealtimeQuery(
  eventType: string,
  queryKeys: string[] | string,
  callback?: (data: unknown) => void
) {
  const queryClient = useQueryClient();
  const callbackRef = useRef(callback);
  
  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = (data: unknown) => {
      // Invalidate queries to trigger refetch
      const keys = Array.isArray(queryKeys) ? queryKeys : [queryKeys];
      keys.forEach(key => {
        queryBatcher.ingest(queryClient, key);
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
  callback: (data: unknown) => void
) {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = (data: unknown) => {
      if (callbackRef.current) {
        callbackRef.current(data);
      }
    };

    updatesWS.on(eventType, handler);

    return () => {
      updatesWS.off(eventType, handler);
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
  callback?: (data: unknown) => void
) {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!resource || !id) return;

    // Subscribe to resource updates
    updatesWS.subscribe(resource, id);

    const handler = (data: unknown) => {
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
      updatesWS.offConnect(checkConnection);
      updatesWS.offDisconnect(checkConnection);
    };
  }, []);

  return { isConnected };
}

/**
 * Generic hook for WebSocket events with automatic cleanup
 */
export function useWebSocketEvent(
  eventType: string,
  handler: (data: unknown) => void,
  dependencies: unknown[] = []
) {
  const handlerRef = useRef(handler);
  
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const wrappedHandler = (data: unknown) => {
      handlerRef.current(data);
    };

    updatesWS.on(eventType, wrappedHandler);

    return () => {
      updatesWS.off(eventType, wrappedHandler);
    };
  }, [eventType, ...dependencies]);
}

/**
 * Hook to synchronize unread notification count in real-time
 * Uses cache patching instead of refetching to save DB connections.
 */
export function useRealtimeNotificationSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = (data: { delta?: number }) => {
      const delta = data?.delta || 0;
      if (delta === 0) return;

      queryClient.setQueryData(['notifications-unread-count'], (old: { unread_count: number } | undefined) => {
        if (!old) return { unread_count: Math.max(0, delta) };
        return {
          ...old,
          unread_count: Math.max(0, (old.unread_count || 0) + delta)
        };
      });
    };

    updatesWS.on('notification_unread_increment', handler);
    return () => updatesWS.off('notification_unread_increment', handler);
  }, [queryClient]);
}

/**
 * Hook to synchronize current user's role and status in real-time
 */
export function useRealtimeRoleSync() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const handler = (data: { new_role?: Role; is_active?: boolean }) => {
      const { new_role, is_active } = data;
      
      // If role or activation changed, update local store
      if (new_role !== undefined || is_active !== undefined) {
        setUser({
          ...user,
          role: new_role ?? user.role,
          is_active: is_active ?? user.is_active
        });

        // If role changed specifically, we might need to invalidate 
        // a lot of role-scoped queries.
        if (new_role && new_role !== user.role) {
          queryClient.invalidateQueries(); 
          // Note: invalidateQueries() is broad but a role change is a major event.
          // Since it's rare per user, it's acceptable for "God Mode" sync.
        }
      }
    };

    updatesWS.on('self_role_changed', handler);
    return () => updatesWS.off('self_role_changed', handler);
  }, [user, setUser, queryClient]);
}

export default useRealtimeQuery;
