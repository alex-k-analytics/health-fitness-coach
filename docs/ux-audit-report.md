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
- Workout modal copy now derives from the selected flow, so completed-workout logging no longer appears as a planned/live workout.
- Meal composer now defaults new entries to the current local date/time and clarifies that the user must describe the meal, choose a saved food, or attach a photo before estimating.
- Header icon-only actions now expose hover/focus tooltips while keeping accessible labels for assistive technology.
- TanStack Router devtools are now opt-in via `VITE_ENABLE_ROUTER_DEVTOOLS=true`, so local UX audits run without the bottom-right devtools overlay or package warning.
- TypeScript checks pass for both frontend and backend.

## Medium Findings

No open medium findings after the latest pass.

## Low Findings

No open low findings after the latest pass.

## Suggested Additions

- Add a first-run setup checklist on Dashboard: profile goals, recipe source, first meal, first workout, first weight.
- Add a lightweight "Today" quick-log surface for the most common meal/workout actions.
- Add clearer planning onboarding: what ATK is, why credentials are required, and what happens without OpenAI planning.
- Add success confirmations that include the next best action, such as "Meal saved. Log another?" or "Workout saved. View dashboard?"

## Verification Notes

- `npm run typecheck` passed in `frontend/`.
- `npm run ux:audit` passed in `frontend/` after adding header action tooltips and a desktop header tooltip regression check.
- `npm run ux:audit` passed in `frontend/` after gating router devtools and adding a devtools overlay regression check.
- `npm run typecheck` passed in `backend/`.
- `npm run prisma:push` synced the local database schema, but Prisma Client generation hit a Windows file-lock on `query_engine-windows.dll.node`.
- `backend/src/seed.ts` now resets the seeded account password to `password123` on rerun so future audits use deterministic credentials.
