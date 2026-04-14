# Frontend WebSocket Resilience Implementation Guide

This guide shows how to implement break point recovery on the frontend using the backend resilience system.

## Table of Contents
1. [WebSocket Manager with Reconnection](#websocket-manager)
2. [Request Queue System](#request-queue)
3. [Heartbeat & Connection Monitoring](#heartbeat)
4. [HTTP Fallback](#http-fallback)
5. [Integration with React Hooks](#react-integration)
6. [Testing](#testing)

---

## WebSocket Manager with Reconnection

**File**: `src/utils/websocket.ts`

```typescript
import { ReconnectionConfig, WebSocketConfig } from '../types/websocket';

/**
 * Exponential backoff reconnection strategy
 * Handles [BP1] WebSocket connection loss
 */
class ReconnectionStrategy {
  private baseDelay = 1000; // 1 second
  private maxDelay = 32000; // 32 seconds
  private maxRetries = 10;
  private currentRetry = 0;

  getNextDelay(): number {
    if (this.currentRetry >= this.maxRetries) {
      return -1; // Stop reconnecting
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 32s, ...
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.currentRetry),
      this.maxDelay
    );

    this.currentRetry++;
    console.warn(`[WebSocket] Reconnection attempt ${this.currentRetry}/${this.maxRetries} in ${delay}ms`);

    return delay;
  }

  reset(): void {
    this.currentRetry = 0;
  }

  getRemainingAttempts(): number {
    return Math.max(0, this.maxRetries - this.currentRetry);
  }
}

/**
 * Manages WebSocket connection with resilience
 */
export class ResilientWebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private userId: number;
  private reconnectionStrategy: ReconnectionStrategy;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pongTimeout: NodeJS.Timeout | null = null;
  private missedPings = 0;
  private maxMissedPings = 3;
  private listeners: Map<string, Function[]> = new Map();
  private isIntentionallyClosed = false;
  private requestQueue: RequestQueueManager;
  private eventLog: ClientEventLog;

  constructor(userId: number, url?: string) {
    this.userId = userId;
    this.url = url || this.buildWebSocketUrl();
    this.reconnectionStrategy = new ReconnectionStrategy();
    this.requestQueue = new RequestQueueManager(userId);
    this.eventLog = new ClientEventLog(userId);
  }

  private buildWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    return `${protocol}://${host}/ws/notifications/`;
  }

  /**
   * Connect to WebSocket with automatic reconnection on failure
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.isIntentionallyClosed = false;
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected');
          this.eventLog.logEvent('connected');
          this.reconnectionStrategy.reset();
          this.startHeartbeat();
          this.syncPendingRequests(); // [BP1] Sync queued requests

          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (event) => {
          console.error('[WebSocket] Error:', event);
          this.eventLog.logEvent('error', { message: event.type });
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = (event) => {
          console.warn(`[WebSocket] Closed (code: ${event.code})`);
          this.eventLog.logEvent('disconnected', { code: event.code });
          this.stopHeartbeat();

          if (!this.isIntentionallyClosed) {
            this.scheduleReconnection();
          }
        };
      } catch (error) {
        console.error('[WebSocket] Connection error:', error);
        this.eventLog.logEvent('connection_error', { message: String(error) });
        reject(error);
      }
    });
  }

  /**
   * Disconnect intentionally without reconnection
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
    }

    this.eventLog.logEvent('disconnected_intentional');
  }

  /**
   * Send message with fallback to request queue
   * Handles [BP1] Connection loss - queues message if offline
   */
  send(action: string, payload: any): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnected()) {
        try {
          this.ws!.send(JSON.stringify({
            type: action,
            ...payload,
            timestamp: Date.now(),
          }));

          this.eventLog.logEvent('message_sent', { action });
          resolve(true);
        } catch (error) {
          console.warn('[WebSocket] Send failed:', error);
          // Queue the request for later
          this.requestQueue.enqueue(action, payload);
          this.eventLog.logEvent('message_queued', { action });
          resolve(false);
        }
      } else {
        // Offline - queue request
        console.warn(`[WebSocket] Not connected, queueing request: ${action}`);
        this.requestQueue.enqueue(action, payload);
        this.eventLog.logEvent('message_queued', { action });
        resolve(false);
      }
    });
  }

  /**
   * Subscribe to event type
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Unsubscribe from event type
   */
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to subscribers
   */
  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[WebSocket] Error in event listener for ${event}:`, error);
      }
    });
  }

  // ===== PRIVATE METHODS =====

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'pong':
          // [BP5] Heartbeat response
          this.missedPings = 0;
          this.eventLog.logEvent('pong_received');
          break;

        case 'ping':
          // Server sent ping, respond with pong
          this.send('pong', { timestamp: Date.now() });
          break;

        case 'sync_status':
          console.log('[WebSocket] Sync status:', message);
          this.emit('sync_status', message);
          break;

        case 'notification':
          this.emit('notification', message);
          break;

        case 'connection_established':
          console.log('[WebSocket] Connection established');
          this.emit('connected', message);
          break;

        default:
          this.emit(message.type, message);
      }
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  }

  /**
   * Send heartbeat ping to detect connection loss
   * Handles [BP1] & [BP5] - detects stale connections
   */
  private startHeartbeat(): void {
    // Every 30 seconds, send ping
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        try {
          this.ws!.send(JSON.stringify({
            type: 'ping',
            timestamp: Date.now(),
          }));

          this.missedPings++;

          if (this.missedPings >= this.maxMissedPings) {
            console.warn(
              `[WebSocket] Missed ${this.missedPings} pong responses, triggering reconnection`
            );
            this.eventLog.logEvent('missed_pongs', { count: this.missedPings });
            this.disconnect();
            this.scheduleReconnection();
          } else {
            // Set timeout for pong response
            this.pongTimeout = setTimeout(() => {
              console.warn('[WebSocket] Pong timeout, may have stale connection');
              this.eventLog.logEvent('pong_timeout');
            }, 10000); // 10 second timeout
          }
        } catch (error) {
          console.error('[WebSocket] Heartbeat error:', error);
        }
      }
    }, 30000); // Every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   * Handles [BP1] - reconnects after connection loss
   */
  private scheduleReconnection(): void {
    const delay = this.reconnectionStrategy.getNextDelay();

    if (delay === -1) {
      console.error('[WebSocket] Max reconnection attempts reached, giving up');
      this.emit('reconnection_failed');
      return;
    }

    console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
    this.emit('reconnecting', { delay });

    this.reconnectTimeout = setTimeout(() => {
      console.log('[WebSocket] Attempting reconnection...');
      this.connect()
        .then(() => {
          console.log('[WebSocket] Reconnection successful');
          this.emit('reconnected');
        })
        .catch((error) => {
          console.error('[WebSocket] Reconnection failed:', error);
          this.scheduleReconnection();
        });
    }, delay);
  }

  /**
   * Sync pending requests after reconnection
   * Handles [BP1] - replays queued actions
   */
  private async syncPendingRequests(): Promise<void> {
    const pending = await this.requestQueue.getPending();

    if (pending.length === 0) {
      return;
    }

    console.log(`[WebSocket] Syncing ${pending.length} pending requests`);
    this.emit('sync_started', { count: pending.length });

    let delivered = 0;
    let failed = 0;

    for (const request of pending) {
      try {
        // Re-send each queued request
        const success = await this.send(request.action, request.payload);

        if (success) {
          await this.requestQueue.markDelivered(request.id);
          delivered++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`[WebSocket] Failed to sync request ${request.id}:`, error);
        failed++;
      }
    }

    console.log(
      `[WebSocket] Sync completed: ${delivered} delivered, ${failed} failed`
    );
    this.emit('sync_completed', { delivered, failed });
  }

  private isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // ===== PUBLIC UTILITIES =====

  isReady(): boolean {
    return this.isConnected();
  }

  getStatus(): string {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'closed';
      default:
        return 'unknown';
    }
  }

  getMissedPings(): number {
    return this.missedPings;
  }

  getRemainingReconnectAttempts(): number {
    return this.reconnectionStrategy.getRemainingAttempts();
  }

  getEvents(): any[] {
    return this.eventLog.getEvents();
  }
}

// Export singleton instance
let wsInstance: ResilientWebSocketManager | null = null;

export function getWebSocketManager(userId: number): ResilientWebSocketManager {
  if (!wsInstance) {
    wsInstance = new ResilientWebSocketManager(userId);
  }
  return wsInstance;
}

export function resetWebSocketManager(): void {
  if (wsInstance) {
    wsInstance.disconnect();
    wsInstance = null;
  }
}
```

---

## Request Queue System

**File**: `src/utils/request-queue.ts`

```typescript
/**
 * Manages pending requests while offline
 * Handles [BP1] - queues actions during disconnection
 */
export class RequestQueueManager {
  private userId: number;
  private queueKey: string;

  constructor(userId: number) {
    this.userId = userId;
    this.queueKey = `ws_queue:${userId}`;
  }

  /**
   * Add request to queue (stored in localStorage)
   */
  async enqueue(action: string, payload: any): Promise<string> {
    const requestId = `${this.userId}:${Date.now()}`;

    const request = {
      id: requestId,
      action,
      payload,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3,
    };

    try {
      const queue = this.getQueue();
      queue.push(request);

      // Keep only last 100 requests
      if (queue.length > 100) {
        queue.shift();
      }

      localStorage.setItem(this.queueKey, JSON.stringify(queue));
      console.log(`[RequestQueue] Enqueued: ${action}`);

      return requestId;
    } catch (error) {
      console.error('[RequestQueue] Failed to enqueue:', error);
      throw error;
    }
  }

  /**
   * Get all pending requests
   */
  async getPending(): Promise<any[]> {
    try {
      const queue = this.getQueue();

      // Filter expired requests (older than 1 hour)
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      return queue.filter((req) => req.timestamp > oneHourAgo);
    } catch (error) {
      console.error('[RequestQueue] Failed to get pending:', error);
      return [];
    }
  }

  /**
   * Mark request as delivered
   */
  async markDelivered(requestId: string): Promise<void> {
    try {
      const queue = this.getQueue();
      const filtered = queue.filter((req) => req.id !== requestId);
      localStorage.setItem(this.queueKey, JSON.stringify(filtered));
      console.log(`[RequestQueue] Marked as delivered: ${requestId}`);
    } catch (error) {
      console.error('[RequestQueue] Failed to mark delivered:', error);
    }
  }

  /**
   * Clear all pending requests
   */
  async clear(): Promise<void> {
    try {
      localStorage.removeItem(this.queueKey);
      console.log('[RequestQueue] Cleared');
    } catch (error) {
      console.error('[RequestQueue] Failed to clear:', error);
    }
  }

  private getQueue(): any[] {
    try {
      const data = localStorage.getItem(this.queueKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[RequestQueue] Failed to parse queue:', error);
      return [];
    }
  }
}

/**
 * Client event logger for debugging
 */
export class ClientEventLog {
  private userId: number;
  private logKey: string;
  private maxEvents = 100;

  constructor(userId: number) {
    this.userId = userId;
    this.logKey = `ws_events:${userId}`;
  }

  logEvent(type: string, details?: any): void {
    try {
      const event = {
        type,
        timestamp: Date.now(),
        details: details || {},
      };

      const events = this.getEvents();

      // Keep only last N events
      if (events.length >= this.maxEvents) {
        events.shift();
      }

      events.push(event);
      sessionStorage.setItem(this.logKey, JSON.stringify(events));
    } catch (error) {
      console.debug('[ClientEventLog] Failed to log event:', error);
    }
  }

  getEvents(): any[] {
    try {
      const data = sessionStorage.getItem(this.logKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      return [];
    }
  }

  clear(): void {
    sessionStorage.removeItem(this.logKey);
  }
}
```

---

## Heartbeat & Connection Monitoring

**File**: `src/hooks/useWebSocketHeartbeat.ts`

```typescript
import { useState, useEffect, useRef } from 'react';
import { ResilientWebSocketManager } from '../utils/websocket';

/**
 * Hook for monitoring WebSocket connection health
 * Handles [BP1] & [BP5] - detects and recovers from connection loss
 */
export function useWebSocketHeartbeat(
  wsManager: ResilientWebSocketManager,
  onStatusChange?: (status: ConnectionStatus) => void
) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [missedPings, setMissedPings] = useState(0);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  useEffect(() => {
    // Monitor connection status
    const updateStatus = () => {
      const newStatus = wsManager.getStatus() as ConnectionStatus;
      setStatus(newStatus);
      setMissedPings(wsManager.getMissedPings());
      setReconnectAttempts(10 - wsManager.getRemainingReconnectAttempts());
      onStatusChange?.(newStatus);
    };

    // Initial update
    updateStatus();

    // Listen for WebSocket events
    wsManager.on('connected', () => updateStatus());
    wsManager.on('reconnecting', () => updateStatus());
    wsManager.on('reconnected', () => updateStatus());
    wsManager.on('disconnected', () => updateStatus());

    // Poll status every 2 seconds
    const interval = setInterval(updateStatus, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [wsManager, onStatusChange]);

  return {
    status,
    isConnected: status === 'connected',
    missedPings,
    reconnectAttempts,
  };
}

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'closing'
  | 'closed'
  | 'unknown';
```

---

## HTTP Fallback

**File**: `src/utils/api-client.ts`

```typescript
import axios from 'axios';

/**
 * API client with WebSocket fallback
 * Handles [BP4] - falls back to HTTP POST when WS unavailable
 */
export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * For critical operations, provide both WS and HTTP options
 */
export async function sendWithFallback(
  action: string,
  payload: any,
  wsManager: ResilientWebSocketManager,
  httpEndpoint: string
): Promise<{
  success: boolean;
  data?: any;
  source: 'websocket' | 'http';
  error?: string;
}> {
  // Try WebSocket first
  if (wsManager.isReady()) {
    try {
      const sent = await wsManager.send(action, payload);
      if (sent) {
        return {
          success: true,
          source: 'websocket',
          data: payload,
        };
      }
    } catch (error) {
      console.warn('[API] WebSocket send failed:', error);
    }
  }

  // Fall back to HTTP POST
  try {
    console.log(`[API] Falling back to HTTP POST: ${httpEndpoint}`);
    const response = await apiClient.post(httpEndpoint, payload);

    return {
      success: true,
      data: response.data,
      source: 'http',
    };
  } catch (error: any) {
    return {
      success: false,
      source: 'http',
      error: error.message,
    };
  }
}

/**
 * Example: Mark attendance with WS/HTTP fallback
 */
export async function markAttendanceWithFallback(
  wsManager: ResilientWebSocketManager,
  time: string
): Promise<any> {
  return sendWithFallback(
    'mark_attendance',
    { time },
    wsManager,
    '/attendance/mark/'
  );
}
```

---

## React Integration

**File**: `src/hooks/useWebSocket.ts`

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ResilientWebSocketManager, getWebSocketManager } from '../utils/websocket';

