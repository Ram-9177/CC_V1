# Gate Pass Role-Based Access Testing Guide

## Overview
Test the complete gate pass workflow across different user roles to verify:
- Students can create/apply for gate passes
- Wardens and Headwardens can view and approve applications
- Security staff can verify approved passes
- Role-based access controls work correctly

## User Roles & Permissions

### 1. **Student Role**
- ✅ Can CREATE gate pass applications
- ✅ Can view their OWN gate passes only
- ❌ Cannot see other students' passes
- ❌ Cannot approve/reject passes
- ❌ Cannot verify gate scans

### 2. **Warden Role** 
- ❌ Cannot create gate passes
- ✅ Can view gate passes for their BLOCK/BUILDING only
- ✅ Can approve pending gate passes
- ✅ Can reject gate passes
- ❌ Cannot verify gate scans (restricted to security roles)

### 3. **Head Warden Role**
- ❌ Cannot create gate passes
- ✅ Can view ALL gate passes in hostel
- ✅ Can approve pending gate passes
- ✅ Can reject gate passes
- ❌ Cannot verify gate scans (restricted to security roles)

### 4. **Admin/Super Admin**
- ✅ Can view ALL gate passes
- ✅ Can approve/reject any pass
- ✅ Can verify gate scans
- ✅ Full management access

### 5. **Gate Security Role**
- ❌ Cannot create passes
- ❌ Cannot approve/reject passes
- ✅ Can verify approved passes (check-in/check-out)
- ✅ Can see all gate passes

### 6. **Security Head Role**
- ❌ Cannot create passes
- ❌ Cannot approve/reject passes
- ✅ Can verify approved passes (check-in/check-out)
- ✅ Can see all gate passes

---

## Test Cases

### TEST 1: Student Creates Gate Pass Application
**Precondition:** Logged in as Student user
**Steps:**
1. Navigate to Gate Passes page
2. Click "Create Pass" button
3. Fill form:
   - Pass Type: "Day" 
   - Purpose: "Visit to library"
   - Destination: "Central Library"
   - Exit Date/Time: Today, 2:00 PM
   - Expected Return: Today, 4:00 PM
4. Submit form

**Expected Result:**
- ✅ Form validates successfully
- ✅ Gate pass created with status = "pending"
- ✅ Toast notification shows "Gate pass created"
- ✅ Pass appears in student's list

**Actual Result:**
[Test this and record]

---

### TEST 2: Warden Views Pending Applications
**Precondition:** 
- Logged in as Warden user assigned to Block A
- Student from Block A has created a pending gate pass

**Steps:**
1. Navigate to Gate Passes page
2. Filter status = "pending"
3. Look for student gate passes from Block A

**Expected Result:**
- ✅ Can see pending gate passes from their building
- ✅ Cannot see passes from other buildings
- ✅ Can see approve/reject buttons for pending passes
- ✅ Can see "Call Parent" option
- ✅ Can see remarks field

**Actual Result:**
[Test this and record]

---

### TEST 3: Warden Approves Gate Pass
**Precondition:**
- Logged in as Warden
- Has pending gate pass visible
- Parent has been informed (checkbox marked)

**Steps:**
1. View pending gate pass from TEST 2
2. Click "Inform Parent" (call button)
3. Confirm parent has been contacted
4. Click "Approve" button
5. (Optional) Add approval remarks

**Expected Result:**
- ✅ "Inform Parent" button shows contact options
- ✅ Parent informed checkbox gets marked
- ✅ "Approve" button becomes enabled (only after parent informed)
- ✅ Gate pass status changes to "approved"
- ✅ Real-time update: Student sees their pass as "approved"
- ✅ Toast: "Gate pass approved"

**Actual Result:**
[Test this and record]

---

### TEST 4: Warden Rejects Gate Pass
**Precondition:**
- Logged in as Warden
- Has different pending gate pass available

**Steps:**
1. View pending gate pass
2. Click "Reject" button
3. (Optional) Add rejection remarks

**Expected Result:**
- ✅ Gate pass status changes to "rejected"
- ✅ Real-time update: Student sees their pass as "rejected"
- ✅ Toast: "Gate pass rejected"
- ✅ Approve button disappears

**Actual Result:**
[Test this and record]

---

### TEST 5: Student Views Approved Pass & QR Code
**Precondition:**
- Logged in as Student
- Has approved gate pass

**Steps:**
1. Navigate to Gate Passes page
2. Find approved pass
3. Click "Show QR Code" button

**Expected Result:**
- ✅ QR code displays for approved pass only
- ✅ QR code is scannable (contains pass info)
- ✅ Students see this button ONLY for approved passes
- ✅ Authorities/Security do NOT see this button

**Actual Result:**
[Test this and record]

---

### TEST 6: Head Warden Views All Pending Passes
**Precondition:**
- Logged in as Head Warden
- Multiple students from different buildings have pending passes

**Steps:**
1. Navigate to Gate Passes page
2. Filter status = "pending"

**Expected Result:**
- ✅ Can see pending passes from ALL buildings
- ✅ Can see student names, halls, purposes
- ✅ Can approve/reject any pass
- ✅ Can filter and search across all buildings

**Actual Result:**
[Test this and record]

---

### TEST 7: Security Staff Verifies Approved Pass
**Precondition:**
- Logged in as Gate Security
- Student has approved gate pass with QR code
- Student shows QR code at gate

