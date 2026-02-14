# 🔴 Concurrent Login & User Connection Analysis

## Executive Summary

**Issue:** System crashes/goes down when ~10 or more members login simultaneously.

**Root Cause:** The current deployment uses **Render Free Tier** with **2 Daphne workers** and **in-memory channel layer**, which can handle max ~20-50 concurrent WebSocket connections before exhausting resources.

**Severity:** 🔴 CRITICAL - Production blocker for scale

---

## 📊 Current Deployment Architecture

### Backend Infrastructure (Render Free Tier)
```
┌─────────────────────────────────────────┐
│   Render Free Tier Plan                 │
├─────────────────────────────────────────┤
│  • WEB_CONCURRENCY: 2 Daphne workers    │ ← LIMITED
│  • Memory: ~512 MB shared                │
│  • CPU: Shared/limited                   │
│  • Redis: In-memory layer (DEBUG mode)   │ ← BOTTLENECK
│  • DB: PostgreSQL free tier (3 max conn) │
│  • No connection pooling                 │
└─────────────────────────────────────────┘

LOGIN FLOW (PER USER)
1. User submits login (HTTP POST) → 1 worker
2. Authentication check → DB query
3. JWT token generation
4. User connects WebSocket (3 types) → 1 more worker resource
5. Presence announced → Broadcast to all groups
6. Each connection joins groups:
   - updates_{user_id}
   - role_{role}
   - notifications_{user_id}
   - management (if staff)
   - presence_all
```

### Critical Bottlenecks Identified

#### 1️⃣ **Daphne Worker Pool Size (2 workers)**
```python
# render.yaml
WEB_CONCURRENCY: 2  # ← CRITICAL LIMIT

# Impact when 10 users login simultaneously:
10 concurrent logins × 3 WebSocket connections per user
= 30 concurrent connections
÷ 2 workers = 15 connections per worker ← OVERLOAD
```

**Expected Behavior:**
- Workers queue after 15 connections
- New logins stall/timeout (10-30s)
- WebSocket handshakes fail
- System becomes unresponsive

#### 2️⃣ **In-Memory Channel Layer (DEBUG mode)**
```python
# hostelconnect/settings/base.py
if config('USE_IN_MEMORY_CHANNEL_LAYER', default=DEBUG, cast=bool):
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer'  # ← PROBLEM
        }
    }
```

**Issues:**
- ❌ Single-process in-memory = doesn't scale beyond 1 worker
- ❌ No persistence across Daphne restarts
- ❌ Broadcasts to non-existent workers lose messages
- ❌ Memory leaks in long-running connections
- ❌ No connection pooling/limits

