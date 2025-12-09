# HostelConnect – SMG Hostel Portal

HostelConnect is a full‑stack hostel management app for students, wardens, chefs, and admins.
This repo bundles the web frontend (Vite + React), backend API (NestJS + PostgreSQL + Socket.IO), basic mobile targets (PWA + Android/Capacitor/Flutter), and CI/CD workflows.

Use this README as your guide for local development and production deployment with real‑time features.

---

## 1. Quick Start (Local Development)

### 1.1. Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (local or cloud)
- Recommended: GitHub Student Developer Pack (for hosting credits)

### 1.2. Install dependencies

From the repo root:

```bash
npm install
npm --prefix backend install
```

### 1.3. Backend: local setup (real backend, real‑time ready)

1. Create a PostgreSQL database (for example `hostelconnect_dev`).
2. Create `backend/.env` (or configure env vars in your shell) with at least:

   - `DB_HOST=localhost`
   - `DB_PORT=5432`
   - `DB_USERNAME=postgres`
   - `DB_PASSWORD=postgres`
   - `DB_NAME=hostelconnect_dev`
   - `JWT_SECRET=change_me`
   - `JWT_REFRESH_SECRET=change_me_refresh`
   - `JWT_REFRESH_EXPIRES_IN=7d`

3. Build and run migrations:

```bash
npm --prefix backend run build
npm --prefix backend run migrate:run
```

4. Start the backend API (default `http://localhost:3000` with global prefix `/api`):

```bash
npm --prefix backend run start:dev
```

- REST base URL (with prefix): `http://localhost:3000/api`
- Swagger docs: `http://localhost:3000/api/docs`
- Socket.IO base: `ws://localhost:3000` (same origin, no `/api`)

### 1.4. Frontend: local setup (real‑time UI)

1. Create `.env` in the repo root (same level as `package.json`):

```bash
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
VITE_ANDROID_APK_URL=
VITE_ANDROID_TWA_URL=
VITE_VAPID_PUBLIC_KEY=
```

2. Start the frontend dev server:

```bash
npm run dev
```

3. Open the app:

- `http://localhost:5173` (or whatever Vite prints in the terminal)

When `VITE_API_URL` is set, the app uses the real backend (no demo data) and all real‑time features are active.

---

## 2. Environment Variables Overview

### 2.1. Frontend (`.env` at repo root)

All frontend variables must be prefixed with `VITE_`:

- `VITE_API_URL`
  - Base URL for REST API including the global `/api` prefix.
  - Local: `http://localhost:3000/api`
  - Production: `https://api.yourdomain.com/api`

- `VITE_WS_URL`
  - WebSocket / Socket.IO base URL for real‑time events (usually without `/api`).
  - Local: `ws://localhost:3000`
  - Production: `wss://api.yourdomain.com`

- `VITE_ANDROID_APK_URL` (optional)
  - Public URL to your Android APK for direct download.

- `VITE_ANDROID_TWA_URL` (optional)
  - Play Store listing URL for your TWA or native app.

- `VITE_VAPID_PUBLIC_KEY` (optional)
  - Base64URL‑encoded VAPID public key for PWA Web Push notifications.

If `VITE_API_URL` is not set, some features fall back to mocked/demo data (for example, meals CSV export).

### 2.2. Backend (`backend/.env` or platform env)

Core configuration:

- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`

Optional but recommended for deployment and notifications:

- `FRONTEND_URL` (for CORS, for example `https://hostel.yourdomain.com`)
- Web Push:
  - `WEB_PUSH_VAPID_PUBLIC_KEY`
  - `WEB_PUSH_VAPID_PRIVATE_KEY`
- Android / FCM:
  - Firebase Admin / FCM secrets as configured in the backend

The backend is configured with a global API prefix `/api`, so:

- REST base path: `/api`
- Example full URL: `https://api.yourdomain.com/api/rooms`

Make sure `VITE_API_URL` includes `/api` at the end.

---

## 3. Real Backend vs Demo Data

The app can run in two modes:

1. **Demo / partially mocked** (no `VITE_API_URL`):
   - No backend connection required.
   - Some features (e.g. meals CSV export) use mock data.
   - Good for quickly previewing UI.

2. **Real backend (recommended for deployment)**:
   - `VITE_API_URL` and `VITE_WS_URL` are set.
   - All modules use the real NestJS backend and real‑time events.

### 3.1. Switching fully to real backend (turning on real‑time for everything)

1. Backend is running with migrations applied (see section 1.3).
2. Frontend `.env` is configured:

```bash
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
```

