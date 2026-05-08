# Health Fitness Coach UX Audit Report

Date: May 8, 2026

## Summary

This audit used the local seeded account flow from `docs/ux-audit-plan.md` across mobile `375x812`, tablet `768x1024`, and desktop `1440x900`.

Frontend and backend typechecks passed. The browser audit found one blocking login issue, repeated React/Radix console errors, desktop navigation overlap, and several UX clarity issues around planning setup, empty states, and modal copy.

Evidence lives in:

- `docs/ux-audit-screenshots/`
- `docs/ux-audit-screenshots/audit-events.json`

Because the UI login flow returned `500` during browser submission, authenticated pages were inspected after bootstrapping the same seeded account through the API and setting the returned token in local storage.

## What Works

- The core page set is reachable once authenticated: Dashboard, Meals, Planning, Workouts, and Settings.
- Empty states are generally present and action-oriented, especially for meals, workouts, charts, and planning.
- Mobile layout is mostly readable, with clear cards, consistent labels, and usable full-screen dialogs.
- Planning gives a clear blocked-state warning in the New Plan tab when ATK credentials are missing.
- TypeScript checks pass for both frontend and backend.

## Critical Findings

### 1. Login Form Returns `500` and Blocks Sign-In

Severity: `Critical`

Page/flow: Login

Evidence:

- `docs/ux-audit-screenshots/mobile-login-success-stayed-on-login.png`
- `docs/ux-audit-screenshots/desktop-login-success-stayed-on-login.png`
- `docs/ux-audit-screenshots/audit-events.json`

Steps:

1. Open `/login`.
2. Submit `test@example.com` / `password123`.

Actual:

- The user remains on `/login`.
- The form displays `Request failed: 500`.
- Browser network events recorded `500 http://127.0.0.1:5173/api/auth/login`.

Expected:

- Successful credentials should navigate to the dashboard.
- Failed credentials should return a clear `Invalid email or password` message, not a generic server failure.

Impact:

- This blocks normal app entry and masks whether credentials, API, proxying, or backend error handling caused the failure.

Recommended fix:

- Reproduce through the Vite proxy from the browser and inspect backend logs for `/api/auth/login`.
- Ensure `authRoutes.post("/login")` returns expected `400`/`401` JSON for validation/auth failures and does not throw.
- Add a regression test for successful login and wrong-password login through the frontend API path.

## High Findings

### 2. Dialog and Drawer Triggers Emit Repeated Ref Warnings

Severity: `High`

Page/flow: App shell, meal composer, workout modal, weight modal, profile drawer

Evidence:

- `docs/ux-audit-screenshots/audit-events.json`

Actual:

- The audit recorded 222 console errors with this warning:
  `Function components cannot be given refs. Attempts to access this ref will fail.`
- The stack points to `Button` inside Radix `DialogTrigger`, `DrawerTrigger`, and `SlotClone`.

Expected:

- Shared UI primitives used with `asChild` should forward refs cleanly.

Impact:

- This can break focus management, trigger semantics, and accessibility behavior in dialogs/drawers.

Recommended fix:

- Convert `frontend/src/components/ui/button.tsx` to `React.forwardRef`.
- Check other `asChild` primitives such as `Badge` if they are used as Radix children.
- Re-run the browser audit and confirm the warning disappears.

### 3. Fixed Bottom Navigation Obscures Desktop Dashboard Content

Severity: `High`

Page/flow: Dashboard on desktop

Evidence:

- `docs/ux-audit-screenshots/desktop-dashboard-empty.png`

Actual:

- The fixed bottom nav floats over the dashboard content on desktop, covering the empty-state area for Today's Meals and Recent Workouts.

Expected:

- Navigation should not cover active content.
- On desktop, use a header/sidebar navigation pattern or reserve enough vertical space so cards never sit under the fixed nav.

Impact:

- The app reads as mobile-only on desktop and hides important empty-state actions.

Recommended fix:

- Keep bottom tabs for mobile.
- At `md`/`lg` and above, move primary navigation into the header or a left rail.
- If bottom nav remains on larger screens, add enough bottom padding and avoid placing it over the main content column.

### 4. Planning Setup State Says "Ready" When Setup Is Required

Severity: `High`

Page/flow: Dashboard and Planning

Evidence:

- `docs/ux-audit-screenshots/mobile-dashboard-empty.png`
- `docs/ux-audit-screenshots/mobile-planning.png`
- `docs/ux-audit-screenshots/mobile-planning-new-plan.png`

Actual:

- Dashboard stat card says `Meal plan Ready`, but the subtext says `Connect a recipe source`.
- Planning status says `Ready`, while the detail says ATK credentials are required before live planning.
- The top planning metric truncates the setup message on mobile.

