# Concurrent Login Fixes - Implementation Guide

## ✅ Fix #1: Increase Daphne Workers (render.yaml)

### Current (BROKEN):
```yaml
startCommand: daphne -b 0.0.0.0 -p $PORT hostelconnect.asgi:application
envVars:
  - key: WEB_CONCURRENCY
    value: 2
```

### Fixed:
```yaml
startCommand: daphne -b 0.0.0.0 -p $PORT -u $WEB_CONCURRENCY hostelconnect.asgi:application
envVars:
  - key: WEB_CONCURRENCY
    value: 8
```

**Why:** Daphne can spawn multiple worker processes. With 8 workers:
- Each worker handles ~10-20 concurrent connections
- Total capacity: 8 × 15 = 120+ concurrent WebSocket connections
- Prevents worker saturation when 10 users login

**Scaling Guide:**
- Small hostel (50-100 users): `WEB_CONCURRENCY: 4`
- Medium hostel (100-300 users): `WEB_CONCURRENCY: 8`
- Large hostel (300+ users): `WEB_CONCURRENCY: 16`

---

## ✅ Fix #2: Fix In-Memory Channel Layer Issue (settings/base.py)

### Current (BROKEN):
```python
# Line 370-375
if config('USE_IN_MEMORY_CHANNEL_LAYER', default=DEBUG, cast=bool):
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer'
        }
    }
```

**Problem:** When DEBUG=True (or not set), uses in-memory layer → workers isolated

### Fixed - Option A: Use Environment Variable
```python
# Line 370-375
if config('USE_IN_MEMORY_CHANNEL_LAYER', default=False, cast=bool):  # Changed default to False
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer'
        }
    }
```

### Fixed - Option B: Explicit Environment Check
```python
# Line 370-385
# Use in-memory ONLY if explicitly requested AND Redis is not available
USE_REDIS = config('REDIS_URL', default='').startswith('redis')

if not USE_REDIS and config('USE_IN_MEMORY_CHANNEL_LAYER', default=False, cast=bool):
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer'
        }
    }
```

### Required Environment Variables:
```bash
# .env or Render environment
USE_IN_MEMORY_CHANNEL_LAYER=false
REDIS_URL=redis://localhost:6379/0  # or Upstash URL in production
```

**Why:** In-memory channels are isolated per worker. With multiple Daphne workers:
- Worker 1 (in-memory) ≠ Worker 2 (in-memory)
- Messages between them are LOST
- Redis is shared, so messages cross worker boundaries ✓

---

## ✅ Fix #3: Increase Redis Capacity (settings/base.py)

### Current (BROKEN):
```python
# Line 353-367
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [config('REDIS_URL', default='redis://localhost:6379/0')],
            'capacity': 1500,  # ❌ Too low
            'expiry': 10,
            'group_expiry': 86400,
            'connection_kwargs': {
                'socket_connect_timeout': 5,
                'socket_timeout': 5,
            },
        },
    },
}
```

### Fixed:
```python
# Line 353-367
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [config('REDIS_URL', default='redis://localhost:6379/0')],
            'capacity': 4000,  # ✅ Increased 2.6x
            'expiry': 10,
            'group_expiry': 86400,
            'connection_kwargs': {
                'socket_connect_timeout': 5,
                'socket_timeout': 5,
                'connection_pool_kwargs': {
                    'max_connections': 50,
                    'timeout': 10,
                }
            },
        },
    },
}
```

**Capacity Calculation:**
- Each user subscribes to ~4-5 groups:
  - `notifications_{user_id}` (1)
  - `updates_{user_id}` (1)
  - `role_{role}` (1, shared)
  - `management` (if staff, shared)
  - Resource updates (dynamic, 0-5)

- For 10 concurrent users:
  - 10 × 5 = 50 group subscriptions
  - 10 WebSocket connections
  - 10 × 2 (reserve) = 20 extra
  - **Total: ~80 capacity needed**
  - Safe capacity with margin: 400 (for 50 concurrent users)
  - Our setting of 4000: Handles 500+ concurrent users comfortably ✓

---

## ✅ Fix #4: Add Redis Connection Pool Configuration

### Current (Missing):
```python
'connection_kwargs': {
    'socket_connect_timeout': 5,
    'socket_timeout': 5,
    # ❌ No connection_pool_kwargs
},
```

### Fixed:
```python
'connection_kwargs': {
    'socket_connect_timeout': 5,
    'socket_timeout': 5,
    'connection_pool_kwargs': {
        'max_connections': 50,
        'timeout': 10,
    }
},
```

**Why:** Redis connection pooling:
- **max_connections: 50**: Allow up to 50 simultaneous Redis connections
- **timeout: 10**: Wait up to 10 seconds for a connection from the pool
- Prevents "Connection pool exhausted" errors
- Allows connection reuse between requests

**Connection Math:**
- Daphne worker processes: 8
- Connections per worker: ~5-10
- Total needed: 8 × 10 = 80
- Our max_connections: 50 (too low) → upgrade to 100 if you see pool exhaustion

```python
'connection_pool_kwargs': {
    'max_connections': 100,  # Increased for safety
    'timeout': 15,
}
```

---

## 📋 Complete Fixed Code Blocks

