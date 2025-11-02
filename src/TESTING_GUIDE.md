# HostelConnect - Testing Guide

## 🔌 Realtime & Backend Smoke Tests (recommended)

Before manual screen testing, validate that your backend and websockets are reachable.

1) Set env variables in your shell:

```
export SMOKE_API_URL="https://your-api.example.com"
export SMOKE_WS_URL="wss://your-ws.example.com"
# Optional JWT for protected checks (login first and copy token)
export SMOKE_AUTH_TOKEN="<jwt>"
```

2) Run the smoke test (auto-loads .env and falls back to VITE_API_URL/VITE_WS_URL):

```
npm run smoke
```

What it does:
- GET /health → expects 200
- Optional GET /auth/me (when token provided)
- Socket.IO connect to WS with token (when provided)
- Optional protected GET /notices/my

Expected: All checks pass. If not, verify CORS, WS auth, and secrets.
Tip: You can set VITE_API_URL and VITE_WS_URL in a .env file and the smoke test will pick them up.

Socket events the frontend listens to (server should emit):
- Users: `user:created`, `user:updated`, `user:deleted`, `user:imported`
- Notices: `notice:created`, `notice:updated`, `notice:deleted`
- Gate passes: `gate-pass:created`, `gate-pass:approved`, `gate-pass:rejected`, `gate-pass:revoked`, `gate-pass:scanned`
- Attendance: `attendance:session-started`, `attendance:session-ended`, `attendance:marked`
- Rooms: `room:upserted`, `room:assigned`, `room:unassigned`, `room:bulkAssigned`
- Meals/Intents: server-specific events for intent changes and menu updates

---

## 🔔 Push quick replies for Meals

End-to-end checklist to validate “outside-the-app” Yes/No and reminder suppression when mess is closed:

- Prereqs
   - Ensure the service worker is active (visit the app once; check Application → Service Workers in the browser devtools)
   - Verify `VITE_API_URL` points to a backend with the meals module and notifications configured
   - Run DB migration that adds `meal_menus.closed` (see backend migrations)

- Student device registration
   - Login as a student so the JWT is stored and bridged to the service worker
   - Register a web push token or device token for that student (Notifications → Register)

- Mess closed suppression
   - Create menus for a test date
   - Mark any menu’s `closed` flag true (via API or DB for now)
   - Trigger a reminder (Chef → Send Reminder or wait for cron)
   - Expected: No reminder should be delivered to any student when any menu for that date is closed

- Outpass suppression
   - Create an ACTIVE gate pass overlapping the target date for a test student
   - Trigger a reminder
   - Expected: That student should not receive the reminder

- Quick reply without opening app
   - Send a meal reminder push (manual or cron)
   - On the notification, tap Yes or No action
   - Expected: The service worker posts to `/meals/intent` with the stored JWT; backend saves the intent; Chef board updates via realtime and the totals reflect the change

- Summary API shape
   - `GET /meals/intents/summary?date=YYYY-MM-DD` returns per-meal totals `{ BREAKFAST, LUNCH, DINNER }` each with `{ yes, same, no, outside }`
   - `GET /meals/intents/my?date=YYYY-MM-DD` returns the student’s intents keyed by meal type, when present

Troubleshooting tips
- If actions don’t appear on the notification, make sure the payload has `data.type = 'MEAL_INTENT_REQUEST'` (the SW adds actions when this type is present)
- If quick replies succeed but don’t reflect in the Chef board, ensure Socket.IO is connected and the server emits `meals:intent-updated` with counts
- If you see auth failures from the SW, confirm the auth token is synced: the app posts `{ type: 'AUTH_TOKEN' }` to the SW after login and on load

## 🧪 How to Test All Screens

### Step 1: Login and Role Selection

1. Go to `/` (Welcome Screen)
2. Click "Get Started"
3. Select a role from the Role Picker
4. You'll be redirected to that role's dashboard

---

## 📱 Testing Each Role

### STUDENT Role Testing

**Login as Student:**
- Hallticket: HT001
- Role: STUDENT

**Test These Routes:**

1. **Dashboard** → `/student`
   - ✅ Should show: Stats cards, charts, quick actions, recent activity

2. **Gate Pass Dashboard** → `/student/gate-pass`
   - ✅ Should show: Active/pending passes list, stats, create button

3. **Create Gate Pass** → `/student/gate-pass/create`
   - ✅ Should show: Form with reason, destination, dates

4. **Gate Pass Detail** → `/student/gate-pass/GP001` (click any pass)
   - ✅ Should show: Pass details, ad gate, QR code area

5. **Attendance** → `/student/attendance`
   - ✅ Should show: Stats, calendar, attendance records

6. **Meals** → `/student/meals`
   - ✅ Should show: Menu, preferences, calendar

7. **Notices** → `/student/notices`
   - ✅ Should show: Pinned notices, all notices list

---

### GATEMAN Role Testing

**Login as Gateman:**
- Hallticket: GATEMAN001
- Role: GATEMAN

