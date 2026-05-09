# Health Fitness Coach UX Audit Report

Generated: 2026-05-09

## Automation Run

- Used `docs/ux-audit-plan.md` as the audit plan.
- Used `ui-ux-pro-max` to refresh the design review baseline for a health, fitness, wellness SaaS dashboard/mobile app.
- Verified API health at `http://localhost:4000/health`.
- Verified the frontend was available at `http://localhost:5173`.
- Ran `npm run ux:audit` in `frontend`.
- Result: Playwright audit passed, `1 passed (1.7m)`.
- Evidence directory: `docs/ux-audit-screenshots/`.
- Structured findings in `audit-events.json`: none.
- Recorded browser/network events: expected wrong-password login checks only, `401 /api/auth/login` on mobile, tablet, and desktop.

Docker status could not be read from this shell because Windows denied access to the Docker engine/config, but the already-running API and frontend were healthy and the audit completed successfully.

## Design Review Baseline

The `ui-ux-pro-max` pass emphasized these checks for this app:

- Mobile navigation should not cover content or controls.
- Forms need visible focus states, semantic labels, and mobile-friendly numeric keyboards.
- Icon-only actions need accessible names and, on desktop, discoverable tooltip behavior.
- Health dashboards should stay readable and utilitarian, with clear progress states rather than decorative complexity.

The current UI is broadly aligned with this baseline: it uses Lucide icons, strong focus rings, labeled inputs, responsive chrome, and restrained dashboard styling.

## Critical Severity

No critical findings in this audit run.

## High Severity

No high severity findings in this audit run.

## Medium Severity

### 1. Profile drawer hides the primary save action below a long mobile form

Status: Fixed on 2026-05-09. The drawer now places a sticky `Profile changes` save action at the top of the editable profile form, and account actions are separated below the form instead of occupying the persistent drawer footer. Verified with `npm run ux:audit`.

- Page/flow: Mobile header -> profile drawer -> edit profile details.
- Steps to reproduce:
  1. Sign in at `375x812`.
  2. Open the profile drawer from the avatar button.
  3. Edit a top-of-form field such as `Display name`.
  4. Look for the action that saves the change.
- Actual behavior: The visible drawer footer shows `Sign out` and `Close`, while `Save changes` belongs to the embedded profile form and sits below the long scrollable form content. On the initial mobile drawer viewport, the user sees account/close actions but not the primary save action.
- Expected behavior: When profile fields are editable in a drawer, the primary dirty-state action should be visible or predictably anchored with the form. Account actions should not be more prominent than saving edits.
- Impact: Users can edit a profile field, then close or sign out without realizing the save action is below the fold. This is especially likely on mobile where the drawer has limited height and many numeric fields.
- Recommended fix: Move profile save/cancel controls into a sticky drawer form footer, or split account actions into a separate section below the editable form. When the form is dirty, prioritize `Save changes` over `Sign out`.
- Screenshot reference: `docs/ux-audit-screenshots/mobile-profile-drawer.png`.
- Likely source areas: `frontend/src/components/shell/ProfileDrawer.tsx`, `frontend/src/features/settings/ProfileForm.tsx`.

## Low Severity

### 2. Audit-created data accumulates and makes dashboard evidence less representative

Status: Fixed on 2026-05-09. The audit runner now deletes prior `UX audit chicken rice bowl` meals after sign-in and deletes the meal it creates after capturing the save evidence. The backend now supports authenticated meal deletion for the cleanup path. Verified with `npm run ux:audit`.

- Page/flow: Dashboard after repeated UX audit runs.
- Steps to reproduce:
  1. Run `npm run ux:audit` multiple times against the same seeded account.
  2. Open dashboard evidence such as `desktop-dashboard-empty.png`.
- Actual behavior: The dashboard evidence now shows accumulated audit entries, including `17 meals logged`, `8563 calories logged`, and repeated `UX audit chicken rice bowl` meals.
- Expected behavior: A repeatable audit should start from deterministic data, or clearly separate generated audit records from normal seeded data.
- Impact: This is not a production UI defect, but it makes audit screenshots harder to interpret and can mask true empty-state or first-run behavior.
- Recommended fix: Add an audit setup/teardown step that resets the seeded account, deletes records created by the audit, or uses unique disposable audit users per run.
- Screenshot reference: `docs/ux-audit-screenshots/desktop-dashboard-empty.png`.

## What Works

- Successful seeded login navigates to the dashboard.
- Invalid email and wrong-password feedback use app-styled validation rather than native browser bubbles.
- Auth-protected routes load at mobile, tablet, and desktop sizes.
- The committed runner found no horizontal overflow.
- Mobile/tablet bottom navigation no longer covers visible page content in the audited routes.
- Meal, workout, and weight dialogs render accessible descriptions.
- Profile drawer, weight logging, profile save from Settings, logout, and meal estimate/review/save flows are covered by refreshed screenshots.
- Planning setup copy clearly communicates that an ATK source is required before live weekly planning.
- Desktop layout remains stable and readable across Dashboard, Meals, Workouts, Planning, and Settings.

## Improvement Backlog

### Quick Wins

- Fixed: Make the profile drawer's save action visible when editable fields are in view or when the form becomes dirty.
- Fixed: Move destructive/account actions in the drawer below the editable profile workflow, or visually separate them from form completion.
- Fixed: Add audit data cleanup so repeated audit runs do not inflate dashboard totals.

### Larger UX Refinements

- Expand the Playwright UX audit to edit and save a profile field from the profile drawer, not only from the Settings page.
- Add a deterministic empty-state audit user or fixture so the audit can separately verify first-run and populated dashboard states.
- Add keyboard-only checks for drawer editing, focus return, and dirty-form completion.

## Residual Risk

The automated audit is strong for layout, dialogs, route coverage, and common authenticated flows, but it still relies mostly on screenshot evidence for visual hierarchy. Manual review remains useful for action priority, form completion clarity, and whether audit-generated data is distorting the user's first-run experience.
