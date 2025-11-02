# HostelConnect - Complete Backend Development Prompt for GitHub Copilot

## 🎯 MASTER PROMPT: Copy this entire document to Copilot

---

# PROJECT OVERVIEW

I'm building **HostelConnect**, a production-ready real-time hostel management system with:
- **Frontend**: React + TypeScript (ALREADY COMPLETE - 27 screens, 24 components)
- **Backend**: NestJS + TypeScript (TO BE BUILT - this is what I need help with)
- **Database**: PostgreSQL
- **Real-time**: Socket.IO
- **Mobile**: Flutter (future phase)

---

# SYSTEM ARCHITECTURE

## Tech Stack for Backend:
- **Framework**: NestJS v10+
- **Database**: PostgreSQL + TypeORM
- **Authentication**: JWT + Passport
- **Real-time**: Socket.IO (NestJS WebSockets)
- **Validation**: class-validator + class-transformer
- **File Upload**: Multer (for CSV imports)
- **QR Generation**: qrcode library
- **Scheduled Tasks**: @nestjs/schedule (for auto-revoke)
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Email**: Nodemailer (optional)
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest

---

# USER ROLES & PERMISSIONS

## 6 User Roles (Enum):
1. **STUDENT** - Can create gate passes, view attendance, set meal preferences
2. **GATEMAN** - Can scan QR codes, verify gate passes, log entries/exits
3. **WARDEN** - Can approve gate passes, manage attendance, create notices
4. **WARDEN_HEAD** - All warden permissions + advanced analytics
5. **CHEF** - Can manage menus, view meal intents, track food waste
6. **SUPER_ADMIN** - Full system access, user management, reports

## Hallticket-First Identity:
- **Primary Key**: Hallticket number (e.g., "HT001", "HT2024CS001")
- No email/username login - only hallticket + password
- Hallticket displayed everywhere in UI (using HallticketChip component)

---

# FRONTEND STRUCTURE (ALREADY COMPLETE)

## 27 Routes Implemented:

### Public (3 routes):
- `/` - Welcome screen
- `/login` - Login with hallticket + password
- `/role-picker` - Select role after login

### Student (7 routes):
- `/student` - Dashboard with stats/charts
- `/student/gate-pass` - List of all gate passes
- `/student/gate-pass/create` - Create new gate pass
- `/student/gate-pass/:id` - View pass details + QR code
- `/student/attendance` - View attendance records
- `/student/meals` - Set meal preferences
- `/student/notices` - View notices

### Gateman (4 routes):
- `/gateman` - Dashboard with gate activity
- `/gateman/queue` - Students waiting for entry
- `/gateman/scan` - QR code scanner
- `/gateman/events` - Entry/exit logs

### Warden (5 routes):
- `/warden` - Dashboard with oversight metrics
- `/warden/approvals` - Approve/reject gate passes
- `/warden/attendance` - Manage attendance sessions
- `/warden/users` - CSV import/export users
- `/warden/notices` - Create/manage notices

### Chef (5 routes):
- `/chef` - Dashboard with meal stats
- `/chef/meals` - Manage daily menus
- `/chef/intents` - View meal intent responses
- `/chef/users` - CSV import/export users
- `/chef/notices` - Create/manage notices

### Admin (3 routes):
- `/admin` - System-wide dashboard
- `/admin/users` - Manage all users
- `/admin/reports` - Generate system reports
- `/admin/notices` - Create/manage notices

---

# DATABASE SCHEMA REQUIREMENTS

## 1. Users Table
```typescript
entity User {
  id: UUID (Primary Key)
  hallticket: string (UNIQUE, indexed)
  password: string (hashed with bcrypt)
  role: UserRole enum
  firstName: string
  lastName: string
  phoneNumber: string (optional)
  email: string (optional, not used for login)
  roomNumber: string (nullable)
  hostelBlock: string (nullable)
  profilePhoto: string (URL, nullable)
  isActive: boolean (default: true)
  createdAt: timestamp
  updatedAt: timestamp
  lastLoginAt: timestamp (nullable)
  
  // Relations:
  gatePasses: GatePass[] (one-to-many)
  attendanceRecords: AttendanceRecord[] (one-to-many)
  mealIntents: MealIntent[] (one-to-many)
  createdNotices: Notice[] (one-to-many)
}
```

## 2. GatePass Table
```typescript
entity GatePass {
  id: UUID (Primary Key)
  passNumber: string (UNIQUE, auto-generated, e.g., "GP2024001")
  studentId: UUID (Foreign Key -> User)
  reason: string
  destination: string
  fromDate: timestamp
  toDate: timestamp
  status: GatePassStatus enum (PENDING, APPROVED, REJECTED, ACTIVE, EXPIRED, REVOKED)
  approvedBy: UUID (Foreign Key -> User, nullable)
  approvedAt: timestamp (nullable)
  rejectedReason: string (nullable)
  qrCode: string (generated after approval)
  adWatchedAt: timestamp (nullable, must watch 20s ad before QR shows)
  lastActivityAt: timestamp (updated on scan)
  autoRevokedAt: timestamp (nullable, after 72h inactivity)
  isEmergency: boolean (default: false)
  createdAt: timestamp
  updatedAt: timestamp
  
  // Relations:
  student: User (many-to-one)
  approver: User (many-to-one, nullable)
  scans: GateScan[] (one-to-many)
}

enum GatePassStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED'
}
```