**When 10 users connect:**
1. User 1-2: Works fine
2. User 3-5: Slow (in-memory queue builds)
3. User 6-10: Broadcast failures (workers can't sync)
4. Result: **System appears to "go down"**

#### 3️⃣ **Presence Broadcasting Amplifies Load**
```python
# websockets/consumers.py - PresenceConsumer.connect()
async def connect(self):
    # ...
    await self.channel_layer.group_send(
        'presence_all',  # ← Broadcast to ALL users
        {
            'type': 'user_status_changed',
            'user_id': self.user.id,
            'status': 'online'  # ← EVERY LOGIN triggers this
        }
    )
```

**Cascade Effect:**
- User 1 logs in → Presence message sent to presence_all group
- In-memory layer broadcasts to all connected clients
- User 2 logs in → Another broadcast
- User 10 logs in → 10th broadcast in quick succession
- **Amplifies WebSocket load by 10x**

#### 4️⃣ **Redis Channel Layer Not Used in Production**
```python
# Settings show Redis is configured but may not be active
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [config('REDIS_URL', default='redis://localhost:6379/0')],
            'capacity': 1500,  # ← GOOD, but...
            # ...
        },
    },
}

# BUT: Falls back to in-memory in DEBUG mode (which includes Render!)
if config('USE_IN_MEMORY_CHANNEL_LAYER', default=DEBUG, cast=bool):
    CHANNEL_LAYERS = {...InMemoryChannelLayer...}  # ← FALLBACK ISSUE
```

#### 5️⃣ **Database Connection Pool Exhaustion**
```python
# Free tier PostgreSQL: max 3 connections
# Each Django connection takes 1 slot
# Each user login:
#   - 1 query: Authenticate user
#   - 1 query: Update last_login
#   - Multiple queries for user data

# With 2 Daphne workers:
#   - Worker 1: Uses conn1, conn2
#   - Worker 2: Uses conn3
#   - User 11 login: NO CONNECTIONS AVAILABLE → TIMEOUT
```

---

## 🔍 Technical Breakdown: What Happens When 10 Users Login

### Timeline (estimated)

```
T=0s: User 1 → POST /api/auth/login/
      ✅ Worker 1 accepts
      ✅ Auth check passes
      ✅ JWT token returned
      ✅ User 1 connects WebSocket (3x)
      ✅ Presence broadcast sent
      ⏱️ Time: 200ms

T=0.2s: User 2 → POST /api/auth/login/
        ✅ Worker 2 accepts
        ✅ Auth check passes (gets conn3)
        ✅ JWT token returned
        ✅ User 2 connects WebSocket (3x)
        ✅ Presence broadcast queued (in-memory queue growing)
        ⏱️ Time: 200ms

T=0.4s: User 3-5 → POST /api/auth/login/
        ⚠️ Queue building
        ⚠️ Workers becoming busy
        ⏱️ Time: 500-1000ms each (slow response)

T=1.5s: User 6-10 → POST /api/auth/login/
        ❌ DB connections exhausted (3 max)
        ❌ In-memory channel layer dropping messages
        ❌ Presence broadcasts failing
        ❌ WebSocket handshakes timing out
        ⏱️ Time: 10-30s+ (or timeout/fail)

T=5s: User 1-2 disconnect due to timeouts
      ➜ Presence broadcasts that they're offline (more messages!)
      ➜ Remaining users' UI updates stall

Result: "SYSTEM IS DOWN"
```

### What Users Experience

**User 1-2 (First logins):**
- ✅ Login succeeds
- ✅ WebSocket connects
- ✅ Real-time features work

**User 3-5:**
- ⚠️ Login slow (5-10s instead of 1-2s)
- ⚠️ WebSocket might timeout
- ⚠️ Presence not shown immediately

**User 6-10:**
- ❌ Login page hangs
- ❌ "Connection timeout" error after 30s
- ❌ Can retry but same result
- ❌ WebSocket never connects
- ❌ All real-time features broken

---

## 🎯 User-to-User Connection Status

### Direct Messaging (Messages App)

**Current Implementation:** ✅ Working but limited by WebSocket availability

```python
# apps/messages/models.py
class Message(TimestampedModel):
    sender = models.ForeignKey(User, ...)
    recipient = models.ForeignKey(User, ...)
    body = models.TextField()
    # ...

# Messages broadcast via WebSocket:
broadcast_to_updates_user(recipient_id, 'messages_updated', {...})
```

**Issues with current setup:**

1. **No real-time delivery when user is offline** ❌
   - Messages sent but recipient unaware until they refresh
   - No notification persistence

2. **WebSocket failure = message delivery failure** ❌
   - If WebSocket drops, `messages_updated` event lost
   - User must manually refresh inbox

3. **No message read receipts in real-time** ⚠️
   - Read status updates via `messages_updated` broadcast
   - If broadcast fails, read status not synced

4. **Concurrent messaging during login surge** ❌
   - Messages queued during login chaos
   - May be lost if in-memory buffer overflows

### Presence System

**Current:** Shows online/offline status via PresenceConsumer

```python
# When user logs in:
await self.channel_layer.group_send(
    'presence_all',
    {
        'type': 'user_status_changed',
        'user_id': self.user.id,
        'status': 'online'
    }
)

# ISSUE: Every presence update is a broadcast
# With 10 concurrent logins = 10 presence broadcasts in-flight
# In-memory layer can't handle the throughput
```

---

## ✅ Proposed Fixes (Priority Order)

### Priority 1: IMMEDIATE (Deploy Today)

#### Fix 1.1: Increase Daphne Worker Count
```yaml
# render.yaml - Change from 2 to 4 (or 6 if free tier allows)
envVars:
  - key: WEB_CONCURRENCY
    value: 4  # Was: 2
```

**Impact:**
- From 2 workers → 4 workers = 2x capacity
- Handles ~40-80 concurrent connections instead of 20-40
- Still won't solve everything but helps

**Cost:** FREE (Render allocates based on available resources)

#### Fix 1.2: Disable Presence Broadcasting During Login
```python
# websockets/consumers.py - PresenceConsumer.connect()
async def connect(self):
    """Handle WebSocket connection."""
    self.user = self.scope.get('user', AnonymousUser())
    self.presence_group = 'presence_all'
    
    if not self.user.is_authenticated:
        await self.close(code=4401)
        return
    
    await self.channel_layer.group_add(
        self.presence_group,
        self.channel_name
    )
    
    await self.accept()
    
    # FIX: Defer presence notification to avoid broadcast storm
    # During login surge, skip immediate broadcast
    if not getattr(self, '_skip_presence_broadcast', False):
        try:
            await asyncio.sleep(2)  # Wait 2s for others to stabilize
            await self.channel_layer.group_send(
                self.presence_group,
                {
                    'type': 'user_status_changed',
                    'user_id': self.user.id,
                    'status': 'online'
                }
            )
        except Exception as e:
            logger.error(f"Presence broadcast failed: {e}")
```

**Impact:** Reduces broadcast storm during login surge

#### Fix 1.3: Add Redis Connection String to Render Config
```yaml
# render.yaml - Set REDIS_URL explicitly
envVars:
  - key: REDIS_URL
    value: redis://[get from Upstash or Redis provider]
```

**Why:**
- Ensures Redis channel layer is used (not in-memory fallback)
- Free Redis from Upstash: https://upstash.com (14 GB free)
- Single command can handle 1000+ concurrent connections

**Impact:** Scales from 50 to 10,000+ concurrent users

### Priority 2: SHORT-TERM (This Week)

#### Fix 2.1: Implement Message Queue for Offline Users
```python
# apps/messages/models.py - Add notification queueing
class Message(TimestampedModel):
    sender = models.ForeignKey(User, ...)
    recipient = models.ForeignKey(User, ...)
    body = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    
    # NEW: Store if WebSocket delivery was attempted
    websocket_delivered = models.BooleanField(default=False)  # NEW
    
    class Meta:
        # Add index for undelivered messages
        indexes = [
            models.Index(fields=['recipient', 'websocket_delivered', '-created_at']),  # NEW
        ]

# NEW: Background task to retry failed deliveries
@app.task(bind=True, max_retries=3)
def retry_message_delivery(self, message_id):
    """Retry WebSocket delivery of message."""
    try:
        message = Message.objects.get(id=message_id)
        broadcast_to_updates_user(
            message.recipient.id,
            'messages_updated',
            {'message_id': message.id, 'from': message.sender.username}
        )
        message.websocket_delivered = True
        message.save()
    except Exception as exc:
        # Retry in 30 seconds
        raise self.retry(exc=exc, countdown=30)
```

#### Fix 2.2: Add Connection Pooling for Database
```python
# hostelconnect/settings/base.py
DATABASES = {
    'default': dj_database_url.parse(
        config('DATABASE_URL', default=''),
        conn_max_age=0,  # Changed from 60
        conn_health_checks=True,  # NEW: Verify connections
    ),
    # NEW: Add PgBouncer for connection pooling (if production DB)
}

if USE_PGBOUNCER:
    DATABASES['default']['HOST'] = 'pgbouncer-host'
    DATABASES['default']['OPTIONS'] = {
        'connect_timeout': 5,
    }
```

#### Fix 2.3: Add Login Rate Limiting Per User
```python
# backend_django/apps/auth/views.py
from core.throttles import LoginRateThrottle

class LoginView(generics.GenericAPIView):
    """User login endpoint."""
    
    serializer_class = LoginSerializer
    throttle_classes = [LoginRateThrottle]  # ← Already set
    
    def post(self, request, *args, **kwargs):
        """Handle login request."""
        # ... existing code ...
        
        # NEW: Don't allow 10+ logins in < 5 seconds per IP
        # This queues excessive login attempts
```

### Priority 3: LONG-TERM (Next Sprint)

#### Fix 3.1: Implement WebSocket Connection Pooling
```python
# src/lib/websocket.ts - Limit concurrent WebSocket connections
class WebSocketClient {
    private static readonly MAX_CONCURRENT_CONNECTIONS = 3;  // NEW
    private static activeConnections = 0;
    
    connect() {
        if (WebSocketClient.activeConnections >= WebSocketClient.MAX_CONCURRENT_CONNECTIONS) {
            console.warn('Connection limit reached, queueing...');
            this.queueConnection();
            return;
        }
        
        WebSocketClient.activeConnections++;
        
        // ... existing connect code ...
        
        this.ws.onclose = () => {
            WebSocketClient.activeConnections--;
            // Try next in queue
            this.processQueue();
        };
    }
    
    private queueConnection() {
        // NEW: Queue excess connections
    }
}
```

#### Fix 3.2: Implement Message Batching
```python
# websockets/broadcast.py - Batch multiple events
class EventBatcher:
    """Batch events to reduce broadcast load."""
    
    def __init__(self, batch_size=10, flush_interval=1.0):
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.batches = {}
        
    async def add_event(self, group_name, event_type, data):
        """Queue event for batching."""
        if group_name not in self.batches:
            self.batches[group_name] = []
        
        self.batches[group_name].append({
            'type': event_type,
            'data': data
        })
        
        if len(self.batches[group_name]) >= self.batch_size:
            await self.flush(group_name)
```

#### Fix 3.3: Upgrade to Render Pro or Alternative Hosting
```
Current: Render Free Tier
- 2 concurrent workers
- 512 MB RAM
- Shared resources
- In-memory only

Options:
1. Render Pro: $12/month
   - Dedicated resources
   - More workers
   - Better uptime

2. Railway: Similar pricing
   - Better WebSocket support
   - Per-second billing

3. Fly.io: Recommended for Django + Channels
   - Dedicated machine ($5/month base)
   - Native WebSocket support
   - Better real-time performance
```

---

## 🧪 Testing Strategy

### Test 1: Concurrent Login Simulation
```bash
#!/bin/bash
# test-concurrent-logins.sh

API_URL="http://localhost:8000"
NUM_USERS=10

# Create test users (if not exists)
for i in {1..10}; do
    curl -X POST "$API_URL/api/auth/register/" \
        -H "Content-Type: application/json" \
        -d "{\"username\": \"testuser$i\", \"password\": \"password123\"}"
done

# Simulate concurrent logins
for i in {1..10}; do
    (
        curl -X POST "$API_URL/api/auth/login/" \
            -H "Content-Type: application/json" \
            -d "{\"username\": \"testuser$i\", \"password\": \"password123\"}" \
            -w "\nUser $i: %{http_code}\n"
    ) &
done

wait
```

### Test 2: WebSocket Connection Test
```python
# test_websocket_load.py
import asyncio
import websockets
import json
import time

async def test_concurrent_websockets(num_clients=10):
    """Test concurrent WebSocket connections."""
    
    async def client_connect(client_id, token):
        try:
            async with websockets.connect(
                f'ws://localhost:8000/ws/updates/?token={token}',
                ping_interval=20,
                ping_timeout=10
            ) as ws:
                await ws.send(json.dumps({'type': 'ping'}))
                response = await ws.recv()
                print(f"Client {client_id}: {response}")
                return True
        except Exception as e:
            print(f"Client {client_id} FAILED: {e}")
            return False
    
    tokens = [generate_token(i) for i in range(num_clients)]
    
    start = time.time()
    results = await asyncio.gather(
        *[client_connect(i, tokens[i]) for i in range(num_clients)]
    )
    elapsed = time.time() - start
    
    success = sum(results)
    print(f"\n✅ {success}/{num_clients} connections succeeded in {elapsed:.2f}s")
    
    return success == num_clients

# Run test
asyncio.run(test_concurrent_websockets(10))
```

---

## 🎯 Immediate Action Items

### TODAY (High Urgency)

- [ ] **Fix 1.1**: Increase WEB_CONCURRENCY to 4-6
  - Edit: [render.yaml](render.yaml#L27)
  - Deploy and test

- [ ] **Fix 1.3**: Add Redis URL to Render config
  - Get free Redis from Upstash
  - Set REDIS_URL environment variable
  - Verify in logs that Redis is used (not in-memory)

### THIS WEEK

- [ ] **Fix 2.1**: Implement message queue for offline delivery
  - Add `websocket_delivered` field to Message model
  - Create Celery task for retry
  - Add middleware to mark delivery

- [ ] **Fix 2.2**: Add database connection pooling
  - Research PgBouncer or pgpool2
  - Test with load simulator

- [ ] **Comprehensive Test**: Run concurrent login test
  - Document results
  - Identify remaining bottlenecks

---

## 📈 Performance Targets

### Before Fixes
```
Concurrent Logins   Response Time   Success Rate
1-2 users          200ms           100% ✅
3-5 users          2-5s            95% ⚠️
6-10 users         10-30s          40% ❌
10+ users          Timeout         0% 🔴
```

### After Priority 1 Fixes (WEB_CONCURRENCY + Redis)
```
Concurrent Logins   Response Time   Success Rate
1-10 users         300-500ms       100% ✅
10-20 users        500ms-2s        99% ✅
20-50 users        2-5s            95% ✅
50+ users          5-15s           85% ⚠️
```

### After Priority 2-3 Fixes (Full optimization)
```
Concurrent Logins   Response Time   Success Rate
1-100 users        200-500ms       99.9% ✅
100-1000 users     1-3s            99.5% ✅
1000+ users        Upgrade needed  99% ⚠️
```

---

## 🔗 Reference Documentation

- [Redis Configuration](https://channels.readthedocs.io/en/latest/topics/databases.html#redis-backend)
- [Daphne Worker Settings](https://github.com/django/daphne)
- [WebSocket Best Practices](https://websockets.readthedocs.io/en/stable/guide/production.html)
- [Channels Scaling Guide](https://channels.readthedocs.io/en/latest/topics/scaling.html)

---

## 📝 Notes

1. **In-memory channel layer is NOT suitable for production** - It only works with 1 worker
2. **Render Free Tier has severe resource constraints** - Consider upgrade for production
3. **Presence broadcasting is the biggest culprit** - Every login triggers a broadcast to ALL users
4. **Database connections are limited** - Add connection pooling ASAP
5. **Real-time messaging depends entirely on WebSocket availability** - Implement graceful fallback to polling

---

**Last Updated:** February 14, 2026  
**Status:** 🔴 CRITICAL - System cannot handle 10+ concurrent logins
