# Role Governance and Scope Model

This document defines role authority boundaries for the hostel product.

## Ownership Levels

### Super Admin (Global Owner)
- Scope: global (all tenant colleges)
- Authority: full product control across all modules and all colleges
- Use case: platform operations and cross-tenant administration

### Admin (College Owner)
- Scope: college
- Authority: full control inside assigned college only
- Use case: operational owner for a single institution using the product

### College (tenant) API boundaries

- **Creating, editing, or deleting** a `College` record (true multi-tenant lifecycle) is restricted to **`super_admin`** only (`CollegeViewSet` uses `IsSuperAdmin` for `create` / `update` / `destroy` / `toggle_active`).
- **College `admin`** (and `super_admin`) may use **`module_config`** and **`usage_stats`** for **their own** college only.
- **Subscription tier and `max_users`** updates remain **`super_admin`** only (`update_subscription`).
- **Tenant (student) directory** (`TenantViewSet` list): **`super_admin`** sees all colleges; **`admin`** is restricted to tenants whose `user.college` matches their own (same pattern as `CollegeScopeMixin` on domain models).
- **Governance** (`operations` — `update_role`, `audit_trail`): **`admin`** may act only on users in their college and cannot modify **`admin` / `super_admin`** accounts; audit entries are filtered to actors in their college. **`super_admin`** (and Django `is_superuser` per `user_is_super_admin`) remains unscoped for these actions.

See [SUPER_ADMIN_CAPABILITY_MATRIX.md](SUPER_ADMIN_CAPABILITY_MATRIX.md) for the full matrix. For production scale (thousands of users), see [SUPER_ADMIN_LAUNCH_READINESS.md](SUPER_ADMIN_LAUNCH_READINESS.md).

## Hostel Chain of Command

### Head Warden (College Hostel Head)
- Scope: college hostel operations
- Authority: all warden capabilities plus head control over warden operations
- Core responsibilities:
  - manage wardens and hostel student operations
  - control hostel workflows and escalations
  - grant/revoke extended block visibility for wardens when needed

### Warden (Block or Area Operator)
- Scope: assigned blocks/floors by default
- Authority: hostel operational management in assigned area
- Notes:
  - a warden is scoped to assigned blocks/floors unless cross-block override is enabled
  - cross-block override is controlled by Head Warden/Admin

## Department Heads and Teams

### Head Chef
- Scope: kitchen and mess operations
- Authority: supervises chef workflows and module operations

### Chef
- Scope: kitchen operations
- Authority: menu and meal execution workflows

### Security Head
- Scope: security operations
- Authority: supervises gate security and security workflows

### Gate Security
- Scope: security execution
- Authority: scan/verification and assigned operational actions

## Incharge Role

- Scope: assigned partial support role
- Authority: restricted view-level support actions, not full management
- Design intent: assist operations without broad write powers

## Scope Override Toggle

The User model includes a controlled toggle:
- field: can_access_all_blocks
- purpose: temporarily or permanently allow a warden to operate across all blocks in their college
- who can set:
  - Admin
  - Head Warden (for warden users)

This is used to handle practical cases like block transfers mid-semester without delaying operations.

## API Visibility

The permissions endpoint includes role governance metadata:
- role_governance.scope
- role_governance.label
- role_governance.description

Use this metadata in frontend UX to display authority boundaries clearly.
