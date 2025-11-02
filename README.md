
  # HostelConnect Mobile App

  This is a code bundle for HostelConnect Mobile App. The original project is available at https://www.figma.com/design/6pROtsWahnmtnSncpRi66o/HostelConnect-Mobile-App.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  
  ## Environment configuration

  Create a `.env` file in the project root (or copy `.env.example`) to point the app at your backend services.

  Variables:

  - `VITE_API_URL`: Base URL for REST API (e.g., `http://localhost:4000`)
  - `VITE_WS_URL`: WebSocket URL for real-time events (e.g., `ws://localhost:4000` or `wss://...`)
  - `VITE_ANDROID_APK_URL` (optional): Public URL to your Android APK for direct download
  - `VITE_ANDROID_TWA_URL` (optional): Play Store listing URL (TWA or native) to open the store page

  If these are not set, features gracefully fall back to mocked data where possible (e.g., meals CSV export produces a mock file).

  ### Real-time setup (switch off demo data)

  To run against the real backend and disable demo/mocked data:

  1) Backend env (.env)

    - DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME
    - JWT_SECRET, JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN

    Run migrations to create/upgrade the database:

    ```bash
    npm --prefix backend run build
    npm --prefix backend run migrate:run
    ```

  2) Frontend env (.env)

    - Set VITE_API_URL to your API base URL, e.g. `http://localhost:4000`
    - Optionally set VITE_WS_URL for real-time events

    When VITE_API_URL is set, the app uses real APIs and stops using demo data for those features.

  3) Login flow

    - The app now calls `POST /auth/login` and stores the JWT in `localStorage.authToken`.
    - Seed users via CSV import (Warden/Admin) or `POST /users` with proper roles.
    - Role-based access is enforced server-side.

  4) Rooms module

    - Endpoints: `POST /rooms/upsert`, `GET /rooms`, `GET /rooms/:id`, `POST /rooms/:id/assign`.
    - Frontend: Warden → “Manage Rooms & Assignments”.
    - Ensure migrations have been applied (creates `rooms` table and adds `roomId`/`bedLabel` columns to `users`).

  ## Real-time events

  The backend emits Socket.IO events and automatically adds clients to rooms:
  - `role:<ROLE>` for role-wide updates (e.g., `role:CHEF`, `role:WARDEN`)
  - `user:<USER_ID>` for per-user updates

  The frontend `src/lib/socket.ts` connects to `VITE_WS_URL` and will attach a Bearer token from `localStorage.getItem('authToken')` when available.

  Usage example:

  - Store your JWT after login: `localStorage.setItem('authToken', '<JWT>')`
  - Subscribe to an event inside a component:
    - `import { useSocketEvent } from '@/lib/socket'`
    - `useSocketEvent('meals:intent-updated', (data) => console.log(data))`
  - Unsubscribes automatically on unmount.

  ## CSV exports

  The Chef Intents Summary screen has an Export button wired via `src/lib/api.ts`:
  - With `VITE_API_URL` set, it downloads a real CSV from `/meals/summary/export?date=YYYY-MM-DD`.
  - Without backend configuration, it downloads a mock CSV so the UX remains testable.

  ## Notices (Phase 9)
  ## API docs (Swagger)

  The backend exposes Swagger UI at:

  - http://localhost:3000/api/docs (default port)

  Make sure the server is running (see backend README) and JWT is configured to try secured endpoints. Rooms endpoints are under the "rooms" tag, including:

  - POST /rooms/upsert
  - GET /rooms
  - GET /rooms/:id
  - POST /rooms/:id/assign
  - POST /rooms/:id/unassign
  - POST /rooms/bulk-assign (CSV: hallticket, block, number, bedLabel, floor?)

  The Notices module is wired end-to-end:
  - Backend endpoints (JWT + roles):
    - `GET /notices` — list notices targeted to current user
    - `GET /notices/all` — list notices with optional filters (warden/chef/admin)
    - `POST /notices` — create a new notice
    - `PUT /notices/:id` — update notice
    - `DELETE /notices/:id` — delete notice
  - Real-time events:
    - `notice:created`, `notice:updated`, `notice:deleted` (broadcast to target roles)
  - Frontend integration:
    - Student view `NoticesView` fetches from `/notices` and auto-refreshes on events.
    - Warden `NoticesManagement` can create, delete, toggle priority (pin), filter by role, and include expired; it auto-refreshes on events.
    - Create Notice supports optional target roles, attachments (comma-separated URLs), and expiry date.
  - Read status:
    - `POST /notices/mark-all-read` marks all visible notices as read for the current user.
    - Student screen has a “Mark All Read” button wired to this endpoint.
  - Config: Ensure `VITE_API_URL` and `VITE_WS_URL` are set and `localStorage.authToken` contains a valid JWT.
  
  ## Notifications (Web Push + Android)

  Web Push (PWA):
  - Set `VITE_VAPID_PUBLIC_KEY` in your frontend `.env` (Base64URL-encoded VAPID public key).
  - On the Profile screen, click “Enable Web Push (PWA)”. This registers a device token via `/notifications/register-token`.
  - Use Admin → Ops → “Send Test Notification” to verify end-to-end. Service worker will display and handle clicks.

  Android Push (FCM via Capacitor):
  - Requires native Android build (Capacitor). Ensure Android Studio and SDKs are installed.
  - Add `google-services.json` to `android/app/` and configure your Firebase project (FCM enabled).
  - From the project root:
    - `npm run cap:add:android` (first time)
    - `npm run cap:sync`
    - `npm run cap:open:android`
  - Build and run on a device/emulator. In the app, Profile → “Enable Android Push” to register the device token.
  - Verify delivery from Admin → Ops → “Send Test Notification” or “Broadcast Notification”.

  Backend requirements:
  - Web Push: VAPID keys configured in server env (already wired in NotificationService). 
  - Android: Firebase Admin SDK service account or FCM server key configured (if server-side FCM is enabled). 
  - Notification endpoints available:
    - `GET /notifications/tokens`, `POST /notifications/register-token`, `DELETE /notifications/token/:id`
    - `POST /notifications/test` (to current user), `POST /notifications/broadcast` (optional role/hostel filters)

  ## Install / Download the App

  Profile → "Get the App" section provides install/download options for every role:
  - PWA: If supported, click "Install App (PWA)" to add to Home Screen / desktop.
  - iOS: Follow the inline hint (Share → Add to Home Screen) since no install prompt API is available.
  - Android APK: When `VITE_ANDROID_APK_URL` is set, a "Download Android APK" button will appear.
  - Play Store: When `VITE_ANDROID_TWA_URL` is set, an "Open in Play Store" button will appear.

  Notes:
  - The PWA install button only shows when the browser fires the install prompt event and the app is not already installed.
  - For best results on Android, serve over HTTPS with a valid web app manifest and service worker.
  
  ## CI/CD and Deployments

  This repo is wired with GitHub Actions for CI and CD.

  Frontend (Vite app):
  - PR Preview: `.github/workflows/pr-preview.yml` builds the app and publishes a preview at `https://<org>.github.io/<repo>/pr-<number>/`.
    - Required repo secrets:
      - `VITE_API_URL` → Backend API base (e.g., `https://api.example.com`)
      - `VITE_WS_URL` → WebSocket base (e.g., `wss://api.example.com`)
  - GitHub Pages deploy: `.github/workflows/deploy.yml` publishes the app on pushes to `main`.
    - Configure Pages in repo Settings → Pages → Build and Deploy: GitHub Actions.
    - The workflow uses `BASE_PATH` to host under `/repo-name/`.

  Backend (NestJS):
  - CI: `.github/workflows/backend-ci.yml` runs build, unit tests, spins up Postgres 15, runs migrations, and executes e2e tests.
  - Container publish (optional): `.github/workflows/backend-docker.yml` builds and pushes a Docker image to GitHub Container Registry (GHCR) on pushes to `main` and releases.
    - Image name: `ghcr.io/<owner>/<repo>-backend`
  - Render deploy hook (optional): `.github/workflows/backend-render-deploy.yml` calls a Render Deploy Hook when you set the secret.
    - Set repo secret `RENDER_DEPLOY_HOOK` with your Render service deploy URL.

  Smoke tests:
  - From the repo root, `npm run smoke` pings `/health`, optional `/auth/me`, and Socket.IO connect.
  - CI usage: you can set `SMOKE_API_URL`, `SMOKE_API_PREFIX` (e.g., `/api`), `SMOKE_WS_URL`, and `SMOKE_AUTH_TOKEN` as needed.

  ### Using GitHub Student Developer Pack benefits

  With the GitHub Student Developer Pack, you typically get free credits and perks useful for hosting:
  - Azure for Students credits → run the backend on Azure App Service or Container Apps, Postgres Flexible Server.
  - DigitalOcean credits → use App Platform or Droplets for the backend and managed PostgreSQL.
  - Railway / Render free tiers → quick backend + Postgres with a Deploy Hook (use the provided render workflow with a secret).
  - Cloudflare Pages (free) → alternative to GitHub Pages for the frontend, with easy custom domains.

  Recommended path:
  - Frontend: keep using GitHub Pages (already wired). Point a custom domain via your DNS (often included in the Pack).
  - Backend: pick Azure (use credits) or Render/Railway (free tier). Set env vars on the platform:
    - `JWT_SECRET`, DB connection variables, `FRONTEND_URL`, and CORS allowed origins.
    - Remember: the backend uses global API prefix `/api`.

  Once deployed, set these repo secrets so previews and Pages know where to call:
  - `VITE_API_URL` (e.g., `https://api.yourdomain.com/api`)
  - `VITE_WS_URL` (e.g., `wss://api.yourdomain.com`)