## 3. GateScan Table
```typescript
entity GateScan {
  id: UUID (Primary Key)
  gatePassId: UUID (Foreign Key -> GatePass)
  scannedBy: UUID (Foreign Key -> User, gateman)
  scanType: ScanType enum (ENTRY, EXIT)
  scannedAt: timestamp
  location: string (gate location)
  notes: string (nullable)
  
  // Relations:
  gatePass: GatePass (many-to-one)
  gateman: User (many-to-one)
}

enum ScanType {
  ENTRY = 'ENTRY',
  EXIT = 'EXIT'
}
```

## 4. AttendanceSession Table
```typescript
entity AttendanceSession {
  id: UUID (Primary Key)
  title: string (e.g., "Morning Assembly", "Dinner Attendance")
  sessionType: string (e.g., "ASSEMBLY", "MEAL", "NIGHT_CHECK")
  scheduledAt: timestamp
  startedAt: timestamp (nullable)
  endedAt: timestamp (nullable)
  status: SessionStatus enum (SCHEDULED, ACTIVE, COMPLETED, CANCELLED)
  mode: AttendanceMode enum (QR, MANUAL, MIXED)
  createdBy: UUID (Foreign Key -> User, warden)
  totalExpected: number (calculated)
  totalPresent: number (calculated)
  totalAbsent: number (calculated)
  qrCode: string (nullable, for QR mode)
  createdAt: timestamp
  
  // Relations:
  creator: User (many-to-one)
  records: AttendanceRecord[] (one-to-many)
}

enum SessionStatus {
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

enum AttendanceMode {
  QR = 'QR',
  MANUAL = 'MANUAL',
  MIXED = 'MIXED'
}
```

## 5. AttendanceRecord Table
```typescript
entity AttendanceRecord {
  id: UUID (Primary Key)
  sessionId: UUID (Foreign Key -> AttendanceSession)
  studentId: UUID (Foreign Key -> User)
  status: AttendanceStatus enum (PRESENT, ABSENT, LATE, EXCUSED)
  markedAt: timestamp (nullable)
  markedBy: UUID (Foreign Key -> User, nullable for QR self-mark)
  method: string (e.g., "QR", "MANUAL", "AUTO")
  notes: string (nullable)
  
  // Relations:
  session: AttendanceSession (many-to-one)
  student: User (many-to-one)
  marker: User (many-to-one, nullable)
}

enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED'
}
```

## 6. MealMenu Table
```typescript
entity MealMenu {
  id: UUID (Primary Key)
  date: date (indexed)
  mealType: MealType enum (BREAKFAST, LUNCH, DINNER, SNACKS)
  items: json (array of menu items, e.g., ["Rice", "Dal", "Sabzi"])
  createdBy: UUID (Foreign Key -> User, chef)
  createdAt: timestamp
  updatedAt: timestamp
  
  // Relations:
  creator: User (many-to-one)
  intents: MealIntent[] (one-to-many)
}

enum MealType {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
  SNACKS = 'SNACKS'
}
```

## 7. MealIntent Table
```typescript
entity MealIntent {
  id: UUID (Primary Key)
  menuId: UUID (Foreign Key -> MealMenu)
  studentId: UUID (Foreign Key -> User)
  intent: MealIntentStatus enum (YES, NO, SAME, NO_RESPONSE)
  respondedAt: timestamp (nullable)
  autoExcluded: boolean (default: false, if student is outside hostel)
  actualAttended: boolean (nullable, marked by chef)
  
  // Relations:
  menu: MealMenu (many-to-one)
  student: User (many-to-one)
}

enum MealIntentStatus {
  YES = 'YES',
  NO = 'NO',
  SAME = 'SAME', // Same as previous meal
  NO_RESPONSE = 'NO_RESPONSE'
}
```

## 8. Notice Table
```typescript
entity Notice {
  id: UUID (Primary Key)
  title: string
  content: text
  category: NoticeCategory enum
  priority: NoticePriority enum (LOW, MEDIUM, HIGH, URGENT)
  isPinned: boolean (default: false)
  targetRoles: UserRole[] (array, e.g., [STUDENT, WARDEN])
  expiresAt: timestamp (nullable)
  createdBy: UUID (Foreign Key -> User)
  createdAt: timestamp
  updatedAt: timestamp
  
  // Relations:
  creator: User (many-to-one)
}

enum NoticeCategory {
  GENERAL = 'GENERAL',
  ACADEMIC = 'ACADEMIC',
  HOSTEL = 'HOSTEL',
  FOOD = 'FOOD',
  EMERGENCY = 'EMERGENCY'
}

enum NoticePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}
```

## 9. SystemReport Table
```typescript
entity SystemReport {
  id: UUID (Primary Key)
  reportType: ReportType enum
  periodStart: date
  periodEnd: date
  generatedBy: UUID (Foreign Key -> User)
  status: ReportStatus enum (GENERATING, COMPLETED, FAILED)
  fileUrl: string (nullable, CSV/PDF download link)
  metadata: json (report-specific data)
  generatedAt: timestamp
  
  // Relations:
  generator: User (many-to-one)
}

enum ReportType {
  GATE_PASS_SUMMARY = 'GATE_PASS_SUMMARY',
  ATTENDANCE_SUMMARY = 'ATTENDANCE_SUMMARY',
  MEAL_SUMMARY = 'MEAL_SUMMARY',
  USER_ACTIVITY = 'USER_ACTIVITY',
  FOOD_WASTE = 'FOOD_WASTE'
}

enum ReportStatus {
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}
```

