# Post-Deployment Guide

A concise runbook for operating HostelConnect in production.

## 1) Observability

- Logging
  - Backend (NestJS): Use a structured logger (pino/winston) and forward to a log sink (e.g., DO App Platform logs, CloudWatch, Datadog, or Logtail/BetterStack).
  - Include request IDs and user IDs in logs for traceability.
- Metrics & Dashboards
  - Expose basic Prometheus metrics (HTTP latency, error rate, active sessions, queue depths) via `/metrics` (protected).
  - Visualize in Grafana or your cloud provider.
- Tracing
  - Optional: OpenTelemetry SDK in backend to trace critical flows (auth, rooms assign, ad-gated QR).
- Alerts
  - Set alert rules: 5xx error rate > 2% (5m), p95 latency > 1s (10m), CPU > 80% (10m).
  - Route to email/Slack.

## 2) Security & Secrets

- Secrets management
  - Store `JWT_SECRET`, DB credentials, and API keys in the platform’s secrets store (DO App Platform/Heroku/Azure) — never commit to git.
  - Rotate secrets at least quarterly.
- TLS
  - Always enforce HTTPS. HSTS enabled via Helmet.
- HTTP Security
  - Helmet is enabled. Optionally add CSP (Content Security Policy) allowing your domains only.
- AuthZ
  - Keep RBAC mappings up-to-date. Review admin/warden privileges periodically.
- Vulnerabilities
  - Enable Dependabot alerts and weekly `npm audit` in CI.

## 3) Data & Backups

- Database
  - Daily automated backups. Retention: 7–30 days.
  - Test restores quarterly in a staging environment.
- Exports
  - CSV exports can be large. Consider streaming/ pagination.
- PII
  - Minimize PII, encrypt at rest (managed PG does this), restrict data access.

## 4) Release & Rollout

- Versioning
  - Tag releases: `vMAJOR.MINOR.PATCH`.
  - GitHub Action `release-pwa.yml` zips PWA output on tag.
  - Backend CI `backend-ci.yml` runs build + tests on PRs and pushes.
- Rollout
  - Web: Blue/Green or staggered rollout (if supported by host). Keep previous build for quick rollback.
  - Android:
    - TWA: ship `*.aab` to Play Console with internal → closed → open tracks.
    - Capacitor: sign `app-release.aab` via Android Studio and upload to Play Console.

## 5) SRE Basics

- Health checks
  - Backend `/health` returns DB + app status. Wire to platform probes.
- Rate limits & Abuse
  - Ensure NestJS throttler is tuned. Add IP-based or user-based limits to auth/QR endpoints.
- Incident response
  - Keep an on-call contact. Document runbooks for: DB outage, auth outage, elevated 5xx, degraded perf.

## 6) Mobile-specific (Android)

- Push notifications
  - Capacitor Push Notifications (FCM) or Web Push for PWA. Store FCM tokens per user.
- Offline & Background sync
  - PWA already caches shell and offers outbox pattern. Consider background sync for critical flows.
- Crash analytics
  - Firebase Crashlytics (Capacitor) or Sentry (Web + Node) for error tracking.

## 7) Compliance & Privacy

- Keep a simple Privacy Policy and Terms page on the PWA domain.
- Handle right-to-erasure and data export (admin console).

## 8) Cost Control

- Right-size instances. Set alerts on spend. Use student credits where available.

## 9) Periodic Tasks

- Monthly
  - Review logs/alerts, rotate keys if needed, run `npm audit fix` PR.
- Quarterly
  - Restore-from-backup drill, load test peak pathways (attendance, QR scanning, bulk CSV).
