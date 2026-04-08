# Mobile Refactor – Implementation Progress

## PHASE 1 – ROLE FILTERING FIX (Backend) ✅ COMPLETE

### Changes Made:

1. **`backend_django/apps/auth/views.py`** – `UserViewSet.get_queryset()`
   - Students can now only see themselves + staff/warden roles (not other students)
   - Blocks student-to-student search (visitor module security fix)

2. **`backend_django/apps/complaints/views.py`** – Full rewrite
   - HR toggle: added `toggle_student_complaints` endpoint (warden/admin only)
   - Default: Only HR/Student HR can create complaints
   - Students see "Contact HR to raise complaint" when toggle is OFF
   - Added `complaint_settings` GET endpoint to check toggle state

3. **`backend_django/apps/notices/views.py`** – `perform_create()`
   - Students blocked from creating notices entirely
   - Student HR auto-scoped to their assigned block/building
   - Cannot create 'all' or 'staff' audience notices

### Already Correct (No Changes Needed):

- ✅ Attendance: Students filtered to own data only
- ✅ Fines/Disciplinary: Create restricted to IsWarden | IsAdmin
- ✅ Visitors: Create restricted to IsGateSecurity | IsWarden | IsAdmin
- ✅ Visitor queryset: Students see only their own visitors
- ✅ Leaves: Students see only their own leaves

## PHASE 2 – MOBILE UI RESTRUCTURE ✅ COMPLETE

### Profile Page (`src/pages/ProfilePage.tsx`)

- ✅ Mobile: Shows ONLY Digital Card + compact inline edit form
- ✅ Phone number disabled for students (Warden+ only can edit)
- ✅ Desktop header hidden on mobile (cleaner layout)
- ✅ Tabs section hidden on mobile (`hidden md:block`)
- ✅ Mobile compact change password form
- ✅ Reduced API calls: Uses auth store user as `initialData` (instant render, background refresh)

### Dashboard (`src/components/dashboard/StudentDashboard.tsx`)

- ✅ Active pass shows details INLINE (no redirect to /gate-passes)
- ✅ Shows: Type, Status, Exit/Return dates, Destination, Approved At, Time Remaining
- ✅ Desktop still has "View All" link to gate-passes page
- ✅ Time remaining with live countdown

### Meals Page (`src/pages/MealsPage.tsx`)

- ✅ Mobile student view: Stacked cards (no tab overhead)
- ✅ Shows: Today's Menu cards, Preferences selectors, Special Request form, My Requests
- ✅ Hides: Attendance tab, Forecast metrics, full tab navigation
- ✅ Full tabs preserved for desktop and authority roles

### Sidebar (`src/components/layout/Sidebar.tsx`)

- ✅ Profile card already positioned ABOVE menu items (was done previously)

## PHASE 3 – NOTIFICATION FIX (Pending)

### Remaining Gaps:

- `src/pages/NotificationsPage.tsx` still requests browser notification permission directly in the subscribe flow.
- Notification list and unread count still keep fallback refresh behavior even though realtime sync exists.

## PHASE 4 – PERFORMANCE (Pending)

### Remaining Gaps:

- `src/components/dashboard/StudentDashboard.tsx` still polls the bundled student dashboard query every 2 minutes.
- `src/pages/DigitalID.tsx` and `src/components/profile/DigitalIDDialog.tsx` still use 30 to 60 second refetch intervals.
- `src/components/dashboard/WardenDashboard.tsx`, `src/components/dashboard/ChefDashboard.tsx`, `src/hooks/useRoleStats.ts`, and `src/hooks/features/useAdmin.ts` still rely on periodic refetching.
- `src/hooks/features/useAttendance.ts` and `src/hooks/features/useGatePasses.ts` still poll for live status updates.

## PHASE 5 – BUG FIXES (Pending)

### Remaining Gaps:

- The notification permission flow and polling cleanup should be verified in the browser after the realtime sync changes.
- Any remaining dashboard pollers should be reviewed for websocket or mutation-driven invalidation before being removed.
