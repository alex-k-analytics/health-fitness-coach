# Health Fitness Coach UX Audit Report

Date: May 8, 2026

## Summary

This audit used the local seeded account flow from `docs/ux-audit-plan.md` across mobile `375x812`, tablet `768x1024`, and desktop `1440x900`.

Frontend and backend typechecks passed. The browser audit found several UX clarity issues around planning setup, empty states, and modal copy.

Evidence lives in:

- `docs/ux-audit-screenshots/`
- `docs/ux-audit-screenshots/audit-events.json`

The initial browser audit was accidentally run against `http://127.0.0.1:5173`, while the backend's default CORS config allows `http://localhost:5173`. That caused the browser login request to fail with `Origin is not allowed by CORS`. The Playwright UX config now defaults to `http://localhost:5173` to match local backend defaults.

## What Works

- The core page set is reachable once authenticated: Dashboard, Meals, Planning, Workouts, and Settings.
- Empty states are generally present and action-oriented, especially for meals, workouts, charts, and planning.
- Mobile layout is mostly readable, with clear cards, consistent labels, and usable full-screen dialogs.
- Planning gives a clear blocked-state warning in the New Plan tab when ATK credentials are missing.
- Dashboard and Planning top-level status metrics now say `Setup required` with concise `Connect ATK source` copy when live planning is blocked.
- Dialog, drawer, button, and badge primitives now forward refs cleanly; the prior Radix/Vaul ref warning no longer appears in the UX audit.
- Desktop primary navigation now lives in the header at `lg` and above, while mobile/tablet keep the fixed bottom nav; short desktop viewport checks no longer show nav/action overlap.
- `frontend/UI_DOCS.md` now reflects the five-route navigation and responsive header/bottom-nav behavior.
- TypeScript checks pass for both frontend and backend.

## Medium Findings

### 1. Workout Modal Copy Is Internally Inconsistent

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

### 2. Meal Composer Starts With a Blank Date/Time

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

### 3. Header Icon Actions Are Hard To Interpret Visually

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

### 4. Devtools Overlay Interferes With Local UX Review

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

## Suggested Additions

- Add a first-run setup checklist on Dashboard: profile goals, recipe source, first meal, first workout, first weight.
- Add a lightweight "Today" quick-log surface for the most common meal/workout actions.
- Add clearer planning onboarding: what ATK is, why credentials are required, and what happens without OpenAI planning.
- Add success confirmations that include the next best action, such as "Meal saved. Log another?" or "Workout saved. View dashboard?"

## Verification Notes

- `npm run typecheck` passed in `frontend/`.
- `npm run typecheck` passed in `backend/`.
- `npm run prisma:push` synced the local database schema, but Prisma Client generation hit a Windows file-lock on `query_engine-windows.dll.node`.
- `backend/src/seed.ts` now resets the seeded account password to `password123` on rerun so future audits use deterministic credentials.
