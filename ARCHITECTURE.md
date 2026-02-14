# SMG Hostel Management System - Complete Architecture

## Table of Contents
1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Real-Time System](#real-time-system)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Security](#security)
9. [Deployment](#deployment)

---

## System Overview

SMG Hostel Management System is a comprehensive web application for managing student hostel operations including:

- **Gate Pass Management** - Request, approve, track entry/exit
- **Attendance Tracking** - Mark and monitor student attendance
- **Room Allocation** - Assign and manage student rooms
- **Meal Management** - Schedule meals and track attendance
- **Notice Distribution** - Post announcements for different roles
- **Message System** - Internal communications between users
- **Disciplinary Action** - Track fines and violations
- **Visitor Management** - Register and manage visitor entries
- **Complaints System** - Log and resolve student complaints
- **Real-Time Updates** - Live notifications across all features

---

## Technology Stack

### Frontend
```
Framework: React 18.3.1 + TypeScript 5.3.3
Build Tool: Vite 5.1.0
State Management: 
  - React Query 5.20.0 (server state)
  - Zustand (auth & global state)
UI Components: shadcn/ui
Real-Time: WebSocket (custom client)
Styling: Tailwind CSS 3.3.0
Auth: JWT tokens
```

### Backend
```
Framework: Django 4.2.10
ASGI Server: Daphne (async support)
Real-Time: Django Channels 4.0.0
Database: PostgreSQL (production) / SQLite (dev)
Authentication: Django REST Framework JWT
Cache: Redis (Upstash/local)
API: Django REST Framework

Key Dependencies:
- django-cors-headers
- django-extensions
- dj-database-url
- python-decouple
- rest-framework-simplejwt
- channels-redis
- psycopg2-binary
```

---

## Frontend Architecture

### Project Structure
```
src/
├── components/
│   ├── ui/                    # shadcn UI components
│   ├── layout/
│   │   ├── DashboardLayout.tsx
│   │   └── Navbar.tsx
│   ├── dashboard/
│   │   ├── StudentDashboard.tsx
│   │   ├── WardenDashboard.tsx
│   │   └── GateSecurityDashboard.tsx
│   ├── forms/                 # Reusable form components
│   └── ConnectionStatus.tsx   # WebSocket status indicator
│
├── pages/
│   ├── Dashboard.tsx
│   ├── GatePassesPage.tsx
│   ├── GateScansPage.tsx
│   ├── AttendancePage.tsx
│   ├── RoomsPage.tsx
│   ├── RoomMapping.tsx
│   ├── MealsPage.tsx
│   ├── NoticesPage.tsx
│   ├── MessagesPage.tsx
│   ├── NotificationsPage.tsx
│   ├── ComplaintsPage.tsx
│   ├── VisitorsPage.tsx
│   ├── FinesPage.tsx
│   ├── UsersPage.tsx
│   ├── CollegesPage.tsx
│   ├── EventsPage.tsx
│   ├── MetricsPage.tsx
│   ├── ReportsPage.tsx
│   ├── ProfilePage.tsx
│   ├── DigitalID.tsx
│   ├── LoginPage.tsx
│   └── RegisterPage.tsx
│
├── hooks/
│   ├── useWebSocket.ts        # Real-time event listeners
│   ├── useCommon.ts           # Common hooks
│   └── useAuth.ts             # Authentication hooks
│
├── lib/
│   ├── api.ts                 # Axios instance with JWT
│   ├── store.ts               # Zustand store (auth state)
│   ├── websocket.ts           # WebSocket client (256 lines)
│   ├── offlineSync.ts         # Offline mutation queuing
│   ├── rbac.ts                # Role-based access control
│   ├── utils.ts               # Utility functions
│   └── constants.ts
│
├── types/
│   └── index.ts               # TypeScript interfaces (all types)
│
├── App.tsx                    # Main app component with routing
├── main.tsx                   # Entry point
└── index.css                  # Global styles
```

### Key Frontend Patterns

#### 1. React Query for Server State
```typescript
// Automatic caching and refetching
const { data, isLoading, error } = useQuery({
  queryKey: ['gate-passes'],
  queryFn: async () => {
    const res = await api.get('/gate-passes/');
    return res.data;
  }
});
```

#### 2. Real-Time Event Invalidation
```typescript
// Listen for events, invalidate query, refetch automatically
useRealtimeQuery('gatepass_updated', 'gate-passes');

// Component re-renders with fresh data
```

#### 3. Zustand for Auth State
```typescript
// Global auth state across app
const { token, isAuthenticated, user } = useAuthStore();
```

#### 4. Role-Based Access Control
```typescript
// Routes protected by role
const ROLE_ACCESS = {
  '/dashboard': ['student', 'warden', 'admin'],
  '/room-mapping': ['warden', 'head_warden', 'admin'],
  '/gate-passes': ['student', 'warden', 'gate_security', 'admin'],
};
```

---

## Backend Architecture

### Project Structure
```
backend_django/
├── manage.py
├── requirements.txt
├── pytest.ini
│
├── hostelconnect/             # Project settings
│   ├── settings/
│   │   ├── base.py            # Base settings
│   │   └── (environment-specific)
│   ├── asgi.py                # ASGI with Channels
│   ├── wsgi.py                # WSGI for HTTP
│   ├── urls.py                # Main URL routing
│   └── sentry.py              # Error tracking
│
├── core/                       # Core app
│   ├── models.py              # Base models (User, Tenant, Staff)
│   ├── permissions.py         # Custom DRF permissions
│   ├── throttles.py           # Rate limiting
│   ├── pagination.py          # Pagination classes
│   ├── exceptions.py          # Custom exceptions
│   ├── middleware.py          # Custom middleware
│   ├── constants.py           # App-wide constants
│   ├── role_scopes.py         # Role definitions
│   ├── security.py            # Security utilities
│   ├── date_utils.py          # Date/time utilities
│   └── errors.py              # Error handling
│
├── apps/
│   ├── auth/                  # Authentication
│   ├── users/                 # User management
│   ├── gate_passes/           # Gate pass system
│   ├── gate_scans/            # Gate entry/exit tracking
│   ├── attendance/            # Attendance tracking
│   ├── rooms/                 # Room management
│   ├── meals/                 # Meal management
│   ├── notices/               # Notice distribution
│   ├── messages/              # Internal messaging
│   ├── notifications/         # In-app notifications
│   ├── disciplinary/          # Fines & discipline
│   ├── complaints/            # Complaint system
│   ├── visitors/              # Visitor management
│   ├── events/                # Event management
│   ├── colleges/              # College management
│   ├── reports/               # Report generation
│   ├── metrics/               # Analytics & metrics
│   ├── health/                # Health checks
│   └── web/                   # Django templates
│
└── websockets/                # Real-time WebSocket
    ├── consumers.py           # 3 consumers (notification, updates, presence)
    ├── middleware.py          # JWT auth middleware
    ├── routing.py             # WebSocket URL patterns
    ├── broadcast.py           # Broadcast utilities
    ├── handlers.py            # Event handlers
    └── __init__.py
```

### Key Backend Patterns

#### 1. Django REST ViewSet
```python
class GatePassViewSet(viewsets.ModelViewSet):
    queryset = GatePass.objects.all()
    serializer_class = GatePassSerializer
    permission_classes = [IsAuthenticated, HasGatePassPermission]
    
    def perform_create(self, serializer):
        instance = serializer.save(student=self.request.user)
        # Broadcast real-time event
        broadcast_to_role('warden', 'gatepass_created', {...})
```

#### 2. Signal-Based Broadcasting
```python
@receiver(post_save, sender=GatePass)
def broadcast_gatepass_saved(sender, instance, created, **kwargs):
    if created:
        broadcast_to_updates_user(instance.student.id, 'gatepass_created', {...})
```

#### 3. Role-Based Permissions
```python
class HasGatePassPermission(BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ['student', 'warden', 'admin']
```

---

## Real-Time System

### WebSocket Architecture

#### Three Connection Types
1. **Updates Socket** (`/ws/updates/`) - Main data updates
2. **Notifications Socket** (`/ws/notifications/`) - Notification delivery
3. **Presence Socket** (`/ws/presence/`) - User online/offline status

#### Connection Flow
```
Client (React)
    ↓
    |-- WebSocket Connect (with JWT token)
    |
Backend (Django Channels)
    ↓
    |-- Validate JWT
    |-- Add to group (updates_123, role_student, etc.)
    |-- Accept connection
    |
    |-- (User action on backend)
    |
    |-- Signal triggered
    |-- broadcast_to_group() called
    |-- Message sent to group
    |
Client
    ↓
    |-- Message received
    |-- Handler invoked
    |-- React Query invalidated
    |-- Data refetched
    |-- UI updated
```

### Event Types (18+ Features)
```
Gate Passes:
  - gatepass_created
  - gatepass_approved
  - gatepass_rejected
  - gatepass_updated

Attendance:
  - attendance_updated
  - gate_scan_logged

Notices:
  - notice_created
  - notice_updated
  - notice_deleted

Rooms:
  - room_allocated
  - room_deallocated
  - room_updated

Meals:
  - meal_updated
  - meal_attendance_updated

Messages:
  - messages_updated

Notifications:
  - notification

Disciplinary:
  - disciplinary

Presence:
  - user_status_changed
```

### Reconnection Strategy
- Initial delay: 1 second
- Exponential backoff: delay × 2^(attempts-1)
- Max delay: 30 seconds
- Jitter: +0-1000ms random
- Max attempts: 12 (~34 minutes total)

### Offline Support
```typescript
// Queue mutations while offline
await offlineSync.queueMutation('/gate-passes/', 'POST', data);

// Auto-replay when connection restored
// Persisted in localStorage
```

---

## Database Schema

### Core Tables

#### Users (core_user)
- id (PK)
- username (unique)
- email (unique)
- password (hashed)
- role (enum: student, warden, head_warden, admin, chef, gate_security, etc.)
- is_active
- created_at

#### Tenant (Student Profile)
- id (PK)
- user (FK)
- hall_ticket (unique)
- phone_number
- date_of_birth
- room (FK nullable)
- risk_score
- risk_status (low, medium, high, critical)
- created_at

#### GatePass
- id (PK)
- student (FK)
- exit_date
- entry_date
- purpose
- status (draft, pending, approved, rejected, used)
- qr_code
- actual_entry_at (nullable)
- created_at

#### GateScan
- id (PK)
- gate_pass (FK)
- student (FK)
- scan_time
- scan_type (entry, exit)
- created_at

#### Room
- id (PK)
- room_number (unique)
- floor
- capacity
- current_occupancy
- status (available, occupied, maintenance)
- created_at

#### RoomAllocation
- id (PK)
- room (FK)
- student (FK)
- allocated_date
- deallocated_date (nullable)
- created_at

#### Attendance
- id (PK)
- user (FK)
- attendance_date
- status (present, absent, on_leave)
- marked_by (FK)
- created_at

#### Meal
- id (PK)
- meal_type (breakfast, lunch, dinner)
- date
- menu_details
- created_at

#### Notice
- id (PK)
- title
- content
- target_roles (array)
- priority (low, normal, high, urgent)
- created_by (FK)
- created_at

#### Message
- id (PK)
- sender (FK)
- recipient (FK)
- content
- is_read
- created_at

#### DisciplinaryAction
- id (PK)
- student (FK)
- action_type (warning, fine, suspension)
- severity (low, medium, high, severe)
- title
- description
- fine_amount
- is_paid
- paid_at (nullable)
- created_at

#### Notification
- id (PK)
- recipient (FK)
- title
- message
- notification_type
- action_url
- is_read
- created_at

---

## API Endpoints

### Authentication
```
POST   /api/auth/login/
POST   /api/auth/register/
POST   /api/auth/token/refresh/
POST   /api/auth/logout/
GET    /api/auth/verify/
```

### Users
```
GET    /api/users/
GET    /api/users/{id}/
PUT    /api/users/{id}/
GET    /api/users/profile/
PUT    /api/users/profile/
```

### Gate Passes
```
GET    /api/gate-passes/
POST   /api/gate-passes/
GET    /api/gate-passes/{id}/
PUT    /api/gate-passes/{id}/
PATCH  /api/gate-passes/{id}/approve/
PATCH  /api/gate-passes/{id}/reject/
```

### Attendance
```
GET    /api/attendance/
POST   /api/attendance/
GET    /api/attendance/{id}/
PUT    /api/attendance/{id}/
```

### Rooms
```
GET    /api/rooms/
POST   /api/rooms/
GET    /api/rooms/{id}/
PUT    /api/rooms/{id}/
POST   /api/rooms/{id}/allocate/
POST   /api/rooms/{id}/deallocate/
POST   /api/rooms/swap/
```

### Meals
```
GET    /api/meals/
POST   /api/meals/
GET    /api/meals/{id}/
PUT    /api/meals/{id}/
GET    /api/meals/forecast/
POST   /api/meals/{id}/attendance/
```

### Notices
```
GET    /api/notices/
POST   /api/notices/
GET    /api/notices/{id}/
PUT    /api/notices/{id}/
DELETE /api/notices/{id}/
```

### Messages
```
GET    /api/messages/
POST   /api/messages/
GET    /api/messages/{id}/
```

### Health & Status
```
GET    /api/health/
GET    /api/metrics/
GET    /api/reports/
```

---

## Security

### Authentication
- JWT tokens (rest_framework_simplejwt)
- Token stored in localStorage
- Auto-refresh on expiry
- Logout clears token

### Authorization
- Role-based access control (RBAC)
- Permission classes on all endpoints
- Student only sees own data
- Wardens see students in their halls
- Admin sees everything

### WebSocket Security
- JWT validation on connection
- Query param token (`?token=...`)
- Header auth support (Authorization: Bearer)
- Group-based filtering (no cross-role data leaks)
- Anonymous user rejection (code 4401)

### Data Protection
- CORS configured
- CSRF protection enabled
- SQL injection prevention (ORM)
- XSS prevention (React escaping)
- Password hashing (bcrypt)
- Sensitive endpoints rate-limited

---

## Deployment

### Environment Variables
```bash
# Backend
DEBUG=False
SECRET_KEY=your-secure-key
ALLOWED_HOSTS=api.example.com
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://user:pass@host:6379/0
CORS_ALLOWED_ORIGINS=https://example.com

# Frontend
VITE_API_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com
```

### Server Setup
```bash
# Backend
gunicorn hostelconnect.wsgi:application --bind 0.0.0.0:8000
daphne -b 0.0.0.0 -p 8000 hostelconnect.asgi:application

# Frontend
npm run build
serve -s dist

# Nginx reverse proxy with WebSocket support
```

### Database
- PostgreSQL 12+
- Migrations auto-applied
- Backup strategy in place
- SSL connections in production

### Monitoring
- Sentry for error tracking
- Request logging
- WebSocket connection monitoring
- Redis health checks
- Uptime monitoring

---

**Last Updated**: February 2026
**Status**: Production-Ready ✅
