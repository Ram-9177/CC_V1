# Gate Pass Workflow - Visual Guide

## Application Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                   GATE PASS REQUEST FLOW                        │
└─────────────────────────────────────────────────────────────────┘

STUDENT                    WARDEN/HEADWARDEN          SECURITY
  │                              │                        │
  │  1. Create Pass              │                        │
  ├─────────────────────────────►│                        │
  │  (Status: pending)            │                        │
  │                              │                        │
  │                         2. Review & Call Parent      │
  │                              │                        │
  │                         3. Approve/Reject           │
  │◄─────────────────────────────┤                        │
  │ (Status: approved/rejected)   │                        │
  │                              │                        │
  │  4. Show QR Code              │                        │
  ├──────────────────────────────────────────────────────►│
  │  (at gate)                    │                        │
  │                              │            5. Verify Check-In
  │                              │                        │
  │                              │◄───────────────────────┤
  │                              │   (Status: used/transit)
  │                              │                        │
  │◄─────────────────────────────┴───────────────────────┤
  │ (Real-time update via WebSocket)                      │
  │
  └─ Returns to hostel
       │
       ├─► Security logs Check-Out
       │
       └─ Status: completed ✓
```

---

## Role-Based Access Control

```
┌──────────────────────────────────────────────────────────────────┐
│                        ROLE PERMISSIONS                          │
├──────────────────┬──────────┬────────┬────────┬──────────┬────────┤
│    ACTION        │ STUDENT  │ WARDEN │ HEAD   │ ADMIN    │SECURITY│
│                  │          │        │WARDEN │          │        │
├──────────────────┼──────────┼────────┼────────┼──────────┼────────┤
│ Create Pass      │    ✅    │   ❌   │   ❌   │    ✅    │   ❌   │
│ (Own Only)       │          │        │        │          │        │
├──────────────────┼──────────┼────────┼────────┼──────────┼────────┤
│ View Passes      │  Own     │Building│ All    │   All    │  All   │
│                  │  Only    │ Only   │        │          │        │
├──────────────────┼──────────┼────────┼────────┼──────────┼────────┤
│ Approve Pass     │    ❌    │   ✅   │   ✅   │    ✅    │   ❌   │
│ (After Parent OK)│          │        │        │          │        │
├──────────────────┼──────────┼────────┼────────┼──────────┼────────┤
│ Reject Pass      │    ❌    │   ✅   │   ✅   │    ✅    │   ❌   │
├──────────────────┼──────────┼────────┼────────┼──────────┼────────┤
│ Verify at Gate   │    ❌    │   ❌   │   ❌   │    ✅    │   ✅   │
│ (Check-In/Out)   │          │        │        │          │        │
├──────────────────┼──────────┼────────┼────────┼──────────┼────────┤
│ Show QR Code     │  Own     │   ❌   │   ❌   │    ❌    │   ❌   │
│ (Approved Only)  │Approved  │        │        │          │        │
├──────────────────┼──────────┼────────┼────────┼──────────┼────────┤
│ Call Parent      │    ❌    │   ✅   │   ✅   │    ✅    │   ❌   │
│ (Mark Informed)  │          │        │        │          │        │
└──────────────────┴──────────┴────────┴────────┴──────────┴────────┘
```

---

## Backend Filtering

```
┌─────────────────────────────────────────────────────────────────┐
│              QUERYSET FILTERING BY ROLE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GET /api/gate-passes/                                         │
│  ↓                                                              │
│  Role Check:                                                   │
│  ├─ Admin/Super Admin/Security/Head Security                  │
│  │  └─► Returns: ALL gate passes                              │
│  │                                                             │
│  ├─ Warden                                                    │
│  │  └─► Returns: Passes from MY BUILDING ONLY                │
│  │      (filtered by warden's building assignment)           │
│  │                                                             │
│  └─ Student                                                  │
│     └─► Returns: MY OWN PASSES ONLY                          │
│         (filtered by student_id = current_user.id)           │
│                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Permission Enforcement Points

```
┌──────────────────────────────────────────────────────────────┐
│            BACKEND PERMISSION CHECKS                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  CREATE Gate Pass                                           │
│  ├─ Permission: [IsAuthenticated()]                         │
│  └─ Check: Students can only create for themselves         │
│     if student_id != current_user.id:                       │
│         raise PermissionError                              │
│                                                              │
│  APPROVE Gate Pass                                          │
│  ├─ Permission: [IsAuthenticated(), IsAdmin | IsWarden]    │
│  └─ Check: Only staff can approve                          │
│     if user.role not in STAFF_ROLES:                       │
│         raise PermissionError                              │
│                                                              │
│  VERIFY Gate Pass                                           │
│  ├─ Permission: [IsAuthenticated(), IsGateSecurity | ...]  │
│  └─ Check: Only security can verify                        │
│     if user.role not in SECURITY_ROLES:                    │
│         raise PermissionError                              │
│                                                              │
│  LIST Gate Passes                                           │
│  ├─ Permission: [IsAuthenticated()]                         │
│  └─ Check: Filter queryset by role                         │
│     - Admin sees all                                        │
│     - Warden sees building only                            │
│     - Student sees own only                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Isolation Example

```
┌─────────────────────────────────────────────────────────────────┐
│         BUILDING-LEVEL ISOLATION FOR WARDENS                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Database: GatePass records from 3 buildings                   │
│  ├─ Building A: Student 1, Student 2, Student 3               │
│  ├─ Building B: Student 4, Student 5                          │
│  └─ Building C: Student 6, Student 7, Student 8               │
│                                                                 │
│  Warden assigned to Building A queries:                        │
│  GET /api/gate-passes/                                        │
│  ↓                                                              │
│  Backend checks warden's building assignment                   │
│  ↓                                                              │
│  Filters query:                                                │
│  WHERE student.room_allocations.room.building_id = A           │
│  AND student.room_allocations.end_date IS NULL                │
│  ↓                                                              │
│  Returns: Student 1, 2, 3 passes ONLY                          │
│  ├─ Cannot see Building B students                            │
│  ├─ Cannot see Building C students                            │
│  └─ Cannot see students who moved/graduated                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Real-Time Updates Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│         WEBSOCKET BROADCAST TO MULTIPLE ROLES                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Student creates gate pass                                     │
│       ↓                                                          │
│  API saves GatePass(status='pending')                          │
│       ↓                                                          │
│  Broadcast event triggered:                                    │
│  {                                                              │
│      type: 'gatepass_created',                                 │
│      id: 123,                                                   │
│      status: 'pending',                                         │
│      student_id: 456                                            │
│  }                                                              │
│       ├─► Send to Student 456 (owner)                          │
│       │   └─ Student sees new pass in real-time               │
│       │                                                         │
│       └─► Send to role_warden group                           │
│           ├─ All wardens in role group receive update         │
│           ├─ Wardens' building filter shows it                │
│           └─ They see pending pass without refresh            │
│                                                                 │
│  Warden approves pass                                          │
│       ↓                                                          │
│  API saves GatePass(status='approved', approved_by=warden)    │
│       ↓                                                          │
│  Broadcast event:                                              │
│  {                                                              │
│      type: 'gatepass_approved',                                │
│      id: 123,                                                   │
│      status: 'approved'                                         │
│  }                                                              │
│       ├─► Send to Student 456                                  │
│       │   └─ Student sees approval in real-time               │
│       │                                                         │
│       └─► Send to role_warden + role_admin groups            │
│           └─ All authorities see status change               │
│                                                                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## Frontend UI Flow

```
┌──────────────────────────────────────────────────────────────────┐
│            CONDITIONAL UI RENDERING BY ROLE                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  const isAuthority = ['warden', 'head_warden', ...].includes()  │
│  const isSecurity = ['gate_security', ...].includes()           │
│  const canCreate = user?.role === 'student'                    │
│                                                                  │
│  STUDENT VIEWS:                                                 │
│  {canCreate && (                                                │
│    <Button>Create Pass</Button>      ✓ Visible                │
│  )}                                                             │
│                                                                  │
│  {gatePass.status === 'approved' && !isAuthority && (           │
│    <Button>Show QR Code</Button>     ✓ Visible only when      │
│  )}                                                             │ approved
│                                                                  │
│  {isAuthority && gatePass.status === 'pending' && (            │
│    <Button>Approve</Button>          ✓ Hidden (not authority) │
│  )}                                                             │
│                                                                  │
│                                                                  │
│  WARDEN/HEADWARDEN VIEWS:                                       │
│  {canCreate && (                                                │
│    <Button>Create Pass</Button>      ✗ Hidden (not student)   │
│  )}                                                             │
│                                                                  │
│  {isAuthority && gatePass.status === 'pending' && (            │
│    <>                                                           │
│      <Button>Call Parent</Button>    ✓ Visible                │
│      <Button>Approve</Button>        ✓ Visible                │
│      <Button>Reject</Button>         ✓ Visible                │
│    </>                                                          │
│  )}                                                             │
│                                                                  │
│                                                                  │
│  SECURITY VIEWS:                                                │
│  {isSecurity && gatePass.status === 'approved' && (            │
│    <Button>Check In</Button>         ✓ Visible                │
│  )}                                                             │
│                                                                  │
│  {isAuthority && gatePass.status === 'pending' && (            │
│    <Button>Approve</Button>          ✗ Hidden (not authority) │
│  )}                                                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Complete Test Path

```
┌──────────────────────────────────────────────────────────────────┐
│          RECOMMENDED TESTING ORDER                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. TEST: Student Creates Pass                                 │
│     └─ Verify: Status = pending, appears in own list          │
│                                                                  │
│  2. TEST: Student Cannot See Other Student's Pass              │
│     └─ Verify: Other pass not visible, API returns 403        │
│                                                                  │
│  3. TEST: Warden Views Pending (Building-Filtered)             │
│     └─ Verify: Sees only building students, not others        │
│                                                                  │
│  4. TEST: Warden Calls Parent                                  │
│     └─ Verify: Phone options shown, marked as informed        │
│                                                                  │
│  5. TEST: Warden Approves Pass                                 │
│     └─ Verify: Status → approved, student notified real-time  │
│                                                                  │
│  6. TEST: Student Sees QR Code                                 │
│     └─ Verify: QR visible for approved pass only              │
│                                                                  │
│  7. TEST: Security Verifies Pass                               │
│     └─ Verify: Check-in recorded, status → used              │
│                                                                  │
│  8. TEST: Head Warden Sees All Buildings                       │
│     └─ Verify: Can view all passes regardless of building     │
│                                                                  │
│  9. TEST: WebSocket Real-Time Updates                          │
│     └─ Verify: Two clients see updates without refresh        │
│                                                                  │
│  10. TEST: Audit Logs                                          │
│      └─ Verify: All actions logged with user/timestamp        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Summary

✅ **Gate Pass RBAC System Features:**
- Role-based view filtering (what you can see)
- Permission-based action control (what you can do)  
- Building-level isolation for Wardens
- Real-time WebSocket updates across roles
- Complete audit trail of all actions
- Student ownership enforcement
- Security verification workflow
- Parent notification protocol

**Status: ✅ FULLY IMPLEMENTED AND READY FOR TESTING**

