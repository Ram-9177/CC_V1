# Codex Workflow For Modular Refactors

## Purpose

This workflow guides future Codex tasks for structural migration so changes remain small, deterministic, and backward compatible.

## Non-Negotiable Scope Rule

When the task is architectural migration:

- change structure, not behavior
- do not redesign pages
- do not alter route paths
- do not alter API contracts
- do not change permission outcomes unless the task explicitly requests policy changes

## Required Working Order

1. Identify the exact ownership boundary.
2. Trace current imports and runtime entry points.
3. Move the smallest safe slice.
4. Keep compatibility exports if needed.
5. Validate behavior did not change.
6. Stop when the requested slice is complete.

## Approved Target Layers

All structural refactor work should map code into:

- `app/`
- `core/`
- `domains/`
- `shared/`

If a change does not clearly fit one of these layers, pause and classify it before editing.

## Classification Rules

Use these rules before moving code.

### Put Code In `app/` If It:

- wires providers
- registers routes
- composes layouts
- bootstraps the application shell

### Put Code In `core/` If It:

- manages auth/session
- defines API client behavior
- evaluates permissions
- owns app-wide state or infra
- is cross-cutting and non-UI

### Put Code In `domains/` If It:

- represents one business area
- has route/page ownership
- contains feature-specific UI, hooks, queries, or types

### Put Code In `shared/` If It:

- is domain-agnostic
- is reusable across unrelated domains
- does not encode business-specific language or rules

## Safe Refactor Pattern

Preferred execution pattern:

1. Create the new target file.
2. Move code with minimal edits.
3. Add a compatibility re-export at the old path if import churn is large.
4. Update only the imports required for the requested slice.
5. Verify typecheck/tests if the task includes runtime edits.

## Compatibility Rules

Structural refactors must preserve:

- route strings
- query keys
- store contracts
- API request paths
- permission semantics
- exported component props

Temporary duplication is preferable to risky behavior drift.

## Domain Extraction Workflow

When extracting a domain:

1. Start from the route/page entry.
2. Identify directly owned hooks/components/types.
3. Move only those files.
4. Leave generic dependencies in place.
5. Export the domain through `domains/<domain>/index.ts`.
6. Avoid cross-domain internal imports.

## Permission Refactor Workflow

When touching permissions:

1. Preserve `allowed_paths` behavior.
2. Preserve `rbac.ts` fallback behavior.
3. Add capability checks as an overlay, not a replacement.
4. Colocate new capabilities under the owning domain.

## Review Checklist

Before closing a modular refactor task, verify:

- no runtime behavior changed unintentionally
- the moved code has a clear owner
- new imports follow layer direction rules
- compatibility shims exist where needed
- the change stayed inside the requested slice

## Task Templates

### Template: Extract Core Module

Goal:

- move one cross-cutting concern from `src/lib/*` into `core/*`

Rules:

- preserve exports
- preserve behavior
- use old-path re-export if needed

### Template: Extract Domain Module

Goal:

- move one feature from `src/pages`, `src/components`, `src/hooks` into `domains/<domain>`

Rules:

- start from the route entry
- move only owned files
- expose a public domain API

### Template: Promote Shared Asset

Goal:

- move a generic reusable asset into `shared/*`

Rules:

- confirm it is domain-agnostic
- do not move feature-specific logic into shared

## Default Constraint For Future Codex Tasks

Unless the task explicitly says otherwise:

- prefer additive migration
- prefer shims over churn
- prefer one domain or one core concern per task
- avoid repo-wide renames
