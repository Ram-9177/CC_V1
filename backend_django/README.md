# Django Conversion - Quick Setup Guide

## Prerequisites

- Python 3.11+
- PostgreSQL 14+
- Redis 6+
- pip and virtualenv

## Step 1: Setup Python Environment

```bash
# Create virtual environment
python3.11 -m venv venv

# Activate it
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate  # Windows
```

## Step 2: Install Dependencies

```bash
cd backend_django
pip install -r requirements.txt
```

## Step 3: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env  # macOS/Linux
# or edit .env in your editor
```

### Key Environment Variables

```env
DEBUG=True  # Set to False in production
SECRET_KEY=your-secret-key-here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hostelconnect
DB_USERNAME=postgres
DB_PASSWORD=your-db-password
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Step 4: Setup Database

```bash
# Create PostgreSQL database
createdb hostelconnect

# Run migrations
python manage.py migrate

# Create superuser (admin account)
python manage.py createsuperuser
```

## Step 5: Run Development Server

### Option A: Direct Execution

```bash
# Terminal 1: Run Django/Daphne server
python manage.py runserver 0.0.0.0:8000

# Or with Daphne (for WebSockets)
daphne -b 0.0.0.0 -p 8000 hostelconnect.asgi:application
```

### Option B: Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f web

# Stop services
docker-compose down
```

## Step 6: Verify Installation

```bash
# Check health endpoint
curl http://localhost:8000/api/health/

# Access API documentation
# Swagger: http://localhost:8000/api/docs/

# Access admin panel
# http://localhost:8000/admin/
```

## Step 7: WebSocket Testing

Open `http://localhost:8000` in browser and test WebSocket connection:

```javascript
// In browser console
const socket = new WebSocket("ws://localhost:8000/ws/notifications/");

socket.onopen = () => {
  console.log("Connected");
  socket.send(JSON.stringify({ type: "ping" }));
};

socket.onmessage = (e) => {
  console.log("Message:", e.data);
};
```

---

## Common Commands

### Database Management

```bash
# Create migrations for model changes
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Show migration status
python manage.py showmigrations

# Rollback last migration
python manage.py migrate [app_name] [migration_number]
```

### Development Tools

```bash
# Run tests
pytest

# Run tests with coverage
pytest --cov=apps --cov-report=html

# Format code
black .
isort .

# Lint code
flake8 .
pylint apps/
```

### Create New App

```bash
python manage.py startapp [app_name] apps/[app_name]
```

---

## Project Structure Overview

```
backend_django/
├── manage.py              # Django management script
├── requirements.txt       # Python dependencies
├── .env.example          # Environment variables template
├── Dockerfile            # Docker container definition
├── docker-compose.yml    # Multi-container setup
├── hostelconnect/        # Main project package
│   ├── settings/         # Django settings
│   ├── asgi.py          # WebSocket/Async config
│   ├── wsgi.py          # WSGI config
│   └── urls.py          # Main URL routing
├── apps/                 # Django applications
│   ├── auth/            # Authentication
│   ├── users/           # User management
│   ├── rooms/           # Room management
│   ├── meals/           # Meal management
│   ├── attendance/      # Attendance tracking
│   ├── gate_passes/     # Gate passes
│   ├── events/          # Events
│   ├── notices/         # Notices
│   └── ...other apps
├── core/                # Shared models, serializers, permissions
├── utils/               # Utility functions
├── websockets/          # WebSocket consumers & routing
└── tests/               # Test suite
```

---

## Migration from NestJS

### Backend Changes

1. ✅ Authentication → DRF JWT + SimpleJWT
2. ✅ WebSockets → Django Channels
3. ✅ Database → TypeORM → Django ORM (migrations needed)
4. ✅ Controllers → ViewSets/APIViews
5. ✅ Services → Django Services/Utils
6. ✅ Guards → Permission classes
7. ✅ Pipes → Serializers + Validators
8. ✅ Scheduled Tasks → Celery + Celery Beat

### Frontend Changes (Minimal)

The React frontend requires minimal changes since Django exposes the same REST API:

1. **Update API URL** (already in .env):

   ```javascript
   const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api";
   ```

2. **WebSocket URL** (new):

   ```javascript
   const WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:8000";
   ```

3. **Request headers** (JWT token handling):
   ```javascript
   headers: {
     'Authorization': `Bearer ${accessToken}`,
   }
   ```

---

## API Endpoint Mapping

### Authentication

- `POST /api/auth/login/` - User login
- `POST /api/auth/register/` - User registration
- `POST /api/auth/token/` - Get JWT tokens
- `POST /api/auth/token/refresh/` - Refresh access token
- `GET /api/auth/users/me/` - Get current user

### Users

- `GET /api/users/` - List users
- `POST /api/users/` - Create user
- `GET /api/users/{id}/` - Get user details
- `PUT /api/users/{id}/` - Update user
- `DELETE /api/users/{id}/` - Delete user

### Rooms

- `GET /api/rooms/` - List rooms
- `POST /api/rooms/` - Create room
- `GET /api/rooms/{id}/` - Get room details
- `PUT /api/rooms/{id}/` - Update room
- `DELETE /api/rooms/{id}/` - Delete room

---

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Test connection
psql -h localhost -U postgres -d hostelconnect

# Check if PostgreSQL is running
pg_isready -h localhost -p 5432
```

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli ping

# Check if Redis is running
redis-cli info server
```

### WebSocket Connection Issues

1. Ensure Redis is running
2. Check Django Channels is configured in ASGI
3. Verify CORS settings in Django settings
4. Check browser console for WebSocket errors