## 10. PushNotification Table
```typescript
entity PushNotification {
  id: UUID (Primary Key)
  userId: UUID (Foreign Key -> User, nullable for broadcast)
  title: string
  body: string
  data: json (additional payload)
  notificationType: NotificationType enum
  sentAt: timestamp (nullable)
  readAt: timestamp (nullable)
  actionTaken: boolean (default: false)
  
  // Relations:
  user: User (many-to-one, nullable)
}

enum NotificationType {
  GATE_PASS_APPROVED = 'GATE_PASS_APPROVED',
  GATE_PASS_REJECTED = 'GATE_PASS_REJECTED',
  GATE_PASS_EXPIRING = 'GATE_PASS_EXPIRING',
  MEAL_INTENT_REQUEST = 'MEAL_INTENT_REQUEST',
  ATTENDANCE_REMINDER = 'ATTENDANCE_REMINDER',
  NOTICE_POSTED = 'NOTICE_POSTED',
  EMERGENCY_ALERT = 'EMERGENCY_ALERT'
}
```

---

# API ENDPOINTS REQUIRED

## Authentication Module (`/auth`)

### POST /auth/login
**Request:**
```json
{
  "hallticket": "HT001",
  "password": "securepass123"
}
```
**Response:**
```json
{
  "accessToken": "jwt-token-here",
  "refreshToken": "refresh-token-here",
  "user": {
    "id": "uuid",
    "hallticket": "HT001",
    "role": "STUDENT",
    "firstName": "Ravi",
    "lastName": "Kumar"
  }
}
```

### POST /auth/refresh
**Request:**
```json
{
  "refreshToken": "refresh-token-here"
}
```
**Response:**
```json
{
  "accessToken": "new-jwt-token"
}
```

### POST /auth/logout
**Headers:** `Authorization: Bearer {token}`
**Response:**
```json
{
  "message": "Logged out successfully"
}
```

### GET /auth/me
**Headers:** `Authorization: Bearer {token}`
**Response:**
```json
{
  "id": "uuid",
  "hallticket": "HT001",
  "role": "STUDENT",
  "firstName": "Ravi",
  "lastName": "Kumar",
  "profilePhoto": "url"
}
```

---

## Users Module (`/users`)

