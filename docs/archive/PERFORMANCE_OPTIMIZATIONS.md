# Performance Optimizations — Summary

This document summarizes the safe, low-risk performance changes applied to the project for operation on low-memory free-tier hosts (Render free tier).

Applied changes (high level):

- Tuned process start command to use `gunicorn` with 1 worker / 2 threads for low RAM.
- Added lightweight `PerformanceLoggingMiddleware` to log method/path/response-time in ms.
- Added `performance` logger to LOGGING that writes to console.
- Exposed health endpoints: `/healthz`, `/ping-db`, `/ping-redis` for uptime and readiness checks.
- Configured `STATICFILES_STORAGE` to use `whitenoise.storage.CompressedManifestStaticFilesStorage` when using WhiteNoise.
- Optimized frontend `vite.config.ts` target to `es2019`, kept `cssCodeSplit`, added optional bundle visualizer plugin.
- Added `scripts/bench.sh` for quick TTFB and total-time measurements.

Rollback: revert the commits that touch `Procfile`, `hostelconnect/settings/base.py`, `core/middleware/perf_logging.py`, and `apps/health/*`. Use `git revert <commit>` for each commit created by these changes.

Benchmarking & Monitoring:
- Use `./scripts/bench.sh https://your-service/healthz` to measure TTFB + total time.
- Use UptimeRobot to poll `/healthz` every 5 minutes.

Next steps and recommendations are documented in the repository checklist.
