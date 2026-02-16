# Gate Pass Role-Based Workflow - Complete Visual Guide

**Status:** ✅ FULLY IMPLEMENTED - READY FOR REVIEW  
**Date:** February 16, 2025

---

## PART 1: ROLE HIERARCHY & PERMISSIONS

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          ROLE HIERARCHY STRUCTURE                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                              ADMIN/SUPER_ADMIN                            │
│                            (Full System Access)                           │
│                                    │                                       │
│                    ┌───────────────┼───────────────┐                      │
│                    │               │               │                      │
│              HEAD_WARDEN      WARDEN          SECURITY_HEAD               │
│            (All Buildings)   (Single Building)  (Gate Management)         │
│                    │               │               │                      │
│                    │               │               ├─ Gate Security       │
│                    │               │               │                      │
│                    └───────────────┼───────────────┘                      │
│                                    │                                       │
│                                STUDENT                                     │
│                          (Gate Pass Applicants)                           │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## PART 2: COMPLETE PERMISSION MATRIX

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         COMPREHENSIVE PERMISSION MATRIX                                 │
├──────────────────────┬─────────┬───────┬──────────┬───────┬──────────┬────────────────┤
│      ACTION          │STUDENT  │WARDEN │HEAD_WARD │ADMIN  │SECURITY  │ SECURITY_HEAD  │
├──────────────────────┼─────────┼───────┼──────────┼───────┼──────────┼────────────────┤
│                      │         │       │          │       │          │                │
│ CREATE GATE PASS     │   ✅    │   ❌  │    ❌    │  ✅   │   ❌     │       ❌        │
│ (Own passes only)    │ (own)   │       │          │       │          │                │
├──────────────────────┼─────────┼───────┼──────────┼───────┼──────────┼────────────────┤
│                      │         │       │          │       │          │                │
│ VIEW GATE PASSES     │   ✅    │   ✅  │    ✅    │  ✅   │   ✅     │       ✅        │
│                      │ (own)   │(build │  (all)   │(all)  │ (all)    │      (all)     │
│                      │         │-ing)  │          │       │          │                │
├──────────────────────┼─────────┼───────┼──────────┼───────┼──────────┼────────────────┤
│                      │         │       │          │       │          │                │
│ APPROVE PASS         │   ❌    │   ✅  │    ✅    │  ✅   │   ❌     │       ❌        │
│ (After parent info)  │         │       │          │       │          │                │
├──────────────────────┼─────────┼───────┼──────────┼───────┼──────────┼────────────────┤
│                      │         │       │          │       │          │                │
│ REJECT PASS          │   ❌    │   ✅  │    ✅    │  ✅   │   ❌     │       ❌        │
│ (With remarks)       │         │       │          │       │          │                │
├──────────────────────┼─────────┼───────┼──────────┼───────┼──────────┼────────────────┤
│                      │         │       │          │       │          │                │
│ VERIFY PASS          │   ❌    │   ❌  │    ❌    │  ✅   │   ✅     │       ✅        │
│ (Check-in/Check-out) │         │       │          │       │          │                │
├──────────────────────┼─────────┼───────┼──────────┼───────┼──────────┼────────────────┤
│                      │         │       │          │       │          │                │
│ CALL PARENT          │   ❌    │   ✅  │    ✅    │  ✅   │   ❌     │       ❌        │
│ (Inform & verify)    │         │       │          │       │          │                │
├──────────────────────┼─────────┼───────┼──────────┼───────┼──────────┼────────────────┤
│                      │         │       │          │       │          │                │
│ SHOW QR CODE         │   ✅    │   ❌  │    ❌    │  ❌   │   ❌     │       ❌        │
│ (Approved only)      │(own app)│       │          │       │          │                │
├──────────────────────┼─────────┼───────┼──────────┼───────┼──────────┼────────────────┤
│                      │         │       │          │       │          │                │
│ VIEW AUDIT LOG       │   ❌    │   ✅  │    ✅    │  ✅   │   ✅     │       ✅        │
│ (All approvals)      │         │       │          │       │          │                │
└──────────────────────┴─────────┴───────┴──────────┴───────┴──────────┴────────────────┘
```

---

## PART 3: COMPLETE STUDENT WORKFLOW

```
┌──────────────────────────────────────────────────────────────────────┐
│               STUDENT GATE PASS APPLICATION JOURNEY                  │
└──────────────────────────────────────────────────────────────────────┘

STEP 1: CREATE APPLICATION
┌────────────────────────────────────────┐
│  Student logs in                       │
│  Navigate to Gate Passes               │
│  Click "Create Pass" button            │
│                                        │
│  Form Fields:                          │
│  • Pass Type (Day/Overnight/Weekend)   │
│  • Purpose (destination & reason)      │
│  • Exit Date & Time                    │
│  • Expected Return Date & Time         │
│  • Additional Remarks                  │
│                                        │
│  Click "Submit Request"                │
└────────────────────────────────────────┘
                    ↓
          📤 Submitted to Backend
                    ↓
┌────────────────────────────────────────┐
│  Status: PENDING                       │ ← Warden sees this
│  Created: 2025-02-16 10:30 AM          │
│  Visible: In student's list            │
│  Action: Waiting for approval          │
└────────────────────────────────────────┘


STEP 2: WAIT FOR WARDEN APPROVAL
┌────────────────────────────────────────┐
│  Real-Time Update (WebSocket)          │
│  Student sees: "Pending Approval"      │
│                                        │
│  What Warden is doing:                 │
│  1. Viewing pending pass               │
│  2. Calling parent                     │
│  3. Verifying request                  │
│  4. Making approval decision           │
│                                        │
│  Student sees instant updates:         │
│  • Parent called ✓                     │
│  • Approval buttons appearing          │
└────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────┐
│  Warden Approved! ✓                    │
│  Status: APPROVED                      │
│  Approved By: Warden Name              │
│  Approved At: 2025-02-16 11:00 AM      │
│  Real-Time Notification: YES ✓         │
└────────────────────────────────────────┘


