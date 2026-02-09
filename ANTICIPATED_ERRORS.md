# 🔮 Anticipated Production Errors & Solutions

**Generated:** 2026-02-09  
**Application:** SMG Hostel Management ERP  
**Purpose:** Proactive error prevention and rapid troubleshooting guide

---

## 🚨 CRITICAL ERRORS (Immediate Action Required)

### 1. **Database Connection Pool Exhaustion**

**Symptom:**

```
OperationalError: FATAL: remaining connection slots are reserved
OperationalError: too many clients already
```

**Root Cause:**

- Render Free Tier: Max 3 PostgreSQL connections
- Each gunicorn worker consumes 1 connection
- WebSocket connections don't consume DB connections (Channels handles separately)
- Long-running queries hold connections

**Detection:**

```python
# Check active connections (Django shell)
from django.db import connection
cursor = connection.cursor()
cursor.execute("SELECT count(*) FROM pg_stat_activity WHERE datname = 'hostelconnect';")
print(cursor.fetchone())
```

**Prevention (Already Configured):**

```python
# backend_django/hostelconnect/settings/base.py
DATABASES['default']['CONN_MAX_AGE'] = 0  # Close after each request
DATABASES['default']['OPTIONS'] = {
    'connect_timeout': 5,
    'keepalives': 1,
}
```

**Quick Fix:**

```bash
# If deployed: Force reset database connections
heroku pg:killall  # or Render equivalent

# Update worker count in Procfile
web: gunicorn hostelconnect.wsgi:application --workers 1 --threads 2
```

**Long-term Solution:**

- Upgrade to paid tier (60 connections)
- Implement connection pooling with PgBouncer
- Use database read replicas

---

### 2. **Redis Connection Failures (WebSocket Dead)**

**Symptom:**

```
ConnectionError: Error connecting to Redis
ConnectionRefusedError: [Errno 111] Connection refused
WebSocket connects but messages don't broadcast
```

**Root Cause:**

- Upstash Redis quota exceeded (10,000 requests/day free tier)
- Redis connection timeout
- Incorrect REDIS_URL format
- Channel layer not configured

**Detection:**

```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping
# Should return: PONG

# Check from Django shell
from channels.layers import get_channel_layer
channel_layer = get_channel_layer()
print(channel_layer)  # Should not be None
```

**Prevention:**

```python
# Use fallback in-memory layer if Redis fails
# backend_django/hostelconnect/settings/base.py (already configured)
USE_IN_MEMORY_CHANNEL_LAYER = config('USE_IN_MEMORY_CHANNEL_LAYER', default=DEBUG, cast=bool)
```

**Quick Fix:**

```bash
# Emergency: Enable in-memory fallback
export USE_IN_MEMORY_CHANNEL_LAYER=True
# Restart server

# Or check Redis quota
# Upstash Dashboard → Check daily request count
```

**Long-term Solution:**

- Monitor Redis usage with Upstash dashboard
- Cache invalidation strategy to reduce requests
- Upgrade Upstash plan if needed
- Implement Redis connection retry logic

---

### 3. **WebSocket Disconnections (Clients Can't Reconnect)**

**Symptom:**

```
[WebSocket] Max reconnection attempts reached
[WebSocket] Connection error: 401 Unauthorized
Frontend shows "Offline" indicator permanently
```

**Root Cause:**

- JWT token expired (5-minute lifetime)
- Token not refreshed before WebSocket reconnection
- Render free tier service sleeping (cold start)
- CORS issues with WebSocket upgrade

**Detection:**

```javascript
// Browser console
console.table(
  performance
    .getEntriesByType("resource")
    .filter((r) => r.name.includes("ws://")),
);
// Check for failed WebSocket connection attempts
```

**Prevention (Already Implemented):**

```typescript
// src/lib/websocket.ts
private maxReconnectAttempts = 999999; // Infinite retries
private reconnectDelay = 1000; // Exponential backoff

// Auto-refresh token before expiry
useAuthStore.subscribe((state) => {
  if (state.isAuthenticated && state.token) {
    notificationWS.connect();
  }
});
```

**Quick Fix:**

```typescript
// Increase token lifetime temporarily
// backend_django/hostelconnect/settings/base.py
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),  # Increase from 5
}
```

**Long-term Solution:**

- Implement token refresh mechanism on WebSocket reconnect
- Add WebSocket health check endpoint
- Monitor WebSocket connection metrics

---