Expected:

- If the user cannot start live planning, the state should be `Setup required` or `Recipe source needed`.
- Truncated setup text should be replaced by a direct CTA or a shorter label.

Impact:

- Users get mixed signals about whether the planner is usable.

Recommended fix:

- Rename the status state to `Setup required` when no planning-ready recipe source exists.
- Make the metric CTA open Planning Settings directly.
- Use concise mobile-safe copy in metric cards.

## Medium Findings

### 5. Workout Modal Copy Is Internally Inconsistent

Severity: `Medium`

Page/flow: Workout logging

Evidence:

- `docs/ux-audit-screenshots/mobile-workout-modal-initial.png`

Actual:

- The modal title says `Plan Workout`.
- The selected flow is `Completed`.
- The subtitle says `Log a completed workout without starting a timer.`

Expected:

- The modal title should match the selected mode, such as `Log Completed Workout`.
- If the user switches to live timer, the title/subtitle should update to reflect that mode.

Impact:

- The workflow is functional but mentally heavier than needed.

Recommended fix:

- Make title/subtitle derive from `defaultIntent` or selected workout flow.
- Use clearer labels: `Start live workout` and `Log completed workout`.

### 6. Meal Composer Starts With a Blank Date/Time

Severity: `Medium`

Page/flow: Meal logging

Evidence:

- `docs/ux-audit-screenshots/mobile-meal-composer-initial.png`

Actual:

- Date & Time is blank on initial meal logging.
- The primary action is disabled until a meal description, saved food, or photo is provided.
- The helper text explains the requirement, but the required fields are not visually marked.

Expected:

- New meal entries should default to the current date/time.
- Required entry paths should be visually obvious before the user reaches the disabled button.

Impact:

- Food logging is a high-frequency flow; defaulting time and clarifying required input would reduce friction.

Recommended fix:

- Default Date & Time to now for new entries.
- Add required markers or inline helper text near the meal description/photo/saved-food options.

### 7. Header Icon Actions Are Hard To Interpret Visually

Severity: `Medium`

Page/flow: App shell

Evidence:

- `docs/ux-audit-screenshots/mobile-dashboard-empty.png`
- `docs/ux-audit-screenshots/desktop-dashboard-empty.png`

Actual:

- Header actions are icon-only: theme, meal, workout, weight, and profile.
- They have accessible labels, but no visible labels or tooltips for sighted mouse users.

Expected:

- Icon-only tools should expose tooltips on hover/focus, especially for less obvious icons like scale and theme.

Impact:

- The header is compact, but discoverability is weak for new users.

Recommended fix:

- Add tooltips for header icon buttons.
- Consider showing short text labels on desktop for the highest-frequency actions.

## Low Findings

### 8. Devtools Overlay Interferes With Local UX Review

Severity: `Low`

Page/flow: Local development

Evidence:

- Many screenshots show the TanStack Router devtools badge overlapping the bottom-right UI.

Actual:

- The devtools badge appears over the app during local review.

Expected:

- Local UX audits should be able to run with the app in a clean review mode.

Impact:

- This is development-only, but it makes screenshots and bottom navigation review noisy.

Recommended fix:

- Gate router devtools behind an explicit env flag such as `VITE_ENABLE_ROUTER_DEVTOOLS=true`.

### 9. UI Documentation Is Out Of Date

Severity: `Low`

Page/flow: Product documentation

Evidence:

- `frontend/UI_DOCS.md` still describes a four-tab app.
- The current route tree and bottom nav expose five tabs, including Planning.

Actual:

- Documentation no longer matches the visible navigation.

Expected:

- UX docs should reflect Dashboard, Meals, Planning, Workouts, and Settings.

Impact:

- This increases audit and implementation friction.

Recommended fix:

- Update `frontend/UI_DOCS.md` after navigation changes.

## Suggested Additions

- Add a first-run setup checklist on Dashboard: profile goals, recipe source, first meal, first workout, first weight.
- Add a dedicated desktop navigation pattern instead of scaling the mobile bottom nav up.
- Add a lightweight "Today" quick-log surface for the most common meal/workout actions.
- Add clearer planning onboarding: what ATK is, why credentials are required, and what happens without OpenAI planning.
- Add success confirmations that include the next best action, such as "Meal saved. Log another?" or "Workout saved. View dashboard?"

## Verification Notes

- `npm run typecheck` passed in `frontend/`.
- `npm run typecheck` passed in `backend/`.
- `npm run prisma:push` synced the local database schema, but Prisma Client generation hit a Windows file-lock on `query_engine-windows.dll.node`.
- `backend/src/seed.ts` now resets the seeded account password to `password123` on rerun so future audits use deterministic credentials.