### render.yaml
```yaml
services:
  - type: web
    name: hostelconnect-api
    plan: free
    rootDir: backend_django
    env: python
    buildCommand: ./build.sh
    startCommand: daphne -b 0.0.0.0 -p $PORT -u $WEB_CONCURRENCY hostelconnect.asgi:application
    healthCheckPath: /api/health/
    envVars:
      - key: DEBUG
        value: false
      - key: RENDER
        value: true
      - key: DATABASE_URL
        fromDatabase:
          name: hostelconnect-db
          property: connectionString
      - key: REDIS_URL
        sync: false
        value: redis://...  # Update with Upash URL
      - key: ALLOWED_HOSTS
        value: "hostelconnect-api.onrender.com"
      - key: CORS_ALLOWED_ORIGINS
        value: "https://hostelconnect-web.onrender.com"
      - key: CSRF_TRUSTED_ORIGINS
        value: "https://hostelconnect-web.onrender.com"
      - key: SECRET_KEY
        generateValue: true
      - key: WEB_CONCURRENCY
        value: 8  # ✅ CHANGED: Was 2
      - key: USE_IN_MEMORY_CHANNEL_LAYER
        value: false  # ✅ NEW: Ensure Redis is used
```

### settings/base.py (Lines 353-385)
```python
# Channels Configuration
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [config('REDIS_URL', default='redis://localhost:6379/0')],
            'capacity': 4000,  # ✅ CHANGED: Was 1500
            'expiry': 10,
            'group_expiry': 86400,
            'connection_kwargs': {
                'socket_connect_timeout': 5,
                'socket_timeout': 5,
                'connection_pool_kwargs': {  # ✅ NEW: Added connection pooling
                    'max_connections': 100,
                    'timeout': 15,
                },
            },
        },
    },
}

# Fallback for in-memory if Redis unavailable
# Use in-memory channel layer ONLY if explicitly requested
if config('USE_IN_MEMORY_CHANNEL_LAYER', default=False, cast=bool):  # ✅ CHANGED: default=False
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer'
        }
    }

# Cache Configuration - Supports both Upash and local Redis
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': config('REDIS_URL', default='redis://localhost:6379/0'),
        'TIMEOUT': config('CACHE_DEFAULT_TIMEOUT', default=300, cast=int),
        'KEY_PREFIX': config('CACHE_KEY_PREFIX', default='hostelconnect'),
        'OPTIONS': {
```

---

## 🧪 Testing After Fix

### 1. Test Local Environment
```bash
cd backend_django

# Export environment variables
export WEB_CONCURRENCY=4
export USE_IN_MEMORY_CHANNEL_LAYER=false
export REDIS_URL=redis://localhost:6379/0
export DEBUG=false

# Start Daphne with multiple workers
daphne -b 0.0.0.0 -p 8000 -u 4 hostelconnect.asgi:application
```

### 2. Verify Redis Connection
```bash
redis-cli INFO | grep connected_clients
# Should show ~4-6 connections (one per worker + Django)
```

### 3. Test Concurrent Logins
```bash
# In another terminal
python test_concurrent_logins.py --users 10 --concurrent true

# Watch logs for:
# ✓ "10 users connected successfully"
# ✓ "User-to-user messages delivered"
# ✗ "Connection refused" → Fix didn't work
# ✗ "Channel layer error" → Redis not running
```

### 4. Monitor Performance
```bash
# Watch Redis memory
redis-cli INFO memory

# Watch Daphne workers
ps aux | grep daphne | grep -v grep | wc -l
# Should show: 4 (or your WEB_CONCURRENCY value)

# Check group subscriptions
redis-cli KEYS "groups:*" | wc -l
# Should show expected number of groups
```

---

## ⚠️ Troubleshooting

### Issue: "Connection pool exhausted"
```python
# Increase max_connections in settings/base.py
'connection_pool_kwargs': {
    'max_connections': 200,  # Increase from 100
    'timeout': 20,
}
```

### Issue: "Channel capacity exceeded"
```python
# Increase capacity
'capacity': 8000,  # Increase from 4000
```

### Issue: "Worker timeout" or "Messages not delivered"
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Check if enough workers are running
ps aux | grep daphne
# Should show WEB_CONCURRENCY number of processes

# Increase socket timeout
'connection_kwargs': {
    'socket_connect_timeout': 10,  # Increase from 5
    'socket_timeout': 10,  # Increase from 5
}
```

---

## 🚀 Deployment Checklist

- [ ] Update `render.yaml`: Set `WEB_CONCURRENCY=8`
- [ ] Update `render.yaml`: Add `-u $WEB_CONCURRENCY` to startCommand
- [ ] Update `settings/base.py`: Set `capacity=4000`
- [ ] Update `settings/base.py`: Add connection_pool_kwargs
- [ ] Update `settings/base.py`: Change in-memory default to `False`
- [ ] Add/Update `.env`: Set `USE_IN_MEMORY_CHANNEL_LAYER=false`
- [ ] Test locally with 10 concurrent users
- [ ] Deploy to Render
- [ ] Monitor for Redis errors in logs
- [ ] Test on production with 10+ concurrent users
- [ ] Verify messages deliver across workers

