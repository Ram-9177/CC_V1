# Gate Pass RBAC Testing Checklist ✓

**Last Updated:** February 16, 2025  
**Status:** ✅ READY FOR TESTING

---

## Quick Start Testing

### Prerequisites
- [ ] Backend running: `python manage.py runserver` (port 8000)
- [ ] Frontend running: `npm run dev` (port 5173)
- [ ] Test users created in database (see below)
- [ ] Postman/curl or browser DevTools ready

### Create Test Users
```bash
cd backend_django
python manage.py shell
```

```python
from apps.auth.models import User
from apps.rooms.models import Building, Room, RoomAllocation
from django.utils import timezone

# Create buildings first
building_a = Building.objects.create(name="Block A")
building_b = Building.objects.create(name="Block B")

# Create rooms
room_a1 = Room.objects.create(building=building_a, number="A101", capacity=2)
room_b1 = Room.objects.create(building=building_b, number="B101", capacity=2)

# Create Student Users
student1 = User.objects.create_user(
    email='student1@test.com',
    password='test123456',
    name='Raj Kumar',
    role='student'
)

student2 = User.objects.create_user(
    email='student2@test.com',
    password='test123456',
    name='Priya Singh',
    role='student'
)

# Assign students to rooms (different buildings)
RoomAllocation.objects.create(
    student=student1,
    room=room_a1,
    start_date=timezone.now()
)

RoomAllocation.objects.create(
    student=student2,
    room=room_b1,
    start_date=timezone.now()
)

# Create Warden for Building A
warden_a = User.objects.create_user(
    email='warden_a@test.com',
    password='test123456',
    name='Warden Block A',
    role='warden'
)

# Create Warden for Building B
warden_b = User.objects.create_user(
    email='warden_b@test.com',
    password='test123456',
    name='Warden Block B',
    role='warden'
)

# Assign wardens to buildings
from apps.auth.models import WardenAssignment
WardenAssignment.objects.create(warden=warden_a, building=building_a)
WardenAssignment.objects.create(warden=warden_b, building=building_b)

# Create Head Warden
headwarden = User.objects.create_user(
    email='headwarden@test.com',
    password='test123456',
    name='Head Warden',
    role='head_warden'
)

# Create Security Staff
security = User.objects.create_user(
    email='security@test.com',
    password='test123456',
    name='Gate Security',
    role='gate_security'
)

# Create Admin
admin = User.objects.create_user(
    email='admin@test.com',
    password='test123456',
    name='Administrator',
    role='admin'
)

print("✓ All test users created successfully!")
exit()
```

---

## Test Checklist

### PHASE 1: Student Creation & Visibility
- [ ] **TC-1.1** Student logs in and creates gate pass
  - [ ] Form accepts all required fields
  - [ ] Submission creates record with status=pending
  - [ ] Toast shows "Gate pass created"
  - [ ] Pass appears in student's own list

- [ ] **TC-1.2** Student sees only their own passes
  - [ ] Cannot see other student's pass in list
  - [ ] Searching for other student returns empty
  - [ ] Direct API access to other pass returns 403

- [ ] **TC-1.3** Student cannot create pass for others
  - [ ] Form doesn't have student selector
  - [ ] API rejects student_id != current_user

---

### PHASE 2: Warden Building Isolation
- [ ] **TC-2.1** Warden A sees only Building A passes
  - [ ] List shows only Building A students' passes
  - [ ] Cannot see Building B passes even if search
  - [ ] Filter by building shows only assigned building

- [ ] **TC-2.2** Warden B sees only Building B passes
  - [ ] Separate warden sees their building only
  - [ ] No cross-building data visibility

- [ ] **TC-2.3** Warden cannot view other warden's building
  - [ ] Cannot see Building B student passes
  - [ ] API returns filtered results only

---

### PHASE 3: Warden Approval Workflow
- [ ] **TC-3.1** Warden sees pending pass from their building
  - [ ] Pass shows in pending status filter
  - [ ] All student details visible
  - [ ] Parent phone numbers displayed