3. Login flow:
   - The app calls `POST /auth/login` (i.e. `POST /api/auth/login`).
   - On success, a JWT is stored in `localStorage.authToken`.
   - All subsequent API and Socket.IO connections use `Authorization: Bearer <JWT>`.

4. Users & roles:
   - Create/seed users via CSV import (warden/admin screens) or `POST /users` via API.
   - Roles (student / warden / chef / admin) are enforced on the backend.

5. Rooms module:
   - Endpoints (all under `/api`):
     - `POST /rooms/upsert`
     - `GET /rooms`
     - `GET /rooms/:id`
     - `POST /rooms/:id/assign`
     - `POST /rooms/:id/unassign`
     - `POST /rooms/bulk-assign` (CSV: hallticket, block, number, bedLabel, floor)
   - Frontend: Warden → "Manage Rooms & Assignments".
   - Ensure migrations created the `rooms` table and `roomId` / `bedLabel` columns on `users`.

6. CSV exports:
   - Chef Intents Summary screen → Export button hits:
     - `/meals/summary/export?date=YYYY-MM-DD` via `VITE_API_URL`.
   - With backend configured: downloads real CSV.
   - Without backend: generates a mock CSV for testing.

---

## 4. Real‑time & Socket.IO (UI + UX)

The app is designed around live updates so changes appear instantly without manual refresh.

### 4.1. Connection behaviour

- Frontend Socket.IO client is created in `src/lib/socket.ts`.
- It connects to `VITE_WS_URL` (for example `ws://localhost:3000` or `wss://api.yourdomain.com`).
- If `localStorage.authToken` exists, it is sent as `Authorization: Bearer <JWT>`.

On the server side, connected users are added to logical rooms:

- `role:<ROLE>` (for example `role:CHEF`, `role:WARDEN`)
- `user:<USER_ID>` for user‑specific notifications

This lets the backend push only the relevant updates.

### 4.2. Using real‑time events in components

Key idea: treat Socket.IO like a shared data stream, and subscribe per‑screen.

- After login, JWT is stored with:

  ```ts
  localStorage.setItem('authToken', '<JWT>');
  ```

- In a React component, you can use the helper hook:

  ```ts
  import { useSocketEvent } from '@/lib/socket';

  useSocketEvent('meals:intent-updated', (payload) => {
    // Update local state, show a toast, etc.
  });
  ```

- The hook automatically subscribes on mount and unsubscribes on unmount to avoid memory leaks.

Common event names include:

- `meals:intent-updated` and related meal events
- Notices:
  - `notice:created`
  - `notice:updated`
  - `notice:deleted`

This pattern gives a smoother UX: changes made by wardens/chefs/admins appear instantly on student screens.

---

## 5. Core Features & APIs

### 5.1. API docs (Swagger)

Swagger UI is exposed at:

- `http://localhost:3000/api/docs`

Rooms endpoints live under the `rooms` tag and include:

- `POST /rooms/upsert`
- `GET /rooms`
- `GET /rooms/:id`
- `POST /rooms/:id/assign`
- `POST /rooms/:id/unassign`
- `POST /rooms/bulk-assign`

Most endpoints require a JWT from `/auth/login`.

### 5.2. Notices (Phase 9 – real‑time announcements)

Backend endpoints (JWT + roles):

- `GET /notices` – list notices targeted to the current user
- `GET /notices/all` – list with filters for warden/chef/admin
- `POST /notices` – create new notice
- `PUT /notices/:id` – update notice
- `DELETE /notices/:id` – delete notice
- `POST /notices/mark-all-read` – mark all visible notices read

Real‑time events broadcast to relevant roles/users:

- `notice:created`
- `notice:updated`
- `notice:deleted`

Frontend UX:

- **Student (NoticesView)**
  - Fetches from `/notices`.
  - Auto‑refreshes when notice events arrive over Socket.IO.
  - "Mark All Read" button calls `/notices/mark-all-read`.

- **Warden/Admin (NoticesManagement)**
  - Create, delete, pin (priority), filter by role, and include expired notices.
  - Updates propagate instantly to all connected clients via real‑time events.

Configuration required:

- `VITE_API_URL` and `VITE_WS_URL` set
- Valid `localStorage.authToken`

### 5.3. Notifications (Web Push + Android)

#### Web Push (PWA)

- Set `VITE_VAPID_PUBLIC_KEY` in `.env`.
- On the Profile screen, click **Enable Web Push (PWA)**:
  - Registers a device token via `POST /notifications/register-token`.
- Use Admin → Ops → **Send Test Notification** to send yourself a push.

Backend requirements:

- VAPID keys configured in env.
- Endpoints:
  - `GET /notifications/tokens`
  - `POST /notifications/register-token`
  - `DELETE /notifications/token/:id`
  - `POST /notifications/test` (current user)
  - `POST /notifications/broadcast` (optional role/hostel filters)