### 4. **CORS Errors (Frontend Can't Connect)**

**Symptom:**

```
Access to XMLHttpRequest at 'https://api.example.com' has been blocked by CORS policy
WebSocket connection failed: Unexpected response code: 403
```

**Root Cause:**

- Production frontend URL not in CORS_ALLOWED_ORIGINS
- Missing `wss://` protocol in allowed origins
- CORS credentials not enabled

**Detection:**

```bash
# Test CORS headers
curl -H "Origin: https://yourdomain.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization" \
  -X OPTIONS \
  https://your-backend.render.com/api/auth/login/
```

**Prevention:**

```bash
# .env (production)
CORS_ALLOWED_ORIGINS=https://yourdomain.com,wss://yourdomain.com,https://your-backend.render.com
ALLOWED_HOSTS=*.render.com,yourdomain.com
```

**Quick Fix:**

```python
# Emergency: Allow all origins (NOT RECOMMENDED FOR PRODUCTION)
# backend_django/hostelconnect/settings/base.py
CORS_ALLOW_ALL_ORIGINS = True  # TEMPORARY ONLY
```

**Long-term Solution:**

- Properly configure CORS_ALLOWED_ORIGINS
- Use environment-specific settings
- Implement CORS monitoring

---

## ⚠️ HIGH-PRIORITY WARNINGS

### 5. **N+1 Query Problem (Slow API Responses)**

**Symptom:**

```
[RequestLogMiddleware] Slow Request: GET /api/gate-passes/ took 3.45s
Database queries: 1247 queries in 3.2s
```

**Root Cause:**

- Missing `select_related()` or `prefetch_related()`
- Serializers accessing related objects without optimization
- Nested serializers causing cascade queries

**Detection:**

```python
# Enable query logging temporarily
# settings.py
LOGGING = {
    'loggers': {
        'django.db.backends': {
            'level': 'DEBUG',  # Shows all SQL queries
        },
    },
}
```

**Vulnerable Endpoints (Already Optimized, but monitor):**

```python
# ✅ Fixed in codebase
# apps/gate_passes/views.py:41
queryset = GatePass.objects.select_related('student', 'approved_by').prefetch_related(...)

# If you add new endpoints, remember to use:
.select_related('foreign_key_field')  # For ForeignKey
.prefetch_related('many_to_many_field')  # For ManyToMany
```

**Quick Fix:**

```python
# Add to slow ViewSet
def get_queryset(self):
    return super().get_queryset().select_related('user', 'room').prefetch_related('related_items')
```

**Long-term Solution:**

- Enable Django Debug Toolbar in staging
- Regular query audits with django-silk
- Implement query count tests

---

### 6. **Broadcast Failures (Silent Errors)**

**Symptom:**

```
Admin creates notice → Students don't receive real-time update
No errors in logs, but WebSocket message not delivered
```

**Root Cause:**

- `broadcast_to_role()` fails silently (no try/except in broadcast.py)
- Channel layer returns None (Redis down)
- Group membership not established

**Detection:**

```python
# Check if broadcast actually sends
# websockets/broadcast.py - Add logging
import logging
logger = logging.getLogger(__name__)

def broadcast_to_role(role: str, event_type: str, data: dict):
    channel_layer = get_channel_layer()
    if not channel_layer:
        logger.error("Channel layer is None - broadcasts will fail")
        return
    logger.info(f"Broadcasting {event_type} to role_{role}")
```

**Quick Fix (Add Error Handling):**

```python
# websockets/broadcast.py
def broadcast_to_group(group_name: str, event_type: str, data: dict):
    channel_layer = get_channel_layer()
    if channel_layer:
        try:
            async_to_sync(channel_layer.group_send)(group_name, {'type': event_type, 'data': data})
        except Exception as e:
            logger.error(f"Broadcast failed to {group_name}: {e}")
            # Fallback: Store in database for retry
```

**Long-term Solution:**

- Implement broadcast confirmation mechanism
- Add fallback to database-backed notifications
- Monitor broadcast success rate

---

### 7. **Session/JWT Token Expiration Loop**

**Symptom:**

```
User logs in → After 5 minutes → API returns 401 → Auto-logout → User frustrated
```

**Root Cause:**

- ACCESS_TOKEN_LIFETIME = 5 minutes (aggressive)
- Frontend doesn't refresh token automatically
- Refresh token rotation causes confusion

**Detection:**

```javascript
// Browser console
localStorage.getItem("auth-storage");
// Check token expiry time
```

