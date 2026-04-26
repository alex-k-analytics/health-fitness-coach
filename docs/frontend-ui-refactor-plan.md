# Frontend Refactor With shadcn, Tailwind, TanStack, And Zustand

## Summary

- Refactor the frontend from the current `App.tsx` + `styles.css` monolith into a route-based app using `shadcn/ui`, Tailwind, TanStack Router, TanStack Query, and Zustand.
- Keep backend contracts unchanged. This is a frontend architecture and UI-system transition, not an API redesign.
- Roll out incrementally so the app remains usable while features move from the legacy screen into the new structure.

## Target Stack And Ownership Rules

- `shadcn/ui` provides base primitives in `components/ui`.
- Tailwind becomes the primary styling system; global CSS is reduced to tokens, base rules, and safe-area helpers.
- TanStack Router owns navigation and route composition.
- TanStack Query owns all server data, query lifecycle, cache invalidation, and mutation state.
- Zustand is limited to non-server app state:
  - shell UI state
  - dialog/drawer visibility where local state is no longer sufficient
  - transient workflow drafts only when they span components or routes
  - lightweight app concerns like filters/view prefs if they should persist across navigation
- Do not duplicate query data into Zustand.

## Implementation Changes

### 1. Foundation

- Add Tailwind and initialize shadcn for the Vite React app.
- Add `@/*` path aliases, `lib/utils.ts`, `components.json`, and shared variant utilities.
- Add TanStack Query provider, TanStack Router provider, and a small Zustand store layer under `src/stores`.
- Add a thin app bootstrap structure such as:
  - `src/app/providers`
  - `src/app/router`
  - `src/routes`
  - `src/components/ui`
  - `src/components/shared`
  - `src/features/*`

### 2. Routing and app shell

- Replace manual `window.location` logic with TanStack Router file-based routes.
- Initial route tree:
  - `/login`
  - `/` dashboard
  - `/meals`
  - `/workouts`
  - `/settings`
- Add an authenticated layout route that handles the shared shell, navigation, and mobile-safe actions.
- Use route guards/layout checks backed by the session query.

### 3. Server-state model

- Convert `loadSession`, `loadDashboard`, and feature reload patterns into query hooks and mutations.
- Session is loaded via TanStack Query and used by router auth protection.
- Replace manual refresh fan-out like `await loadDashboard()` with targeted invalidation/refetch:
  - profile mutations invalidate profile/dashboard queries
  - meal mutations invalidate meals and nutrition summary queries
  - workout mutations invalidate workout history and dashboard summary queries
- Keep feature API wrappers near each feature rather than inside the route components.

### 4. Feature decomposition

- Split the current `App.tsx` into feature modules:
  - `features/auth`
  - `features/dashboard`
  - `features/meals`
  - `features/workouts`
  - `features/settings`
- Extract reusable app composites on top of shadcn primitives:
  - page header
  - stat cards
  - section header
  - empty/error states
  - form sections
  - dialog/drawer shells
  - upload control
  - trend/summary cards
- Move the current inline helper components and overlay UI into shared or feature-owned components with explicit props.

### 5. Zustand usage boundaries

- Start with narrow stores only:
  - app shell store for nav/profile drawer/mobile actions if needed
  - UI overlay store only if cross-route or cross-feature coordination appears
  - workout session draft store only if the planner flow remains multi-surface and becomes awkward with local component state
- Prefer local component state first, TanStack Query for server state second, Zustand third.
- Avoid a broad "global app store".

### 6. Migration order

- Phase 1: Tailwind, shadcn, TanStack Query, TanStack Router, Zustand, aliases, providers, route shell.
- Phase 2: login route and auth/session protection.
- Phase 3: dashboard route with summary cards and trends.
- Phase 4: meals route and meal create/edit flows.
- Phase 5: workouts route, simple workout logging, and workout session planner.
- Phase 6: settings route for profile editing and remaining account UI.
- Phase 7: remove legacy `styles.css` dependency and delete the monolithic `App.tsx` flow.

## Interfaces And Conventions

- Keep existing TypeScript API types compatible with current backend responses.
- Prefer feature-local hooks:
  - `useSessionQuery`
  - `useNutritionSummaryQuery`
  - `useMealsQuery`
  - `useCreateMealMutation`
  - `useWorkoutSessionsQuery`
  - similar hooks per feature
- File-based TanStack Router routes should align with product areas rather than backend resources.
- Styling convention:
  - Tailwind utilities for layout and styling
  - shadcn primitives for base components
  - `cva` or equivalent variant helpers for reusable app-specific components
  - no new large replacement stylesheet

## Test Plan

- Add Vitest + React Testing Library during the foundation phase.
- Add route rendering tests for `/login`, `/`, `/meals`, `/workouts`, and `/settings`.
- Add query/mutation tests for invalidation behavior after meal, workout, weight, and profile mutations.
- Add UI tests for:
  - auth redirect and protected routes
  - dashboard loading/error/empty states
  - meal dialog create/edit flows
  - workout session planner step transitions
  - settings/profile save behavior
- Acceptance criteria:
  - all existing major flows still work
  - protected navigation is router-driven
  - server state is query-driven
  - non-server global state stays narrow and intentional
  - migrated screens no longer depend on legacy CSS classes

## Assumptions And Defaults

- TanStack Router uses file-based routing.
- Auth is implemented as session query + router-protected layouts, not a primary Zustand auth store.
- Zustand remains limited to app/UI state outside querying.
- The visual refresh is moderate, not a full brand reboot.
- No backend API changes are required for this transition.
- Existing chart logic can be retained initially and rewrapped in the new component system unless implementation reveals a strong reason to adopt a charting library.
