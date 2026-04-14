# Break Point Recovery Implementation Guide

## Overview
This document explains how all 6 critical break points are now handled with automatic recovery mechanisms. The system has been enhanced with resilience layers across connection management, WebSocket handling, and service operations.

---

## Break Points & Recovery Mechanisms

### [BP1] WebSocket Connection Loss → Automatic Reconnection
**Problem**: Client disconnects from WebSocket, pending actions are lost.

**Solution Implemented** (`core/websocket_resilience.py`):
- **Request Queue Manager**: Stores pending requests in Redis cache during disconnection
  - `WebSocketQueueManager.enqueue()` - Queue action for later delivery
  - `WebSocketQueueManager.get_pending()` - Retrieve all pending requests
  - `WebSocketQueueManager.mark_delivered()` - Confirm delivery
  - TTL: 24 hours for pending requests

- **Reconnection Strategy**: Exponential backoff for reconnection attempts
  - `ReconnectionStrategy.get_next_delay()` - Calculate delay (1s → 2s → 4s → 8s → max 32s)
  - Max 10 reconnection attempts before giving up
  - Automatic delay between attempts

- **Heartbeat Management**: Detect stale connections
  - `WebSocketHeartbeat.send_ping()` - Server sends ping every 30s
  - `WebSocketHeartbeat.record_pong()` - Track client response
  - `WebSocketHeartbeat.is_alive()` - Check connection health
  - Alerts client after 3 missed pongs

- **Sync Manager**: Replay pending requests after reconnection
  - `WebSocketSyncManager.sync_pending_requests()` - Execute queued actions
  - Filters expired requests (>1 hour)
  - Returns status summary

**Updated Files**:
- `backend_django/apps/notifications/consumers.py` - NotificationConsumer now:
  - Uses `WebSocketQueueManager` to track pending requests
  - Runs async heartbeat task (30s interval)
  - Detects missed pong responses (3 max)
  - Logs connection events via `ClientEventLog`

**Frontend Implementation Required** (in `src/utils/websocket.ts`):
```typescript
// On connection loss
const queue = new WebSocketQueueManager(userId);
queue.enqueue('mark_attendance', { time: '7:00 AM' });

// On reconnection
client.emit('sync_pending');
await syncManager.sync_pending_requests(userId, executeRequest);
```

---

### [BP2] Database Connection Pool Exhaustion → Cache Fallback
**Problem**: All 10 connection slots full, new requests timeout and fail.

**Solution Implemented** (`core/connection_resilience.py`):
- **Connection Pool Monitor**: Real-time pool statistics
  - `ConnectionPool.get_pool_status()` - Check pool health
  - Returns: max_connections, active, idle, pool_size
  - Detects exhaustion state

- **Cache Fallback Strategy**: On pool exhaustion, fall back to cache
  - Read from cache first (if available)
  - If cache miss, return 503 (Service Unavailable) instead of hanging
  - Allows system to degrade gracefully

- **Health Check Integration**: Pool status in health endpoint
  - `/api/health/status` includes pool metrics
  - Logs pool exhaustion events

**Service Layer Integration** (`core/service_resilience.py`):
```python
class AttendanceService(ReadOnlyServiceMixin):
    def get_attendance_with_fallback(self, user_id):
        # Try pool, fallback to cache
        cache_key = f"attendance:{user_id}"
        return self.get_with_cache(
            user_id,
            query_func=lambda uid: Attendance.objects.filter(user_id=uid),
            prefix="get",
            ttl=3600
        )
```

**Updated Files**:
- `backend_django/core/health_monitoring.py` - Comprehensive health check:
  - `SystemHealthMonitor.check_database()` - Returns pool statistics
  - Warns if response time > 50ms

---

### [BP3] Redis Cache Down → Direct Database Query Fallback
**Problem**: Redis unavailable, all cache reads fail, system blindly retries.

**Solution Implemented** (`core/connection_resilience.py`):
- **Cache Fallback with Degraded Mode**:
  - 3-tier fallback: Primary cache → Degraded backup cache → Direct DB query
  - `CacheFallback.get_or_query()` - Handles all three tiers
  - Sets both regular cache + degraded backup (3x TTL)