**Quick Fix:**

```python
# Increase token lifetime
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),  # More user-friendly
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}
```

**Long-term Solution:**

- Implement automatic token refresh
- Add "session about to expire" warning
- Use sliding session mechanism

---

### 8. **File Upload Failures (Memory/Size Limits)**

**Symptom:**

```
413 Request Entity Too Large
500 Internal Server Error when uploading profile pictures
Memory usage spike → Render kills process
```

**Root Cause:**

- Upload exceeds 5 MB limit (configured)
- Render Free Tier: 512 MB RAM
- File uploaded to memory instead of streaming

**Detection:**

```python
# Check file size limits
# settings.py
DATA_UPLOAD_MAX_MEMORY_SIZE = 5242880  # 5 MB
```

**Quick Fix:**

```python
# Validate file size in serializer
from rest_framework import serializers

class ProfileSerializer(serializers.ModelSerializer):
    def validate_profile_picture(self, value):
        if value.size > 2 * 1024 * 1024:  # 2 MB
            raise serializers.ValidationError("Image too large (max 2 MB)")
        return value
```

**Long-term Solution:**

- Use cloud storage (AWS S3, Cloudinary)
- Implement client-side image compression
- Stream uploads instead of loading to memory

---

## 📊 MEDIUM-PRIORITY ISSUES

### 9. **Timezone Confusion (UTC vs Local)**

**Symptom:**

```
Gate pass shows "Exit Time: 10:00 PM" but user created it at 4:30 PM
Attendance marked "Present" but shows tomorrow's date
```

**Root Cause:**

- Backend uses UTC (settings: USE_TZ=True, TIME_ZONE='UTC')
- Frontend shows local time without conversion
- Database stores timestamps in UTC

**Prevention:**

```javascript
// Always convert to local time in frontend
import { format } from "date-fns";
format(new Date(utcTimestamp), "PPP p"); // Handles timezone automatically
```

**Quick Fix:**

```python
# Explicitly set timezone in view
from django.utils import timezone
attendance.marked_at = timezone.now()  # Always UTC
```

---

### 10. **Render Free Tier Cold Starts**

**Symptom:**

```
First request after 15 minutes: 30-60 second delay
WebSocket fails to connect on first try
"Service Unavailable" error
```

**Root Cause:**

- Render shuts down free services after 15 minutes inactivity
- Daphne + Gunicorn take time to restart
- Database connections need to re-establish

**Detection:**

```bash
# Check if service is sleeping
curl https://your-backend.render.com/api/health/
# If timeout > 5s, likely cold start
```

**Quick Fix:**

```bash
# Use cron job to keep alive
# Every 10 minutes
*/10 * * * * curl https://your-backend.render.com/api/health/
```

**Long-term Solution:**

- Use UptimeRobot (free) to ping every 5 minutes
- Upgrade to paid tier (always-on)
- Implement graceful cold start handling in frontend

---

### 11. **Missing Environment Variables**

**Symptom:**

```
ImproperlyConfigured: The SECRET_KEY setting must not be empty
KeyError: 'REDIS_URL'
Firebase admin SDK fails to initialize
```

**Root Cause:**

- .env file not loaded in production
- Environment variables not set in Render dashboard
- Variable names case-sensitive

**Detection:**

```python
# Check if all required vars are set
# manage.py shell
import os
print(os.getenv('SECRET_KEY'))
print(os.getenv('DATABASE_URL'))
print(os.getenv('REDIS_URL'))
```

**Quick Fix:**

```python
# Add sensible defaults
SECRET_KEY = config('SECRET_KEY', default='INSECURE_CHANGE_ME')
REDIS_URL = config('REDIS_URL', default='redis://localhost:6379/0')
```

**Long-term Solution:**

- Use `.env.example` as checklist
- Implement startup validation script
- Document all required environment variables

---

### 12. **Rate Limiting Blocks Legitimate Users**

**Symptom:**

```
429 Too Many Requests
Student dashboard fails to load (multiple API calls)
"Request was throttled" error
```

**Root Cause:**

- Aggressive throttling (currently: 120/min for authenticated)
- Dashboard makes 10+ parallel requests on load
- Mobile network NAT causes IP-based throttling issues

**Detection:**

```python
# Check throttle rates
# settings.py
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_RATES': {
        'user': '120/minute',  # May be too low for dashboard
        'anon': '30/minute',
    }
}
```

**Quick Fix:**

