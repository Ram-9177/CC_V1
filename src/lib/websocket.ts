/**
 * WebSocket client for real-time updates
 * Provides automatic reconnection, event handling, and connection management
 */

import { useAuthStore } from './store';

type MessageHandler = (data: Record<string, unknown>) => void;
type ConnectionHandler = () => void;

interface WebSocketMessage {
  type: string;
  data?: Record<string, unknown>;
  resource?: string;
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  // Cap reconnect attempts to prevent runaway timer/memory growth.
  // After MAX_RECONNECT_ATTEMPTS the client stops retrying until connect() is called explicitly.
  private maxReconnectAttempts: number | null = 20;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private heartbeatInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private disconnectionHandlers: Set<ConnectionHandler> = new Set();
  private isIntentionallyClosed = false;
  private pendingSubscriptions: Array<{ resource: string; id: string }> = [];
  private lastToken: string | null = null;

  constructor(private url: string) {}

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.isIntentionallyClosed = false;
    const token = useAuthStore.getState().token;
    
    // If token changed, close current connection to reconnect with new credentials
    if (this.ws && this.lastToken !== token) {
      this.disconnect();
      this.isIntentionallyClosed = false; // Reset because disconnect() sets it to true
    }

    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (!token) {
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      this.ws = null;
      return;
    }
    this.lastToken = token;

    try {
      // Create WebSocket URL with token as query parameter
      const baseUrl = this.url.includes('?') ? this.url.split('?')[0] : this.url;
      const wsUrl = new URL(baseUrl, window.location.origin);
      wsUrl.searchParams.set('token', token);
      this.ws = new WebSocket(wsUrl.toString());

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        // Reset counter so future disconnects start from scratch
        // (already set reconnectAttempts = 0 above)
        
        // Resubscribe to pending subscriptions
        this.pendingSubscriptions.forEach(sub => {
          this.send({ type: 'subscribe', resource: sub.resource, id: sub.id });
        });
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Notify connection handlers
        this.connectionHandlers.forEach(handler => handler());
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          const handlers = this.messageHandlers.get(message.type);
          
          if (handlers) {
            const data = (message.data || message) as Record<string, unknown>;
            handlers.forEach(handler => handler(data));
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      this.ws.onclose = (event) => {
        this.stopHeartbeat();
        
        // Notify disconnection handlers
        this.disconnectionHandlers.forEach(handler => handler());

        // Do not retry forever when the server explicitly rejects auth with a specific token.
        // However, we still schedule a slow reconnect in case the token is updated later.
        const closeCode = event.code ?? 1000;
        if (!this.isIntentionallyClosed) {
           const isAuthError = closeCode === 4401 || closeCode === 4403;
           const delayMultiplier = isAuthError ? 10 : 1; // back off much more for auth errors
           this.scheduleReconnect(delayMultiplier);
        }
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(multiplier = 1) {
    this.reconnectAttempts++;

    // If we have hit the cap, stop scheduling and log a warning.
    // A fresh connect() call (e.g. on auth state change) will reset the counter.
    if (this.maxReconnectAttempts !== null && this.reconnectAttempts > this.maxReconnectAttempts) {
      console.warn('[WebSocket] Max reconnect attempts reached. Stopping automatic reconnection.');
      return;
    }

    const backoff = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    const jitter = Math.floor(Math.random() * 1000);
    const delay = (backoff + jitter) * multiplier;
    
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = window.setInterval(() => {
      // Pause heartbeats when tab is not visible to save bandwidth
      if (document.visibilityState === 'hidden') return;
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 35000); // 35s heartbeat: slower interval reduces background idle traffic on free tier
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  send(message: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  subscribe(resource: string, id: string) {
    // Add to pending subscriptions for reconnection
    if (!this.pendingSubscriptions.some(sub => sub.resource === resource && sub.id === id)) {
      this.pendingSubscriptions.push({ resource, id });
    }
    
    this.send({ type: 'subscribe', resource, id });
  }

  unsubscribe(resource: string, id: string) {
    // Remove from pending subscriptions
    this.pendingSubscriptions = this.pendingSubscriptions.filter(
      sub => !(sub.resource === resource && sub.id === id)
    );
    
    this.send({ type: 'unsubscribe', resource, id });
  }

  on(eventType: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(eventType)) {
      this.messageHandlers.set(eventType, new Set());
    }
    this.messageHandlers.get(eventType)!.add(handler);
  }

  off(eventType: string, handler: MessageHandler) {
    const handlers = this.messageHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  onConnect(handler: ConnectionHandler) {
    this.connectionHandlers.add(handler);
  }

  offConnect(handler: ConnectionHandler) {
    this.connectionHandlers.delete(handler);
  }

  onDisconnect(handler: ConnectionHandler) {
    this.disconnectionHandlers.add(handler);
  }

  offDisconnect(handler: ConnectionHandler) {
    this.disconnectionHandlers.delete(handler);
  }

  disconnect() {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Create singleton instances
const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  // Vite dev / preview: the UI is on :5173 or :4173 but Channels (ASGI) runs on the Django port.
  // Using window.location.host would target the dev server; /ws is proxied, but a direct backend URL
  // avoids proxy edge cases and matches docker/production (same-origin or explicit host).
  if (import.meta.env.DEV) {
    const p = window.location.port;
    if (p === '5173' || p === '4173') {
      return `ws://127.0.0.1:8000`;
    }
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};

const WS_BASE_URL = getWsUrl();
export const hostelWS = new WebSocketClient(`${WS_BASE_URL}/ws/main/`);

// Aliases for backward compatibility to avoid breaking existing components
export const notificationWS = hostelWS;
export const updatesWS = hostelWS;
export const presenceWS = hostelWS;

// Auto-connect when authenticated
useAuthStore.subscribe((state) => {
  // Only connect if we are fully authenticated and NOT in the process of verifying a stale session
  if (state.isAuthenticated && state.token) {
    // Small delay to ensure any concurrent logout/refresh cleanup is done
    setTimeout(() => {
       hostelWS.connect();
    }, 50);
  } else {
    hostelWS.disconnect();
  }
});

