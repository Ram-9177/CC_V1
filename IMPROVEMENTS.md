# Improvement Plan (Modules)

This document summarizes pragmatic enhancements and test coverage to bring each module to production-grade quality.

## Gate Passes (Student ↔ Warden ↔ Gateman)
- Validation & UX
  - Enforce date ranges (fromDate < toDate, same-day constraints) and destination/ reason length limits.
  - Idempotent submit with client-side debounce to avoid duplicates.
- Security
  - Rate-limit creation and ad-watch endpoints per user.
  - RBAC audit: ensure revoke only for WARDEN/SUPER_ADMIN.
- Observability
  - Emit structured events for create/approve/reject/revoke; add audit table for status history.
  - Add metrics: approvals per day, emergency ratio, mean approval time.
- Reliability
  - QR content signature (HMAC) to prevent tamper; include short TTL.
  - Auto-expire passes after toDate; background job.
- Tests
  - E2E: create → approve → ad watch → scan simulate; negative paths (reject, revoke).

## Gate Scans (Gateman)
- UX & Flows
  - Support manual hallticket lookup fallback if QR failure.
  - Display recent scans with filters; prevent double-scan within N minutes.
- Security
  - Verify pass status and validity window server-side; log attempts.
- Tests
  - Unit: scan validation; E2E: scan happy/invalid/expired.

## Attendance
- Data Integrity
  - De-duplication: unique (session_id, student_id) DB constraint.
  - Guard state transitions (SCHEDULED → ACTIVE → COMPLETED) strictly.
- UX
  - Countdown/timer visible for active sessions; late threshold configuration.
- Exports
  - Add per-day CSV rollup and attendance rates per student.
- Tests
  - E2E: session lifecycle (create/start/mark/export/end) and CSV assertions.

## Rooms
- Integrity
  - Enforce capacity via transaction-level check (SELECT FOR UPDATE) to avoid race.
  - Move operation: atomic unassign + assign.
- UX
  - Room detail modal with bed map A/B/C/D; drag to move between rooms.
  - Bulk importer preview+diff before apply.
- Tests
  - Unit: capacity edge cases; E2E: export endpoints (added), assign/unassign race.

## Meals (Kitchen)
- Features
  - Menu planner with per-day items; intents cutoff time.
  - Allergy flags; per-meal opt-outs and analytics.
- Ops
  - Daily CSV of counts; chef dashboard KPIs.
- Tests
  - Unit: intent rules; E2E: submit intent → board view.

## Users & Profiles
- Features
  - Role-based profile page (added web); avatar upload; contact edit with OTP verify.
  - Password reset via email/SMS (backend token + frontend form).
- Security
  - Enforce strong passwords; failed login throttling; JWT refresh rotation.
- Tests
  - Unit: RBAC creation rules; E2E: CSV import/export and profile fetch.

## Platform & Cross-Cutting
- AuthZ
  - Central policy checks with error codes; consistent 403 vs 404.
- Performance
  - Pagination defaults + max limits; response compression for CSV.
- Observability
  - Request logging with correlation ID; error fingerprinting.
- PWA/Offline
  - Outbox retries jitter; partial sync for rooms/attendance.

## Mobile (Flutter)
- Parity roadmap
  - Implement modules incrementally: Auth → Profile → Gate Passes → Attendance → Rooms → Meals.
  - Shared ApiClient with token storage; role-based navigation shell.
- Testing
  - Widget tests for screens; integration tests with mock HTTP.
