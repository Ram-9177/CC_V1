# Frontend Architecture

## Purpose

This document defines the current frontend architecture, the target modular structure, and the migration rules for moving from the current `src/` layout to a future-proof `app/`, `core/`, `domains/`, and `shared/` structure without changing runtime behavior.

## Current State Summary

The current frontend is a React 18 + TypeScript + Vite application organized primarily under `src/`:

- `src/main.tsx` bootstraps the app, `QueryClient`, theme selection, offline banner, and PWA update handling.
- `src/App.tsx` is the load-bearing composition root for routing, session bootstrap, auth guards, role/path authorization, suspense, and top-level error boundaries.
- `src/pages/` contains page-first feature entry points. The codebase currently has roughly 36 page files.
- `src/components/` contains shared UI, layout, feature widgets, dialogs, and screen-specific presentation. The codebase currently has roughly 90 component files.
- `src/hooks/` contains app-level and feature hooks, including `hooks/features/*`. The codebase currently has roughly 27 hook files.
- `src/lib/` contains cross-cutting infrastructure such as API clients, auth/session state, RBAC helpers, offline sync, websocket handling, event bus, and perf helpers. The codebase currently has roughly 23 files in this area.
- `src/types/index.ts` is a large central type registry that mixes cross-cutting and feature-specific contracts.

### Current Load-Bearing Execution Path

1. `src/main.tsx` creates the React root and shared `QueryClient`.
2. `src/App.tsx` verifies session state and fetches `/auth/profile/`.
3. Route access is decided by a hybrid model:
   - static role/path rules in `src/lib/rbac.ts`
   - DB-driven permissions from `/auth/my-permissions/` via `src/hooks/useMyPermissions.ts`
4. Pages render through `DashboardLayout` plus lazily loaded routes.

### Current Architectural Constraints

- The app uses `@/*` aliases mapped to `src/*`.
- Routing is centralized in one file (`src/App.tsx`).
- Permissions are already partly capability-aware at the API contract level, but route enforcement is still path-centric.
- Feature boundaries exist informally by folder naming, not by enforced module ownership.

## Target Structure

The target structure is additive and modular:

```text
app/
  bootstrap/
  providers/
  router/
  layouts/

core/
  api/
  auth/
  config/
  permissions/
  routing/
  state/
  realtime/

domains/
  attendance/
  meals/
  rooms/
  notices/
  events/
  complaints/
  users/
  reports/
  profile/
  auth/
  ...future domains

shared/
  ui/
  components/
  hooks/
  utils/
  types/
  constants/
```

## Ownership Model

### `app/`

Owns application composition only:

- app bootstrap
- provider wiring
- route registration
- global layouts
- application shell concerns

`app/` must not contain domain business logic.

### `core/`

Owns cross-cutting business infrastructure:

- API client setup
- auth/session bootstrap
- permission evaluation
- router helpers
- global state primitives
- websocket and offline infrastructure

`core/` may be imported by any layer.

### `domains/`

Owns feature/business modules:

- domain pages
- domain components
- domain hooks
- domain queries/mutations
- domain types
- domain permission declarations

Each domain should be independently movable and should expose a small public surface through an `index.ts`.

### `shared/`

Owns reusable, domain-agnostic building blocks:

- UI primitives
- generic components
- generic hooks
- utility functions
- shared type helpers

If code carries domain language like `meal`, `attendance`, `gate`, or `tenant`, it does not belong in `shared/`.

## Mapping From Current To Target

### Current `src/` to Target

- `src/main.tsx` -> `app/bootstrap/`
- `src/App.tsx` -> `app/router/` plus `app/providers/`
- `src/components/layout/*` -> `app/layouts/`
- `src/lib/api.ts`, `src/lib/auth.ts`, `src/lib/store.ts`, `src/lib/websocket.ts` -> `core/`
- `src/lib/rbac.ts` and permission helpers -> `core/permissions/`
- `src/components/ui/*` -> `shared/ui/`
- `src/components/common/*` and truly generic hooks/utilities -> `shared/`
- `src/pages/*`, `src/components/features/*`, `src/hooks/features/*` -> `domains/<domain>/`

### Initial Domain Candidates

Based on the current route set, the first domain modules should likely be:

- `auth`
- `dashboard`
- `attendance`
- `meals`
- `rooms`
- `gate-passes`
- `complaints`
- `users`
- `reports`
- `events`
- `profile`
- `sports`
- `placements`

## Migration Strategy

The migration must be incremental and zero-behavior-change.

### Phase 0: Document and Freeze Boundaries

- Keep runtime code where it is.
- Define target layers and import rules in docs.
- Treat `src/App.tsx` and `src/main.tsx` as the current composition roots.

### Phase 1: Introduce Target Folders

- Create `app/`, `core/`, `domains/`, and `shared/` as new top-level frontend folders when implementation begins.
- Re-export from old locations where needed.
- Do not change route paths, query keys, API paths, or store shape in this phase.

### Phase 2: Move Cross-Cutting Infrastructure

- Extract stable infrastructure from `src/lib/` into `core/`.
- Keep compatibility adapters in old `src/lib/*` files until all imports are migrated.

### Phase 3: Extract Shared UI

- Move reusable primitives and generic components into `shared/`.
- Leave domain-specific UI in place until the owning domain module exists.

### Phase 4: Extract Domains One at a Time

For each domain:

1. Create `domains/<domain>/`.
2. Move pages, components, hooks, queries, and types into that domain.
3. Export through a domain barrel.
4. Update route registration to import from the new domain public API.
5. Leave a thin re-export shim at the old path until the codebase is fully migrated.

### Phase 5: Split Router Composition

- Break `src/App.tsx` responsibilities into:
  - `app/providers/*`
  - `app/router/*`
  - `core/auth/*`
  - `core/permissions/*`
- Keep the route table behavior identical.

## Backward Compatibility Rule

The migration is invalid if it changes observable runtime behavior.

Non-negotiable rules:

- Existing route URLs must remain unchanged.
- Existing API endpoints and payload contracts must remain unchanged.
- Existing query keys should remain unchanged unless there is a deliberate cache migration plan.
- Existing auth bootstrap behavior must remain unchanged.
- Existing permission outcomes must remain unchanged during structural refactors.
- Old imports may remain as compatibility re-exports until the entire repo is migrated.

## Dependency Rules

Allowed dependency direction:

- `app` -> `core`, `domains`, `shared`
- `domains` -> `core`, `shared`
- `core` -> `shared`
- `shared` -> nothing domain-specific

Disallowed dependency direction:

- `shared` -> `domains`
- `shared` -> `app`
- `core` -> `domains`
- one domain importing internal files from another domain instead of its public API

## Definition of Done For Foundation Refactor

The architecture foundation is in place when:

- the target folders exist
- ownership boundaries are documented
- at least one domain can be extracted without changing behavior
- compatibility shims are accepted as temporary migration tools
- route and permission behavior remain identical before and after each extraction step
