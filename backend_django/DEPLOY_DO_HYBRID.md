# DigitalOcean Hybrid Performance Profile

This profile is tuned for medium usage (about 100-500 DAU) with no feature cuts.

## Topology
- App Platform: frontend static build only
- Droplet: Django API + ASGI websocket + Celery workers
- Postgres: managed basic (or external managed equivalent)
- Redis: local droplet Redis for cost control (or managed Redis if budget allows)

## Runtime Files
- Nginx: `backend_django/nginx/campuscore.conf`
- Gunicorn: `backend_django/gunicorn.conf.py`
- Redis: `backend_django/redis.conf`

## Process Profile (2 vCPU / 2 GB)
- Gunicorn workers: `3`
- Gunicorn threads: `2`
- Uvicorn worker class for ASGI/ws compatibility
- Celery default queue: concurrency `2`
- Celery heavy queue: concurrency `1`

## DB/Cache Tuning
- `DB_CONN_MAX_AGE=120`
- `DB_STATEMENT_TIMEOUT_MS=4000`
- `USE_PGBOUNCER=True`
- Redis eviction: `allkeys-lru`
- Redis maxmemory: `256mb` (raise to `384mb` if swap pressure is low)

## Nginx Notes
- gzip enabled for API/static transfer reduction
- keepalive upstream enabled for lower connect latency
- websocket upgrade route on `/ws/`
- long-lived static cache headers for immutable assets

## Validation Checklist
- Frontend build completes
- `python3 manage.py check` passes
- Login, dashboard, users list, events, gate scan flows work
- Websocket reconnect + updates confirmed
- p95 endpoint latency sampled below target for hot routes