**Test These Routes:**

1. **Dashboard** → `/gateman`
   - ✅ Should show: Stats, charts, quick actions

2. **Gate Queue** → `/gateman/queue`
   - ✅ Should show: Students waiting for verification

3. **Scan QR** → `/gateman/scan`
   - ✅ Should show: QR scanner interface, recent scans

4. **Recent Events** → `/gateman/events`
   - ✅ Should show: Entry/exit logs, search, filters

---

### WARDEN Role Testing

**Login as Warden:**
- Hallticket: WARDEN001
- Role: WARDEN

**Test These Routes:**

1. **Dashboard** → `/warden`
   - ✅ Should show: Stats, charts, analytics

2. **Approvals** → `/warden/approvals`
   - ✅ Should show: Pending gate pass requests

3. **Attendance** → `/warden/attendance`
   - ✅ Should show: Sessions, blueprint, analytics tabs

4. **Users CSV** → `/warden/users`
   - ✅ Should show: Import/export interface, guidelines

5. **Notices** → `/warden/notices`
   - ✅ Should show: Create form, notices list

---

### CHEF Role Testing

**Login as Chef:**
- Hallticket: CHEF001
- Role: CHEF

**Test These Routes:**

1. **Dashboard** → `/chef`
   - ✅ Should show: Meal stats, charts, food waste metrics

2. **Meals Board** → `/chef/meals`
   - ✅ Should show: Today's menu, intent breakdown

3. **Intents Summary** → `/chef/intents`
   - ✅ Should show: Calendar, meal tabs, response rates

4. **Users CSV** → `/chef/users`
   - ✅ Should show: Same as warden users (shared component)

5. **Notices** → `/chef/notices`
   - ✅ Should show: Same as warden notices (shared component)

---

### SUPER_ADMIN Role Testing

**Login as Admin:**
- Hallticket: ADMIN001
- Role: SUPER_ADMIN

**Test These Routes:**

1. **Dashboard** → `/admin`
   - ✅ Should show: System stats, user growth, module usage

2. **Users** → `/admin/users`
   - ✅ Should show: All users by role, search

3. **Reports** → `/admin/reports`
   - ✅ Should show: Report generation, recent reports

4. **Notices** → `/admin/notices`
   - ✅ Should show: Same as warden notices (shared component)

---

## 🔍 What to Look For

### ✅ Every Screen Should Have:

1. **Header/Title**
   - Clear page title
   - Subtitle/description

2. **Stats Cards** (on most screens)
   - Numbers should be visible
   - Proper colors (green/red/blue/orange)

3. **Content Area**
   - Cards with data
   - Lists or tables
   - Forms or inputs

4. **Buttons**
   - Properly styled
   - Icons visible
   - Hover states work

5. **Responsive Design**
   - Works on mobile (< 640px)
   - Works on tablet (640-1024px)
   - Works on desktop (> 1024px)

6. **Dark Mode**
   - Toggle dark mode in browser/OS
   - All colors adjust properly
   - Charts adapt to theme

---

## ❌ If You See a Blank Screen

### Possible Causes:

1. **Not Logged In**
   - Solution: Go to `/login` or `/role-picker`

2. **Wrong Role**
   - Solution: Make sure you selected the right role
   - Check URL matches your role

3. **Console Errors**
   - Open Browser DevTools (F12)
   - Check Console tab for errors
   - Report any errors you see

4. **Import Error**
   - Check if component file exists
   - Verify import path in App.tsx

---

## 🧭 Navigation Test

### Desktop:
1. ✅ Sidebar should be visible on left
2. ✅ Click any menu item → page changes
3. ✅ Click logo → goes to welcome screen
4. ✅ Click user avatar → shows dropdown
5. ✅ Click logout → returns to welcome

### Mobile (< 768px):
1. ✅ Hamburger menu icon should appear
2. ✅ Click hamburger → sidebar slides in
3. ✅ Click menu item → page changes & sidebar closes
4. ✅ User avatar should be visible in header

---

## 📊 Charts Test

### Screens with Charts:

1. **Student Dashboard** → 3 charts
2. **Gateman Dashboard** → 3 charts
3. **Warden Dashboard** → 3 charts
4. **Chef Dashboard** → 5 charts
5. **Admin Dashboard** → 4 charts

### All Charts Should:
- ✅ Be visible (not empty)
- ✅ Have proper colors
- ✅ Show tooltips on hover
- ✅ Adapt to dark mode
- ✅ Be responsive (resize on mobile)

---

## 🎨 UI Components Test

### Test These Interactions:

1. **Buttons**
   - ✅ Hover changes color
   - ✅ Click shows feedback
   - ✅ Disabled state works

2. **Forms**
   - ✅ Can type in inputs
   - ✅ Validation works
   - ✅ Submit button enables/disables

3. **Dialogs/Modals**
   - ✅ Open on button click
   - ✅ Close on X or Cancel
   - ✅ Backdrop blur works