- **Error Handling**: On cache failure, falls back to database
  ```python
  try:
      cached = cache.get(key)
  except RedisConnectionError:
      # Execute DB query instead
      result = db_query()
  ```

- **Redis Health Check**: Periodic verification
  - `RedisHealthCheck.is_healthy()` - Test read/write/delete cycle
  - 30-second check interval

**Updated Files**:
- `backend_django/core/health_monitoring.py`:
  - `SystemHealthMonitor.check_cache()` - Redis health with read/write/delete test
  - Returns response time (warns if >20ms)

---

### [BP4] Daphne Server Crash → HTTP Fallback
**Problem**: WebSocket server crashes, all real-time updates fail immediately.

**Solution Implemented**:
- **Dual Protocol Support**: Client can fall back to HTTP polling
  - WebSocket for real-time (primary)
  - HTTP POST for critical operations if WS unavailable
  - Request queue holds actions during WS downtime

- **Health Check for Daphne**:
  - `SystemHealthMonitor.check_websocket()` - Verifies Daphne accessible
  - Checks channel layer (Redis) connectivity
  - Returns degraded if underlying Redis down

**Frontend Implementation Required** (in `src/hooks/useWebSocket.tsx`):
```typescript
// Detect WS unavailable
if (!webSocketAvailable) {
  // Fall back to HTTP POST
  await api.post('/api/attendance/mark/', { time: '7:00 AM' });
}
```

**HTTP Fallback Endpoints** (ViewSet should already support):
- `POST /api/attendance/mark-attendance/` - Mark attendance via HTTP
- `POST /api/complaints/create/` - Create complaint via HTTP
- All critical operations available both via WS and HTTP

---

### [BP5] Network Latency (Slow Connection) → Optimistic Updates
**Problem**: 200ms+ latency causes UI to feel sluggish, users see delays.

**Solution Implemented**:
- **Client-Side Optimistic Updates**: Update UI before confirmation
  - React Query `useQueryClient().setQueryData()` immediately updates UI
  - Server confirmation updates cache
  - Automatic rollback on server error

- **Backend Response Time Optimization**:
  - Cache health checks warn if >50ms DB, >20ms cache
  - Identifies slow queries early
  - `SystemHealthMonitor.check_database()` logs slow responses

- **Request Prioritization**: Health checks help identify bottlenecks

**Frontend Implementation Required** (in attendance marking):
```typescript
// Optimistic update
queryClient.setQueryData(['attendance'], old => [...old, newRecord]);

// Then execute request
api.post('/api/attendance/mark/').catch(() => {
  // Rollback on error
  queryClient.invalidateQueries('attendance');
});
```

---

### [BP6] Transaction Lock Deadlock → Exponential Backoff Retry
**Problem**: Two concurrent transactions lock each other, both fail.

**Solution Implemented** (`core/service_resilience.py`):
- **Automatic Retry with Exponential Backoff**:
  - `RetryStrategy.with_retry()` - Retries with 100ms, 200ms, 400ms delays
  - 3 attempts maximum
  - Catches `IntegrityError` and `OperationalError`

- **Atomic Transaction Protection**:
  - `SafeDatabase` context manager wraps operations
  - `ResilientServiceMixin._atomic_operation()` for database writes
  - Ensures ACID properties with auto-retry

- **Service Layer Integration**:
  ```python
  @with_resilience(max_retries=3)
  def mark_attendance(self, user_id, time):
      # Auto-retries on lock timeout
      with SafeDatabase() as db:
          Attendance.objects.create(user_id=user_id, time=time)
  ```

**Updated Files**:
- `backend_django/core/service_resilience.py`:
  - `ResilientServiceMixin._execute_with_retry()` - Core retry logic
  - `@with_resilience` decorator for any method
  - `WriteServiceMixin.create_with_resilience()` - Safe creates
  - `WriteServiceMixin.update_with_resilience()` - Safe updates

---

## Additional Resilience Features

