# Deployment Guide (Student Benefits: DigitalOcean, Heroku, Azure)

This repo contains both the PWA frontend (root) and the NestJS backend (backend/). Below are three production-ready paths using popular student-benefit platforms. Pick one end-to-end path for the simplest experience.

---

## Option A: DigitalOcean App Platform (Recommended)

What you get:
- Static PWA at https://hostel.samuraitechpark.in
- Dockerized backend service with autoscaling options
- Managed PostgreSQL (optional, with student credits)

Repo config added:
- `.do/app.yaml` — defines two components: frontend static site and backend service, plus a managed Postgres stub.

Steps:
1) Fork this repo into your GitHub account.
2) Edit `.do/app.yaml`:
   - Replace `<YOUR_GITHUB_USERNAME>` with your GitHub username.
   - Optionally change VITE_API_URL (points to your backend origin if different).
3) Create a DigitalOcean App from GitHub and import `.do/app.yaml`.
4) In the DO dashboard:
   - Add environment variables (as secrets) for the backend:
     - `DATABASE_URL` (from your DO Managed Database)
     - `JWT_SECRET` (any strong secret)
   - Link the database component to the backend or supply the URL manually.
5) Set custom domain:
   - Frontend → Domains → add `hostel.samuraitechpark.in` and follow DNS instructions.
   - (Optional) Backend → add `api.hostel.samuraitechpark.in` if you want a separate API subdomain.
6) Deploy. Verify:
   - PWA: https://hostel.samuraitechpark.in/
   - Asset links: https://hostel.samuraitechpark.in/.well-known/assetlinks.json

Notes:
- The backend already ships with a Dockerfile; App Platform will build and run it.
- If your backend expects specific env vars, mirror them in App Platform. A `.env.example` exists in `backend/`.

---

## Option B: Heroku (Backend) + Static Hosting

Backend on Heroku:
1) In `backend/`, Procfile is provided (`web: node dist/main.js`).
2) Create Heroku app:
   - Set Buildpacks: Node.js
   - Config Vars:
     - `NODE_ENV=production`
     - `PORT=3000`
     - Database vars (either `DATABASE_URL` or individual pg envs)
     - `JWT_SECRET` (strong secret)
   - Add Heroku Postgres add-on; copy the `DATABASE_URL` into Config Vars.
3) Deploy via GitHub integration or `git push heroku main`.

Frontend static hosting (choose one):
- Vercel (fast): project root, build `npm run build`, output `build/`, custom domain `hostel.samuraitechpark.in`.
- Netlify: build `npm run build`, publish directory `build/`.
- S3+CloudFront or Nginx: upload `build/` and set SPA fallback to `/index.html`.

Wire the frontend → backend:
- Set `VITE_API_URL` in the hosting platform to your Heroku backend URL.
- Rebuild/redeploy frontend to apply the new API base.

---

## Option C: Azure (Static Web Apps + App Service)

Frontend (Azure Static Web Apps):
1) Connect GitHub repo to Azure Static Web Apps service.
2) App location: `/`
3) Build command: `npm run build`
4) Output location: `build`
5) Domain: add `hostel.samuraitechpark.in` in Static Web Apps → Custom Domains.

Backend (Azure App Service):
1) Create App Service for Node (Linux) and Azure Database for PostgreSQL (Flexible Server).
2) Set App Settings:
   - `NODE_ENV=production`
   - `PORT=3000`
   - connection vars for PostgreSQL (or `DATABASE_URL`)
   - `JWT_SECRET`
3) Deploy with GitHub Actions or `az webapp up`.

Wire frontend → backend:
- In Static Web Apps, set `VITE_API_URL` environment (SWA env vars via GitHub Action). Re-deploy.

---

## TWA for Play Store

- Host the app at: `https://hostel.samuraitechpark.in`
- Ensure `/.well-known/assetlinks.json` is live. Update SHA-256 fingerprint.
- Use Bubblewrap:
  ```bash
  npm i -g @bubblewrap/cli
  bubblewrap init --manifest=https://hostel.samuraitechpark.in/manifest.webmanifest
  bubblewrap build
  ```
- Upload the generated `.aab` to Play Console.

Package IDs we set:
- Capacitor appId: `com.samuraitechpark.hostelconnect`
- TWA package: `com.samuraitechpark.hostelconnect.twa`

---

## Production PWA Tips
- Service Worker: `sw.js` already caches shell and uses SWR for GET APIs; version bump triggers update. An in-app prompt asks to refresh when new version is ready.
- Icons: SVG + maskable already included. Add PNG 192/512 to maximize Lighthouse scores (optional).
- CSV exports can be large—prefer server-side streaming if you later expect huge datasets.

---

## Real-time (Socket.IO) behind a proxy

If you place the backend behind Nginx or a cloud proxy, ensure WebSocket upgrade headers are passed through.

Nginx example (see `deploy/nginx.conf.example`):

```nginx
location /socket.io/ {
   proxy_pass http://backend:3000/socket.io/;
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   proxy_set_header Host $host;
   proxy_read_timeout 600s;
}
```

Frontend `.env`:

```bash
VITE_WS_URL=wss://api.example.com
```

---

## Security headers and CSP

Enable CSP via backend env:

```bash
CSP_ENABLE=true
CSP_CONNECT="https://api.example.com, https://api.example.com/socket.io"
```

This restricts `connect-src` while allowing your API and Socket.IO endpoints. Adjust for CDNs as needed.

---

## Web Push & Android Push (Notifications)

Web Push (PWA):
- Generate a VAPID key pair; set `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` in backend and `VITE_VAPID_PUBLIC_KEY` in frontend.
- Users enable from Profile → Enable Web Push.
- Send test from Admin → Ops.

Android Push (FCM):
- Add `android/app/google-services.json` and configure Firebase.
- Run app on device; Profile → Enable Android Push.
- Send test from Admin → Ops.

---

## Post-deploy checks

- Backend:
   - /health returns 200 with status
   - /metrics returns Prometheus text
   - Swagger at /api/docs loads over HTTPS
- Frontend:
   - PWA loads with service worker active
   - Admin → Ops shows Health and Metrics
   - Notifications: Send Test delivers to a registered device
   - Real-time: trigger an event (e.g., notice/gate pass) and see live update

## Need help choosing?
- Easiest: DigitalOcean App Platform (.do/app.yaml included)
- Simplest split: Heroku backend + Vercel frontend
- Azure-first stack: Static Web Apps + App Service + Azure Database for PostgreSQL
