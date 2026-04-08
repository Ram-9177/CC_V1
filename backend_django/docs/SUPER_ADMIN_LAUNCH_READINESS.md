# Super admin — launch readiness (3k → 10k users)

This note ties product expectations to engineering reality before you go live.

## What was going wrong (common symptoms)

1. **Dashboard looked empty or wrong for super admin**  
   The admin dashboard expects fields like `total_rooms`, `active_rooms`, and `closed_tickets`. The generic metrics payload did not always populate them.  
   **Fix:** college-scoped dashboards now include those fields; super admin uses a dedicated platform aggregate path.

2. **Super admin without a college triggered “whole database” filters**  
   When `request.user.college` is null, many metric queries used `Q()` (no college filter), causing heavy scans and timeouts as you approach thousands of users.  
   **Fix:** `GET /api/metrics/dashboard/` detects `super_admin` and uses a **cached platform aggregate** (`metrics:dashboard:super_admin:platform:v2`, TTL 120s).

3. **Recent activity feed hammering the DB**  
   Super admins see all colleges; the activity combiner runs several `ORDER BY … LIMIT` queries.  
   **Mitigation:** slightly smaller per-stream limit and longer cache TTL for super admin (`SUPER_ADMIN_ACTIVITY_CACHE_TTL`).

4. **Platform analytics card failing silently in the UI**  
   **Fix:** Colleges page shows an error panel with retry when `/colleges/platform-analytics/` fails.

## Pre-launch checklist (super admin)

- **One real super admin account** with `role=super_admin` (and optionally Django `is_superuser` for ops).
- **Redis** enabled in production (dashboard + platform analytics + activity feeds rely on cache).
- **Database indexes** on hot paths (`GatePass.created_at`, `Attendance.attendance_date`, `Notice.published_date`, etc.). Run `EXPLAIN` on slow queries if p95 API latency rises.
- **Celery worker + beat** running if you depend on scheduled tasks (not super-admin specific, but required for “complete” SaaS ops).
- **Smoke test** after deploy:
  - Login as super admin → land on `/colleges`.
  - Open Dashboard → numbers non-zero / plausible; no long spinners.
  - Platform Snapshot card loads or shows actionable error + retry.

## Scaling path (3k → 10k)

| Stage | Focus |
|-------|--------|
| ~3k | Redis cache hit rate, DB connection pool vs gunicorn workers, basic query timings on dashboard + activities |
| ~10k | Pre-aggregates (`DailyHostelMetrics` etc.) backfilled per tenant, read replicas or heavier caching for analytics, rate limits on expensive endpoints |

## Related docs

- [ROLE_GOVERNANCE.md](ROLE_GOVERNANCE.md)
- [SUPER_ADMIN_CAPABILITY_MATRIX.md](SUPER_ADMIN_CAPABILITY_MATRIX.md)
- [PRODUCTION_COMMAND_CENTER.md](PRODUCTION_COMMAND_CENTER.md)