### GET /users
**Roles:** WARDEN, CHEF, SUPER_ADMIN
**Query Params:** `?role=STUDENT&search=HT001&page=1&limit=20`
**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "hallticket": "HT001",
      "firstName": "Ravi",
      "lastName": "Kumar",
      "role": "STUDENT",
      "roomNumber": "101",
      "isActive": true
    }
  ],
  "total": 150,
  "page": 1,
  "totalPages": 8
}
```

### GET /users/:id
**Roles:** Any authenticated user (own profile) or SUPER_ADMIN
**Response:**
```json
{
  "id": "uuid",
  "hallticket": "HT001",
  "firstName": "Ravi",
  "lastName": "Kumar",
  "role": "STUDENT",
  "phoneNumber": "9876543210",
  "email": "ravi@example.com",
  "roomNumber": "101",
  "hostelBlock": "A-Block",
  "isActive": true,
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### POST /users/bulk-import
**Roles:** WARDEN, CHEF, SUPER_ADMIN
**Content-Type:** `multipart/form-data`
**Request:** CSV file upload
**CSV Format:**
```csv
hallticket,firstName,lastName,role,roomNumber,hostelBlock,phoneNumber
HT001,Ravi,Kumar,STUDENT,101,A-Block,9876543210
HT002,Priya,Sharma,STUDENT,102,A-Block,9876543211
```
**Response:**
```json
{
  "imported": 45,
  "failed": 2,
  "errors": [
    {
      "row": 3,
      "hallticket": "HT003",
      "error": "Duplicate hallticket"
    }
  ]
}
```

### GET /users/export
**Roles:** WARDEN, CHEF, SUPER_ADMIN
**Query Params:** `?role=STUDENT&format=csv`
**Response:** CSV file download

### PUT /users/:id
**Roles:** SUPER_ADMIN (or user updating own profile)
**Request:**
```json
{
  "firstName": "Ravi",
  "lastName": "Kumar",
  "phoneNumber": "9876543210",
  "roomNumber": "101"
}
```

### DELETE /users/:id
**Roles:** SUPER_ADMIN
**Response:**
```json
{
  "message": "User deactivated successfully"
}
```

---

## Gate Pass Module (`/gate-passes`)

### GET /gate-passes
**Roles:** STUDENT (own), GATEMAN, WARDEN, SUPER_ADMIN
**Query Params:** `?status=ACTIVE&studentId=uuid&page=1&limit=20`
**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "passNumber": "GP2024001",
      "student": {
        "hallticket": "HT001",
        "firstName": "Ravi",
        "lastName": "Kumar"
      },
      "reason": "Home visit",
      "destination": "Hyderabad",
      "fromDate": "2024-11-01T10:00:00Z",
      "toDate": "2024-11-03T20:00:00Z",
      "status": "ACTIVE",
      "approvedBy": {
        "hallticket": "WARDEN001",
        "firstName": "Dr. Sharma"
      },
      "approvedAt": "2024-10-31T15:00:00Z",
      "isEmergency": false
    }
  ],
  "total": 25,
  "page": 1
}
```

### GET /gate-passes/:id
**Response:**
```json
{
  "id": "uuid",
  "passNumber": "GP2024001",
  "student": {...},
  "reason": "Home visit",
  "destination": "Hyderabad",
  "fromDate": "2024-11-01T10:00:00Z",
  "toDate": "2024-11-03T20:00:00Z",
  "status": "APPROVED",
  "qrCode": "data:image/png;base64,...",
  "adWatchedAt": null,
  "scans": [
    {
      "scanType": "EXIT",
      "scannedAt": "2024-11-01T10:30:00Z",
      "scannedBy": {...}
    }
  ]
}
```

### POST /gate-passes
**Roles:** STUDENT
**Request:**
```json
{
  "reason": "Home visit",
  "destination": "Hyderabad",
  "fromDate": "2024-11-01T10:00:00Z",
  "toDate": "2024-11-03T20:00:00Z",
  "isEmergency": false
}
```
**Response:**
```json
{
  "id": "uuid",
  "passNumber": "GP2024001",
  "status": "PENDING",
  "message": "Gate pass created and sent for approval"
}
```

### PUT /gate-passes/:id/approve
**Roles:** WARDEN, WARDEN_HEAD
**Request:**
```json
{
  "notes": "Approved for family event"
}
```
**Response:**
```json
{
  "id": "uuid",
  "status": "APPROVED",
  "qrCode": "data:image/png;base64,...",
  "approvedAt": "2024-10-31T15:00:00Z"
}
```
**Side Effect:** Send push notification to student

### PUT /gate-passes/:id/reject
**Roles:** WARDEN, WARDEN_HEAD
**Request:**
```json
{
  "reason": "Insufficient reason provided"
}
```

### PUT /gate-passes/:id/watch-ad
**Roles:** STUDENT (own gate pass)
**Request:**
```json
{
  "watchedDuration": 20
}
```
**Response:**
```json
{
  "adWatchedAt": "2024-11-01T09:00:00Z",
  "qrCodeUnlocked": true
}
```

### PUT /gate-passes/:id/revoke
**Roles:** WARDEN, SUPER_ADMIN
**Request:**
```json
{
  "reason": "Violation of hostel rules"
}
```

---

## Gate Scan Module (`/gate-scans`)

### POST /gate-scans
**Roles:** GATEMAN
**Request:**
```json
{
  "gatePassId": "uuid",
  "scanType": "ENTRY",
  "location": "Main Gate"
}
```
**Response:**
```json
{
  "id": "uuid",
  "gatePass": {...},
  "student": {...},
  "scanType": "ENTRY",
  "scannedAt": "2024-11-01T10:30:00Z",
  "valid": true
}
```
**Side Effect:** Update `lastActivityAt` on gate pass, emit Socket event

### GET /gate-scans
**Roles:** GATEMAN, WARDEN, SUPER_ADMIN
**Query Params:** `?scanType=ENTRY&date=2024-11-01&page=1`
**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "gatePass": {...},
      "student": {...},
      "scanType": "ENTRY",
      "scannedAt": "2024-11-01T10:30:00Z",
      "scannedBy": {...}
    }
  ],
  "total": 50
}
```

### GET /gate-scans/queue
**Roles:** GATEMAN
**Response:**
```json
{
  "data": [
    {
      "student": {...},
      "gatePass": {...},
      "queuedAt": "2024-11-01T10:25:00Z",
      "status": "WAITING"
    }
  ]
}
```

---

## Attendance Module (`/attendance`)

### POST /attendance/sessions
**Roles:** WARDEN, WARDEN_HEAD
**Request:**
```json
{
  "title": "Morning Assembly",
  "sessionType": "ASSEMBLY",
  "scheduledAt": "2024-11-01T07:00:00Z",
  "mode": "QR"
}
```
**Response:**
```json
{
  "id": "uuid",
  "title": "Morning Assembly",
  "status": "SCHEDULED",
  "qrCode": "data:image/png;base64,...",
  "scheduledAt": "2024-11-01T07:00:00Z"
}
```