#### Android Push (FCM via Capacitor)

- Requires native Android build (Capacitor + FCM).
- Add `google-services.json` to `android/app/`.
- Make sure your Firebase project has FCM enabled.

From the repo root:

```bash
npm run cap:add:android    # first time only
npm run cap:sync
npm run cap:open:android
```

Then build & run from Android Studio. In the app:

- Profile → **Enable Android Push** to register device.
- Admin → Ops → **Send Test Notification** or **Broadcast Notification** to verify.

---

## 6. Install / Download the App (End‑User UX)

Profile → **Get the App** shows platform‑specific options:

- **PWA**
  - "Install App (PWA)" button appears when the browser fires the install prompt and the app is not already installed.
- **iOS**
  - Shows friendly instructions (Share → Add to Home Screen) because there is no install prompt API.
- **Android APK**
  - "Download Android APK" appears when `VITE_ANDROID_APK_URL` is set.
- **Play Store**
  - "Open in Play Store" appears when `VITE_ANDROID_TWA_URL` is set.

For the best UX:

- Serve over HTTPS.
- Ensure `manifest.webmanifest` and `sw.js` are accessible.
- Use a custom icon set for a polished home‑screen experience.

---

## 7. Deployment Guide (Real‑time Production Setup)

### 7.1. Backend deployment

You can deploy the NestJS backend on Render, Railway, Azure App Service, a VPS, or any Docker/Kubernetes platform.

Key points:

- Expose HTTP (REST) + WebSocket (Socket.IO) on the same origin.
- Keep `/api` as the global REST prefix.
- Configure env vars on the platform:
  - `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`
  - `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`
  - `FRONTEND_URL` (for example `https://hostel.yourdomain.com`)
  - Optional Web Push + FCM secrets

Typical production URLs:

- REST: `https://api.yourdomain.com/api`
- WebSockets: `wss://api.yourdomain.com`

If using the provided Docker / GitHub workflows, images are published to GHCR (see `.github/workflows` and `backend/Dockerfile`).

### 7.2. Frontend deployment

The frontend is a static Vite app and can be deployed to:

- GitHub Pages (already wired in workflows)
- Cloudflare Pages, Vercel, Netlify, or any static web host

To build the production bundle:

```bash
npm run build
```

Then deploy the built assets (typically `build/` or `dist/` depending on config) to your host.

In production, set:

- `VITE_API_URL` → `https://api.yourdomain.com/api`
- `VITE_WS_URL` → `wss://api.yourdomain.com`

These can be wired into your host’s build environment or GitHub Actions secrets.

### 7.3. CI/CD & GitHub Actions

This repo includes GitHub Actions (see `.github/workflows/`):

- **Frontend**
  - PR preview workflow builds and publishes preview sites for each pull request.
  - Deploy workflow publishes to GitHub Pages on pushes to `main`.
- **Backend**
  - CI workflow runs build, tests, and e2e with Postgres.
  - Optional Docker publish + Render deploy hook workflows.

You can run smoke tests against any deployed environment:

```bash
npm run smoke
```

Configure via env vars:

- `SMOKE_API_URL` (for example `https://api.yourdomain.com`)
- `SMOKE_API_PREFIX` (for example `/api`)
- `SMOKE_WS_URL` (for example `wss://api.yourdomain.com`)
- `SMOKE_AUTH_TOKEN` (optional JWT for auth checks)

---

## 8. Troubleshooting

- **Frontend loads but features dont work**
  - Check `VITE_API_URL` and `VITE_WS_URL` are set correctly.
  - Ensure `VITE_API_URL` includes `/api`.

- **401 / 403 errors**
  - Log in again; confirm `localStorage.authToken` exists.
  - Verify user roles are set correctly in the backend.

- **Real‑time updates not arriving**
  - Confirm `VITE_WS_URL` is reachable and WebSockets are enabled on your host.
  - Check that the JWT is valid and being sent as `Authorization: Bearer ...`.

- **CSV export returns mock data**
  - Usually indicates `VITE_API_URL` is not configured or backend is unreachable.

- **PWA install button missing**
  - Ensure HTTPS and valid manifest / service worker.
  - Already‑installed PWAs will not show the install button.

---

## 9. References

- Original design: https://www.figma.com/design/6pROtsWahnmtnSncpRi66o/HostelConnect-Mobile-App
- Frontend entry points: `src/main.tsx`, `src/App.tsx`, `src/lib/api.ts`, `src/lib/socket.ts`
- Backend structure: see `backend/` (NestJS modules, migrations, tasks, websockets)
