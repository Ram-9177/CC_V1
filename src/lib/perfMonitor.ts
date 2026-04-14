/**
 * Performance Monitoring Utilities
 * Tracks and logs API response times > 4ms threshold
 */

interface APIMetric {
  endpoint: string;
  method: string;
  duration: number;
  timestamp: number;
  status: number;
}

class PerformanceMonitor {
  private metrics: APIMetric[] = [];
  private maxMetrics = 100;
  private threshold = 4; // milliseconds

  recordMetric(endpoint: string, method: string, duration: number, status: number) {
    // Only log if exceeds threshold
    if (duration <= this.threshold) return;

    const metric: APIMetric = {
      endpoint,
      method: method.toUpperCase(),
      duration: parseFloat(duration.toFixed(2)),
      timestamp: Date.now(),
      status,
    };

    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log to console
    console.log(
      `%c[PERF] ${metric.method} ${metric.endpoint}: ${metric.duration}ms (${metric.status})`,
      'color: #ff6b00; font-weight: bold;'
    );
  }

  getMetrics() {
    return this.metrics;
  }

  getSummary() {
    if (this.metrics.length === 0) return null;

    const times = this.metrics.map((m) => m.duration);
    const avg = times.reduce((a, b) => a + b) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);
    const slowest = [...this.metrics].sort((a, b) => b.duration - a.duration).slice(0, 5);

    return {
      totalRequests: this.metrics.length,
      avgTime: parseFloat(avg.toFixed(2)),
      maxTime: parseFloat(max.toFixed(2)),
      minTime: parseFloat(min.toFixed(2)),
      slowestEndpoints: slowest,
      threshold: this.threshold,
    };
  }

  clearMetrics() {
    this.metrics = [];
  }

  // Expose in console for debugging
  exposeToWindow() {
    (window as any).__perfMonitor = {
      metrics: () => this.getMetrics(),
      summary: () => this.getSummary(),
      clear: () => this.clearMetrics(),
    };
    console.log('✨ Performance monitor available: window.__perfMonitor');
  }
}

export const perfMonitor = new PerformanceMonitor();

// Auto-expose to window in development
if (import.meta.env.DEV) {
  setTimeout(() => perfMonitor.exposeToWindow(), 100);
}