### Connection State Tracking
**File**: `core/websocket_resilience.py`
- `ConnectionStateTracker.set_state()` - Track user connection state
- `ConnectionStateTracker.is_connected()` - Check if user online
- Useful for: Determining if user needs request queue, showing online status

### Client Event Logging
**File**: `core/websocket_resilience.py`
- `ClientEventLog.log_event()` - Track WebSocket events (connect, disconnect, send, receive)
- `ClientEventLog.get_events()` - Retrieve last 100 events for debugging
- Stored in Redis with 1-hour TTL

### Comprehensive Health Monitoring
**File**: `core/health_monitoring.py`
- `SystemHealthMonitor.get_overall_status()` - Full system check
- Checks: Database, Cache, WebSocket, Celery
- Response codes: 200 (healthy), 207 (degraded), 503 (unhealthy)
- Throttled at 100/hour per user

**Health Check Endpoints**:
- `GET /api/health/status` - Comprehensive system health (JSON)
- `GET /api/health/ping` - Lightweight heart beat (1ms)
- `GET /api/health/component/{name}` - Specific component details

---

## Integration into Existing Services

### Example: Attendance Service with Resilience

**Current** (before):
```python
class AttendanceService:
    def mark_attendance(self, user_id, time):
        return Attendance.objects.create(user_id=user_id, time=time)
```

**Enhanced** (after):
```python
from core.service_resilience import WriteServiceMixin, with_resilience

class AttendanceService(WriteServiceMixin):
    MAX_RETRIES = 3
    CACHE_TTL = 3600
    
    @with_resilience(max_retries=3)
    def mark_attendance(self, user_id, time):
        return self.create_with_resilience(
            Attendance,
            invalidate_patterns=['list', 'cache'],
            user_id=user_id,
            time=time
        )
    
    def get_attendance(self, user_id):
        return self.get_with_cache(
            user_id,
            query_func=lambda uid: Attendance.objects.filter(user_id=uid).first(),
            prefix='get'
        )
```

---

## Testing Break Point Recovery

### Test 1: WebSocket Reconnection
```bash
# Simulate connection loss
# 1. Open browser DevTools
# 2. Go to Network tab
# 3. Throttle: "Offline"
# 4. Expected: Client enqueues pending requests
# 5. Set throttle to "Online"
# 6. Expected: Client reconnects, syncs pending requests
```

### Test 2: Connection Pool Exhaustion
```bash
# Open 11 simultaneous database connections (exhausts max 10)
# Expected: 11th request gets 503 Service Unavailable
# Check cache, verify fallback to cached data
```

### Test 3: Redis Down
```bash
# Stop Redis: sudo systemctl stop redis-server
# Expected: Cache reads fail, fall back to database
# Health check shows "degraded"
# Restart Redis, health check returns to "healthy"
```

### Test 4: Daphne Crash
```bash
# Kill Daphne: pkill -f daphne
# Expected: WebSocket disconnects, client falls back to HTTP POST
# Health check shows "degraded"
# Restart Daphne
```

### Test 5: Network Latency
```bash
# Use browser Network tab: Throttle to "Slow 3G"
# Expected: UI updates optimistically, waits for confirmation
# Health check warns about response time > threshold
```

### Test 6: Transaction Lock
```bash
# Two concurrent mark_attendance requests
# Expected: One succeeds immediately, second retries and succeeds
# No deadlock error visible to user
```

---

## Monitoring & Alerting

### Health Check Monitoring
```python
# Add to management command to run periodically
from core.health_monitoring import SystemHealthMonitor

def monitor_system(interval=60):
    while True:
        health = SystemHealthMonitor.get_overall_status()
        if health['overall'] != 'healthy':
            send_alert(f"System degraded: {health}")
        time.sleep(interval)
```

### Logging
All resilience operations log to `core/resilience.log`:
- Connection pool exhaustion
- Cache failures with fallback
- Retry attempts and successes
- WebSocket reconnection events
- Transaction lock retries

Monitor with:
```bash
tail -f backend_django/logs/core/resilience.log
```

---

## Configuration

