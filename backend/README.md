# HostelConnect - Backend (NestJS)

This folder contains the backend scaffold for HostelConnect (NestJS + TypeORM + PostgreSQL).

Quick start (after installing dependencies):

1. Copy `.env.example` to `.env` and update values.
2. Install dependencies:
   npm install
3. Run in dev mode:
   npm run start:dev

Phase 6 (Notifications, Attendance+, Reports, Release)
-----------------------------------------------------

This repo now includes Phase 6 work: push notifications (FCM) with retry + auditing, expanded Attendance model and endpoints, initial Reports aggregations, Swagger docs, and Docker + CI improvements.

Key files and tips:

- Docker compose: `docker-compose.yml` — starts a local Postgres and the app on `:3000`.
- Build and run with Docker (recommended for demos):

   docker compose -f docker-compose.yml up -d

- Migrations (TypeORM):

   # generate
   npm run migrate:generate -- InitSchema

   # apply
   npm run migrate:run

- Notification FCM setup (optional):
   - Provide `FIREBASE_SERVICE_ACCOUNT` (base64) or `FIREBASE_CRED_PATH` env var.
   - In CI, store service account JSON as a secret (e.g. `FIREBASE_SERVICE_ACCOUNT`).

- Swagger API docs:

   - Available at http://localhost:3000/api/docs
   - Uses Bearer Auth (JWT). Click “Authorize” and paste your token.

- New/updated endpoints:
   - Notifications
      - GET /notifications/audit?page=1&limit=20 — list notification audit records (paginated) [SUPER_ADMIN]
   - Attendance (Phase 6)
      - POST /attendance/sessions — create session (SCHEDULED by default)
      - PUT /attendance/sessions/:id/start — start session [WARDEN, WARDEN_HEAD]
      - PUT /attendance/sessions/:id/end — end session [WARDEN, WARDEN_HEAD]
      - POST /attendance/join — student self join (QR or manual depending on mode)
      - GET /attendance/sessions?status=ACTIVE&fromDate=...&toDate=... — list sessions with filters
      - GET /attendance/my-records?fromDate=...&toDate=... — current user’s records + summary
      - GET /attendance/export?sessionId=... — CSV export for a session
   - Reports
      - GET /reports/gate-passes?from=YYYY-MM-DD&to=YYYY-MM-DD — totals and counts by status
      - GET /reports/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD — sessions, records, and counts by status
      - GET /reports/gate-passes/timeseries?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week|month — counts over time
      - GET /reports/attendance/timeseries?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week|month — sessions and records over time
      - Meals (Phase 7)
            - POST /meals/menu — create menu [CHEF, WARDEN_HEAD]
            - GET /meals/menu?date=YYYY-MM-DD[&mealType] — list menus by date (and optional meal type)
            - PUT /meals/menu/:id — update menu [CHEF, WARDEN_HEAD]
            - DELETE /meals/menu/:id — delete menu [CHEF, WARDEN_HEAD]
            - POST /meals/intent — submit student intent for a menu
           - GET /meals/intents/summary?date=YYYY-MM-DD[&mealType] — aggregated intent counts [CHEF, WARDEN_HEAD]
           - GET /meals/intents/export?date=YYYY-MM-DD[&mealType] — CSV export of aggregated intents [CHEF, WARDEN_HEAD]

   Cron jobs:
   - 18:00 daily: Meal intent reminder broadcast (topic: students)
   - 21:00 daily: Auto-exclude students outside hostel (sets NO intent with autoExcluded)

   WebSocket rooms and events:
   - Rooms joined automatically on connect:
      - role:<ROLE> — e.g., role:CHEF, role:WARDEN_HEAD
      - user:<ID> — user-specific room
   - Meals events (emitted to role rooms):
      - `meals:menu-created` → payload: { id, date, mealType } → to CHEF, WARDEN_HEAD
      - `meals:intent-updated` → payload: { menuId, studentId, intent } → to CHEF, WARDEN_HEAD

CI notes:
- GitHub Actions workflow updated to provision Postgres service, run `npm run migrate:run`, then run e2e tests.


What's included:
- Basic NestJS bootstrap (`src/main.ts`, `src/app.module.ts`)
- TypeORM config placeholder (`src/config/database.config.ts`)
- `package.json`, `tsconfig` and helpful scripts

Next steps:
- Run `npm install` in `backend/`.
- Implement modules per the project master prompt (auth, users, gate-passes, etc.).
- Add database entities and run migrations.


Phase 8 (Notices)
------------------

Endpoints:
- POST /notices — create [WARDEN, WARDEN_HEAD, CHEF, SUPER_ADMIN]
- GET /notices — list targeted for current user (active only)
- GET /notices/all — list with filters (role/hostel/block, includeExpired) [WARDEN, WARDEN_HEAD, CHEF, SUPER_ADMIN]
- GET /notices/:id — get one
- PUT /notices/:id — update [WARDEN, WARDEN_HEAD, CHEF, SUPER_ADMIN]
- DELETE /notices/:id — delete [WARDEN, WARDEN_HEAD, CHEF, SUPER_ADMIN]

Real-time:
- `notice:created` → emitted to targeted roles (defaults to STUDENT if none)
- `notice:updated` → emitted to targeted roles
- `notice:deleted` → emitted to targeted roles

Data model:
- Notice: title, content, priority(LOW|NORMAL|HIGH), targets (roles[], hostelIds[], blockIds[]), attachments[], author, createdAt/updatedAt, expiresAt



Phase 12–13 (Attendance pagination, search, sorting, date-range, filtered export)
---------------------------------------------------------------------------------

Enhancements to Attendance APIs with server-side pagination, search, sorting, date-range filters, and filtered CSV export. Swagger is updated; see /api/docs when running locally.

Endpoints and query params:

- GET /attendance/sessions
   - Query params:
      - status: SCHEDULED | ACTIVE | COMPLETED
      - date: YYYY-MM-DD (exact date match on scheduledAt)
      - dateFrom: ISO or YYYY-MM-DD (scheduledAt >=)
      - dateTo: ISO or YYYY-MM-DD (scheduledAt <=)
      - search: substring match on title (case-insensitive)
      - sortBy: createdAt | scheduledAt | status | title (default: createdAt)
      - sortDir: ASC | DESC (default: DESC)
      - page: number (default: 1)
      - pageSize: number (default: 10, max: 100)
   - Response: { data: AttendanceSession[], total, page, pageSize }

- GET /attendance/sessions/:id/records
   - Query params:
      - status: PRESENT | ABSENT | LATE | EXCUSED
      - fromDate: ISO (markedAt >=)
      - toDate: ISO (markedAt <=)
      - search: substring on student first/last name or hallticket (case-insensitive)
      - sortBy: markedAt | status | hallticket (default: markedAt)
      - sortDir: ASC | DESC (default: DESC)
      - page: number (default: 1)
      - pageSize: number (default: 10, max: 100)
   - Response: { data: AttendanceRecord[], total, page, pageSize }

- GET /attendance/sessions/:id/export
   - Query params (optional):
      - status, search as above
      - page, pageSize to export only current page
   - Response: CSV text (columns: hallticket, firstName, lastName, status, markedAt, method, markedBy)

Notes:
- Database indexes added via migration `1761895765414-AttendanceIndexes.ts` to support common filters and sorts.
- Real-time events remain unchanged (attendance:session-started, attendance:session-ended, attendance:marked).