### GET /attendance/sessions
**Query Params:** `?status=ACTIVE&date=2024-11-01`
**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Morning Assembly",
      "status": "ACTIVE",
      "totalPresent": 145,
      "totalExpected": 200,
      "startedAt": "2024-11-01T07:00:00Z"
    }
  ]
}
```

### GET /attendance/sessions/:id
**Response:**
```json
{
  "id": "uuid",
  "title": "Morning Assembly",
  "status": "ACTIVE",
  "mode": "QR",
  "qrCode": "data:image/png;base64,...",
  "records": [
    {
      "student": {...},
      "status": "PRESENT",
      "markedAt": "2024-11-01T07:05:00Z"
    }
  ]
}
```

### PUT /attendance/sessions/:id/start
**Roles:** WARDEN
**Response:**
```json
{
  "id": "uuid",
  "status": "ACTIVE",
  "startedAt": "2024-11-01T07:00:00Z"
}
```

### PUT /attendance/sessions/:id/end
**Roles:** WARDEN
**Response:**
```json
{
  "id": "uuid",
  "status": "COMPLETED",
  "endedAt": "2024-11-01T07:30:00Z",
  "summary": {
    "totalPresent": 185,
    "totalAbsent": 15,
    "attendanceRate": 92.5
  }
}
```

### POST /attendance/mark
**Roles:** STUDENT (QR self-mark), WARDEN (manual mark)
**Request (QR):**
```json
{
  "sessionId": "uuid",
  "method": "QR"
}
```
**Request (Manual):**
```json
{
  "sessionId": "uuid",
  "studentId": "uuid",
  "status": "PRESENT",
  "method": "MANUAL"
}
```

### GET /attendance/my-records
**Roles:** STUDENT
**Query Params:** `?fromDate=2024-10-01&toDate=2024-10-31`
**Response:**
```json
{
  "data": [
    {
      "session": {...},
      "status": "PRESENT",
      "markedAt": "2024-11-01T07:05:00Z"
    }
  ],
  "summary": {
    "totalSessions": 30,
    "present": 28,
    "absent": 2,
    "attendanceRate": 93.3
  }
}
```

### GET /attendance/export
**Roles:** WARDEN, SUPER_ADMIN
**Query Params:** `?sessionId=uuid&format=csv`
**Response:** CSV file download

---

## Meals Module (`/meals`)

### POST /meals/menus
**Roles:** CHEF
**Request:**
```json
{
  "date": "2024-11-01",
  "mealType": "LUNCH",
  "items": ["Rice", "Dal", "Paneer Curry", "Roti", "Salad"]
}
```

### GET /meals/menus
**Query Params:** `?date=2024-11-01&mealType=LUNCH`
**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "date": "2024-11-01",
      "mealType": "LUNCH",
      "items": ["Rice", "Dal", "Paneer Curry", "Roti", "Salad"],
      "totalIntents": 180,
      "yesCount": 150,
      "noCount": 20,
      "sameCount": 10
    }
  ]
}
```

### POST /meals/intents
**Roles:** STUDENT
**Request:**
```json
{
  "menuId": "uuid",
  "intent": "YES"
}
```
**Response:**
```json
{
  "id": "uuid",
  "intent": "YES",
  "respondedAt": "2024-10-31T20:00:00Z"
}
```

### GET /meals/intents/summary
**Roles:** CHEF
**Query Params:** `?date=2024-11-01&mealType=LUNCH`
**Response:**
```json
{
  "menuId": "uuid",
  "date": "2024-11-01",
  "mealType": "LUNCH",
  "totalStudents": 200,
  "responses": {
    "yes": 150,
    "no": 20,
    "same": 10,
    "noResponse": 20
  },
  "responseRate": 90.0,
  "estimatedWaste": 5.2
}
```

### GET /meals/my-intents
**Roles:** STUDENT
**Query Params:** `?fromDate=2024-10-01&toDate=2024-10-31`
**Response:**
```json
{
  "data": [
    {
      "menu": {...},
      "intent": "YES",
      "respondedAt": "2024-10-31T20:00:00Z"
    }
  ]
}
```

---

## Notices Module (`/notices`)

### GET /notices
**Query Params:** `?category=HOSTEL&isPinned=true`
**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Hostel Inspection Tomorrow",
      "content": "All students must keep rooms clean...",
      "category": "HOSTEL",
      "priority": "HIGH",
      "isPinned": true,
      "createdBy": {...},
      "createdAt": "2024-10-30T10:00:00Z"
    }
  ]
}
```

### POST /notices
**Roles:** WARDEN, CHEF, SUPER_ADMIN
**Request:**
```json
{
  "title": "Hostel Inspection Tomorrow",
  "content": "All students must keep rooms clean...",
  "category": "HOSTEL",
  "priority": "HIGH",
  "isPinned": true,
  "targetRoles": ["STUDENT"],
  "expiresAt": "2024-11-05T23:59:59Z"
}
```
**Side Effect:** Send push notifications to target roles

### PUT /notices/:id
**Roles:** Creator or SUPER_ADMIN
**Request:**
```json
{
  "title": "Updated Title",
  "isPinned": false
}
```

### DELETE /notices/:id
**Roles:** Creator or SUPER_ADMIN

---

## Reports Module (`/reports`)

### POST /reports/generate
**Roles:** SUPER_ADMIN
**Request:**
```json
{
  "reportType": "GATE_PASS_SUMMARY",
  "periodStart": "2024-10-01",
  "periodEnd": "2024-10-31",
  "format": "CSV"
}
```
**Response:**
```json
{
  "id": "uuid",
  "reportType": "GATE_PASS_SUMMARY",
  "status": "GENERATING",
  "message": "Report generation started"
}
```
**Side Effect:** Generate report asynchronously

### GET /reports
**Roles:** SUPER_ADMIN
**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "reportType": "GATE_PASS_SUMMARY",
      "periodStart": "2024-10-01",
      "periodEnd": "2024-10-31",
      "status": "COMPLETED",
      "fileUrl": "https://storage.../report.csv",
      "generatedAt": "2024-11-01T08:00:00Z"
    }
  ]
}
```

### GET /reports/:id/download
**Roles:** SUPER_ADMIN
**Response:** File download (CSV/PDF)

---