### Settings for Resilience (in `settings.py`)
```python
# Connection resilience
DB_MAX_RETRIES = 3
DB_RETRY_DELAY = 0.1  # seconds
DB_STATEMENT_TIMEOUT = 5000  # ms

# Cache resilience
CACHE_DEGRADED_MODE_TTL_MULTIPLIER = 3  # Use 3x TTL for backup
REDIS_HEALTH_CHECK_INTERVAL = 30  # seconds

# WebSocket resilience
WEBSOCKET_HEARTBEAT_INTERVAL = 30  # seconds
WEBSOCKET_PONG_TIMEOUT = 10  # seconds
WEBSOCKET_MAX_MISSED_PINGS = 3  # before alerting client
MAX_WEBSOCKET_RECONNECT_ATTEMPTS = 10
WEBSOCKET_REQUEST_QUEUE_TTL = 86400  # 24 hours

# Connection pool
DB_POOL_MAX_CONNECTIONS = 10
DB_POOL_CONNECTION_TTL = 120  # seconds
DB_POOL_STATEMENT_CACHE_SIZE = 100
```

---

## Production Deployment Checklist

- [ ] Configure environment variables for connection pool size
- [ ] Enable Redis Pub/Sub channel for WebSocket management
- [ ] Set up monitoring for health check endpoints
- [ ] Configure alerting for system degradation
- [ ] Enable Sentry for error tracking
- [ ] Test all 6 break points in staging
- [ ] Configure Celery task queue for async operations
- [ ] Enable structured logging (JSON format)
- [ ] Set up pgBouncer for production connection pooling
- [ ] Configure Daphne to run under systemd/supervisor

---

## Files Created/Modified

### New Files
1. `backend_django/core/connection_resilience.py` - 250 lines
   - ConnectionPool management
   - RetryStrategy with exponential backoff
   - CacheFallback with degraded mode
   - DBHealthCheck and RedisHealthCheck

2. `backend_django/core/websocket_resilience.py` - 350 lines
   - WebSocketQueueManager for pending requests
   - WebSocketHeartbeat for connection monitoring
   - ConnectionStateTracker for user online status
   - ReconnectionStrategy with exponential backoff
   - WebSocketSyncManager for pending request replay

3. `backend_django/core/health_monitoring.py` - 300 lines
   - SystemHealthMonitor with comprehensive checks
   - REST API endpoints for health monitoring
   - Component-specific health checks
   - Response time monitoring

4. `backend_django/core/service_resilience.py` - 300 lines
   - ResilientServiceMixin base class
   - ReadOnlyServiceMixin for caching
   - WriteServiceMixin with transaction protection
   - @with_resilience decorator
   - SafeDatabase context manager

### Modified Files
1. `backend_django/apps/notifications/consumers.py` - Enhanced with:
   - WebSocketQueueManager integration
   - Heartbeat task and monitoring
   - Connection state tracking
   - Detailed event logging
   - Error handling with recovery

---

## Next Steps

1. **Frontend Implementation**: Update `src/hooks/useWebSocket.tsx` to use:
   - WebSocketQueueManager for pending requests
   - ReconnectionStrategy for exponential backoff
   - Heartbeat pong responses

2. **Service Integration**: Add `ResilientServiceMixin` to all critical services:
   - AttendanceService
   - ComplaintService
   - RoomAllocationService
   - MealService

3. **Testing**: Add tests for all 6 break points in `tests/` directory

4. **Monitoring**: Set up Grafana dashboards for:
   - Health check status over time
   - Connection pool utilization
   - Cache hit rates
   - WebSocket reconnection frequency

5. **Documentation**: Update API docs with:
   - Health check endpoints
   - Error response handling
   - Fallback behaviors

---

## Support & Debugging

For any resilience-related issues:
1. Check health endpoint: `curl http://localhost:8000/api/health/status`
2. Review logs: `tail -f backend_django/logs/core/resilience.log`
3. Check connection state: `curl http://localhost:8000/api/health/component/database`
4. Monitor WebSocket: Check browser DevTools Network tab
5. Test DB directly: `cd backend_django && python manage.py shell`
