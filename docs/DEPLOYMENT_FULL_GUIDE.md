# HostelConnect Deployment Guide (Free & Always-On)

This guide explains, **step by step**, how to deploy the entire HostelConnect project using **only free tiers** and how to keep it effectively **always on (no sleeping)**.

It is written specifically for this repository structure and config files:

- Backend: Django + Channels in `backend_django`
- Frontend: React + Vite in `src` (built to `dist`)
- Render blueprint: `render.yaml`
- Extra configs: `backend_django/render.yaml`, `backend_django/fly.toml`, `vercel.json`
- Keep-alive CI: `.github/workflows/keep_alive.yml`

The recommended production setup is:

- **Backend API + WebSockets**: Render free Web Service (`hostelconnect-api`)
- **PostgreSQL Database**: Render free PostgreSQL (`hostelconnect-db`)
- **Redis / Channels Layer**: Upstash free Redis (or similar free Redis SaaS)
- **Frontend (React/Vite)**: Render free Static Site (`hostelconnect-web`) — or Vercel free if you prefer
- **Always-On (No Sleep)**: GitHub Actions keep-alive workflow that pings the backend every few minutes

---

## 0. Prerequisites

Before starting, make sure you have:

- A **GitHub** account that owns this repo (`HOSTEL_WEBAPP`).
- A **Render** account (https://render.com/), free plan is enough.
- An **Upstash** account (https://upstash.com/) for free Redis.
- (Optional) A **Vercel** account (https://vercel.com/) if you want frontend on Vercel.

You do **not** need to run anything locally to deploy, but local testing is recommended.

---

## 1. Understand the Production Architecture

**Backend**

- Runs from `backend_django` using ASGI server `daphne`.
- Handles:
  - REST APIs under `/api/...`
  - WebSockets via Django Channels.
- Configured for Render in:
  - `render.yaml` (root) → main blueprint
  - `backend_django/render.yaml` (older/secondary config)

**Frontend**

- React + Vite app under `src/`.
- Built with `npm run build` into `dist/`.
- Deployed as static hosting either:
  - On Render (static site) using `render.yaml`, or
  - On Vercel using `vercel.json` and Vercel project settings.

**Database & Redis**

- PostgreSQL:
  - Free Render Postgres via `hostelconnect-db` in `render.yaml`.
- Redis:
  - External Upstash instance, configured via `REDIS_URL` env variable.

**Always-On Keep-Alive**

- `.github/workflows/keep_alive.yml` regularly sends a request to `/api/health/` on your backend.
- This prevents Render free service from going idle/sleeping.

---

## 2. Create External Services (Free Tiers)

### 2.1. Create Upstash Redis (Free)

1. Sign up at **https://upstash.com/**.
2. Create a **Redis** database in a region near your users.
3. Copy the **Redis URL**, which looks like:
   - `rediss://:<password>@<host>:<port>`
4. You will use this as the value for `REDIS_URL` in Render.

### 2.2. Prepare Render

1. Sign up / log in at **https://render.com/**.
2. Connect your **GitHub** account to Render.
3. Ensure Render can see your `HOSTEL_WEBAPP` repository.

You will use the root **`render.yaml`** as a **Blueprint**.

---

## 3. Deploy with Render Blueprint (Backend + Frontend + DB)

### 3.1. Start Blueprint Deploy from `render.yaml`

1. In Render dashboard, click **New → Blueprint**.
2. Choose **GitHub** and select this repo (`HOSTEL_WEBAPP`).
3. Render auto-detects `render.yaml` at the root.
4. It will show these resources:
   - `hostelconnect-api` (type: `web`, plan: `free`, rootDir: `backend_django`)
   - `hostelconnect-web` (type: `static`, plan: `free`, rootDir: `.`)
   - `hostelconnect-db` (type: `database`, plan: `free`)

Confirm and proceed to configure environment variables.

### 3.2. Configure `hostelconnect-db` (Postgres)

The database section in `render.yaml` is:

```yaml
databases:
  - name: hostelconnect-db
    plan: free
    maxConnections: 3
    postgresMajorVersion: 14
```

Render will create this automatically. Nothing else to do here.

### 3.3. Configure `hostelconnect-api` (Backend Web Service)

From `render.yaml` (top-level):

```yaml
- type: web
  name: hostelconnect-api
  plan: free
  rootDir: backend_django
  env: python
  buildCommand: ./build.sh
  startCommand: daphne -b 0.0.0.0 -p $PORT -u $WEB_CONCURRENCY hostelconnect.asgi:application
  healthCheckPath: /api/health/
  envVars:
    - key: DEBUG
      value: false
    - key: RENDER
      value: true
    - key: DATABASE_URL
      fromDatabase:
        name: hostelconnect-db
        property: connectionString
    - key: REDIS_URL
      sync: false
      value: redis://... # MANUAL STEP: Update this with Upstash URL after creating service
    - key: ALLOWED_HOSTS
      value: "hostelconnect-api.onrender.com,hostel.samuraitechpark.in,api.hostel.samuraitechpark.in"
    - key: CORS_ALLOWED_ORIGINS
      value: "https://hostelconnect-web.onrender.com,https://hostel.samuraitechpark.in"
    - key: CSRF_TRUSTED_ORIGINS
      value: "https://hostelconnect-web.onrender.com,https://hostel.samuraitechpark.in"
    - key: SECRET_KEY
      generateValue: true
    - key: WEB_CONCURRENCY
      value: 4
    - key: USE_IN_MEMORY_CHANNEL_LAYER
      value: false
    - key: CHANNELS_CAPACITY
      value: 5000
    - key: CHANNELS_MAX_CONNECTIONS
      value: 50
    - key: CACHE_MAX_CONNECTIONS
      value: 25
    - key: CHANNELS_SOCKET_TIMEOUT
      value: 20
```

Configure these in Render UI during/after blueprint creation:

1. **DATABASE_URL**
   - Will be auto-wired to `hostelconnect-db`. Do not change.

2. **REDIS_URL**
   - Replace placeholder with your Upstash URL, e.g.:
   - `rediss://:<password>@<host>:<port>`

3. **ALLOWED_HOSTS**
   - Adjust to include your actual backend Render URL:
   - Example:
     - `hostelconnect-api.onrender.com`
     - Or your custom domain if you add one later.

4. **CORS_ALLOWED_ORIGINS** and **CSRF_TRUSTED_ORIGINS**
   - Include the final frontend URLs, e.g.:
     - `https://hostelconnect-web.onrender.com`
     - Your custom frontend domain, if any.

5. **SECRET_KEY**
   - Leave `generateValue: true` so Render creates a secure random key.

6. **Other tuning vars**
   - Keep the default free-tier values; they are tuned for Render free plan.

After configuring, click **Apply** / **Create Resources** to start the initial deploy.

### 3.4. Configure `hostelconnect-web` (Frontend Static Site)

From `render.yaml`:

```yaml
- type: static
  name: hostelconnect-web
  plan: free
  rootDir: .
  buildCommand: npm install && npm run build
  publishDir: dist
  envVars:
    - key: VITE_API_URL
      fromService:
        type: web
        name: hostelconnect-api
        property: url
```

This means:

- Render will:
  - Run `npm install && npm run build` at the repo root.
  - Publish `dist/` as the static site.
- `VITE_API_URL` will be set to the **URL of `hostelconnect-api`** automatically.

No manual env var setup needed here, unless you want to override.

---

## 4. Run Migrations and Create Admin User

After the first `hostelconnect-api` deploy:

1. Go to the `hostelconnect-api` service in Render.
2. Open **Shell** (or Logs → Shell equivalent).
3. Run:

```bash
cd backend_django
python manage.py migrate --noinput
```

4. Optionally create a superuser for admin access:

```bash
python manage.py createsuperuser
# Follow prompts for username, email, password
```

5. Verify health endpoint:

- In your browser, open: `https://<your-backend-hostname>/api/health/`
- Expect HTTP 200 with a short JSON/OK response.

---

## 5. Verify Frontend + Backend Integration

Once both services are deployed:

1. Open the Render static site URL for `hostelconnect-web`, e.g.:
   - `https://hostelconnect-web.onrender.com`
2. The app should load.
3. Try logging in with valid test credentials.
4. Check that data loads and real-time UI (gate passes, notifications, etc.) works.

If you see CORS or CSRF errors, double-check:

- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`

in the `hostelconnect-api` environment settings.

---

## 6. Keep the Backend Always-On (No Sleep)

Render’s free plan **web services sleep after ~15 minutes** of no traffic.
To prevent this, your repo already includes a **keep-alive GitHub Actions workflow**:

- `.github/workflows/keep_alive.yml`

### 6.1. Set `RENDER_BACKEND_URL` in GitHub

1. Go to **GitHub → Your Repo → Settings → Secrets and variables → Actions → Variables**.
2. Create a new variable:
   - Name: `RENDER_BACKEND_URL`
   - Value: `https://<your-backend-hostname>` (no trailing slash)
     - Example: `https://hostelconnect-api.onrender.com`

### 6.2. Enable the Keep-Alive Workflow

1. Go to the **Actions** tab in your repo.
2. Locate workflow: **"Keep Render Service Awake"**.
3. Ensure workflows are enabled for the repo.

The workflow:

- Runs on a schedule: `*/5 * * * *` (every 5 minutes).
- Calls:

  ```bash
  curl -L -s -o /dev/null -w "%{http_code}" "$RENDER_BACKEND_URL/api/health/"
  ```

- If it gets HTTP 200, your backend is awake.
- These regular pings prevent Render from treating it as idle, so it **stays warm**.

> Note: This consumes GitHub Actions free minutes, but for a small project it is typically acceptable. Monitor usage in your GitHub billing/settings.

---

## 7. Optional: Frontend on Vercel (Alternative to Render Static)

If you prefer to host the frontend on **Vercel** instead of Render:

1. In Vercel, create a new project from your `HOSTEL_WEBAPP` repo.
2. In project settings:
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
3. Set **environment variable** in Vercel:
   - `VITE_API_URL = https://<your-backend-hostname>` (Render backend URL)
4. The file `vercel.json` already contains:

   ```json
   {
     "framework": "vite",
     "cleanUrls": true,
     "headers": [
       {
         "source": "/assets/(.*)",
         "headers": [
           {
             "key": "Cache-Control",
             "value": "public, max-age=31536000, immutable"
           }
         ]
       }
     ],
     "rewrites": [
       {
         "source": "/((?!assets|favicon.ico|manifest.webmanifest|sw.js|workbox-.*).*)",
         "destination": "/index.html"
       }
     ]
   }
   ```

5. Deploy the project in Vercel.

Vercel free tier does **not sleep**, so your frontend is always live, while the backend stays awake via the keep-alive workflow.

---

## 8. Optional: Fly.io Backend (Alternative to Render)

The file `backend_django/fly.toml` configures the backend for **Fly.io**. This is **optional**; you don’t need it if you are happy with Render.

Key points from `fly.toml`:

- Runs: `python manage.py migrate --noinput && daphne -b 0.0.0.0 -p 8000 hostelconnect.asgi:application`
- Can be configured to keep at least 1 machine always running by adjusting:
  - `min_machines_running`
  - `auto_stop_machines`

Using Fly.io would consume its free credits. Given your requirement for free + always-on, the **Render + GitHub keep-alive** route is simpler and already integrated into your repo.

---

## 9. Final Checklist (Pin-to-Pin)

Follow this checklist in order:

1. **Accounts**
   - [ ] GitHub repo ready and code pushed.
   - [ ] Render account created and linked to GitHub.
   - [ ] Upstash account created.

2. **Upstash Redis**
   - [ ] Create Redis DB.
   - [ ] Copy `REDIS_URL`.

3. **Render Blueprint**
   - [ ] Start new Blueprint from `render.yaml`.
   - [ ] Confirm `hostelconnect-api`, `hostelconnect-web`, `hostelconnect-db` resources.

4. **Backend Env Vars** (`hostelconnect-api`)
   - [ ] `DATABASE_URL` auto-wired.
   - [ ] `REDIS_URL` set to Upstash URL.
   - [ ] `ALLOWED_HOSTS` includes backend Render URL and any custom domains.
   - [ ] `CORS_ALLOWED_ORIGINS` includes frontend URLs.
   - [ ] `CSRF_TRUSTED_ORIGINS` includes frontend URLs.
   - [ ] `SECRET_KEY` generated.

5. **Deploy**
   - [ ] First deploy of all services completed.

6. **Migrations & Admin**
   - [ ] Run `python manage.py migrate --noinput` on Render shell.
   - [ ] Optionally run `python manage.py createsuperuser`.

7. **Verify Backend**
   - [ ] `/api/health/` returns 200.

8. **Verify Frontend**
   - [ ] Open frontend URL.
   - [ ] Log in as test user.
   - [ ] Confirm data and real-time features work.

9. **Keep-Alive Setup**
   - [ ] In GitHub → Actions variables, set `RENDER_BACKEND_URL`.
   - [ ] Ensure **Keep Render Service Awake** workflow is enabled.
   - [ ] Confirm workflow runs every 5 minutes and reports HTTP 200.

10. **(Optional) Vercel Frontend**
    - [ ] If used, set `VITE_API_URL` in Vercel pointing to Render backend.

After completing these steps, the **entire HostelConnect project will be deployed on free tiers**, and with the keep-alive GitHub Action, your **backend should not sleep**, providing an effectively always-on experience.
