---
description: Critical fixes and system control checkpoints implementation
---

# Implementation Checklist

## 1. Room Allocation Bug (Optimistic Locking) ✅ ALREADY IMPLEMENTED

- Room views already use `select_for_update`, retry loops, and optimistic timestamp validation.
- UniqueConstraint at DB level prevents duplicate active allocations.

## 2. Refresh → Permission Error ⚠️ NEEDS FIX

- `App.tsx` bootstrap calls `/profile/` on refresh.
- If 403 (e.g., college disabled), it logs out correctly.
- BUT: bootstrap treats any 403 as "unauthenticated" → causes incorrect logout.
- FIX: Only logout on 401. For 403, let the api interceptor handle redirect.

## 3. Mobile Layout Overflow ⚠️ NEEDS FIX

- Global CSS already has overflow-x: hidden and max-width: 100%.
- Some button groups in pages may still overflow.
- FIX: Add responsive button styling improvements.

## 4. Feature Parity (Desktop/Mobile) ⚠️ NEEDS FIX

- BottomNav has limited items (max 5).
- Sidebar on mobile has all items.
- FIX: Ensure BottomNav has "More" menu and sidebar is accessible.

## 5-8. College/Hostel/Block/Floor ON/OFF System ✅ ALREADY IMPLEMENTED

- College model has `is_active`, `disabled_reason`
- Hostel model has `is_active`, `disabled_reason`
- Building model has `is_active`, `disabled_reason`, `disabled_floors`
- CollegeAccessMiddleware handles all 4 tiers
- Toggle endpoints exist on ViewSets
- API interceptor on frontend handles COLLEGE_DISABLED, HOSTEL_DISABLED, BLOCK_DISABLED, FLOOR_DISABLED

## 9. Gate Pass Digital Card ⚠️ NEEDS ENHANCEMENT

- DigitalCard exists and shows gate pass info.
- Need to add more gate pass details to the card.

## 10. Mass CSV Bulk Creation ⚠️ NEEDS FIX

- `bulk_upload` action exists in UserViewSet.
- Needs better error handling for partial failures.
- Needs to continue on individual row failures vs batch rollback.

## 11. Sidebar Fix ⚠️ NEEDS FIX

- Last menu item going under bottom nav on mobile.
- Need scrollable sidebar with sticky logout.
