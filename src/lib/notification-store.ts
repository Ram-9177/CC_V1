/**
 * CampusCore Notification Store
 * ===============================
 * Manages unread notification count independently of user data.
 * Patched in real-time via WebSocket WITHOUT a full API refetch.
 *
 * Budget server benefit: each unread notification badge update used to cause
 * a DB query. Now the WS delta patches cache in microseconds.
 */
import { create } from 'zustand'

interface NotificationState {
  /** Live unread count — patched by WebSocket delta events */
  unreadCount: number
  setUnreadCount: (count: number) => void
  /** +delta or -delta — avoids refetch from DB */
  incrementUnread: (delta: number) => void
  resetUnread: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: Math.max(0, count) }),
  incrementUnread: (delta) => set(s => ({ unreadCount: Math.max(0, s.unreadCount + delta) })),
  resetUnread: () => set({ unreadCount: 0 }),
}))

/**
 * Offline Mutation Queue
 * =======================
 * When the device goes offline, mutations (POST/PATCH/DELETE) are queued here
 * and replayed in order when connectivity is restored.
 *
 * Budget server benefit: prevents duplicate API calls from frustrated users
 * tapping "Submit" multiple times on a slow connection.
 */
export interface QueuedMutation {
  id: string
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  url: string
  body?: unknown
  label: string          // Human-readable description for the UI
  queuedAt: string       // ISO timestamp
  retries: number
}

interface OfflineQueueState {
  queue: QueuedMutation[]
  isReplaying: boolean
  enqueue: (mutation: Omit<QueuedMutation, 'id' | 'queuedAt' | 'retries'>) => void
  dequeue: (id: string) => void
  setReplaying: (v: boolean) => void
  clearQueue: () => void
}

export const useOfflineQueue = create<OfflineQueueState>((set) => ({
  queue: [],
  isReplaying: false,

  enqueue: (mutation) => set(s => ({
    queue: [
      ...s.queue,
      {
        ...mutation,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        queuedAt: new Date().toISOString(),
        retries: 0,
      },
    ],
  })),

  dequeue: (id) => set(s => ({ queue: s.queue.filter(m => m.id !== id) })),

  setReplaying: (v) => set({ isReplaying: v }),

  clearQueue: () => set({ queue: [] }),
}))
