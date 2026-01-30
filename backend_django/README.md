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
const socket = new WebSocket('ws://localhost:8000/ws/notifications/');

socket.onopen = () => {
    console.log('Connected');
    socket.send(JSON.stringify({type: 'ping'}));
};

socket.onmessage = (e) => {
    console.log('Message:', e.data);
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
   const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
   ```

2. **WebSocket URL** (new):
   ```javascript
   const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';
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