## Analytics Module (`/analytics`)

### GET /analytics/dashboard
**Roles:** All (role-specific data)
**Query Params:** `?period=WEEK`
**Response (Student):**
```json
{
  "gatePassStats": {
    "total": 5,
    "active": 1,
    "pending": 0,
    "approved": 4
  },
  "attendanceStats": {
    "attendanceRate": 95.5,
    "presentDays": 21,
    "totalDays": 22
  },
  "mealStats": {
    "responseRate": 90.0,
    "yesCount": 18,
    "noCount": 2
  }
}
```

**Response (Warden):**
```json
{
  "pendingApprovals": 15,
  "activeGatePasses": 45,
  "todayAttendance": 185,
  "attendanceRate": 92.5,
  "charts": [
    {
      "type": "LINE",
      "title": "Daily Attendance Trend",
      "data": [...]
    }
  ]
}
```

### GET /analytics/charts/:chartType
**Query Params:** `?period=MONTH&role=STUDENT`

---

# SOCKET.IO REAL-TIME EVENTS

## Events to Emit (Server -> Client):

### 1. `gate-pass:created`
```json
{
  "gatePass": {...},
  "student": {...}
}
```
**Recipients:** Wardens (for approval queue)

### 2. `gate-pass:approved`
```json
{
  "gatePass": {...},
  "approvedBy": {...}
}
```
**Recipients:** Student who created the pass

### 3. `gate-pass:rejected`
```json
{
  "gatePass": {...},
  "rejectedBy": {...},
  "reason": "..."
}
```
**Recipients:** Student who created the pass

### 4. `gate-pass:scanned`
```json
{
  "scan": {...},
  "gatePass": {...},
  "student": {...}
}
```
**Recipients:** Wardens, Student

### 5. `attendance:session-started`
```json
{
  "session": {...}
}
```
**Recipients:** All students

### 6. `attendance:marked`
```json
{
  "record": {...},
  "session": {...}
}
```
**Recipients:** Warden who created session

### 7. `meal-intent:requested`
```json
{
  "menu": {...},
  "deadline": "2024-10-31T20:00:00Z"
}
```
**Recipients:** All students (via push notification)

### 8. `notice:created`
```json
{
  "notice": {...}
}
```
**Recipients:** Users in targetRoles array

### 9. `user:status-changed`
```json
{
  "userId": "uuid",
  "isActive": false
}
```
**Recipients:** Admins

---

# BUSINESS LOGIC RULES

## Gate Pass Rules:

1. **Auto-Revoke After 72h Inactivity:**
   - Use @nestjs/schedule to run cron job every hour
   - Check gate passes where `lastActivityAt` > 72 hours ago
   - Change status to REVOKED
   - Send notification to student

2. **Ad Gate Enforcement:**
   - QR code MUST NOT be visible until `adWatchedAt` is set
   - Frontend shows 20-second ad, then calls `/gate-passes/:id/watch-ad`
   - Only after this endpoint succeeds, show QR code

3. **Emergency Passes:**
   - `isEmergency: true` passes are auto-approved
   - Send immediate notification to warden

4. **Expiration:**
   - Gate passes where `toDate < now` should have status = EXPIRED
   - Run cron job to update expired passes

## Attendance Rules:

1. **One-Tap Session Creation:**
   - Warden clicks "Start Session" -> immediately creates session with status ACTIVE
   - QR code generated if mode is QR
   - All students get notification

2. **Blueprint Planner (UI Ready):**
   - Frontend has UI for recurring schedules
   - Backend should support creating multiple sessions from blueprint
   - Store blueprint as json in session metadata

3. **Mixed Mode:**
   - Some students can scan QR (self-mark)
   - Warden can manually mark others

## Meal Intent Rules:

1. **Daily Notifications:**
   - Cron job at 6 PM daily
   - Send push notifications to all active students
   - Quick-reply options: YES, NO, SAME (as yesterday)

2. **Auto-Exclude:**
   - If student has active gate pass (outside hostel), set `autoExcluded: true`
   - Don't send notification

3. **Food Waste Calculation:**
   - Track `actualAttended` vs `intent: YES`
   - Calculate waste percentage

## CSV Import Rules:

1. **Validation:**
   - Hallticket must be unique
   - Role must be valid enum value
   - Phone number format validation

2. **Error Handling:**
   - Return array of errors with row numbers
   - Don't rollback entire import if some rows fail
   - Import successful rows, report failed rows

---

# SCHEDULED TASKS (@nestjs/schedule)

## Cron Jobs Needed:

### 1. Auto-Revoke Gate Passes (Every hour)
```typescript
@Cron('0 * * * *') // Every hour
async autoRevokeGatePasses() {
  // Find gate passes where lastActivityAt > 72h and status = ACTIVE
  // Update status to REVOKED
  // Send notifications
}
```

### 2. Expire Old Gate Passes (Daily at midnight)
```typescript
@Cron('0 0 * * *') // Daily at midnight
async expireGatePasses() {
  // Find gate passes where toDate < now and status != EXPIRED
  // Update status to EXPIRED
}
```

### 3. Send Meal Intent Notifications (Daily at 6 PM)
```typescript
@Cron('0 18 * * *') // Daily at 6 PM
async sendMealIntentNotifications() {
  // Get tomorrow's breakfast menu
  // Find all active students
  // Exclude students with active gate passes
  // Send push notifications
}
```

