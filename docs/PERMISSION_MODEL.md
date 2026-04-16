# Permission Model

## Purpose

This document defines the current permission model and the migration path toward a capability-based model that supports modular domain growth without breaking existing access behavior.

## Current State Summary

The frontend currently uses a hybrid authorization model.

### Source of Truth Today

1. Static role and route rules in `src/lib/rbac.ts`
2. Dynamic permission payloads from `/auth/my-permissions/`
3. Client hook access through `src/hooks/useMyPermissions.ts`

### Current Enforcement Behavior

In `src/App.tsx`, route access is resolved as:

- use `permissions.allowed_paths` when the permission payload exists
- otherwise fall back to `canAccessPath(...)` from `src/lib/rbac.ts`

This means the app already has a DB-driven permission layer, but route enforcement remains path-oriented and retains a static fallback.

## Current Model Strengths

- Backward compatible with existing roles.
- Simple route gating.
- Supports server-driven path allowlists.
- Already includes module capability payloads in `RBACPermissions.modules`.

## Current Model Limitations

- Path checks are coarse-grained.
- UI actions inside a page can require more nuance than route access.
- Static role logic is centralized and hard to evolve safely as domains grow.
- Permission ownership is not colocated with domains.

## Target Model

The target model is capability-based, domain-owned, and server-driven.

### Target Layers

- `core/permissions/`
  - generic permission evaluation
  - authz hooks
  - route guard helpers
  - compatibility adapters
- `domains/<domain>/permissions/`
  - domain capability constants
  - domain-level guard helpers
  - local permission mappings for UI actions

## Capability Model

Capabilities should follow a stable namespaced format:

```text
<domain>.<action>
```

Examples:

- `attendance.view`
- `attendance.mark`
- `attendance.export`
- `meals.view`
- `meals.manage_menu`
- `rooms.assign`
- `complaints.resolve`
- `users.edit`
- `reports.export`

## Permission Shapes

The current API contract already includes:

```ts
interface RBACPermissions {
  role: string
  modules: Record<string, { level: string; capabilities: string[] }>
  allowed_paths: string[]
}
```

This is sufficient for a phased migration because:

- `allowed_paths` preserves existing route gating
- `modules[*].capabilities` can power action-level checks

## Migration Plan

### Phase 1: Preserve Existing Route Behavior

Keep the current route decision model:

- prefer server-returned `allowed_paths`
- fall back to static `rbac.ts` behavior

No route access semantics change in this phase.

### Phase 2: Introduce Core Permission Helpers

Create core helpers with behavior equivalent to today:

- `hasPathAccess(path)`
- `hasCapability(capability)`
- `hasAnyCapability(capabilities)`
- `hasAllCapabilities(capabilities)`

Initially, these helpers should wrap the existing payload and fallback logic.

### Phase 3: Start Action-Level Checks Inside Domains

Use capabilities for buttons, mutations, approvals, exports, and admin actions before changing route logic.

Examples:

- show upload actions only when `meals.manage_menu`
- allow complaint resolution only when `complaints.resolve`
- allow audit export only when `reports.export`

### Phase 4: Colocate Capability Declarations With Domains

Each domain defines its own capability constants under `domains/<domain>/permissions/`.

This makes permission ownership modular and reduces coupling to one central RBAC file.

### Phase 5: Reduce Static Role Logic To Compatibility Fallback

Once all critical pages and actions rely on server-driven capabilities:

- keep static role/path mappings only as fallback safety
- stop adding new permission logic to the static role table

### Phase 6: Optional Future Route Capability Mapping

If needed later, route registration can declare required capabilities directly, but this is not required for V1.

Example:

```ts
{
  path: 'reports',
  requiredCapabilities: ['reports.view'],
}
```

This should only happen after server capability coverage is complete.

## Backward Compatibility Rule

During migration:

- roles remain valid inputs
- `allowed_paths` remains supported
- existing route outcomes must not change
- static `rbac.ts` fallback remains until server capability coverage is trusted

No permission migration is acceptable if it changes access for current users without an explicit policy change.

## Recommended Core API

The future `core/permissions` layer should expose a small stable API:

```ts
type PermissionCheck = string | string[]

hasCapability(check: string): boolean
hasAnyCapability(checks: string[]): boolean
hasAllCapabilities(checks: string[]): boolean
hasPathAccess(path: string): boolean
```

## Domain Permission Template

Example:

```ts
export const REPORTS_CAPABILITIES = {
  view: 'reports.view',
  export: 'reports.export',
  audit: 'reports.audit',
} as const
```

## Practical Migration Rule

For new work:

- new page access may continue using route/path gating
- new in-page actions should prefer capability checks
- new capabilities should be declared in the owning domain, not a central catch-all file