### Migration Issues

```bash
# Reset migrations (dev only!)
python manage.py migrate [app_name] zero

# Then run migrations again
python manage.py migrate
```

---

## Next Steps

1. Complete model implementations for remaining apps
2. Create full CRUD endpoints for each module
3. Implement WebSocket consumers for real-time features
4. Add comprehensive tests
5. Set up CI/CD pipeline
6. Deploy to production

See [DJANGO_CONVERSION_PLAN.md](../DJANGO_CONVERSION_PLAN.md) for detailed implementation guide.

---

## ⚡ CI Performance Benchmarking (TTFB)

The project includes an automated **Time-To-First-Byte (TTFB)** benchmark that runs on every push to `main` to detect performance regressions before they reach users.

### How It Works

| Step | What happens                                                                                        |
| ---- | --------------------------------------------------------------------------------------------------- |
| 1    | GitHub Actions triggers `.github/workflows/performance.yml` on `push` to `main`                     |
| 2    | `backend/bench_ttfb.sh` fires `curl` at each key endpoint and captures `time_starttransfer`         |
| 3    | Each TTFB is compared against the configurable **threshold** (default `1.0 s`)                      |
| 4    | If **any** endpoint exceeds the threshold the CI job fails and the commit is flagged                |
| 5    | A structured log (with timestamps, pass/fail per endpoint) is uploaded as a GitHub Actions artifact |

### Endpoints benchmarked

| Endpoint            | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `/api/health/`      | Liveness probe – fastest possible response |
| `/api/`             | API root – checks routing layer            |
| `/api/rooms/`       | Typical authenticated list view            |
| `/api/notices/`     | Notice board – commonly hit by students    |
| `/api/gate-passes/` | Gate pass list – business-critical         |

### Configuring the threshold

The threshold is controlled by the `THRESHOLD` environment variable (unit: **seconds**).

```bash
# Default (1 second)
THRESHOLD=1.0

# Stricter (500 ms) – after optimization sprints
THRESHOLD=0.5

# Looser (2 seconds) – during Render cold-start debugging
THRESHOLD=2.0
```

Change it for CI by updating the `threshold` default in `performance.yml`:

```yaml
threshold:
  description: "TTFB threshold in seconds (default: 1.0)"
  default: "1.0" # ← edit this
```

Or override it per-run using the **"Run workflow"** button in GitHub Actions (Actions tab → Performance Benchmark → Run workflow).

### Setting up the secret (required)

The workflow reads `BASE_URL` from a **GitHub repository secret** called `RENDER_BACKEND_URL` so the production URL is never committed to source control.

1. Go to **Settings → Secrets and variables → Actions → New repository secret**
2. Name: `RENDER_BACKEND_URL`
3. Value: `https://campuscore-api.onrender.com` (your Render URL)

### Running the benchmark locally

```bash
# Make sure curl and awk are available (standard on macOS/Linux)

# Test against production
BASE_URL=https://campuscore-api.onrender.com ./backend/bench_ttfb.sh

# Test against local dev server
BASE_URL=http://localhost:8000 THRESHOLD=0.5 ./backend/bench_ttfb.sh

# Stricter threshold + more retries
BASE_URL=https://campuscore-api.onrender.com THRESHOLD=0.8 MAX_RETRIES=3 ./backend/bench_ttfb.sh
```

Example output:

```
╔══════════════════════════════════════════════════════════╗
║         SMG CampusCore ERP – TTFB Performance Benchmark       ║
╚══════════════════════════════════════════════════════════╝

  Base URL  : https://campuscore-api.onrender.com
  Threshold : 1.0s
  Timestamp : 2026-02-23 10:45:00 UTC

Endpoint                            TTFB (s)     Status     Notes
────────────────────────────────────────────────────────────────────────
Health Check (/api/health/)         0.342        ✅ PASS
API Root (/api/)                    0.388        ✅ PASS
Rooms List (/api/rooms/)            0.521        ✅ PASS
Notices List (/api/notices/)        0.617        ✅ PASS
Gate Passes (/api/gate-passes/)     0.489        ✅ PASS

════════════════════════════════════════════════════════════════════════
  Results: 5 passed / 0 failed out of 5 endpoints
  Threshold: 1.0s per endpoint

✅  All endpoints within performance threshold. CI PASSED.
```

### Temporarily disabling the benchmark

If there is a known infrastructure issue (e.g. Render free-tier outage, scheduled maintenance) and you need to merge anyway:

1. **Quick disable** (no code change required): Go to **Settings → Actions → Variables → Repository variables** and add `SKIP_PERF_BENCHMARK = true`. Remove it once the issue is resolved.
2. **Per-commit skip**: Add `[skip perf]` to your commit message and add a path filter in `performance.yml` (see GitHub Actions docs on conditional steps).
3. **Temporary threshold bump**: Trigger the workflow manually with a higher threshold via "Run workflow" → set `threshold` to `3.0`.

### Interpreting failures

| Symptom                  | Likely cause                                     | Action                                                  |
| ------------------------ | ------------------------------------------------ | ------------------------------------------------------- |
| All endpoints fail       | Render cold start / instance sleeping            | Re-run job after ~30 s; consider Render cron keep-alive |
| Only `/api/rooms/` fails | N+1 query or missing DB index                    | `EXPLAIN ANALYZE` the room list query                   |
| Intermittent failures    | Network jitter between GitHub runners and Render | Increase `MAX_RETRIES` or `THRESHOLD` slightly          |
| All fail with `N/A`      | `RENDER_BACKEND_URL` secret not set              | Add the secret (see setup section above)                |