4. **Dropdowns**
   - ✅ Open on click
   - ✅ Select item works
   - ✅ Close after selection

5. **Tabs**
   - ✅ Click switches content
   - ✅ Active tab highlighted
   - ✅ Content changes

6. **Calendar**
   - ✅ Date picker works
   - ✅ Can select dates
   - ✅ Today is highlighted

---

## 📱 Responsive Breakpoints

### Test at These Widths:

1. **Mobile (375px)** - iPhone SE
   - ✅ Single column layout
   - ✅ Hamburger menu
   - ✅ Stacked cards

2. **Tablet (768px)** - iPad
   - ✅ 2-column grids
   - ✅ Sidebar visible
   - ✅ Some horizontal layouts

3. **Desktop (1440px)** - MacBook
   - ✅ Multi-column layouts
   - ✅ Side-by-side content
   - ✅ Full charts

4. **Large (1920px)** - External Monitor
   - ✅ Proper max-width
   - ✅ No excessive stretching
   - ✅ Content centered

---

## 🚨 Common Issues & Solutions

### Issue 1: "Cannot read property 'map' of undefined"
**Solution:** Mock data might be undefined. Check if data arrays exist.

### Issue 2: Charts not showing
**Solution:** Recharts needs non-zero data. Check mock data values.

### Issue 3: Blank sidebar
**Solution:** Navigation array might be wrong. Check role mapping.

### Issue 4: Buttons not clickable
**Solution:** Check z-index and pointer-events in CSS.

### Issue 5: Images not loading
**Solution:** Use ImageWithFallback component for all images.

---

## ✅ Expected Test Results

After testing all 27 routes, you should see:
- ✅ 0 blank screens
- ✅ 0 console errors
- ✅ All data displays correctly
- ✅ All buttons work
- ✅ All forms validate
- ✅ All charts render
- ✅ Responsive on all devices
- ✅ Dark mode works everywhere

---

## 🎯 Quick Verification Checklist

```
[ ] Welcome Screen works
[ ] Login/Role Picker works
[ ] Student Dashboard (7/7 screens)
[ ] Gateman Dashboard (4/4 screens)
[ ] Warden Dashboard (5/5 screens)
[ ] Chef Dashboard (5/5 screens)
[ ] Admin Dashboard (3/3 screens)
[ ] Navigation works
[ ] Mobile menu works
[ ] Dark mode works
[ ] Charts display
[ ] Forms work
[ ] Buttons respond
```

---

## 🐛 Found a Bug?

Please report:
1. Which route/screen
2. What you expected
3. What actually happened
4. Console errors (if any)
5. Browser & device
6. Screenshot (if possible)

---

**All 27 routes should work perfectly. If any screen appears blank, it's likely a data/auth issue, not a missing component.**

---

## 🚀 PWA & Android Test Playbook

### PWA install + offline
- Open the app in Chrome on Android or Desktop → Install/Add to Home Screen.
- Toggle Airplane Mode and refresh.
  - Expected: Shell loads from cache, HTML routes fallback to cached index.html, assets served from cache.
  - Attendance lists use SW stale-while-revalidate when online; offline uses session cache where available.

### Background sync for attendance
- Go to Warden → Attendance → open any active session.
- Turn off network (Airplane Mode), Manual Mark a student.
  - Expected: Toast shows “Offline: queued for sync” and Outbox badge appears with count.
- Turn network back on.
  - Expected: Queue flushes automatically (or tap Outbox to retry). Records reflect the mark afterward.

### Outbox badge behavior
- With queued items, the header shows “Outbox: N”.
- Tap it to force a retry.
- Expected: Count decrements to 0 after success.

### Sessions lists filters/sorting/pagination
- Warden → Attendance (Sessions tab):
  - Filter by status/date/search; change sort (createdAt vs scheduledAt).
  - Page through results (server-side pagination).
  - Expected: Result counts and pages align; “Export Sessions Page” downloads current page; “Export Filtered (All)” combines all pages.

### Records list filters/sorting
- In Session Details → Records:
  - Filter by status/search, sort by markedAt/status/hallticket.
  - Export page or export filtered (all) records.

### Service Worker update cycle
- Make a trivial change and rebuild; reload the app.
- Expected: SW updates on next load; a second reload serves the new assets.

### Android (Capacitor) quick run
Prereqs: Java 17, Android Studio + SDK.

1) Build web and sync:
   - npm run build
   - npm run cap:sync
2) Open Android Studio:
   - npm run cap:open:android
3) Build & run on a device (debug APK) or build an AAB for Play Console.

### TWA verification (when hosted on production domain)
- Ensure https://<your-domain>/.well-known/assetlinks.json is live with your package name + SHA-256.
- Use Bubblewrap:
  - bubblewrap init --manifest=https://<your-domain>/manifest.webmanifest
  - bubblewrap build
- Install/run built app on device; links should open full-screen, sharing origin storage.