```python
# Increase limits
'user': '300/minute',  # Allow dashboard bursts
'anon': '60/minute',
```

**Long-term Solution:**

- Implement per-endpoint throttling
- Use rate limiting by user ID, not IP
- Add burst allowance for initial page loads

---

## 🔧 LOW-PRIORITY (Monitor)

### 13. **Static Files 404 in Production**

**Symptom:**

```
GET /static/admin/css/base.css 404
Admin panel shows unstyled HTML
Frontend assets missing
```

**Root Cause:**

- `collectstatic` not run during deployment
- WhiteNoise misconfigured
- Static files path incorrect

**Quick Fix:**

```bash
# Manual deployment
python manage.py collectstatic --noinput
```

**Prevention (Already in build.sh):**

```bash
#!/bin/bash
python manage.py collectstatic --no-input  # ✅ Configured
python manage.py migrate --no-input
```

---

### 14. **WebSocket Message Flooding**

**Symptom:**

```
Browser console: 1000+ WebSocket messages/second
CPU usage spikes to 100%
Frontend becomes unresponsive
```

**Root Cause:**

- Infinite broadcast loop (e.g., update triggers another update)
- Room/role subscription to too many updates
- No message deduplication

**Detection:**

```javascript
// Monitor message frequency
let msgCount = 0;
setInterval(() => {
  console.log(`WebSocket messages/sec: ${msgCount}`);
  msgCount = 0;
}, 1000);

updatesWS.on("*", () => msgCount++);
```

**Quick Fix:**

```typescript
// Implement message throttling in frontend
import { throttle } from "lodash";
const handleUpdate = throttle((data) => {
  queryClient.invalidateQueries(["gate-passes"]);
}, 1000); // Max once per second
```

---

### 15. **Database Migration Conflicts**

**Symptom:**

```
django.db.migrations.exceptions.InconsistentMigrationHistory
Migration 0015_alter_gatepass_status cannot be applied
```

**Root Cause:**

- Multiple developers creating migrations simultaneously
- Deployed migration not in local database
- Deleted migration files

**Quick Fix:**

```bash
# Fake the conflicting migration
python manage.py migrate <app_name> <migration_number> --fake

# Or reset migrations (DANGER: Only in development!)
python manage.py migrate <app_name> zero
python manage.py migrate <app_name>
```

**Prevention:**

- Always pull before creating migrations
- Never delete migration files in production
- Use migration squashing for cleanup

---

## 🛠️ DEBUGGING TOOLS

### Essential Commands:

```bash
# Check Django configuration
python manage.py check --deploy

# View all migrations
python manage.py showmigrations

# Test WebSocket locally
wscat -c ws://localhost:8000/ws/updates/?token=YOUR_JWT

# Monitor Redis
redis-cli -u $REDIS_URL MONITOR

# Check database connections
python manage.py dbshell
SELECT count(*) FROM pg_stat_activity;

# View last 100 logs (Render)
render logs -t 100

# Test API endpoint
curl -H "Authorization: Bearer $TOKEN" https://api.example.com/api/health/
```

### Monitoring Checklist:

- [ ] Set up Sentry for error tracking
- [ ] Monitor database connection count
- [ ] Track WebSocket connection health
- [ ] Monitor Redis request quota (Upstash dashboard)
- [ ] Set up UptimeRobot for cold start prevention
- [ ] Enable slow query logging (> 500ms)
- [ ] Track JWT token expiration rates
- [ ] Monitor API response times

---

## 🚀 EMERGENCY RESPONSE PLAN

### Service Down (500 Errors):

1. Check Render logs: `render logs -t 100`
2. Verify environment variables are set
3. Check database connection limit
4. Restart service: Render Dashboard → Manual Deploy

### WebSockets Not Working:

1. Check Redis connection: `redis-cli -u $REDIS_URL ping`
2. Verify `USE_IN_MEMORY_CHANNEL_LAYER=False`
3. Check CORS_ALLOWED_ORIGINS includes `wss://`
4. Test WebSocket directly with `wscat`

### Database Locked/Slow:

1. Check active connections
2. Kill long-running queries if needed
3. Review recent migrations
4. Check for missing indexes

### Everything Broken:

1. Rollback to last known good deployment
2. Enable all debug logging
3. Check external service status (Render, Upstash)
4. Verify .env variables match production

---

**Last Updated:** 2026-02-09  
**Next Review:** After first production deployment  
**Maintained By:** Development Team