/**
 * Main WebSocket hook for React components
 * Integrates all resilience features
 */
export function useWebSocket(userId: number | null) {
  const wsRef = useRef<ResilientWebSocketManager | null>(null);
  const queryClient = useQueryClient();

  // Initialize WebSocket manager
  useEffect(() => {
    if (!userId) return;

    wsRef.current = getWebSocketManager(userId);

    // Connect and handle errors
    wsRef.current.connect()
      .catch((error) => {
        console.error('[useWebSocket] Failed to connect:', error);
        // Will auto-retry via reconnection strategy
      });

    // Listen for sync completion
    wsRef.current.on('sync_completed', (data) => {
      console.log('[useWebSocket] Pending requests synced:', data);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    // Listen for notifications
    wsRef.current.on('notification', (data) => {
      console.log('[useWebSocket] Notification received:', data);
      // Update notification count
      queryClient.setQueryData(['notifications', 'unread'], data.unread_count);
    });

    return () => {
      // Don't disconnect on unmount - keep connection alive
      // wsRef.current?.disconnect();
    };
  }, [userId, queryClient]);

  // Public API
  const send = useCallback(
    async (action: string, payload: any) => {
      if (!wsRef.current) throw new Error('WebSocket not initialized');
      return wsRef.current.send(action, payload);
    },
    []
  );

  const on = useCallback(
    (event: string, callback: Function) => {
      if (!wsRef.current) throw new Error('WebSocket not initialized');
      wsRef.current.on(event, callback);
    },
    []
  );

  const isConnected = useCallback(() => {
    return wsRef.current?.isReady() ?? false;
  }, []);

  return {
    send,
    on,
    isConnected,
    manager: wsRef.current,
  };
}

/**
 * Hook for attendance marking with optimistic updates
 */
export function useMarkAttendance(userId: number | null) {
  const queryClient = useQueryClient();

  return useMutation(
    async (time: string) => {
      // Optimistic update [BP5]
      queryClient.setQueryData(['attendance'], (old: any) => {
        return [...(old || []), { time, status: 'pending' }];
      });

      try {
        // Send via WebSocket with HTTP fallback [BP4]
        const response = await apiClient.post('/attendance/mark/', { time });
        return response.data;
      } catch (error) {
        // Rollback on error
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
        throw error;
      }
    },
    {
      onError: () => {
        // Rollback optimistic update
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
      },
    }
  );
}
```

---

## Testing

**File**: `src/__tests__/websocket.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResilientWebSocketManager } from '../utils/websocket';
import { RequestQueueManager } from '../utils/request-queue';

describe('[BP1] WebSocket Resilience', () => {
  let manager: ResilientWebSocketManager;
  let queue: RequestQueueManager;

  beforeEach(() => {
    manager = new ResilientWebSocketManager(1);
    queue = new RequestQueueManager(1);
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should queue requests when offline', async () => {
    // Don't connect
    const requestId = await queue.enqueue('mark_attendance', { time: '7:00 AM' });

    expect(requestId).toBeDefined();

    const pending = await queue.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].action).toBe('mark_attendance');
  });

  it('should remove delivered requests from queue', async () => {
    const id1 = await queue.enqueue('action1', {});
    const id2 = await queue.enqueue('action2', {});

    await queue.markDelivered(id1);

    const pending = await queue.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(id2);
  });

  it('should filter expired requests', async () => {
    const oldTimestamp = Date.now() - 2 * 3600000; // 2 hours ago

    // Manually create old request
    const queue = [
      {
        id: 'old',
        action: 'old_action',
        timestamp: oldTimestamp,
      },
      {
        id: 'new',
        action: 'new_action',
        timestamp: Date.now(),
      },
    ];

    localStorage.setItem('ws_queue:1', JSON.stringify(queue));

    const pending = await queue.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('new');
  });

  it('should handle reconnection strategy', () => {
    const strategy = new ReconnectionStrategy();

    expect(strategy.getNextDelay()).toBe(1000); // 1s
    expect(strategy.getNextDelay()).toBe(2000); // 2s
    expect(strategy.getNextDelay()).toBe(4000); // 4s

    strategy.reset();
    expect(strategy.getRemainingAttempts()).toBe(10);
  });
});

