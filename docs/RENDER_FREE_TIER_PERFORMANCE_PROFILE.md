# Render Free-Tier Performance Profile (Strict)

Use this profile as-is for a stable and responsive free-tier deployment.

## 1) Backend Service Settings

Set these in Render service `campuscore-api`:

- `DEBUG=false`
- `RENDER=true`
- `DATABASE_URL=<from Render Postgres>`
- `REDIS_URL=<your Upstash rediss:// URL>`
- `WEB_CONCURRENCY=2`
- `DB_CONN_MAX_AGE=30`
- `DB_STATEMENT_TIMEOUT_MS=5000`
- `SLOW_QUERY_THRESHOLD_MS=700`
- `USE_IN_MEMORY_CHANNEL_LAYER=false`
- `CHANNELS_CAPACITY=5000`
- `CACHE_VERSION=1`

Optional (if you keep these in your environment):

- `UPSTASH_REDIS_REST_URL=<upstash https url>`
- `UPSTASH_REDIS_REST_TOKEN=<upstash token>`

## 2) Backend Commands

Use exactly:

- `buildCommand: ./build.sh`
- `preDeployCommand: python manage.py migrate`
- `startCommand: gunicorn hostelconnect.asgi:application -k uvicorn.workers.UvicornWorker --workers 2 --threads 2 --timeout 60 --keep-alive 5 --max-requests 500 --max-requests-jitter 50 --log-level warning --bind 0.0.0.0:$PORT`

Why this is strict-safe on free tier:

- Migrations run at deploy time, not every restart.
- Two workers fit memory better than 3+ workers.
- Worker recycling prevents slow memory growth.

## 3) Redis Layout (Do Not Change)

Your Django settings already split Redis keyspaces correctly:

- Channels (WebSocket): Redis DB `0`
- Django Cache/Session: Redis DB `1`

This separation reduces lock/contention and keeps websocket state isolated from cache churn.

## 4) Postgres Free-Tier Rules

- Keep `maxConnections` low (your blueprint uses 3).
- Keep query timeout enabled (`DB_STATEMENT_TIMEOUT_MS=5000`).
- Keep `DB_CONN_MAX_AGE=30` to avoid excessive reconnect overhead while not hoarding idle connections.

## 5) Frontend Service Rules

- Keep frontend as static web service.
- Keep API rewrites to backend domain.
- Avoid server-side rendering on free tier unless required.

## 6) Fast Verification Checklist

After deploy, validate:

1. First request after sleep may be slow (normal), second request should be much faster.
2. `/api/health/` returns quickly and consistently.
3. WebSocket routes connect and stay stable.
4. Logs do not show repeated DB timeout errors.
5. Logs do not show Redis connection churn spikes.

## 7) If It Is Still Slow

Most likely causes (in order):

1. Cold start after idle sleep (platform behavior).
2. Heavy endpoint query path (not Redis).
3. Frontend loading too much data on initial mount.
4. Region mismatch between Render service and Upstash Redis.

Tune next only if needed:

- Reduce initial API payload sizes and N+1 queries.
- Add endpoint-level caching for expensive dashboard endpoints.
- Keep workers at 2 on free tier unless memory metrics prove headroom.
