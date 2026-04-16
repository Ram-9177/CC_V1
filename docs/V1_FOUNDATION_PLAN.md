# V1 Foundation Plan

## Objective

Establish a modular frontend foundation for future growth using:

- `app/`
- `core/`
- `domains/`
- `shared/`

This plan explicitly does not require behavior changes. V1 is a structural migration plan, not a feature rewrite.

## Current State

The application currently behaves like a modular monolith inside `src/`, with most responsibilities concentrated in a few broad buckets:

- app composition in `src/main.tsx` and `src/App.tsx`
- cross-cutting infrastructure in `src/lib/`
- screen-level assembly in `src/pages/`
- reusable and semi-reusable UI in `src/components/`
- feature hooks in `src/hooks/`
- centralized types in `src/types/index.ts`

This is workable today, but it will become increasingly expensive to grow because:

- routing, auth bootstrap, and authorization are tightly centralized
- domain ownership is implicit, not enforced
- reusable code and domain code are mixed in the same areas
- feature extraction requires broad code awareness

## V1 Target

V1 aims to create a stable architecture skeleton with explicit ownership:

- `app/` for composition
- `core/` for platform/business infrastructure
- `domains/` for feature modules
- `shared/` for generic reusable building blocks

## V1 Principles

- No route behavior changes.
- No API contract changes.
- No permission outcome changes.
- No visual redesign.
- No cross-domain rewrite.
- Prefer re-export shims over big-bang import churn.

## Proposed Folder Shape

```text
app/
  bootstrap/
  providers/
  router/
  layouts/

core/
  api/
  auth/
  permissions/
  state/
  realtime/
  offline/
  perf/

domains/
  auth/
  dashboard/
  attendance/
  meals/
  rooms/
  complaints/
  gate/
  users/
  reports/
  profile/

shared/
  ui/
  components/
  hooks/
  utils/
  types/
  constants/
```

## Recommended Sequencing

### Step 1: Establish Composition Boundaries

Document the intended split of current responsibilities:

- `main.tsx` concerns -> `app/bootstrap`
- provider registration -> `app/providers`
- route declarations -> `app/router`
- layout shell -> `app/layouts`

### Step 2: Extract Stable Core Services First

Move infrastructure that should not belong to domains:

- API client
- auth/session store
- permission evaluator
- websocket/offline services
- network/perf helpers

These pieces are already conceptually cross-cutting and are the safest first extraction targets.

### Step 3: Normalize Shared Building Blocks

Promote only generic assets into `shared/`:

- UI primitives in `src/components/ui/*`
- generic loading, skeleton, form, and utility components
- generic hooks and utilities

Do not move domain-named components into `shared/`.

### Step 4: Move Domains by Vertical Slice

Extract one domain at a time. Recommended first domains:

1. `auth`
2. `profile`
3. `meals`
4. `attendance`
5. `complaints`

These are relatively easy to identify because they already have page/hook/component clustering.

### Step 5: Shrink `src/App.tsx`

When implementation starts, split `App.tsx` into:

- router assembly
- session bootstrap
- auth guards
- permission guards
- shell composition

The main rule is to split by responsibility, not by arbitrary file count.

## Migration Tactics

### Tactic 1: Compatibility Re-Exports

When code moves from `src/lib/api.ts` to `core/api/client.ts`, keep a compatibility file at the old path:

```ts
export * from '@/core/api/client'
```

This reduces blast radius while preserving behavior.

### Tactic 2: Domain Public APIs

Each domain should export only supported entry points via a local `index.ts`. Other modules should import from the domain root, not internal files.

### Tactic 3: Keep Query Keys Stable

If hooks move files but keep the same queries, keep query keys unchanged.

### Tactic 4: Keep Route Paths Stable

Route path changes are out of scope for V1. Structural extraction must preserve the current URL map.

## Risks

### Risk 1: Hidden Shared State Coupling

Some pages may depend on `src/lib/store.ts`, `src/lib/ui-store.ts`, or query cache behavior in ways not obvious from file location.

Mitigation:

- extract infra before domains
- preserve existing store contracts
- avoid reshaping provider order

### Risk 2: Permission Drift During Refactor

Because current access control is hybrid, moving code can accidentally change authorization checks.

Mitigation:

- centralize permission logic in `core/permissions`
- keep static path fallback until capability checks are fully proven

### Risk 3: Shared vs Domain Misclassification

There is a high risk of moving feature-specific UI into `shared/`.

Mitigation:

- if a component uses domain nouns, API payloads, or role logic, keep it in a domain

## Backward Compatibility Rule

During V1 migration:

- old file paths may remain as shims
- runtime behavior must remain byte-for-byte equivalent from the user perspective
- any cleanup that is not required for structural migration is out of scope

## V1 Exit Criteria

V1 is complete when:

- the target architecture is documented
- implementation can begin without ambiguity
- boundaries between `app`, `core`, `domains`, and `shared` are explicit
- the permission migration strategy is defined
- every future refactor can be executed as a bounded vertical move rather than a repo-wide rewrite