describe('[BP4] HTTP Fallback', () => {
  it('should fall back to HTTP when WebSocket unavailable', async () => {
    const result = await sendWithFallback(
      'mark_attendance',
      { time: '7:00 AM' },
      null as any, // No WS manager
      '/attendance/mark/'
    );

    expect(result.source).toBe('http');
  });
});

describe('[BP5] Heartbeat Monitoring', () => {
  it('should track missed pings', () => {
    // Create mock WebSocket
    vi.stubGlobal('WebSocket', class MockWS {
      readyState = 1; // OPEN
    });

    const manager = new ResilientWebSocketManager(1);
    expect(manager.getMissedPings()).toBe(0);
  });
});
```

---

## Usage in Components

**Example**: Attendance Marking Component

```typescript
import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useWebSocketHeartbeat } from '../hooks/useWebSocketHeartbeat';

export function AttendanceMarker({ userId }: { userId: number }) {
  const { send, manager } = useWebSocket(userId);
  const { status, isConnected, missedPings } = useWebSocketHeartbeat(manager);
  const [marking, setMarking] = React.useState(false);

  const handleMarkAttendance = async () => {
    setMarking(true);
    try {
      const success = await send('mark_attendance', {
        time: new Date().toLocaleTimeString(),
      });

      if (success) {
        alert('Attendance marked (real-time)');
      } else {
        alert('Marked offline - will sync when online');
      }
    } finally {
      setMarking(false);
    }
  };

  return (
    <div>
      <p>Connection: {status}</p>
      <p>Missed pings: {missedPings}</p>

      {!isConnected && (
        <div className="warning">
          You're offline. Changes will sync when connection restores.
        </div>
      )}

      <button
        onClick={handleMarkAttendance}
        disabled={marking}
      >
        {marking ? 'Marking...' : 'Mark Attendance'}
      </button>
    </div>
  );
}
```

---

## Configuration

**File**: `src/config/websocket.ts`

```typescript
export const WEBSOCKET_CONFIG = {
  // Heartbeat
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  PONG_TIMEOUT: 10000, // 10 seconds
  MAX_MISSED_PINGS: 3,

  // Reconnection
  BASE_DELAY: 1000, // 1 second
  MAX_DELAY: 32000, // 32 seconds
  MAX_RETRIES: 10,

  // Request queue
  MAX_QUEUED_REQUESTS: 100,
  REQUEST_EXPIRY_TIME: 3600000, // 1 hour
  REQUEST_SYNC_INTERVAL: 5000, // 5 seconds

  // Logging
  ENABLE_EVENT_LOGGING: true,
  MAX_EVENT_LOG: 100,
};
```

---

This frontend implementation provides complete break point recovery on the client side, complementing the backend resilience system!
