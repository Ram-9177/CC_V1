# Floor Map Loading - Testing Guide

## ✅ Fix Applied

Added error logging, retry logic, and caching to Floor Map queries in AttendancePage.tsx:

**Changes Made:**
1. Added try-catch blocks to both API calls
2. Added `retry: 1` to retry once on failure
3. Added `staleTime` to cache results (prevent unnecessary API calls)
4. Added error logging to browser console

## 🧪 How to Test

### Step 1: Hard Refresh Browser
```
Cmd+Shift+R  (or Cmd+R on Mac, Ctrl+Shift+R on Windows)
```

### Step 2: Open DevTools
```
F12 → Console Tab
```

### Step 3: Navigate to Attendance Page
1. Go to main dashboard
2. Find and click **Attendance** page
3. Switch to **Map View** tab (if available)

### Step 4: Watch Console for Messages

**Good Signs:**
```
✅ [PERF] GET /api/rooms/mapping/: 45.23ms
✅ Floor map loads with building data
✅ Rooms display with occupancy colors
```

**Bad Signs (Errors to Fix):**
```
❌ [AttendancePage] Buildings API error: ...
❌ [AttendancePage] Floor map API error: ...
❌ 401 Unauthorized (auth token expired)
❌ 403 Forbidden (user role not allowed)
❌ 404 Not Found (endpoint doesn't exist)
```

## 🔍 Common Issues & Solutions

### Issue 1: "Loading Floor Map..." stuck
**Cause:** API request hanging or timing out
**Check:** Browser console for `[AttendancePage]` error messages
**Fix:** Check if:
- User has required role (warden, admin, head_warden, etc.)
- API endpoint `/api/rooms/mapping/` exists on backend
- Django server is running on port 8000

### Issue 2: 401 Unauthorized
**Cause:** Auth token expired
**Fix:** 
1. Refresh page
2. Login again if prompted
3. Try Floor Map again

### Issue 3: 403 Forbidden
**Cause:** User role not in allowed list
**Roles that can view floor map:**
- super_admin
- admin
- head_warden
- warden
- hr
- staff
- incharge
- principal
- director
- hod
- chef
- head_chef

**Fix:** Login as user with one of these roles

### Issue 4: No floor map data appears
**Cause:** Building has no floors or rooms in database
**Fix:** Check Django admin - ensure buildings have floor and room records

## 📊 Performance Metrics

After hard refresh, check:
1. **Console [PERF] log**: Should show ~40-100ms response time
2. **Network tab**: `/api/rooms/mapping/` should return 200 status
3. **Response payload**: Should contain building/floor/room data

## ✨ Expected Behavior

1. **Click Map View** → "LOADING FLOOR MAP..." appears
2. **Buildings API loads (0-2s)** → Building buttons appear at top
3. **Click a building** → Floor map loads with rooms
4. **Rooms display** with color-coded occupancy:
   - 🟢 Green = Present
   - 🔴 Red = Absent
   - 🟠 Orange = Outside

## 🚀 Next Steps if Still Stuck

1. **Share console error** - Copy exact error message
2. **Check backend** - Verify `/rooms/mapping/` endpoint exists
3. **Check database** - Ensure building/floor/room data exists
4. **Check auth** - Verify user token and role

---

**Status:** ✅ Code fixes applied  
**Next:** Test in browser and report any console errors shown
