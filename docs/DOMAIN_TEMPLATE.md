# Domain Module Template

## Purpose

This template defines the standard structure for any module placed under `domains/`.

The goal is consistent domain ownership, predictable imports, and low-risk extraction from the current `src/` layout.

## Domain Responsibilities

A domain owns:

- its route-level pages
- its feature components
- its feature hooks
- its API queries and mutations
- its local types
- its local permission declarations

A domain should not own:

- app bootstrap
- global provider wiring
- generic UI primitives
- global auth/session infrastructure

## Standard Folder Template

```text
domains/
  <domain>/
    index.ts
    routes.tsx
    pages/
    components/
    hooks/
    api/
    model/
    permissions/
    types/
    tests/
```

## Folder Meanings

### `index.ts`

The public API for the domain. Other parts of the app should import from here whenever possible.

### `routes.tsx`

Exports route definitions or route elements owned by the domain. Route registration stays in `app/router`, but route payloads can come from the domain.

### `pages/`

Contains route entry components for the domain.

### `components/`

Contains domain-specific UI components that should not live in `shared/`.

### `hooks/`

Contains feature hooks scoped to the domain.

### `api/`

Contains domain query/mutation functions and server contract adapters.

### `model/`

Contains derived selectors, mappers, constants, and domain business helpers.

### `permissions/`

Contains domain capability declarations and helper checks.

### `types/`

Contains domain-specific contracts that do not belong in `shared/types`.

## Minimal Public API Example

```ts
export { MealsPage } from './pages/MealsPage'
export { mealsRoutes } from './routes'
export { useMealsList } from './hooks/useMealsList'
export * from './permissions/capabilities'
```

## Example Domain Skeleton

```text
domains/
  meals/
    index.ts
    routes.tsx
    pages/
      MealsPage.tsx
    components/
      MenuUploadDialog.tsx
      FeedbackDialog.tsx
    hooks/
      useMeals.ts
    api/
      meals.api.ts
    model/
      meals.constants.ts
      meals.mappers.ts
    permissions/
      capabilities.ts
      guards.ts
    types/
      meals.types.ts
```

## Extraction Rule From Current Code

When creating a domain from the current codebase:

1. Start from one route/page entry.
2. Move only the files directly owned by that feature.
3. Leave generic dependencies in place until shared/core extraction is complete.
4. Use re-export shims from old paths if import churn would be large.

## Import Rules

Allowed:

- domain -> `core/*`
- domain -> `shared/*`
- domain -> its own internal files

Avoid:

- domain -> another domain's internal files
- domain -> `app/*`

If a domain needs another domain's functionality, import from that domain's `index.ts` public API.

## Permission Template

Each domain should declare its capabilities explicitly.

Example:

```ts
export const MEALS_CAPABILITIES = {
  view: 'meals.view',
  manageMenu: 'meals.manage_menu',
  markAttendance: 'meals.mark_attendance',
  requestSpecialMeal: 'meals.request_special_meal',
  reviewFeedback: 'meals.review_feedback',
} as const
```

## Route Ownership Template

Example:

```ts
import { MealsPage } from './pages/MealsPage'

export const mealsRoutes = [
  {
    path: 'meals',
    element: <MealsPage />,
  },
]
```

## Backward Compatibility Rule

Domain extraction must preserve:

- route paths
- API paths
- exported component behavior
- query keys
- permission outcomes

The domain folder is an ownership change, not a behavior change.
