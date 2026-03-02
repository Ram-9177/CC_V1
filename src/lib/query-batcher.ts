import { QueryClient } from '@tanstack/react-query';

/**
 * Event Storm Protection Utility
 * 
 * Implements micro-batching (50ms) and rate-limiting (5/sec) for query invalidations.
 * Uses requestAnimationFrame for frame alignment and maintains low latency (<150ms).
 */
class QueryBatcher {
  private queue: Set<string> = new Set();
  private lastExecuted: Map<string, number> = new Map();
  private timer: ReturnType<typeof setTimeout> | null = null;
  
  private readonly BATCH_MS = 50;
  private readonly THROTTLE_MS = 200; // 5 invalidations per second

  /**
   * Schedules a batched invalidation for a specific query key.
   */
  ingest(queryClient: QueryClient, key: string) {
    this.queue.add(key);
    
    if (this.timer) return;

    this.timer = setTimeout(() => {
      this.timer = null;
      
      // Frame grouping for UI smoothness
      requestAnimationFrame(() => {
        this.processQueue(queryClient);
      });
    }, this.BATCH_MS);
  }

  private processQueue(queryClient: QueryClient) {
    const now = Date.now();
    const deferredKeys = new Set<string>();

    this.queue.forEach(key => {
      const last = this.lastExecuted.get(key) || 0;
      
      if (now - last >= this.THROTTLE_MS) {
        // Execute invalidation
        queryClient.invalidateQueries({ queryKey: [key] });
        this.lastExecuted.set(key, now);
      } else {
        // Rate limited - defer to next cycle
        deferredKeys.add(key);
      }
    });

    // Clear and refill with deferred
    this.queue = deferredKeys;

    // If we have deferred keys, schedule another check at the next earliest available slot
    if (this.queue.size > 0 && !this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        requestAnimationFrame(() => this.processQueue(queryClient));
      }, this.THROTTLE_MS / 2); // Check frequently enough to catch early available slots
    }
  }
}

export const queryBatcher = new QueryBatcher();