STEP 3: VIEW APPROVED PASS & QR CODE
┌────────────────────────────────────────┐
│  Status: APPROVED (Green Badge)        │
│                                        │
│  Student can now:                      │
│  • View all pass details               │
│  • See "Show QR Code" button ✓         │
│  • Click to display QR code            │
│  • Take screenshot for gate staff      │
│                                        │
│  QR Code Contains:                     │
│  • Pass ID                             │
│  • Student Name & Hall Ticket          │
│  • Exit/Return Times                   │
│  • Approval Status                     │
│  • Validation Token                    │
└────────────────────────────────────────┘


STEP 4: GO TO GATE WITH QR CODE
┌────────────────────────────────────────┐
│  Student exits hostel                  │
│  Shows QR code to Security Staff       │
│                                        │
│  Security scans/reads QR               │
│  Records Check-In:                     │
│  • Actual exit time                    │
│  • Gate location                       │
│  • Direction (OUT)                     │
│                                        │
│  Status Changes: IN-TRANSIT            │
│  Real-Time Update to Student: YES ✓    │
└────────────────────────────────────────┘


STEP 5: STUDENT OUTSIDE HOSTEL
┌────────────────────────────────────────┐
│  Pass Status: IN-TRANSIT               │
│  Exit Recorded At: 2:30 PM             │
│  Expected Return: 4:00 PM              │
│                                        │
│  Student Activities:                   │
│  • Outside hostel                      │
│  • Can view pass status anytime        │
│  • Real-time location tracking (opt)   │
└────────────────────────────────────────┘


STEP 6: RETURN TO HOSTEL
┌────────────────────────────────────────┐
│  Student returns before/after time     │
│  Shows QR code again to Security       │
│                                        │
│  Security scans/reads QR               │
│  Records Check-Out:                    │
│  • Actual return time                  │
│  • Gate location                       │
│  • Direction (IN)                      │
│                                        │
│  Status Changes: COMPLETED             │
│  Real-Time Update to Student: YES ✓    │
└────────────────────────────────────────┘


STEP 7: PASS MARKED COMPLETE
┌────────────────────────────────────────┐
│  Status: COMPLETED ✓                   │
│  Exit Time: 2:30 PM                    │
│  Return Time: 3:45 PM                  │
│  Total Duration: 1 hour 15 min         │
│                                        │
│  History Entry Created                 │
│  Can create new pass anytime           │
│  Pass archived in history              │
└────────────────────────────────────────┘
```

---

## PART 4: WARDEN/HEAD WARDEN WORKFLOW

```
┌──────────────────────────────────────────────────────────────────────┐
│          WARDEN APPROVAL & MANAGEMENT WORKFLOW                       │
└──────────────────────────────────────────────────────────────────────┘

WARDEN (Building-Specific Access)
═════════════════════════════════════════════════════════════════════════

STEP 1: LOGIN & VIEW DASHBOARD
┌────────────────────────────────────────┐
│  Warden logs in                        │
│  Dashboard shows:                      │
│  • Pending applications (their building)
│  • Approved passes                     │
│  • Total students in building          │
│  • Recent activity                     │
└────────────────────────────────────────┘


STEP 2: VIEW PENDING PASSES (BUILDING ONLY)
┌────────────────────────────────────────┐
│  Filter Status = "Pending"             │
│                                        │
│  Shows Only:                           │
│  ✓ Students from Building A            │
│  ✓ Students from Building B            │
│  ✗ Students from Building C (blocked)  │
│  ✗ Other building students (blocked)   │
│                                        │
│  For Each Pending Pass Shows:          │
│  • Student name                        │
│  • Hall ticket                         │
│  • Pass type                           │
│  • Purpose                             │
│  • Exit & Return dates/times           │
│  • Parent phone numbers                │
└────────────────────────────────────────┘


STEP 3: REVIEW PASS DETAILS
┌────────────────────────────────────────┐
│  Click on pending pass to expand       │
│                                        │
│  Visible Information:                  │
│  • Full student details                │
│  • Complete purpose text               │
│  • Audio brief (if recorded)           │
│  • Additional remarks                  │
│                                        │
│  Can View But Cannot:                  │
│  ✗ Edit student information            │
│  ✗ Change dates/times                  │
│  ✗ Modify pass type                    │
│  (Warden can only approve or reject)   │
└────────────────────────────────────────┘


