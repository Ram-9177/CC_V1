# Super Admin capability matrix (multi-tenant)

This document maps **platform vs college** ownership to code. It complements [ROLE_GOVERNANCE.md](ROLE_GOVERNANCE.md).

## Ownership summary

| Actor | Scope | Tenant (College) records | Users |
|-------|--------|---------------------------|-------|
| **super_admin** | All colleges | Create, update, delete, enable/disable (`toggle_active`), subscription fields | All users; only role that may promote another user to **admin** (see `AdminControlViewSet`) |
| **admin** | Single `user.college` | Read own college; **module_config** and **usage_stats** for own college only | Users within college (UI/backend rules apply) |
| **Other roles** | RBAC + optional `RolePermission` rows | No college CRUD | Per viewset and `CollegeScopeMixin` |

## RBAC modules (`super_admin`)

Static fallback matrix in `core/rbac.py` — `PERMISSION_MATRIX['super_admin']` grants **full** on every product module:

| Module slug | Level |
|-------------|--------|
| `hostel` | full |
| `sports` | full |
| `hall` | full |
| `fees` | full |
| `gatepass` | full |
| `notices` | full |
| `meals` | full |
| `security` | full |
| `reports` | full |
| `complaints` | full |
| `notifications` | full |

Effective paths for navigation/API permission hints also include **`ROLE_EXTRA_PATHS['super_admin']`**: `/colleges`, `/metrics`, `/reports`, `/users`.

> **Note:** Production may override levels via DB `RolePermission` (`seed_rbac`); the matrix above is the unseeded fallback.

## College API (`CollegeViewSet`)

| Action | Who |
|--------|-----|
| `list` / `retrieve` | Authenticated users; full serializer for `admin` / `super_admin`, minimal serializer for non-admin roles |
| `create` / `update` / `partial_update` / `destroy` | **super_admin** only (`IsSuperAdmin`) |
| `toggle_active` | **super_admin** only (permission + in-action check) |
| `module_config` (GET/POST) | **super_admin** (any college) or **admin** / **super_admin** scoped to own college |
| `usage_stats` | Same as `module_config` |
| `update_subscription` | **super_admin** only |

Platform analytics: `GET /api/colleges/platform-analytics/` — **super_admin** only (`SuperAdminAnalyticsView`).

## Governance APIs

| Endpoint / view | super_admin |
|-----------------|-------------|
| `AdminControlViewSet.update_role` | Allowed; **only super_admin** may set target role to `admin` |
| `AdminControlViewSet.audit_trail` | Allowed with `admin` |
| Bulk user jobs (`BulkOperationViewSet`) | `admin` and `super_admin` |

## Data layer bypass (cross-tenant reads)

| Mechanism | super_admin behavior |
|-----------|----------------------|
| `CollegeScopeMixin` | No college filter — sees all rows |
| `CollegeModelViewSet` (`core/views/base.py`) | Same |
| `TenantManager.for_user` | Unfiltered queryset |
| `ScopedQuerySet.scoped()` | Bypass tenant slice when `user_is_super_admin(user)` |

## Frontend reference

| Area | File | Notes |
|------|------|--------|
| Static route allow list | `src/lib/rbac.ts` — `ROLE_ALLOWED_PATHS.super_admin` | Fallback when `/auth/my-permissions/` is unavailable |
| Default home after login | `src/lib/rbac.ts` — `ROLE_HOME.super_admin` | `/colleges` (platform entry) |
| Sidebar | `src/components/layout/Sidebar.tsx` — `roleWorkflows.super_admin` | Platform section first |
| Colleges UI (CRUD) | `src/pages/CollegesPage.tsx` | Add / delete / toggle only if `super_admin` |
| Admin dashboard | `src/pages/Dashboard.tsx` | Super admin sees platform banner + `/metrics/dashboard/` platform-wide cached payload |

## Metrics API (super admin)

| Endpoint | Behavior |
|----------|----------|
| `GET /api/metrics/dashboard/` | For `super_admin`, builds **platform-wide** counters in `_build_super_admin_dashboard_metrics_payload` (Redis cache key `metrics:dashboard:super_admin:platform:v2`, TTL 120s). Avoids unscoped college filters when `user.college` is null. |
| `GET /api/metrics/activities/` | Uses a longer cache TTL for super admin; slightly smaller per-feed slice to reduce sort cost. |

## Source of truth for “what can I open?”

Prefer **`GET /api/auth/my-permissions/`** (`allowed_paths`) over static frontend lists. Keep `src/lib/rbac.ts` aligned for offline fallback and first paint.