### 4. Generate Daily Reports (Daily at 7 AM)
```typescript
@Cron('0 7 * * *') // Daily at 7 AM
async generateDailyReports() {
  // Generate attendance summary for yesterday
  // Generate meal intent summary
  // Store in SystemReport table
}
```

---

# PUSH NOTIFICATIONS (FCM)

## Implementation:

1. **User FCM Tokens:**
   - Add `fcmToken` field to User entity
   - Update token on login (mobile app sends token)

2. **Send Notifications:**
   - Use `@google-cloud/firestore-admin` or `firebase-admin`
   - Send to individual users or broadcast to role

3. **Quick-Reply Actions (Meal Intents):**
   - Include action buttons in notification payload
   - Handle quick-reply responses via API endpoint

---

# VALIDATION & SECURITY

## Request Validation:
- Use `class-validator` decorators on all DTOs
- Use `ValidationPipe` globally

## Authentication:
- JWT strategy with Passport
- Access tokens (15 min expiry)
- Refresh tokens (7 days expiry)

## Authorization:
- Role-based guards using `@Roles()` decorator
- Custom `RolesGuard` checking user role

## Password Security:
- Hash passwords with bcrypt (10 rounds)
- Never return passwords in responses

## Rate Limiting:
- Use `@nestjs/throttler`
- Limit login attempts (5 per minute)

---

# FILE STRUCTURE (Backend)

```
src/
├── main.ts
├── app.module.ts
├── config/
│   ├── database.config.ts
│   ├── jwt.config.ts
│   └── firebase.config.ts
├── common/
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   └── current-user.decorator.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── interceptors/
│   │   └── transform.interceptor.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── pipes/
│       └── validation.pipe.ts
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── local.strategy.ts
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       └── register.dto.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   └── dto/
│   │       ├── create-user.dto.ts
│   │       └── update-user.dto.ts
│   ├── gate-passes/
│   │   ├── gate-passes.module.ts
│   │   ├── gate-passes.controller.ts
│   │   ├── gate-passes.service.ts
│   │   ├── entities/
│   │   │   └── gate-pass.entity.ts
│   │   └── dto/
│   ├── gate-scans/
│   ├── attendance/
│   ├── meals/
│   ├── notices/
│   ├── reports/
│   ├── analytics/
│   └── notifications/
├── websockets/
│   ├── events.gateway.ts
│   └── events.service.ts
└── tasks/
    └── scheduled-tasks.service.ts
```

---

# IMPLEMENTATION STEPS (In Order)

## Phase 1: Project Setup (Day 1)
1. Initialize NestJS project: `nest new hostelconnect-api`
2. Install dependencies:
   ```bash
   npm install @nestjs/typeorm typeorm pg
   npm install @nestjs/passport passport passport-jwt
   npm install @nestjs/jwt bcrypt
   npm install @nestjs/websockets @nestjs/platform-socket.io
   npm install @nestjs/schedule
   npm install class-validator class-transformer
   npm install qrcode
   npm install firebase-admin
   ```
3. Set up PostgreSQL database
4. Configure TypeORM in `app.module.ts`
5. Set up environment variables (`.env`)

## Phase 2: Auth Module (Day 2)
1. Create User entity with hallticket as unique field
2. Implement AuthModule with JWT strategy
3. Implement login endpoint (hallticket + password)
4. Implement refresh token logic
5. Create RolesGuard for authorization
6. Test authentication flow

## Phase 3: Users Module (Day 3)
1. Create UsersModule, controller, service
2. Implement CRUD endpoints
3. Implement CSV bulk import endpoint
4. Implement CSV export endpoint
5. Add validation for hallticket uniqueness
6. Test all user endpoints

## Phase 4: Gate Pass Module (Day 4-5)
1. Create GatePass entity
2. Implement gate pass CRUD
3. Implement approve/reject endpoints
4. Implement QR code generation (after approval)
5. Implement ad-watch endpoint
6. Add auto-revoke cron job (72h inactivity)
7. Add expiration cron job
8. Test all gate pass flows

## Phase 5: Gate Scan Module (Day 6)
1. Create GateScan entity
2. Implement scan endpoint (validate QR, log entry/exit)
3. Implement queue endpoint for gateman
4. Update lastActivityAt on gate pass when scanned
5. Emit Socket.IO events on scan
6. Test QR scanning flow

## Phase 6: Attendance Module (Day 7-8)
1. Create AttendanceSession entity
2. Create AttendanceRecord entity
3. Implement session CRUD
4. Implement one-tap session start
5. Implement QR code generation for sessions
6. Implement mark attendance endpoint (QR + manual)
7. Implement student attendance records endpoint
8. Implement CSV export for attendance
9. Test all attendance flows

## Phase 7: Meals Module (Day 9-10)
1. Create MealMenu entity
2. Create MealIntent entity
3. Implement menu CRUD
4. Implement intent submission endpoint
5. Implement intent summary for chef
6. Add daily notification cron job (6 PM)
7. Implement auto-exclude logic (students outside hostel)
8. Test meal intent flow

## Phase 8: Notices Module (Day 11)
1. Create Notice entity
2. Implement notice CRUD
3. Add role-based filtering
4. Emit Socket.IO events when notice created
5. Send push notifications to target roles
6. Test notice creation and delivery

