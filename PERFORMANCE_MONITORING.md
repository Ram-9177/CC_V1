# Performance Monitoring Guide - API Requests > 4ms

## What's Tracked

All API requests that take **more than 4ms** are automatically logged to console with timing data.

## How to View Timing Data

### In Browser Console

1. Open DevTools: **F12**
2. Go to **Console** tab
3. You'll see orange `[PERF]` logs for slow requests:
   ```
   [PERF] GET /api/dashboard: 45.23ms
   [PERF] POST /api/gate-passes: 67.12ms
   [PERF] GET /api/notifications: 23.45ms
   ```

### Access Performance Summary

Run in console:
```javascript
window.__perfMonitor.summary()
```

Returns:
```javascript
{
  totalRequests: 45,          // Requests > 4ms
  avgTime: 28.34,             // Average duration
  maxTime: 127.45,            // Slowest request
  minTime: 4.02,              // Fastest tracked
  slowestEndpoints: [         // Top 5 slowest
    { endpoint: '/api/analytics', method: 'GET', duration: 127.45, ... },
    { endpoint: '/api/metrics', method: 'GET', duration: 98.12, ... },
    { ... }
  ],
  threshold: 4                // Current threshold (ms)
}
```

### View All Metrics

```javascript
window.__perfMonitor.metrics()
```

Returns array of APIMetric objects with timestamp and status code.

### Clear Metrics

```javascript
window.__perfMonitor.clear()
```

## Understanding the Data

### Request Timing Breakdown

```
Total Request Time = Network Latency + Backend Processing + Response Parsing

├─ Network Latency (1-5ms on localhost)
│  └─ Client → Server roundtrip
├─ Backend Processing (5-100ms depending on query complexity)
│  ├─ Django route resolution
│  ├─ Database query execution
│  ├─ Serialization
│  └─ Cache hits/misses
└─ Client Response Parsing (0-2ms)
   └─ JSON parsing + state update
```

### Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| API response | < 50ms | 🟡 Monitor |
| Network only | < 5ms | ✅ Acceptable |
| Backend only | < 50ms | 🟡 Optimize if > 100ms |
| Total dashboard | < 2000ms | ✅ Stage 1 |

## Why Requests Take > 4ms

### On Localhost (127.0.0.1)

**Minimum latency**: ~1-2ms just for IPC overhead
- Network roundtrip: ~1ms
- Backend processing: ~1-10ms (depending on query)
- Client parsing: ~0.5-1ms

**Total for simple GET**: ~3-5ms (unavoidable)

### Common Slow Requests

1. **N+1 Database Queries** (10-100ms)
   - Loading user + related data without `select_related()`
   - Fix: Use Django ORM `select_related()` / `prefetch_related()`

2. **Full Table Scans** (20-500ms)
   - No database index on filter column
   - Fix: Add database index to frequently filtered fields

3. **Large Response Bodies** (5-50ms)
   - Serializing thousands of records
   - Fix: Implement pagination, use `limit` parameter

4. **Complex Serialization** (5-30ms)
   - DRF serializers with many nested fields
   - Fix: Use `SlugRelatedField` or custom lean serializers

5. **Missing Caching** (same result requested 3x)
   - Browser not caching identical GET requests
   - Fix: API already deduplicates with `requestCache`

## Optimization Strategies

### Quick Wins (1-5ms improvement)

✅ Enable query result caching (browsers caches GETs)
✅ Use database query optimization (`select_related`)
✅ Reduce JSON response payload size

### Medium Effort (5-20ms improvement)

🔄 Add database indexes on commonly filtered columns
🔄 Implement API pagination for large datasets
🔄 Use Django cache for expensive queries

### Advanced (20-100ms improvement)

⚡ Implement GraphQL N+1 prevention
⚡ Use Redis for distributed caching
⚡ Batch multiple API calls into single endpoint

## Performance Thresholds

### What's "Slow"?

- **< 4ms**: Imperceptible, don't optimize
- **4-10ms**: Network roundtrip, acceptable
- **10-50ms**: Backend work, monitor
- **50-200ms**: Noticeable, consider optimizing
- **> 200ms**: Definitely optimize

### Stage 1 vs Stage 2

- **Stage 1** (critical data): Target < 2000ms total
  - Includes 4-5 API calls in parallel
  - Individual calls: < 50ms preferred
  
- **Stage 2** (secondary data): Delayed until Stage 1 complete
  - User sees skeleton + critical data first
  - 2-3 additional API calls
  - Individual calls: < 100ms acceptable

## Example Output

When loading Warden Dashboard:

```
[PERF] GET /api/metrics/dashboard: 45.23ms
[PERF] GET /api/announcements: 23.45ms
[PERF] GET /api/gate-passes: 67.89ms
[PERF] GET /api/notices: 12.34ms
[PERF] GET /api/complaints: 34.56ms (Stage 2 - delays until stage 1)
[PERF] GET /api/student-hrs: 89.12ms (Stage 2 - delays until stage 1)
```

Summary shows:
- **avgTime**: 44.5ms (acceptable for localhost)
- **maxTime**: 89.12ms (Stage 2 queries OK)
- **slowestEndpoints**: student-hrs, gate-passes

## When to Investigate

Investigate and optimize when:

1. ✅ Individual API calls consistently > 100ms
2. ✅ Stage 1 total time > 2500ms (user perceives slowness)
3. ✅ Same endpoint has high variance (5ms → 200ms)
4. ✅ Mobile/3G simulation shows > 3000ms Stage 1

## Tools

### Browser DevTools Network Tab
- Shows waterfall with individual request timings
- Can simulate 3G/4G throttling
- Best for seeing full request lifecycle

### Console Performance Monitor
- Shows server response times only
- Excludes browser rendering time
- Best for backend bottleneck analysis

### Django Debug Toolbar (if available)
- Shows DB query count and execution time
- Identifies N+1 problems
- Best for backend optimization

---

**Status**: ✅ All APIs > 4ms are now tracked  
**Console logs**: Orange `[PERF]` messages for slow requests  
**Command**: `window.__perfMonitor.summary()` for quick stats
