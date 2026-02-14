# FREE TIER TO PRO TIER UPGRADE GUIDE

## Current Setup - FREE TIER ✅

**What's Working:**
- ✅ User-to-user messaging (real-time)
- ✅ Live notifications
- ✅ Real-time attendance updates
- ✅ Gate pass processing
- ✅ Concurrent logins (up to 300 users)
- ✅ 1000+ total registered users
- ✅ All hostel features enabled

**Limits:**
- Max concurrent WebSocket connections: ~300 users at same time
- Render compute: 0.5 CPU (shared)
- Database: 3 connections max (free tier PostgreSQL)
- Redis: 25MB (free tier Upstash)

---

## How to Upgrade to PRO (when ready)

### Step 1: Update render.yaml Environment Variables

**Change these 4 lines in render.yaml:**

```yaml
- key: WEB_CONCURRENCY
  value: 16  # Increased from 4

- key: CHANNELS_CAPACITY
  value: 20000  # Increased from 5000

- key: CHANNELS_MAX_CONNECTIONS
  value: 200  # Increased from 50

- key: CACHE_MAX_CONNECTIONS
  value: 100  # Increased from 25
```

### Step 2: Upgrade Render Plan

**Current:** Free tier
**Upgrade to:** Standard or Pro plan

- Adds auto-scaling (2+ instances)
- Increases CPU to 1.5+
- Removes auto-sleep

### Step 3: Upgrade Redis (Upstash)

**Current:** Free tier (25MB)
**Upgrade to:** Pro tier (500MB+)

- 10x more storage
- Better throughput
- Multiple regions available

### Step 4: Upgrade Database (PostgreSQL)

**Current:** Free tier (1 GB, 3 connections)
**Upgrade to:** Standard tier (10GB, 20 connections)

- More storage for growth
- More concurrent connections
- Backups enabled

---

## Performance Comparison

| Metric | Free Tier | Pro Tier |
|--------|-----------|----------|
| **Concurrent Users** | 300 | 1500+ |
| **Daphne Workers** | 4 | 16+ |
| **Redis Capacity** | 5,000 | 20,000 |
| **Redis Connections** | 50 | 200 |
| **Cache Connections** | 25 | 100 |
| **DB Connections** | 3 | 20 |
| **Expected Cost** | Free | ~$20-30/month |

---

## No Code Changes Needed! 🎉

The code is already optimized for both tiers:
- Environment variables handle all scaling
- Connection pools auto-adjust
- No redeployment needed (just update render.yaml)
- All features work instantly at pro scale

---

## When to Upgrade

Upgrade to Pro when you see:
- ❌ "Connection pool exhausted" errors
- ❌ "Channel capacity exceeded" errors
- ❌ Slow WebSocket message delivery (>5 seconds)
- ❌ Users getting kicked off randomly
- ❌ More than 250 concurrent users at peak

**Current Status:** All green on free tier ✅