STEP 4: CALL PARENT (VERIFY REQUEST)
┌────────────────────────────────────────┐
│  "Call Parent" Section Shows:          │
│  • Father Phone: +91-XXXXXXXXXX        │
│  • Mother Phone: +91-XXXXXXXXXX        │
│  • Guardian Phone: +91-XXXXXXXXXX      │
│                                        │
│  Click to call (tel:// link):          │
│  • Opens phone dialer                  │
│  • Warden calls parent                 │
│  • Confirms request authenticity       │
│  • Verifies student is allowed out     │
│  • Gets parent permission              │
│                                        │
│  After Confirming:                     │
│  ☑ Mark "Parent Informed" checkbox     │
│  (Must be checked before approving)    │
└────────────────────────────────────────┘


STEP 5: APPROVE PASS
┌────────────────────────────────────────┐
│  Prerequisites:                        │
│  ✓ Parent called and checkbox marked   │
│  ✓ All details verified                │
│  ✓ Request seems legitimate            │
│                                        │
│  Click "APPROVE" Button:               │
│  • Button becomes enabled after parent │
│  • Optional: Add approval remarks      │
│  • Click to approve                    │
│                                        │
│  What Happens:                         │
│  → Status changes to "APPROVED"        │
│  → Warden name recorded                │
│  → Timestamp recorded                  │
│  → Student notified in real-time       │
│  → Audit log entry created            │
│  → Pass visible to security            │
└────────────────────────────────────────┘


STEP 6: REJECT PASS (Alternative)
┌────────────────────────────────────────┐
│  If Cannot Approve:                    │
│  • Request seems unauthorized          │
│  • Parent denies permission            │
│  • Dates conflict with rules           │
│  • Other reasons                       │
│                                        │
│  Click "REJECT" Button:                │
│  • Add rejection remarks (optional)    │
│  • Explain reason to student           │
│  • Click to reject                     │
│                                        │
│  What Happens:                         │
│  → Status changes to "REJECTED"        │
│  → Student notified in real-time       │
│  → Remarks sent to student             │
│  → Student can create new request      │
│  → Audit log entry created            │
└────────────────────────────────────────┘


STEP 7: MONITOR ACTIVITY
┌────────────────────────────────────────┐
│  After Approving:                      │
│  • See pass move to "Approved" section │
│  • See student check-in/check-out      │
│  • View real-time gate activity        │
│  • Monitor building security           │
│                                        │
│  Can Still:                            │
│  ✓ View history of decisions           │
│  ✓ See audit trail                     │
│  ✓ Generate reports                    │
└────────────────────────────────────────┘


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HEAD WARDEN (Full Building Access)
═════════════════════════════════════════════════════════════════════════

SAME WORKFLOW AS WARDEN BUT:

🔓 BUILDING ISOLATION REMOVED
┌────────────────────────────────────────┐
│  Head Warden can view:                 │
│  ✓ All buildings                       │
│  ✓ All pending passes (no filter)      │
│  ✓ All students                        │
│  ✓ Complete hostel overview            │
│                                        │
│  Can approve/reject from:              │
│  ✓ Building A                          │
│  ✓ Building B                          │
│  ✓ Building C                          │
│  ✓ Any building (no restriction)       │
│                                        │
│  Perfect for:                          │
│  • Hostel management                   │
│  • Policy enforcement                  │
│  • Overall oversight                   │
│  • Conflict resolution                 │
└────────────────────────────────────────┘
```

---

## PART 5: SECURITY STAFF WORKFLOW

```
┌──────────────────────────────────────────────────────────────────────┐
│              SECURITY VERIFICATION WORKFLOW                          │
└──────────────────────────────────────────────────────────────────────┘

GATE SECURITY / SECURITY HEAD
═════════════════════════════════════════════════════════════════════════

STEP 1: LOGIN & VIEW GATE DASHBOARD
┌────────────────────────────────────────┐
│  Security staff logs in                │
│  Gate Pass Management page             │
│                                        │
│  Default View:                         │
│  • All approved passes (no filters)    │
│  • Today's expected exits              │
│  • Check-in/check-out count            │
│  • Recent scans                        │
│  • Any pending issues                  │
└────────────────────────────────────────┘


STEP 2: FILTER BY STATUS = APPROVED
┌────────────────────────────────────────┐
│  See All Approved Passes:              │
│  • Ready for verification              │
│  • Student can exit/return anytime     │
│  • QR code active                      │
│                                        │
│  Cannot See/Approve:                   │
│  ✗ Pending passes (not their job)      │
│  ✗ Rejected passes                     │
│  ✗ Cannot change approval status       │
└────────────────────────────────────────┘


STEP 3: STUDENT ARRIVES AT GATE (EXITING)
┌────────────────────────────────────────┐
│  Student shows QR code to security     │
│                                        │
│  Security Options:                     │
│  1. Scan QR code with phone            │
│  2. Manually search by hall ticket     │
│  3. Manually search by name            │
│  4. Ask for Gate Pass ID number        │
│                                        │
│  System shows pass details:            │
│  • Student name                        │
│  • Pass status                         │
│  • Approved dates/times                │
│  • Warden approval details             │
│  • All pass information                │
│                                        │
│  Security verifies:                    │
│  • Is this the right student?          │
│  • Is pass status "APPROVED"?          │
│  • Is exit within approved time?       │
│  • Any flags or issues?                │
└────────────────────────────────────────┘


STEP 4: RECORD CHECK-IN (STUDENT EXITING)
┌────────────────────────────────────────┐
│  Verification Complete ✓               │
│  Security clicks "CHECK IN" button     │
│                                        │
│  What Gets Recorded:                   │
│  • Actual exit timestamp (NOW)         │
│  • Gate location                       │
│  • Direction: OUT                      │
│  • Security staff name                 │
│  • Scan method (QR/Manual)             │
│                                        │
│  System Updates:                       │
│  → Pass status: IN-TRANSIT             │
│  → Real-time update to student: YES    │
│  → Alert to warden: YES                │
│  → Audit log entry: YES                │
│                                        │
│  What Student Sees:                    │
│  "Checked Out at 2:30 PM"              │
│  "Expected Return: 4:00 PM"            │
│  Real-time status: IN-TRANSIT ✓        │
└────────────────────────────────────────┘


STEP 5: STUDENT IS OUTSIDE HOSTEL
┌────────────────────────────────────────┐
│  Time Passes...                        │
│  Student is outside                    │
│                                        │
│  System Monitoring:                    │
│  • Track if late return                │
│  • Check expected return time          │
│  • Alert warden if overdue             │
│  • Monitor duration                    │
└────────────────────────────────────────┘


STEP 6: STUDENT RETURNS (RE-ENTRY)
┌────────────────────────────────────────┐
│  Student arrives back at gate          │
│  Shows same QR code (or hall ticket)   │
│                                        │
│  Security Looks Up Pass:               │
│  • Status should be: IN-TRANSIT        │
│  • Exit time recorded                  │
│  • Student identification matches      │
│  • No issues or flags                  │
└────────────────────────────────────────┘


STEP 7: RECORD CHECK-OUT (STUDENT RETURNING)
┌────────────────────────────────────────┐
│  Verification Complete ✓               │
│  Security clicks "CHECK OUT" button    │
│                                        │
│  What Gets Recorded:                   │
│  • Actual return timestamp (NOW)       │
│  • Gate location                       │
│  • Direction: IN                       │
│  • Security staff name                 │
│  • Duration outside: 1h 15m            │
│  • Scan method (QR/Manual)             │
│                                        │
│  System Updates:                       │
│  → Pass status: COMPLETED              │
│  → Real-time update to student: YES    │
│  → Alert to warden: YES                │
│  → Report entry: YES                   │
│  → Audit log entry: YES                │
│                                        │
│  What Student Sees:                    │
│  "Checked In at 3:45 PM"               │
│  "Gate Pass Complete" ✓                │
│  Duration: 1h 15m                      │
│  "Create new pass to go out again"     │
└────────────────────────────────────────┘


STEP 8: GENERATE REPORTS
┌────────────────────────────────────────┐
│  Security can generate:                │
│  • Daily gate activity report          │
│  • Student exit/entry summary          │
│  • Average duration outside            │
│  • Overdue pass alerts                 │
│  • Peak hours analysis                 │
│  • Building-wise breakdown             │
│                                        │
│  Used For:                             │
│  • Security planning                   │
│  • Hostel management                   │
│  • Incident investigation              │
│  • Performance metrics                 │
└────────────────────────────────────────┘


CANNOT DO:
═════════════════════════════════════════════════════════════════════════
❌ Approve passes (warden's job)
❌ Reject passes (warden's job)
❌ View pending passes
❌ See parent contact info
❌ Call parent
❌ Modify any pass details
❌ View student's personal info beyond pass
```

---

## PART 6: REAL-TIME UPDATES (WEBSOCKET)

```
┌──────────────────────────────────────────────────────────────────────┐
│           REAL-TIME UPDATE FLOW (NO PAGE REFRESH NEEDED)             │
└──────────────────────────────────────────────────────────────────────┘

SCENARIO: Student Creates Pass, Warden Approves Instantly
═════════════════════════════════════════════════════════════════════════

STUDENT WINDOW (Browser 1)              WARDEN WINDOW (Browser 2)
─────────────────────────────           ────────────────────────────

(2:00 PM) Logged in
Shows: "No pending passes"               Shows: "0 pending passes"


(2:05 PM) Fills form & Submits          (Warden checks page)
Creates: New Gate Pass
Status: pending                          


                                         REAL-TIME UPDATE (WebSocket)
                                         No page refresh needed!
                                         ↓
                                         
                                         NEW PENDING PASS APPEARS! ✓
                                         • Student name visible
                                         • Pass details shown
                                         • Action buttons ready


Student sees:                            Warden sees:
"Gate pass created!"                     "New pending pass from Raj"
Status: pending                          Calls parent number...
Toast notification ✓                     Marks "Parent Informed" ✓


                                         Clicks "APPROVE" button
                                         Status changes to: approved


                                         REAL-TIME UPDATE (WebSocket)
                                         ↓


Student sees instantly:                  Warden sees:
Status: APPROVED ✓                       Pass moved to approved list
Toast: "Pass approved!"                  Counts: 1 pending left
"Show QR Code" button appears            
Real-time notification ✓                 
No refresh needed! ✓                     


TIMING:
├─ 2:05 PM: Student submits
├─ 2:05:01 PM: Warden sees (instant)
├─ 2:06 PM: Warden calls parent
├─ 2:06:30 PM: Warden approves
├─ 2:06:31 PM: Student sees approval (instant)
└─ 2:07 PM: Student shows QR at gate

Total Time: 2 minutes (all real-time)


WEBSOCKET CONNECTION FLOW:
═════════════════════════════════════════════════════════════════════════

┌──────────────┐                                      ┌──────────────┐
│   STUDENT    │                                      │   WARDEN     │
│   BROWSER    │                                      │   BROWSER    │
└──────┬───────┘                                      └──────┬───────┘
       │                                                     │
       │  WebSocket Connection (Open)                       │
       │◄────────────────────────────────────────────────────►│
       │                                                     │
       │  [Student creates pass]                            │
       │  Emit: "gatepass_created"                          │
       ├────────────────────────────────────────────────────>│
       │                                                     │
       │                               (Warden receives in real-time)
       │                               New pass appears ✓
       │                                                     │
       │  [Warden approves pass]                            │
       │  Emit: "gatepass_approved"                         │
       │<────────────────────────────────────────────────────┤
       │                                                     │
       │  (Student receives in real-time)                   │
       │  Status updated ✓                                  │
       │                                                     │
       │  [Student shows QR at gate]                        │
       │  Emit: "gatepass_checkin"                          │
       ├────────────────────────────────────────────────────>│
       │                                                     │
       │                               (Warden sees check-in log)
       │                               Activity recorded ✓
       │                                                     │
```

---

## PART 7: DATA ISOLATION BY BUILDING

```
┌──────────────────────────────────────────────────────────────────────┐
│           BUILDING-LEVEL DATA ISOLATION FOR WARDENS                  │
└──────────────────────────────────────────────────────────────────────┘

DATABASE (3 Buildings, Multiple Students)
═════════════════════════════════════════════════════════════════════════

Building A          Building B          Building C
├─ Student 1        ├─ Student 4        ├─ Student 6
├─ Student 2        ├─ Student 5        ├─ Student 7
├─ Student 3        │                   ├─ Student 8
│                   │                   │
└─ 5 Gate Passes    └─ 3 Gate Passes    └─ 4 Gate Passes


WARDEN A (Building A Only)
═════════════════════════════════════════════════════════════════════════

Database Query:
WHERE student.room_allocations.building_id = A
AND student.room_allocations.end_date IS NULL

Results:
✓ Can see: Student 1 passes
✓ Can see: Student 2 passes
✓ Can see: Student 3 passes
✗ Cannot see: Student 4 passes (Building B)
✗ Cannot see: Student 5 passes (Building B)
✗ Cannot see: Student 6 passes (Building C)
✗ Cannot see: Student 7 passes (Building C)
✗ Cannot see: Student 8 passes (Building C)

Can Approve: 5 Passes (Building A only)
Cannot Approve: 7 Passes (Other buildings - hidden)


WARDEN B (Building B Only)
═════════════════════════════════════════════════════════════════════════

Database Query:
WHERE student.room_allocations.building_id = B
AND student.room_allocations.end_date IS NULL

Results:
✗ Cannot see: Student 1 passes (Building A)
✗ Cannot see: Student 2 passes (Building A)
✗ Cannot see: Student 3 passes (Building A)
✓ Can see: Student 4 passes
✓ Can see: Student 5 passes
✗ Cannot see: Student 6 passes (Building C)
✗ Cannot see: Student 7 passes (Building C)
✗ Cannot see: Student 8 passes (Building C)

Can Approve: 3 Passes (Building B only)
Cannot Approve: 9 Passes (Other buildings - hidden)


HEAD WARDEN (All Buildings)
═════════════════════════════════════════════════════════════════════════

Database Query:
No building filter applied
Returns: ALL records

Results:
✓ Can see: Student 1 passes (Building A)
✓ Can see: Student 2 passes (Building A)
✓ Can see: Student 3 passes (Building A)
✓ Can see: Student 4 passes (Building B)
✓ Can see: Student 5 passes (Building B)
✓ Can see: Student 6 passes (Building C)
✓ Can see: Student 7 passes (Building C)
✓ Can see: Student 8 passes (Building C)

Can Approve: 12 Passes (All buildings)
Cannot Approve: 0 Passes (All visible)


BACKEND FILTERING CODE:
═════════════════════════════════════════════════════════════════════════

if user.role == 'head_warden':
    # No filter - return all
    queryset = GatePass.objects.all()

elif user.role == 'warden':
    # Filter by assigned building(s)
    warden_buildings = get_warden_building_ids(user)
    queryset = queryset.filter(
        student__room_allocations__room__building_id__in=warden_buildings,
        student__room_allocations__end_date__isnull=True
    ).distinct()

elif user.role == 'student':
    # Filter by own passes only
    queryset = queryset.filter(student=user)

elif user.role in ['gate_security', 'security_head', 'admin']:
    # No filter - return all
    queryset = queryset.all()


SECURITY IMPLICATIONS:
═════════════════════════════════════════════════════════════════════════

✓ Student A cannot see Student B's pass (even if same building)
✓ Warden A cannot approve Building B pass
✓ Warden A cannot modify another building's data
✓ Head Warden has full oversight
✓ API enforces filtering (cannot bypass in UI)
✓ Database query prevents data leakage
✓ Audit log tracks all access attempts
```

---

## PART 8: STATUS LIFECYCLE

```
┌──────────────────────────────────────────────────────────────────────┐
│          GATE PASS STATUS LIFECYCLE & STATE TRANSITIONS              │
└──────────────────────────────────────────────────────────────────────┘

STATUS FLOW DIAGRAM:
═════════════════════════════════════════════════════════════════════════

                          ┌─────────────┐
                          │   PENDING   │
                          │ (Just Created)
                          └────┬────────┘
                               │
                               │ Only Warden Can Act
                               ├─────────────┬──────────────┐
                               │             │              │
                        Approve │        Reject │        Ignore
                               │             │              │
                    ┌──────────▼──┐  ┌───────▼────┐  ┌──────▼────┐
                    │  APPROVED   │  │  REJECTED  │  │  EXPIRED  │
                    │ (Ready to   │  │ (Denied)   │  │ (Timeout) │
                    │  go out)    │  │            │  │           │
                    └──────┬──────┘  └────────────┘  └───────────┘
                           │
                    Student exits with QR
                           │
                    ┌──────▼──────┐
                    │  IN-TRANSIT │
                    │ (Outside)   │
                    └──────┬──────┘
                           │
                    Security Check-Out
                           │
                    ┌──────▼──────┐
                    │  COMPLETED  │
                    │ (Returned)  │
                    └─────────────┘


DETAILED STATUS DESCRIPTIONS:
═════════════════════════════════════════════════════════════════════════

1. PENDING
   ├─ Created by: Student
   ├─ Visible to: Student, Warden, Head Warden, Admin
   ├─ Duration: Waiting for approval (usually 1-24 hours)
   ├─ Can Change To: APPROVED or REJECTED
   ├─ Actions Available: 
   │  ├─ Warden: Approve (after parent call)
   │  ├─ Warden: Reject (with remarks)
   │  └─ Student: View only
   └─ Color: Orange/Yellow (warning)


2. APPROVED
   ├─ Created by: Warden action
   ├─ Visible to: Student, Warden, Head Warden, Admin, Security
   ├─ Duration: Until student exits or expires
   ├─ Can Change To: IN-TRANSIT (when student checks in)
   ├─ Actions Available:
   │  ├─ Student: Show QR Code, View details
   │  ├─ Security: Check-In student
   │  └─ Warden: View and monitor
   └─ Color: Green (success)


3. IN-TRANSIT
   ├─ Created by: Security Check-In
   ├─ Visible to: All users
   ├─ Duration: From exit until check-out
   ├─ Can Change To: COMPLETED
   ├─ Actions Available:
   │  ├─ Student: View real-time status
   │  ├─ Security: Check-Out when returns
   │  └─ Warden: Monitor location/time
   └─ Color: Blue (in progress)


4. COMPLETED
   ├─ Created by: Security Check-Out
   ├─ Visible to: All users (historical)
   ├─ Duration: Permanent record
   ├─ Can Change To: None (final state)
   ├─ Actions Available:
   │  └─ View in history only
   └─ Color: Green (done)


5. REJECTED
   ├─ Created by: Warden action
   ├─ Visible to: Student, Warden, Head Warden, Admin
   ├─ Duration: Permanent record
   ├─ Can Change To: None (final state)
   ├─ Contains: Rejection remarks from warden
   ├─ Actions Available:
   │  ├─ Student: Read remarks, create new request
   │  └─ Warden: View decision history
   └─ Color: Red (denied)


6. EXPIRED
   ├─ Created by: Automatic timeout
   ├─ Visible to: All users (historical)
   ├─ Duration: When deadline passes
   ├─ Can Change To: None (final state)
   ├─ Trigger: Not used within X days of approval
   ├─ Actions Available:
   │  └─ View in history only
   └─ Color: Gray (expired)


POSSIBLE TRANSITIONS:
═════════════════════════════════════════════════════════════════════════

PENDING → APPROVED          (Warden approves after parent call)
PENDING → REJECTED          (Warden rejects with remarks)
PENDING → EXPIRED           (Auto-timeout if not acted on)

APPROVED → IN-TRANSIT       (Security checks in student at gate)
APPROVED → EXPIRED          (Auto-timeout if not used)

IN-TRANSIT → COMPLETED      (Security checks out student)

REJECTED → (no transitions) (Final state)
COMPLETED → (no transitions) (Final state)
EXPIRED → (no transitions)  (Final state)


INVALID TRANSITIONS (Cannot Happen):
═════════════════════════════════════════════════════════════════════════

✗ PENDING → IN-TRANSIT      (Must be APPROVED first)
✗ REJECTED → APPROVED       (Cannot resurrect rejected pass)
✗ COMPLETED → PENDING       (Cannot restart completed pass)
✗ IN-TRANSIT → PENDING      (Cannot go backward)
✗ APPROVED → PENDING        (Cannot change status backward)
✗ APPROVED → REJECTED       (Cannot change after approved)
```

---

## PART 9: FRONTEND UI VISIBILITY MATRIX

```
┌──────────────────────────────────────────────────────────────────────┐
│        WHICH BUTTONS/FIELDS EACH ROLE SEES ON GATE PASSES PAGE       │
└──────────────────────────────────────────────────────────────────────┘

STUDENT VIEWING OWN PENDING PASS
═════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────┐
│  Gate Pass #123 - RAJ KUMAR             │
│  Status: 🟠 PENDING                     │
│  Student: Raj Kumar (19B31A0587)        │
│  Building: Block A, Room 101            │
│  Exit: 16-Feb-2025, 2:00 PM            │
│  Return: 16-Feb-2025, 4:00 PM          │
│  Purpose: Visit library for study      │
│                                         │
│  VISIBLE BUTTONS/ACTIONS:               │
│  ❌ "Create Pass" button (this is list) │
│  ❌ "Approve" button                    │
│  ❌ "Reject" button                     │
│  ❌ "Call Parent" section               │
│  ❌ "Show QR Code" button               │
│  ❌ "Check In" button                   │
│  ❌ "Check Out" button                  │
│                                         │
│  VISIBLE SECTIONS:                      │
│  ✓ Pass details                         │
│  ✓ Student info                         │
│  ✓ Dates and times                      │
│  ✓ Purpose description                  │
│  ✓ Audio brief (if any)                 │
│  ✓ Status badge                         │
└─────────────────────────────────────────┘


WARDEN VIEWING PENDING PASS (FROM THEIR BUILDING)
═════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────┐
│  Gate Pass #123 - RAJ KUMAR             │
│  Status: 🟠 PENDING                     │
│  Student: Raj Kumar (19B31A0587)        │
│  Building: Block A, Room 101            │
│  Exit: 16-Feb-2025, 2:00 PM            │
│  Return: 16-Feb-2025, 4:00 PM          │
│  Purpose: Visit library for study      │
│                                         │
│  PARENT INFORMATION:                    │
│  Father: +91-9876543210                 │
│  Mother: +91-9876543211                 │
│  Guardian: +91-9876543212               │
│                                         │
│  ACTION SECTION:                        │
│  📞 Call Father (tel:// link)           │
│  📞 Call Mother (tel:// link)           │
│  📞 Call Guardian (tel:// link)         │
│                                         │
│  APPROVAL PROTOCOL:                     │
│  ☐ Parent Informed                      │
│  (Checkbox - must check before approve) │
│                                         │
│  APPROVAL BUTTONS:                      │
│  ✓ ✅ APPROVE button (enabled after    │
│      parent informed checked)           │
│  ✓ ❌ REJECT button (always available)  │
│                                         │
│  OPTIONAL:                              │
│  ✓ Add approval/rejection remarks       │
│                                         │
│  CANNOT SEE/DO:                         │
│  ❌ Show QR Code                        │
│  ❌ Check In/Out                        │
│  ❌ Verify/Scan QR                      │
│  ❌ Modify student info                 │
│  ❌ Edit dates/times/purpose            │
└─────────────────────────────────────────┘


STUDENT VIEWING OWN APPROVED PASS
═════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────┐
│  Gate Pass #123 - RAJ KUMAR             │
│  Status: 🟢 APPROVED                    │
│  Student: Raj Kumar (19B31A0587)        │
│  Approved By: Warden (Block A)          │
│  Approved At: 16-Feb-2025, 1:00 PM     │
│                                         │
│  Exit: 16-Feb-2025, 2:00 PM            │
│  Return: 16-Feb-2025, 4:00 PM          │
│  Purpose: Visit library for study      │
│                                         │
│  VISIBLE BUTTONS/ACTIONS:               │
│  ✓ ✅ SHOW QR CODE button               │
│    (Click to see QR code)               │
│  ❌ Approve/Reject buttons              │
│  ❌ Check In/Out buttons                │
│                                         │
│  QR CODE MODAL (when clicked):          │
│  ┌─────────────────────────────┐        │
│  │    [QR CODE IMAGE]          │        │
│  │                             │        │
│  │    Pass ID: 123             │        │
│  │    Student: Raj Kumar       │        │
│  │    Valid Until: 4:00 PM     │        │
│  │                             │        │
│  │  [Screenshot] [Print]       │        │
│  └─────────────────────────────┘        │
└─────────────────────────────────────────┘


SECURITY VIEWING APPROVED PASS (AT GATE)
═════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────┐
│  Gate Pass #123 - RAJ KUMAR             │
│  Status: 🟢 APPROVED                    │
│  Approved By: Warden (Block A)          │
│  Approved At: 16-Feb-2025, 1:00 PM     │
│                                         │
│  VERIFICATION DETAILS:                  │
│  Student Name: Raj Kumar                │
│  Hall Ticket: 19B31A0587                │
│  Building: Block A, Room 101            │
│  Pass Type: Day                         │
│  Purpose: Visit library for study      │
│                                         │
│  APPROVAL CHAIN:                        │
│  ✓ Created by: Student (2:00 PM)       │
│  ✓ Approved by: Warden (1:00 PM)       │
│  ✓ Parent Informed: Yes                │
│                                         │
│  VISIBILITY OPTIONS:                    │
│  • View QR Code for verification        │
│  • View pass details                    │
│  • Check approval status                │
│                                         │
│  ACTION BUTTONS (STUDENT EXITING):      │
│  ✓ ✅ CHECK IN button                   │
│    (Records student leaving)            │
│                                         │
│  CANNOT:                                │
│  ❌ Approve/Reject pass                 │
│  ❌ Modify any details                  │
│  ❌ View parent contact info            │
│  ❌ See student's personal info         │
└─────────────────────────────────────────┘


SECURITY VIEWING IN-TRANSIT PASS (STUDENT RETURNING)
═════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────┐
│  Gate Pass #123 - RAJ KUMAR             │
│  Status: 🔵 IN-TRANSIT                  │
│  Check-In: 16-Feb-2025, 2:15 PM        │
│  (Student exited 15 minutes ago)        │
│                                         │
│  TIMELINE:                              │
│  Exit Approved: 2:00 PM - 4:00 PM      │
│  Actual Check-In: 2:15 PM (on time)    │
│  Expected Return: 4:00 PM               │
│  Current Status: Outside (OK)           │
│                                         │
│  ACTION BUTTONS (STUDENT RETURNING):    │
│  ✓ ✅ CHECK OUT button                  │
│    (Records student returning)          │
│  ❌ Check In button (already checked in)│
│                                         │
│  When Click CHECK OUT:                  │
│  → Records return time                  │
│  → Calculates total duration            │
│  → Updates pass status to COMPLETED     │
│  → Notifies warden                      │
│  → Student gets real-time update        │
└─────────────────────────────────────────┘


VISIBILITY RULES BY ROLE:
═════════════════════════════════════════════════════════════════════════

┌──────────────────┬──────────┬────────┬────────┬──────────┬────────────┐
│     BUTTON       │ STUDENT  │ WARDEN │HEAD_WD │ SECURITY │   ADMIN    │
├──────────────────┼──────────┼────────┼────────┼──────────┼────────────┤
│ Create Pass      │ ✓ (own)  │   ❌   │   ❌   │   ❌     │     ✓      │
│ Approve          │   ❌     │   ✓    │   ✓    │   ❌     │     ✓      │
│ Reject           │   ❌     │   ✓    │   ✓    │   ❌     │     ✓      │
│ Call Parent      │   ❌     │   ✓    │   ✓    │   ❌     │     ✓      │
│ Show QR Code     │ ✓(approv)│   ❌   │   ❌   │   ❌     │     ❌     │
│ Check In         │   ❌     │   ❌   │   ❌   │   ✓      │     ✓      │
│ Check Out        │   ❌     │   ❌   │   ❌   │   ✓      │     ✓      │
│ View Details     │ ✓(own)   │ ✓(bldg)│   ✓    │   ✓      │     ✓      │
│ View Audit Log   │   ❌     │   ✓    │   ✓    │   ✓      │     ✓      │
└──────────────────┴──────────┴────────┴────────┴──────────┴────────────┘
```

---

## PART 10: MOBILE RESPONSIVENESS

```
┌──────────────────────────────────────────────────────────────────────┐
│         MOBILE-OPTIMIZED GATE PASS WORKFLOW (320px - 768px)          │
└──────────────────────────────────────────────────────────────────────┘

STUDENT MOBILE VIEW - CREATE PASS
═════════════════════════════════════════════════════════════════════════

📱 iPhone SE (375px width)

┌─────────────────────────┐
│  🏨 GATE PASSES        │
│  ━━━━━━━━━━━━━━━━━━━━  │
│                         │
│  [+ Create Pass] ← 44px │
│       Button           │
│  (Full width mobile)   │
│                         │
│  Pending Gate Passes:   │
│  ┌─────────────────────┐
│  │  📋 Pass #123       │
│  │  Status: Pending 🟠 │
│  │                     │
│  │  Raj Kumar          │
│  │  Hall: 19B31A0587   │
│  │                     │
│  │  Exit: 16-Feb, 2pm  │
│  │  Return: 16-Feb,4pm │
│  │                     │
│  │  Purpose: Library   │
│  │                     │
│  │  [View Details >]   │
│  └─────────────────────┘
│  (Card layout, no scroll)
│                         │
└─────────────────────────┘

FORM LAYOUT:
┌─────────────────────────┐
│  Create Gate Pass       │
│  ━━━━━━━━━━━━━━━━━━━━  │
│                         │
│  Pass Type *           │
│  [Day ▼]               │
│  (Full width select)   │
│                         │
│  Purpose *             │
│  [Text input field]    │
│  (44px minimum height) │
│                         │
│  Destination           │
│  [Text input field]    │
│                         │
│  Exit Date *           │
│  [16-Feb-2025]         │
│                         │
│  Exit Time *           │
│  [14:00 ▼]             │
│                         │
│  Return Date *         │
│  [16-Feb-2025]         │
│                         │
│  Return Time *         │
│  [16:00 ▼]             │
│                         │
│  [Submit Request]      │
│  (Full width, 48px)    │
│  [Cancel]              │
│  (Full width, 44px)    │
│                         │
└─────────────────────────┘

OPTIMIZATIONS:
✓ Full-width buttons (44px+ height)
✓ Card-based layout (no horizontal scroll)
✓ Stacked form fields
✓ Single-column design
✓ Large touch targets
✓ Readable font sizes
✓ No small UI elements
✓ Responsive spacing


WARDEN MOBILE VIEW - APPROVAL
═════════════════════════════════════════════════════════════════════════

📱 iPad (768px width)

┌─────────────────────────────────────┐
│  🚪 GATE PASSES MANAGEMENT         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│  Pending: 3 | Approved: 12         │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 📋 Pass #123 - RAJ KUMAR      │ │
│  │ Status: 🟠 PENDING            │ │
│  │                               │ │
│  │ Room: A101 | Building: Block A│ │
│  │ Exit: 16-Feb, 2:00 PM        │ │
│  │ Return: 16-Feb, 4:00 PM      │ │
│  │                               │ │
│  │ Purpose: Library visit        │ │
│  │ Audio Brief: [Play] 45sec    │ │
│  │                               │ │
│  │ ┌──────────────────────────┐ │ │
│  │ │ PARENT CONTACT PROTOCOL: │ │ │
│  │ │ Father: 📞 +91-9876543210│ │ │
│  │ │ Mother: 📞 +91-9876543211│ │ │
│  │ │ Guardian: 📞 +91-9876543212│ │
│  │ └──────────────────────────┘ │ │
│  │                               │ │
│  │ ☑ Parent Informed (checked)   │ │
│  │                               │ │
│  │ Approval Remarks:             │ │
│  │ [Text input - optional]       │ │
│  │                               │ │
│  │ [✅ Approve] [❌ Reject]      │ │
│  │ (Side by side on tablet)      │ │
│  │                               │ │
│  └───────────────────────────────┘ │
│                                     │
│  More Pending Passes...             │
│                                     │
└─────────────────────────────────────┘

MOBILE OPTIMIZATIONS:
✓ Buttons stack vertically on small screens
✓ Buttons side-by-side on tablets
✓ Clickable phone numbers (tel://)
✓ Card layout for pass details
✓ Checkbox easily tappable (44px)
✓ Text input fields full width
✓ Form sections clearly separated


SECURITY MOBILE VIEW - VERIFICATION
═════════════════════════════════════════════════════════════════════════

📱 Smartphone (360px width)

┌──────────────────────────┐
│  🔐 GATE VERIFICATION   │
│  ━━━━━━━━━━━━━━━━━━━━  │
│                          │
│  Search Pass:            │
│  ┌──────────────────────┐│
│  │ 🔍 QR Code or...     ││
│  │ Hall Ticket / Name   ││
│  └──────────────────────┘│
│                          │
│  [Scan QR Code]         │
│  [Search Manually]      │
│                          │
│  ━━━━━━━━━━━━━━━━━━━━  │
│                          │
│  Found: Pass #123       │
│  📋 Raj Kumar          │
│  Hall: 19B31A0587      │
│  Building: Block A     │
│                          │
│  Status: ✅ APPROVED    │
│  Checked: Not yet      │
│                          │
│  Exit: 16-Feb, 2:00pm  │
│  Return: 16-Feb, 4:00pm│
│  Duration: 2 hours     │
│                          │
│  Approval: Warden      │
│                          │
│  STUDENT EXITING:      │
│  ✓ Verified ✓          │
│                          │
│  [✅ CHECK IN]         │
│  (46px, full width)    │
│                          │
│  ━━━━━━━━━━━━━━━━━━━━  │
│  Check-In: 2:15 PM    │
│  Status: IN-TRANSIT    │
│                          │
│  STUDENT RETURNING:    │
│  ✓ Verified ✓          │
│                          │
│  [✅ CHECK OUT]        │
│  (46px, full width)    │
│                          │
│  Total Outside: 1h 45m │
│  ✓ Pass Completed!    │
│                          │
│  [New Search]          │
│                          │
└──────────────────────────┘

MOBILE OPTIMIZATIONS:
✓ Large QR scanner button
✓ Clear search field
✓ Card-based pass display
✓ Large action buttons (46px+)
✓ Confirmation messages
✓ Easy to use while standing
✓ One action per screen
✓ Back to search after action
```

---

## SUMMARY: WHEN TO USE THIS DOCUMENT

**Use this document to:**
1. ✅ Understand complete gate pass workflow
2. ✅ See how each role interacts with the system
3. ✅ Review permission matrix for compliance
4. ✅ Plan mobile implementation
5. ✅ Train staff on their responsibilities
6. ✅ Identify missing features
7. ✅ Plan testing scenarios

**Before making changes:**
- Review relevant section (Student/Warden/Security)
- Check permission matrix for conflicts
- Verify status lifecycle makes sense
- Test on mobile view
- Update this document accordingly

---

**STATUS:** ✅ COMPLETE & READY FOR IMPLEMENTATION

