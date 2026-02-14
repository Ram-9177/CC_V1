# 🔧 Implementation Guide: Concurrent Login Fixes

## Quick Start: Priority 1 Fixes (30 minutes)

Follow these steps in order to immediately improve system stability.

---

## Fix 1: Increase Daphne Worker Count

### What This Does
Increases from 2 to 4 concurrent workers, allowing more simultaneous connections.

### Implementation

**Step 1:** Open `render.yaml`
```yaml
# Current (BAD)
envVars:
  - key: WEB_CONCURRENCY
    value: 2  # ← Change this

# Fixed (GOOD)
envVars:
  - key: WEB_CONCURRENCY
    value: 4  # Or 6 if system allows
```

**Step 2:** Deploy to Render
```bash
# Commit and push changes
git add render.yaml
git commit -m "fix: increase worker concurrency to 4"
git push origin main

# Render will redeploy automatically
```

**Step 3:** Verify in logs
```bash
# In Render dashboard, check logs for:
# "Starting Daphne with 4 workers"
```

### Testing
```bash
python test_concurrent_logins.py --users 10
```

### Expected Impact
- **Before:** System goes down at 10 concurrent logins
- **After:** Handles 10-20 concurrent logins (maybe slow but functional)

---

## Fix 2: Enable Redis Channel Layer

### Why This Is Critical
- In-memory channel layer = doesn't scale beyond 1 worker
- Redis = can handle 1000+ connections per worker
- **This is the biggest bottleneck in your system**

### Implementation

**Step 1:** Get Free Redis (Upstash)
1. Go to https://upstash.com
2. Sign up (free account = 14 GB free)
3. Create new database → "Global" → "Free"
4. Copy connection string: `redis://[user:password@]host:port`

**Step 2:** Update `render.yaml`
```yaml
envVars:
  - key: REDIS_URL
    # BEFORE: (in-memory fallback)
    # value: "" (empty or missing)
    
    # AFTER: (use real Redis)
    value: redis://default:YOUR_PASSWORD@your-host.upstash.io:37001
    
    # Mark as not synced (don't expose in UI)
    sync: false
```

**Step 3:** Update `backend_django/hostelconnect/settings/base.py`
```python
# Around line 371, change:
if config('USE_IN_MEMORY_CHANNEL_LAYER', default=DEBUG, cast=bool):
    # Before: Falls back to in-memory when DEBUG=True
    # After: Force Redis when REDIS_URL is set
    
# Add this logic:
HAS_REDIS = bool(config('REDIS_URL', default='').strip())

if not HAS_REDIS:
    # Only use in-memory as fallback
    logger.warning("REDIS_URL not set, falling back to in-memory channel layer")
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer'
        }
    }
# else: Use Redis config (already set above)
```

**Step 4:** Deploy
```bash
git add render.yaml backend_django/hostelconnect/settings/base.py
git commit -m "fix: enable Redis channel layer for production"
git push origin main
```

**Step 5:** Verify in Django logs
```
Expected: "Channels using Redis: redis://..."
Not: "Using in-memory channel layer"
```

### Testing After Fix
```bash
python test_concurrent_logins.py --users 20
```

### Expected Impact
- **Before:** 10 users → system down
- **After:** 50+ users → still works (with slower response)

---

## Fix 3: Reduce Presence Broadcast Storm

### What This Does
Prevents every login from sending a broadcast to ALL connected users.

### Implementation

**Step 1:** Edit `backend_django/websockets/consumers.py`
```python
# Around line 245, in PresenceConsumer.connect():

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
    
    # BEFORE: Immediate broadcast (causes storm)
    # await self.channel_layer.group_send(...)
    
    # AFTER: Defer broadcast to smooth out load
    try:
        # Wait 2 seconds for login storm to settle
        await asyncio.sleep(2)
        
        # Then broadcast presence
        await self.channel_layer.group_send(
            self.presence_group,
            {
                'type': 'user_status_changed',
                'user_id': self.user.id,
                'status': 'online'
            }
        )
    except Exception as e:
        logger.error(f"Presence broadcast error: {e}", exc_info=False)
        # Don't crash if broadcast fails
```

**Step 2:** Add import at top
```python
import asyncio  # Add this import if not present
```

**Step 3:** Deploy
```bash
git add backend_django/websockets/consumers.py
git commit -m "fix: defer presence broadcasts to reduce load"
git push origin main
```

### Testing
```bash
python test_concurrent_logins.py --users 10
# You should see faster response times (less broadcast overhead)
```

---