- [ ] **TC-3.2** Warden calls parent
  - [ ] "Call Parent" button shows contact options
  - [ ] Link opens phone dialer (tel://)
  - [ ] Can mark "Parent Informed" checkbox

- [ ] **TC-3.3** Warden approves pass
  - [ ] Approve button enabled after parent informed
  - [ ] Click approve changes status to "approved"
  - [ ] Can add approval remarks
  - [ ] Student receives real-time notification

- [ ] **TC-3.4** Warden rejects pass
  - [ ] Can reject at any time
  - [ ] Status changes to "rejected"
  - [ ] Can add rejection remarks
  - [ ] Student notified in real-time

---

### PHASE 4: Head Warden Full Access
- [ ] **TC-4.1** Head Warden sees all building passes
  - [ ] List shows Building A student passes
  - [ ] List shows Building B student passes
  - [ ] Can approve/reject from any building
  - [ ] No building-level filter applied

- [ ] **TC-4.2** Head Warden can approve pass from Building B
  - [ ] Head warden not assigned to Building B
  - [ ] Can still see and approve Building B passes
  - [ ] Full hostel-wide management capability

---

### PHASE 5: Student Approved Pass
- [ ] **TC-5.1** Student sees approved pass
  - [ ] Status shows as "approved" (green badge)
  - [ ] Shows exit/return dates and times
  - [ ] Purpose and remarks visible

- [ ] **TC-5.2** Student can view QR Code
  - [ ] "Show QR Code" button visible for approved only
  - [ ] QR code is scannable
  - [ ] QR contains pass information
  - [ ] Authorities cannot see this button

---

### PHASE 6: Security Verification
- [ ] **TC-6.1** Security sees approved passes
  - [ ] Can view all approved gate passes
  - [ ] Can see student details
  - [ ] Can see QR codes (via backend)

- [ ] **TC-6.2** Security records check-in
  - [ ] "Check In" button visible for approved passes
  - [ ] Click records entry timestamp
  - [ ] Pass status shows as "in-transit"
  - [ ] Student gets real-time update

- [ ] **TC-6.3** Security records check-out
  - [ ] After check-in, "Check Out" button visible
  - [ ] Click records exit timestamp
  - [ ] Pass marked as "used" or "completed"
  - [ ] Student notified

- [ ] **TC-6.4** Security cannot approve pass
  - [ ] Approve button not visible to security
  - [ ] API rejects approve from security role
  - [ ] Only see verification buttons

---

### PHASE 7: Real-Time Updates (WebSocket)
- [ ] **TC-7.1** Student creation visible to Warden instantly
  - [ ] Open two windows: Warden + Student
  - [ ] Student creates pass in Window 2
  - [ ] Window 1 (Warden) shows new pending pass
  - [ ] No page refresh needed

- [ ] **TC-7.2** Approval visible to Student instantly
  - [ ] Warden approves in Window 1
  - [ ] Window 2 (Student) shows approved status
  - [ ] No page refresh needed
  - [ ] Toast notification appears

- [ ] **TC-7.3** Check-in visible to Student instantly
  - [ ] Security checks in in Window 1
  - [ ] Window 2 (Student) shows "in-transit"
  - [ ] No page refresh needed

---

### PHASE 8: Mobile Responsiveness
- [ ] **TC-8.1** Create Pass form on mobile
  - [ ] All fields visible on 320px width
  - [ ] Touch targets 44px+ minimum
  - [ ] Submit button accessible
  - [ ] No horizontal scroll

- [ ] **TC-8.2** Gate pass list on mobile
  - [ ] Card layout for mobile (not table)
  - [ ] All info visible without scroll
  - [ ] Approve/Reject buttons accessible
  - [ ] No overflow issues

- [ ] **TC-8.3** Buttons on mobile
  - [ ] "Create Pass" button accessible
  - [ ] "Approve" button has good color contrast
  - [ ] "Call Parent" clickable
  - [ ] QR Code button touch-friendly

---

### PHASE 9: Permission Enforcement
- [ ] **TC-9.1** Student cannot approve pass
  - [ ] Approve button not shown in UI
  - [ ] API returns 403 if attempting
  - [ ] Backend permission check triggered

- [ ] **TC-9.2** Security cannot approve pass
  - [ ] Approve button hidden from security
  - [ ] API rejects with PermissionError
  - [ ] Only verification buttons shown

- [ ] **TC-9.3** Student cannot verify pass
  - [ ] Verify buttons not visible
  - [ ] API returns 403 on verification
  - [ ] Only see pass details

- [ ] **TC-9.4** Warden cannot verify pass
  - [ ] Verify buttons not visible
  - [ ] Can approve but not verify
  - [ ] Role-based button rendering works

---

### PHASE 10: Audit & Logging
- [ ] **TC-10.1** Create action logged
  - [ ] Check audit_logs table
  - [ ] `action='create'`, `actor_id=student.id`
  - [ ] Timestamp recorded

- [ ] **TC-10.2** Approve action logged
  - [ ] Check audit_logs table
  - [ ] `action='approve'`, `actor_id=warden.id`
  - [ ] Includes approval remarks

- [ ] **TC-10.3** Reject action logged
  - [ ] Check audit_logs table
  - [ ] `action='reject'`, `actor_id=warden.id`
  - [ ] Includes rejection remarks

- [ ] **TC-10.4** Verify action logged
  - [ ] Check audit_logs table
  - [ ] `action='verify'`, `actor_id=security.id`
  - [ ] Includes direction (check_in/check_out)

---

### PHASE 11: Error Cases
- [ ] **TC-11.1** Invalid form submission
  - [ ] Missing required field → error message
  - [ ] Invalid date → error message
  - [ ] Form doesn't submit

- [ ] **TC-11.2** Duplicate pass
  - [ ] Student tries to create pass while pending
  - [ ] System prevents or allows based on rules
  - [ ] Feedback message shown

- [ ] **TC-11.3** Approve pending reject
  - [ ] Cannot approve after reject
  - [ ] Cannot reject after approve
  - [ ] Status change prevented

- [ ] **TC-11.4** Network error handling
  - [ ] Offline student create attempt
  - [ ] Error message displayed
  - [ ] Can retry when online

---

### PHASE 12: API Testing
- [ ] **TC-12.1** Create pass endpoint
  ```bash
  POST /api/gate-passes/
  Auth: STUDENT_TOKEN
  Status: 201 Created ✓
  Status: 403 (if Warden tries) ✓
  ```

- [ ] **TC-12.2** List endpoint filtering
  ```bash
  GET /api/gate-passes/
  As Student → Only own passes
  As Warden → Only building passes
  As HeadWarden → All passes
  ```

- [ ] **TC-12.3** Approve endpoint
  ```bash
  POST /api/gate-passes/1/approve/
  As Warden → 200 OK ✓
  As Student → 403 Forbidden ✓
  As Security → 403 Forbidden ✓
  ```

- [ ] **TC-12.4** Verify endpoint
  ```bash
  POST /api/gate-passes/1/verify/
  As Security → 200 OK ✓
  As Warden → 403 Forbidden ✓
  As Student → 403 Forbidden ✓
  ```

---

## Test Results Summary

| Phase | Test Cases | Passed | Failed | Notes |
|-------|-----------|--------|--------|-------|
| 1: Student Create | 3 | [ ] | [ ] | |
| 2: Warden Building | 3 | [ ] | [ ] | |
| 3: Approval Flow | 4 | [ ] | [ ] | |
| 4: Head Warden | 2 | [ ] | [ ] | |
| 5: Student Approved | 2 | [ ] | [ ] | |
| 6: Security Verify | 4 | [ ] | [ ] | |
| 7: Real-Time Updates | 3 | [ ] | [ ] | |
| 8: Mobile | 3 | [ ] | [ ] | |
| 9: Permissions | 4 | [ ] | [ ] | |
| 10: Audit | 4 | [ ] | [ ] | |
| 11: Error Cases | 4 | [ ] | [ ] | |
| 12: API Tests | 4 | [ ] | [ ] | |
| **TOTAL** | **40** | [ ] | [ ] | |

---

## Known Limitations

- [ ] Concurrent approval attempts (if two wardens approve same pass simultaneously)
- [ ] Timezone handling for students across regions
- [ ] Multiple parent contacts (father/mother/guardian)
- [ ] Pass modification after creation (currently not allowed)

---

## Next Steps After Testing

1. [ ] Fix any bugs found in testing
2. [ ] Performance optimization if needed
3. [ ] User documentation update
4. [ ] Deployment checklist
5. [ ] Production monitoring setup

---

## Contact & Issues

**For bugs/issues found during testing:**
- Document exact steps to reproduce
- Include user role and building assignment
- Attach screenshots if UI-related
- Provide API response if API-related

