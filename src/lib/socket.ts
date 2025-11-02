import { io, Socket } from 'socket.io-client';
import { WS_URL } from './config';
import { getAuthToken } from './config';
import { useEffect, useRef } from 'react';

type EventHandler = (...args: any[]) => void;

class SocketManager {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventHandler>> = new Map();

  connect() {
    if (this.socket || !WS_URL) return;
    const token = getAuthToken();
    this.socket = io(WS_URL, {
      transports: ['websocket'],
      autoConnect: true,
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: token ? { token: `Bearer ${token}` } : undefined,
    });

    // Re-bind any queued listeners on connect
    this.socket.on('connect', () => {
      this.listeners.forEach((handlers, event) => {
        handlers.forEach((h) => this.socket?.on(event, h));
      });
    });

    // Optional: log errors in dev
    this.socket.on('connect_error', (err) => {
      try {
        const isDev = (import.meta as any)?.env?.DEV;
        if (isDev) console.warn('[socket] connect_error', err.message);
      } catch {}
    });
  }

  disconnect() {
    if (!this.socket) return;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.listeners.clear();
  }

  on(event: string, handler: EventHandler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    if (this.socket) this.socket.on(event, handler);
  }

  off(event: string, handler: EventHandler) {
    this.listeners.get(event)?.delete(handler);
    if (this.socket) this.socket.off(event, handler);
  }

  emit(event: string, ...args: any[]) {
    this.socket?.emit(event, ...args);
  }
}

export const socketManager = new SocketManager();

// Hook to subscribe to a socket event and auto-manage lifecycle
export function useSocketEvent(event: string, handler: EventHandler, enabled = true) {
  const savedHandler = useRef(handler as any);
  savedHandler.current = handler;

  useEffect(() => {
    if (!enabled || !WS_URL) return;

    // Ensure connection
    socketManager.connect();

    const wrapper: EventHandler = (...args) => savedHandler.current?.(...args);
    socketManager.on(event, wrapper);
    return () => socketManager.off(event, wrapper);
  }, [event, enabled]);
}