## Fix 4: Add Connection Limits to WebSocket Client

### What This Does
Prevents client from opening 3 sockets at once during login spike.

### Implementation

**Step 1:** Edit `src/lib/websocket.ts`
```typescript
// Around line 10-20, add connection pool limit

class WebSocketClient {
  // NEW: Connection pooling
  private static activeConnections = new Map<string, number>();  // NEW
  private static readonly MAX_CONCURRENT_PER_TYPE = 5;  // NEW: Max 5 per socket type
  
  constructor(private url: string) {}
  
  connect() {
    // NEW: Check connection pool
    const key = this.url;
    const currentConnections = WebSocketClient.activeConnections.get(key) || 0;
    
    if (currentConnections >= WebSocketClient.MAX_CONCURRENT_PER_TYPE) {
      console.warn(`[WebSocket] Connection limit reached for ${key}, queueing...`);
      // Queue connection for later
      setTimeout(() => this.connect(), 1000);
      return;
    }
    
    WebSocketClient.activeConnections.set(key, currentConnections + 1);
    
    // ... rest of connect() code ...
    
    this.ws.onclose = () => {
      // Decrement counter
      const current = WebSocketClient.activeConnections.get(key) || 0;
      WebSocketClient.activeConnections.set(key, Math.max(0, current - 1));
      
      // ... rest of onclose code ...
    };
  }
}
```

**Step 2:** Deploy frontend
```bash
npm run build
git add src/lib/websocket.ts
git commit -m "fix: add connection pooling to WebSocket client"
git push origin main
```

---

## Verification Checklist

After each fix, verify:

```bash
# 1. Test concurrent logins
python test_concurrent_logins.py --users 10

# Expected output:
# ✅ Successful Logins: 10/10
# ✅ Success Rate: 100%
# ✅ Average Response Time: < 2 seconds
```

## Fix Progress Tracking

| Fix | Priority | Status | Impact | Time |
|-----|----------|--------|--------|------|
| 1. WEB_CONCURRENCY=4 | 🔴 HIGH | ⏳ | 2x capacity | 5 min |
| 2. Enable Redis | 🔴 HIGH | ⏳ | 10x capacity | 10 min |
| 3. Defer broadcasts | 🟡 MED | ⏳ | Smoother logins | 5 min |
| 4. Client pooling | 🟡 MED | ⏳ | Better stability | 5 min |

---

## Troubleshooting

### Problem: Still going down at 10 users
**Solution:** Ensure Redis is actually enabled (check logs)
```bash
# In Render logs, search for:
# "redis://" in CHANNELS config (good)
# "in-memory" or "InMemory" (bad - Redis not enabled)
```

### Problem: "Redis connection timeout"
**Solution:** Check Upstash dashboard
1. Verify Redis database is running
2. Check connection string format
3. Verify password is correct
4. Whitelist Render IP in Upstash settings

### Problem: WebSocket still not working
**Solution:** Debug WebSocket path
```bash
# Browser console:
# Check: DevTools → Network → WS
# Should see: ws://api.example.com/ws/updates/?token=...
# If 401: Token not being sent
# If 502: Redis not connected
```

---

## Next Steps (This Week)

After Priority 1 fixes are working:

1. **Add message queue** (Priority 2.1)
   - File: `backend_django/apps/messages/models.py`
   - Time: 1 hour

2. **Implement db connection pooling** (Priority 2.2)
   - Research PgBouncer
   - Time: 2 hours

3. **Load test with 50 users** (Priority 2.3)
   - Run: `python test_concurrent_logins.py --users 50`
   - Document results

---

## Performance Timeline

Track these metrics before and after each fix:

```
BEFORE ANY FIXES:
  10 concurrent logins → 50-70% failure rate → System down 🔴

AFTER FIX #1 (WEB_CONCURRENCY=4):
  10 concurrent logins → 90% success, slow response
  
AFTER FIX #2 (Redis enabled):
  20 concurrent logins → 100% success, normal response
  50 concurrent logins → 90% success, slow but stable

AFTER ALL FIXES:
  100 concurrent logins → 95% success, acceptable performance
```

---

## Files Modified

- [render.yaml](render.yaml)
- [backend_django/hostelconnect/settings/base.py](backend_django/hostelconnect/settings/base.py)
- [backend_django/websockets/consumers.py](backend_django/websockets/consumers.py)
- [src/lib/websocket.ts](src/lib/websocket.ts)

---

**Last Updated:** February 14, 2026
**Estimated Total Time:** 30 minutes for Priority 1 fixes
