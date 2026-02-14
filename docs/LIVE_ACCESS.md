# 🚀 SMG Hostel Management System - Live Access

## 📡 Public URLs (via ngrok)

### API Endpoint
```
https://galleried-warless-petronila.ngrok-free.dev
```

### Frontend (Local)
```
http://localhost:5173
```

### Health Check
```
https://galleried-warless-petronila.ngrok-free.dev/api/health/
```

---

## 🔐 Login Credentials

### ⭐ STUDENT ROLE (Primary User)

| Hall Ticket | Email | Password | Role |
|---|---|---|---|
| **STUDENT1** | student1@example.com | `password123` | Student |
| **STUDENT2** | student2@example.com | `password123` | Student |
| **21BJ1A5447** | - | `password123` | Student |
| **237W1A05C0** | - | `password123` | Student |
| **23D01A72A3** | - | `password123` | Student |

### 👔 WARDEN ROLE

| Hall Ticket | Email | Password | Role |
|---|---|---|---|
| **WARDEN** | warden@example.com | `password123` | Warden |
| **HEADWARDEN** | headwarden@example.com | `password123` | Head Warden |

### 👨‍💼 ADMIN ROLES

| Hall Ticket | Email | Password | Role |
|---|---|---|---|
| **ADMIN** | admin@example.com | `password123` | Super Admin |

### 🔒 SECURITY ROLES

| Hall Ticket | Email | Password | Role |
|---|---|---|---|
| **SECURITY** | security@example.com | `password123` | Gate Security |
| **SECURITYHEAD** | headsec@example.com | `password123` | Security Head |

### 👨‍🍳 CHEF ROLE

| Hall Ticket | Email | Password | Role |
|---|---|---|---|
| **CHEF** | chef@example.com | `password123` | Chef |

---

## 📋 API Endpoints (Use ngrok URL)

### Authentication
```
POST   https://galleried-warless-petronila.ngrok-free.dev/api/auth/login/
POST   https://galleried-warless-petronila.ngrok-free.dev/api/auth/register/
POST   https://galleried-warless-petronila.ngrok-free.dev/api/auth/password-reset/
POST   https://galleried-warless-petronila.ngrok-free.dev/api/auth/otp-request/
POST   https://galleried-warless-petronila.ngrok-free.dev/api/auth/otp-verify/
GET    https://galleried-warless-petronila.ngrok-free.dev/api/auth/users/
```

### Student Features
```
GET    https://galleried-warless-petronila.ngrok-free.dev/api/gate-passes/
POST   https://galleried-warless-petronila.ngrok-free.dev/api/gate-passes/
GET    https://galleried-warless-petronila.ngrok-free.dev/api/meals/
POST   https://galleried-warless-petronila.ngrok-free.dev/api/meals/
GET    https://galleried-warless-petronila.ngrok-free.dev/api/complaints/
POST   https://galleried-warless-petronila.ngrok-free.dev/api/complaints/
GET    https://galleried-warless-petronila.ngrok-free.dev/api/notices/
GET    https://galleried-warless-petronila.ngrok-free.dev/api/rooms/
```

### Warden Features
```
GET    https://galleried-warless-petronila.ngrok-free.dev/api/gate-passes/
PATCH  https://galleried-warless-petronila.ngrok-free.dev/api/gate-passes/{id}/approve/
PATCH  https://galleried-warless-petronila.ngrok-free.dev/api/gate-passes/{id}/reject/
GET    https://galleried-warless-petronila.ngrok-free.dev/api/attendance/
POST   https://galleried-warless-petronila.ngrok-free.dev/api/attendance/mark/
GET    https://galleried-warless-petronila.ngrok-free.dev/api/rooms/
```

### Admin Features
```
GET    https://galleried-warless-petronila.ngrok-free.dev/api/users/
POST   https://galleried-warless-petronila.ngrok-free.dev/api/users/
GET    https://galleried-warless-petronila.ngrok-free.dev/api/metrics/
GET    https://galleried-warless-petronila.ngrok-free.dev/api/reports/
```

---

## 🧪 Test Scenarios

### Scenario 1: Student Login & Gate Pass
1. Login as: **STUDENT1** / `password123`
2. Navigate to: Gate Passes
3. Click: "Request New Pass"
4. Fill: Destination, Purpose, Date
5. Submit: Request

### Scenario 2: Warden Approval
1. Login as: **WARDEN** / `password123`
2. Navigate to: Gate Passes
3. View: Pending requests
4. Action: Approve or Reject

### Scenario 3: Attendance Marking
1. Login as: **HEADWARDEN** / `password123`
2. Navigate to: Attendance
3. Select: Building/Floor
4. Mark: Student attendance
5. Submit: Batch save

### Scenario 4: Meal Management
1. Login as: **CHEF** / `password123`
2. Navigate to: Meals
3. View: Today's meal plan
4. Manage: Portions, dietary restrictions

### Scenario 5: Admin Dashboard
1. Login as: **ADMIN** / `password123`
2. Navigate to: Metrics
3. View: All statistics
4. Download: Reports