## Phase 9: Reports Module (Day 12)
1. Create SystemReport entity
2. Implement report generation endpoint (async)
3. Implement report download endpoint
4. Generate CSV/PDF reports for different types
5. Add daily report generation cron job
6. Test report generation

## Phase 10: Analytics Module (Day 13)
1. Create analytics service
2. Implement dashboard stats endpoint (role-specific)
3. Implement chart data endpoints
4. Aggregate data from different modules
5. Test analytics for all roles

## Phase 11: WebSockets (Day 14)
1. Create EventsGateway
2. Implement Socket.IO connection handling
3. Implement room-based broadcasting (by role)
4. Emit events for gate pass actions
5. Emit events for attendance updates
6. Emit events for notices
7. Test real-time updates on frontend

## Phase 12: Push Notifications (Day 15)
1. Set up Firebase Admin SDK
2. Add FCM token field to User entity
3. Implement notification service
4. Send notifications for gate pass approval/rejection
5. Send meal intent notifications with quick-reply
6. Test push notifications on mobile

## Phase 13: Testing & Documentation (Day 16-17)
1. Write unit tests for critical services
2. Write e2e tests for main flows
3. Set up Swagger/OpenAPI documentation
4. Test all API endpoints with Postman/Insomnia
5. Load testing with k6 or Artillery

## Phase 14: Deployment (Day 18)
1. Set up Docker containers
2. Configure production database
3. Set up environment variables for production
4. Deploy to cloud (AWS/GCP/Heroku)
5. Set up SSL certificates
6. Configure CORS for frontend domain
7. Set up monitoring (Sentry, LogRocket)

---

# ENVIRONMENT VARIABLES (.env)

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=hostelconnect

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d

# App
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Firebase (for push notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key

# File Upload
MAX_FILE_SIZE=5242880 # 5MB in bytes
UPLOAD_DIR=./uploads

# Cron Jobs
ENABLE_CRON_JOBS=true
```

---

# TESTING CHECKLIST

## Auth:
- [ ] Login with hallticket + password
- [ ] Login with wrong credentials fails
- [ ] Refresh token works
- [ ] Logout invalidates token
- [ ] Protected routes require token

## Gate Pass:
- [ ] Student can create gate pass
- [ ] Warden sees pending approvals
- [ ] Warden can approve gate pass
- [ ] QR code generated after approval
- [ ] Ad must be watched before QR shows
- [ ] Gateman can scan QR code
- [ ] Gate pass auto-revokes after 72h
- [ ] Gate pass expires after toDate

## Attendance:
- [ ] Warden can create session
- [ ] Students see active sessions
- [ ] Students can mark attendance via QR
- [ ] Warden can manually mark attendance
- [ ] Attendance records are accurate
- [ ] CSV export works

## Meals:
- [ ] Chef can create menu
- [ ] Students receive meal intent notification
- [ ] Students can respond YES/NO/SAME
- [ ] Chef sees intent summary
- [ ] Students outside hostel are auto-excluded

## Notices:
- [ ] Authorized users can create notices
- [ ] Notices appear for target roles
- [ ] Pinned notices appear first
- [ ] Push notifications sent

## Real-time:
- [ ] Socket.IO connection established
- [ ] Events received in real-time on frontend
- [ ] Multiple clients receive broadcasts

---

# SUCCESS CRITERIA

Your backend is complete when:

✅ All 50+ API endpoints work correctly
✅ All database entities created with proper relations
✅ JWT authentication working
✅ Role-based authorization working
✅ Socket.IO real-time updates working
✅ All cron jobs executing on schedule
✅ CSV import/export working
✅ QR code generation working
✅ Push notifications working
✅ Swagger documentation generated
✅ All business logic rules implemented
✅ Frontend can connect and display real data
✅ No mock data needed on frontend
✅ All 27 frontend routes show live data

---

# ADDITIONAL NOTES

1. **TypeScript Strict Mode:**
   - Enable strict mode in `tsconfig.json`
   - No `any` types

2. **Error Handling:**
   - Use custom exceptions
   - Return proper HTTP status codes
   - Include helpful error messages

3. **Logging:**
   - Use NestJS Logger
   - Log all important actions
   - Log errors with stack traces

4. **Performance:**
   - Use database indexes on frequently queried fields (hallticket, status, dates)
   - Implement pagination for all list endpoints
   - Use caching for analytics data (Redis optional)

5. **Code Quality:**
   - Follow NestJS best practices
   - Use dependency injection
   - Keep controllers thin, services fat
   - Write reusable services

---

# FINAL FRONTEND INTEGRATION

Once backend is complete, update frontend:

1. Create `/lib/api.ts` with all API client functions
2. Create `/lib/socket.ts` for Socket.IO client
3. Replace all imports from `/lib/mockData.ts` with API calls
4. Update `/lib/context.tsx` to use real auth endpoints
5. Add loading/error states for async operations
6. Add retry logic for failed requests
7. Test all 27 routes with real data

---

# YOU ARE READY TO BUILD!

This prompt contains everything needed to build the complete NestJS backend for HostelConnect. Follow the implementation steps in order, and you'll have a production-ready API in ~18 days.

**Start with Phase 1: Project Setup** and work through each phase systematically.

Good luck! 🚀
