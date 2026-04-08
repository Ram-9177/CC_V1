/**
 * React hooks for WebSocket integration
 * Provides easy-to-use hooks for real-time updates
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updatesWS } from '../lib/websocket';
import { useAuthStore } from '../lib/store';
import { Role } from '../types';

/**
 * Hook to listen for WebSocket events and trigger data refetches
 * @param eventType - The event type(s) to listen for (string or array of strings)
 * @param queryKeys - Query keys to invalidate when event is received
 * @param callback - Optional callback to run when event is received
 */
export function useRealtimeQuery(
  eventType: string | string[],
  queryKeys: (string | unknown[])[] | string | unknown[],
  callback?: (data: unknown) => void
) {
  const queryClient = useQueryClient();
  const callbackRef = useRef(callback);
  
  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Stable ref for queryKeys to avoid re-subscriptions on every render
  const queryKeysRef = useRef(queryKeys);
  useEffect(() => {
    queryKeysRef.current = queryKeys;
  });

  useEffect(() => {
    let timeoutId: number;
    let isMounted = true;
    
    // We purposefully stagger invalidations to prevent a massive DB thundering herd
    const handler = (data: unknown) => {
      // Add a small random jitter to refetches if many clients receive the event
      const jitterDelay = Math.random() * 2000;
      
      timeoutId = window.setTimeout(() => {
        if (!isMounted) return;
        const raw = queryKeysRef.current;
        let keysToInvalidate: unknown[][];
        if (Array.isArray(raw)) {
          const looksLikeMultiRoot = raw.every((k) => typeof k === 'string');
          if (looksLikeMultiRoot) {
            keysToInvalidate = (raw as string[]).map((k) => [k]);
          } else if (raw.length > 0 && Array.isArray(raw[0])) {
            keysToInvalidate = raw as unknown[][];
          } else {
            // Composite query key tuple (e.g. ['student-bundle', userId])
            keysToInvalidate = [raw as unknown[]];
          }
        } else {
          keysToInvalidate = [[raw]];
        }
        keysToInvalidate.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }, jitterDelay);
      
      // Run optional callback immediately
      if (callbackRef.current && isMounted) {
        callbackRef.current(data);
      }
    };

    const aliasMap: Record<string, string[]> = {
      gate_pass_updated: ['gatepass_updated'],
      gatepass_updated: ['gate_pass_updated'],
      gate_pass_status_changed: ['gatepass_updated', 'gate_pass_updated'],
      // GatePassConsumer (/ws/gatepass/) emits these legacy message types.
      // Map them so existing dashboard/page subscriptions still invalidate correctly.
      gatepass_created: ['new_request'],
      new_request: ['gatepass_created', 'gatepass_updated'],
      gatepass_approved: ['approved_pass', 'status_update'],
      gatepass_rejected: ['status_update'],
      approved_pass: ['gatepass_approved', 'gatepass_updated'],
      status_update: ['gatepass_updated', 'gatepass_approved', 'gatepass_rejected'],
      gate_scan_logged: ['gate_scan'],
      gate_scan: ['gate_scan_logged'],
      disciplinary_updated: ['disciplinary'],
      disciplinary: ['disciplinary_updated'],
      student_type_changed: ['student.type_changed'],
      'student.type_changed': ['student_type_changed'],
    };
    const expandEventTypes = (value: string): string[] => {
      const variants = new Set<string>([value]);
      (aliasMap[value] || []).forEach((v) => variants.add(v));
      if (value.includes('.')) variants.add(value.replace(/\./g, '_'));
      if (value.includes('_')) variants.add(value.replace(/_/g, '.'));
      return Array.from(variants);
    };
    const events = (Array.isArray(eventType) ? eventType : [eventType]).flatMap(expandEventTypes);
    events.forEach(e => updatesWS.on(e, handler));

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      events.forEach(e => updatesWS.off(e, handler));
    };
  // eventType serialized to detect array changes
  }, [Array.isArray(eventType) ? eventType.join(',') : eventType, queryClient]);
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
    let isMounted = true;
    const handler = (data: unknown) => {
      if (callbackRef.current && isMounted) {
        callbackRef.current(data);
      }
    };

    updatesWS.on(eventType, handler);

    return () => {
      isMounted = false;
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

    let isMounted = true;
    // Subscribe to resource updates
    updatesWS.subscribe(resource, id);

    const handler = (data: unknown) => {
      if (callbackRef.current && isMounted) {
        callbackRef.current(data);
      }
    };

    updatesWS.on('data_updated', handler);

    return () => {
      isMounted = false;
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
 * Generic hook for WebSocket events with automatic cleanup.
 *
 * Safety notes:
 * - `handler` is captured in a ref so callers don't need to memoize it.
 * - `dependencies` are additional values that should trigger re-subscription
 *   (e.g. a resource ID).  Passing an empty array (default) is safe because
 *   the handlerRef keeps the handler current.
 */
export function useWebSocketEvent<T = unknown>(
  eventType: string,
  handler: (data: T) => void,
  dependencies: unknown[] = []
) {
  const handlerRef = useRef(handler);
  
  // Keep ref up-to-date without triggering re-subscription
  useEffect(() => {
    handlerRef.current = handler;
  });

  // Only re-subscribe when eventType or a caller-supplied dep changes.
  useEffect(() => {
    const wrappedHandler = (data: unknown) => {
      handlerRef.current(data as T);
    };

    updatesWS.on(eventType, wrappedHandler);

    return () => {
      updatesWS.off(eventType, wrappedHandler);
    };
  // Spread dependencies intentionally included so callers can trigger re-sub
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
  // Stable refs so the effect doesn't re-run on every user object re-render
  const userRef = useRef(user);
  const setUserRef = useRef(setUser);

  useEffect(() => {
    userRef.current = user;
    setUserRef.current = setUser;
  });

  useEffect(() => {
    if (!user?.id) return;

    const handler = (data: { new_role?: Role; is_active?: boolean }) => {
      const { new_role, is_active } = data;
      const currentUser = userRef.current;
      if (!currentUser) return;

      // If role or activation changed, update local store
      if (new_role !== undefined || is_active !== undefined) {
        setUserRef.current({
          ...currentUser,
          role: new_role ?? currentUser.role,
          is_active: is_active ?? currentUser.is_active
        });

        // If role changed specifically, we might need to invalidate
        // a lot of role-scoped queries.
        if (new_role && new_role !== currentUser.role) {
          // Invalidate specific cache paths instead of global invalidation
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
          queryClient.invalidateQueries({ queryKey: ['recent-activities'] });
          queryClient.invalidateQueries({ queryKey: ['profile'] });
          queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
        }
      }
    };

    updatesWS.on('self_role_changed', handler);

    // ── Student Type real-time sync ───────────────────────────────────────────
    // Fires when the backend emits "student.type_changed" for this user.
    // Updates the auth store so HostellerOnly / DayScholarOnly gates re-render
    // instantly — no page reload required.
    const typeChangeHandler = (data: { new_type?: string }) => {
      const { new_type } = data;
      const currentUser = userRef.current;
      if (!currentUser || !new_type) return;

      setUserRef.current({
        ...currentUser,
        student_type: new_type as 'hosteller' | 'day_scholar',
      });

      // Invalidate hostel-scoped queries that depend on student_type
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    };

    updatesWS.on('student_type_changed', typeChangeHandler);
    updatesWS.on('student.type_changed', typeChangeHandler);

    return () => {
      updatesWS.off('self_role_changed', handler);
      updatesWS.off('student_type_changed', typeChangeHandler);
      updatesWS.off('student.type_changed', typeChangeHandler);
    };
  // Only re-register when the user's identity changes, not on every field update
  }, [user?.id, queryClient]);
}

export default useRealtimeQuery;