---

## 🔗 Quick Access Links

### Frontend
- Dashboard: http://localhost:5173/dashboard
- Gate Passes: http://localhost:5173/gate-passes
- Meals: http://localhost:5173/meals
- Complaints: http://localhost:5173/complaints
- Notices: http://localhost:5173/notices
- Attendance: http://localhost:5173/attendance (Warden only)
- Rooms: http://localhost:5173/rooms (Admin only)
- Metrics: http://localhost:5173/metrics (Admin only)

### API Testing (Postman/cURL)
```bash
# Get auth token
curl -X POST "https://galleried-warless-petronila.ngrok-free.dev/api/auth/login/" \
  -H "Content-Type: application/json" \
  -d '{"hall_ticket":"STUDENT1","password":"password123"}'

# Response includes tokens:
# {
#   "user": {...},
#   "tokens": {
#     "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
#     "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
#   }
# }

# Use access token in subsequent requests
curl -X GET "https://galleried-warless-petronila.ngrok-free.dev/api/gate-passes/" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## ✨ Features Available by Role

### Student
- ✅ Request Gate Passes
- ✅ Register Meals
- ✅ File Complaints
- ✅ View Notices
- ✅ Check Room Assignment
- ✅ View Attendance Record
- ✅ Receive Notifications
- ✅ Send Messages

### Warden
- ✅ All Student features
- ✅ Approve/Reject Gate Passes
- ✅ Mark Attendance
- ✅ Manage Room Allocations
- ✅ View Building Reports
- ✅ Respond to Complaints

### Head Warden
- ✅ All Warden features
- ✅ Building-wide Attendance
- ✅ Hostel Reports
- ✅ Approve Meal Plans
- ✅ Manage All Warden Tasks

### Admin
- ✅ All features for all roles
- ✅ User Management
- ✅ System Settings
- ✅ Generate Reports
- ✅ View Metrics & Analytics
- ✅ Manage Colleges
- ✅ Bulk Operations

### Security
- ✅ Log Gate Scans
- ✅ View Entry/Exit Records
- ✅ Verify Gate Passes
- ✅ Generate Scan Reports

### Chef
- ✅ Plan Meals
- ✅ View Registrations
- ✅ Manage Menu
- ✅ Track Dietary Restrictions

---

## 📊 System Information

**Backend:**
- Framework: Django 4.2.10
- API: Django REST Framework
- Real-time: Django Channels 4.0.0
- Database: SQLite (dev) / PostgreSQL (prod)
- Authentication: JWT (rest_framework_simplejwt)

**Frontend:**
- Framework: React 18.3.1
- Build: Vite 5.1.0
- State: Zustand + React Query
- Styling: Tailwind CSS 3.3.0
- Real-time: WebSocket (custom client)

**Deployment:**
- Backend: Daphne ASGI Server (port 8000)
- Frontend: Vite Dev Server (port 5173)
- Tunnel: ngrok (free tier)

---

## ⚠️ Important Notes

1. **ngrok Link Changes**: Every time you restart ngrok, you get a new URL
   - Save the current link: `https://galleried-warless-petronila.ngrok-free.dev`
   - Update in Postman/frontend config if needed

2. **Password Format**: All demo accounts use `password123`
   - Never use in production
   - Change via API: `/api/auth/change-password/`

3. **Token Expiration**: JWT tokens expire after 5 minutes
   - Use refresh token to get new access token
   - Refresh endpoint: `/api/auth/token/refresh/`

4. **CORS**: ngrok URL is already CORS-enabled for frontend

5. **Rate Limiting**:
   - Login: 5 attempts per 5 minutes
   - Password reset: 3 requests per hour
   - General API: 100 requests per minute

6. **Mobile Testing**:
   - Frontend works on any device
   - Use ngrok URL for external mobile access
   - Recommend testing on actual devices

---

## 🐛 Troubleshooting

**Issue:** "Invalid credentials"
- Solution: Check hall ticket is uppercase (e.g., STUDENT1, not student1)
- Also verify password is exactly `password123`

**Issue:** "CORS error"
- Solution: Use ngrok URL for API calls, not localhost
- Frontend on localhost:5173 works fine

**Issue:** "Token expired"
- Solution: Use refresh token to get new access token
- Endpoint: POST `/api/auth/token/refresh/`

**Issue:** "WebSocket connection failed"
- Solution: WebSocket might not work through ngrok free tier
- Use locally for real-time features

**Issue:** "ngrok link is dead"
- Solution: Restart ngrok tunnel to get new link
- Save the new link in your notes

---

## 📞 Support

**API Health Check:**
```
https://galleried-warless-petronila.ngrok-free.dev/api/health/
```

**Backend Status:** http://0.0.0.0:8000/api/health/

**Frontend Status:** http://localhost:5173

---

**Generated:** February 14, 2026  
**ngrok URL:** https://galleried-warless-petronila.ngrok-free.dev  
**Status:** ✅ All Systems Online
