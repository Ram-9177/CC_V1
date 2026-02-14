/**
 * Offline sync utility for handling mutations while offline
 * Queues mutations and replays them when connection is restored
 */

import { updatesWS } from './websocket';

interface QueuedMutation {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

class OfflineSyncManager {
  private queue: QueuedMutation[] = [];
  private readonly STORAGE_KEY = 'hostel_offline_queue';
  private readonly MAX_RETRIES = 3;
  private isProcessing = false;

  constructor() {
    this.loadFromStorage();
    this.setupConnectionListener();
  }

  /**
   * Add a mutation to the queue when offline
   */
  async queueMutation(
    endpoint: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    data?: Record<string, unknown>
  ): Promise<void> {
    const mutation: QueuedMutation = {
      id: `${Date.now()}-${Math.random()}`,
      endpoint,
      method,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(mutation);
    this.saveToStorage();

    // If online, process immediately
    if (updatesWS.isConnected()) {
      await this.processMutation(mutation);
    }
  }

  /**
   * Process a single mutation
   */
  private async processMutation(mutation: QueuedMutation): Promise<boolean> {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}${mutation.endpoint}`,
        {
          method: mutation.method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
          },
          body: mutation.data ? JSON.stringify(mutation.data) : undefined,
        }
      );

      if (response.ok) {
        // Remove from queue on success
        this.queue = this.queue.filter(m => m.id !== mutation.id);
        this.saveToStorage();
        return true;
      } else if (response.status >= 500) {
        // Server error - retry later
        return false;
      } else {
        // Client error - remove from queue (don't retry)
        this.queue = this.queue.filter(m => m.id !== mutation.id);
        this.saveToStorage();
        return false;
      }
    } catch (error) {
      console.error('[OfflineSync] Error processing mutation:', error);
      return false;
    }
  }

  /**
   * Process all queued mutations
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      for (const mutation of [...this.queue]) {
        if (mutation.retries >= this.MAX_RETRIES) {
          // Skip mutations that have exceeded retry limit
          continue;
        }

        const success = await this.processMutation(mutation);
        if (!success) {
          mutation.retries++;
          this.saveToStorage();
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get pending mutations count
   */
  getPendingCount(): number {
    return this.queue.length;
  }

  /**
   * Get all pending mutations
   */
  getPending(): QueuedMutation[] {
    return [...this.queue];
  }

  /**
   * Clear the queue (manual reset)
   */
  clearQueue(): void {
    this.queue = [];
    this.saveToStorage();
  }

  /**
   * Setup listener for connection changes
   */
  private setupConnectionListener(): void {
    updatesWS.onConnect(async () => {
      console.log('[OfflineSync] Connection restored, processing queue...');
      await this.processQueue();
    });
  }

  /**
   * Save queue to localStorage for persistence
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[OfflineSync] Error saving queue to storage:', error);
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[OfflineSync] Error loading queue from storage:', error);
      this.queue = [];
    }
  }
}

export const offlineSync = new OfflineSyncManager();

/**
 * Hook for tracking offline mutations
 */
import { useEffect, useState } from 'react';

export function usePendingMutations() {
  const [pendingCount, setPendingCount] = useState(() => offlineSync.getPendingCount());

  useEffect(() => {
    // Update pending count when connection changes
    const updateCount = () => setPendingCount(offlineSync.getPendingCount());
    
    updatesWS.onConnect(updateCount);
    updatesWS.onDisconnect(updateCount);

    return () => {
      updatesWS.offConnect(updateCount);
      updatesWS.offDisconnect(updateCount);
    };
  }, []);

  return { pendingCount };
}
