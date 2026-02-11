/**
 * WebSocket client for real-time updates
 * Provides automatic reconnection, event handling, and connection management
 */

import { useAuthStore } from './store';

type MessageHandler = (data: any) => void;
type ConnectionHandler = () => void;

interface WebSocketMessage {
  type: string;
  data?: any;
  resource?: string;
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 999999; // Effectively infinite
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private heartbeatInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private disconnectionHandlers: Set<ConnectionHandler> = new Set();
  private isIntentionallyClosed = false;
  private pendingSubscriptions: Array<{ resource: string; id: string }> = [];

  constructor(private url: string) {}

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.isIntentionallyClosed = false;
    const token = useAuthStore.getState().token;
    
    if (!token) {
      console.warn('[WebSocket] No auth token available');
      return;
    }

    try {
      // Append JWT token as query parameter for backend JWT auth middleware
      const wsUrl = new URL(this.url, window.location.origin);
      wsUrl.searchParams.set('token', token);
      this.ws = new WebSocket(wsUrl.toString());

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        
        // Backend auth happens via query param; no in-band auth message needed
        
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
            handlers.forEach(handler => handler(message.data || message));
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.stopHeartbeat();
        
        // Notify disconnection handlers
        this.disconnectionHandlers.forEach(handler => handler());
        
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    
    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
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
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  send(message: any) {
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
  // 1. Explicit WS URL
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  
  // 2. Derive from API URL
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    try {
      // Handle relative URLs or full URLs
      const url = new URL(apiUrl, window.location.origin);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return url.origin;
    } catch (e) {
      console.warn('[WebSocket] Could not derive WS URL from API URL');
    }
  }

  // 3. Fallback to current window location
  return (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + 
    window.location.host;
};

const WS_BASE_URL = getWsUrl();

export const notificationWS = new WebSocketClient(`${WS_BASE_URL}/ws/notifications/`);
export const updatesWS = new WebSocketClient(`${WS_BASE_URL}/ws/updates/`);
export const presenceWS = new WebSocketClient(`${WS_BASE_URL}/ws/presence/`);

// Auto-connect when authenticated
useAuthStore.subscribe((state) => {
  if (state.isAuthenticated && state.token) {
    notificationWS.connect();
    updatesWS.connect();
    presenceWS.connect();
  } else {
    notificationWS.disconnect();
    updatesWS.disconnect();
    presenceWS.disconnect();
  }
});