**Steps:**
1. Navigate to Gate Passes page
2. See approved passes in list
3. Click "Check In" button for approved pass
4. Verify check-in recorded

**Expected Result:**
- ✅ Can see approved gate passes
- ✅ "Check In" button visible
- ✅ Click records entry time
- ✅ Pass status changes to "used" after check-in
- ✅ Later, "Check Out" button appears for same pass
- ✅ Can mark check-out time

**Actual Result:**
[Test this and record]

---

### TEST 8: Access Control - Student Cannot See Other Students' Passes
**Precondition:**
- Logged in as Student A
- Student B has created and approved a gate pass

**Steps:**
1. Navigate to Gate Passes page
2. Try to search for or view Student B's pass
3. Try to access Student B's pass via URL directly

**Expected Result:**
- ✅ Cannot see Student B's pass in list
- ✅ API returns 403 if accessing directly
- ✅ Only sees own gate passes
- ✅ Cannot access other students' QR codes

**Actual Result:**
[Test this and record]

---

### TEST 9: Access Control - Warden Cannot See Other Building Passes
**Precondition:**
- Logged in as Warden for Building A
- Gate pass exists from student in Building B

**Steps:**
1. Navigate to Gate Passes page
2. Try to search for Building B student
3. Check query filters

**Expected Result:**
- ✅ Cannot see Building B passes in list
- ✅ API filters by warden's building only
- ✅ Warden sees only their assigned building

**Actual Result:**
[Test this and record]

---

### TEST 10: Real-time Updates with WebSocket
**Precondition:**
- Two browser windows/devices
- Window 1: Logged in as Warden
- Window 2: Logged in as Student

**Steps:**
1. Window 2 (Student): Create new gate pass
2. Window 1 (Warden): Observe pending passes list
3. Window 1: Approve the pass
4. Window 2: Check if status updates in real-time

**Expected Result:**
- ✅ Warden immediately sees new pending pass (without refresh)
- ✅ Student immediately sees approved status (without refresh)
- ✅ WebSocket connection broadcasts updates correctly
- ✅ Multiple users see synchronized updates

**Actual Result:**
[Test this and record]

---

## Test Matrix

| User Role | Create | View Own | View Building | View All | Approve | Reject | Verify | QR View |
|-----------|--------|----------|---------------|----------|---------|--------|--------|---------|
| Student   | ✅     | ✅       | ❌           | ❌       | ❌      | ❌     | ❌     | ✅      |
| Warden    | ❌     | ❌       | ✅           | ❌       | ✅      | ✅     | ❌     | ❌      |
| Head Warden | ❌  | ❌       | ❌           | ✅       | ✅      | ✅     | ❌     | ❌      |
| Security  | ❌     | ❌       | ❌           | ✅       | ❌      | ❌     | ✅     | ❌      |
| Admin     | ✅     | ❌       | ❌           | ✅       | ✅      | ✅     | ✅     | ❌      |

---

## Backend Verification

### Check Database Records
```sql
-- View all gate passes
SELECT id, student_id, status, approved_by_id, created_at FROM gate_passes;

-- Check role-based filtering works
SELECT * FROM auth_user WHERE role = 'warden';
SELECT * FROM auth_user WHERE role = 'student';

-- View audit logs
SELECT * FROM audit_logs WHERE action IN ('create', 'approve', 'reject', 'verify');
```

### API Endpoints to Test
```bash
# Create gate pass (Student)
POST /api/gate-passes/
Body: { pass_type, purpose, exit_date, expected_return_date, ... }
Auth: Student token

# List gate passes (role-filtered)
GET /api/gate-passes/
Auth: Any role (filters applied based on role)

# Approve gate pass (Warden/HeadWarden/Admin)
POST /api/gate-passes/{id}/approve/
Auth: Warden token

# Reject gate pass
POST /api/gate-passes/{id}/reject/
Auth: Warden token

# Verify gate pass (Security)
POST /api/gate-passes/{id}/verify/
Auth: Security token
```

---

## Troubleshooting

### Issue: "Only staff can approve gate passes"
- **Cause:** User role is not in STAFF_ROLES list
- **Fix:** Verify user has role in: admin, super_admin, warden, head_warden

### Issue: Warden cannot see pending passes
- **Cause:** Building assignment not set or student not in that building
- **Fix:** Check room allocations in database

### Issue: Security cannot verify pass
- **Cause:** Pass not in "approved" status or role permissions not set
- **Fix:** Verify pass status and user role is gate_security or security_head

### Issue: Real-time updates not showing
- **Cause:** WebSocket connection not active
- **Fix:** Check browser console for WebSocket errors, restart dev server

---

## Manual Testing Checklist

- [ ] Student can create gate pass
- [ ] Student sees only their own passes
- [ ] Warden sees building-specific passes
- [ ] Warden can approve after parent informed
- [ ] Warden can reject with remarks
- [ ] Head Warden sees all passes
- [ ] Security can verify approved passes
- [ ] QR code shows only for students on approved passes
- [ ] Real-time updates work with WebSocket
- [ ] Access controls prevent unauthorized viewing
- [ ] Audit logs record all actions
- [ ] Status badges display correctly
- [ ] Mobile UI shows all buttons correctly
- [ ] Error messages appear for permission denials

