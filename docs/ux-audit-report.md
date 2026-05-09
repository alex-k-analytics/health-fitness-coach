# Health Fitness Coach UX Audit Report

Generated: 2026-05-08

## Automation Run

- Ran `docker compose up -d`.
- Ran `npm run prisma:push` in `backend`.
- Seeded `test@example.com` / `password123` with `npx tsx src\seed.ts`.
- Verified API health at `http://localhost:4000/health`.
- Ran `npm run ux:audit` in `frontend`.
- Result: Playwright audit passed, `1 passed (1.1m)`.
- Evidence directory: `docs/ux-audit-screenshots/`.

The committed runner reported no structured findings in `audit-events.json`, but it did record repeated warning/error events:

- Expected negative-login events: `401 /api/auth/login` for the wrong-password check in mobile, tablet, and desktop.
- Accessibility warnings: Radix dialog content missing a description or `aria-describedby={undefined}` on the meal composer in mobile, tablet, and desktop.

## High Severity

### 1. Mobile bottom navigation occludes page content

- Page/flow: Mobile app shell across Meals, Workouts, Settings, Planning.
- Steps to reproduce:
  1. Sign in at `375x812`.
  2. Visit `/meals`, `/workouts`, `/settings`, or `/planning`.
  3. Review the first viewport and full-page evidence.
- Actual behavior: The fixed bottom nav visually sits over content instead of reserving a clear safe area. It covers the fat macro card on Meals, workout stats on Workouts, the Fat goal field on Settings, and Planning tab/card content.
- Expected behavior: Fixed navigation should not obscure active content, form fields, tabs, stats, or CTAs. Content should remain readable and tappable above the nav.
- Impact: Common mobile flows feel cramped and users may miss fields or read partially hidden cards. This is especially risky on Settings because macro goals affect dashboard and meal progress feedback.
- Recommended fix: Treat the mobile nav as a layout participant or add enough scroll offset and section spacing so active content never renders beneath it. Validate at `375x812`, `390x844`, and tablet widths where the bottom nav is still active.
- Screenshot references:
  - `docs/ux-audit-screenshots/mobile-meals.png`
  - `docs/ux-audit-screenshots/mobile-workouts.png`
  - `docs/ux-audit-screenshots/mobile-settings.png`
  - `docs/ux-audit-screenshots/mobile-planning-new-plan.png`
  - Likely source areas: `frontend/src/components/shell/BottomNav.tsx`, `frontend/src/index.css`, `frontend/src/components/shell/Layout.tsx`.

## Medium Severity

### 2. Meal composer dialog is missing an accessible description

- Page/flow: Meals -> Log meal.
- Steps to reproduce:
  1. Sign in.
  2. Open `/meals`.
  3. Click `Log meal`.
  4. Check console output.
- Actual behavior: The audit records repeated warnings: `Missing Description or aria-describedby={undefined} for {DialogContent}`.
- Expected behavior: Dialog content should include a `DialogDescription`, or explicitly opt out with `aria-describedby={undefined}` when no description is appropriate.
- Impact: Screen reader users get weaker dialog context, and the app emits noisy console warnings during normal flows.
- Recommended fix: Add `DialogDescription` to the meal composer header using the already visible helper copy, or pass the Radix opt-out intentionally if the title is sufficient.
- Screenshot/reference:
  - `docs/ux-audit-screenshots/mobile-meal-composer-initial.png`
  - Source: `frontend/src/features/meals/MealComposer.tsx`.

### 3. Weight modal has the same dialog-description risk

- Page/flow: Header -> Log weight.
- Steps to reproduce:
  1. Sign in.
  2. Click the scale icon or `Log weight`.
  3. Inspect dialog markup and expected Radix behavior.
- Actual behavior: `WeightModal` renders `DialogContent` and `DialogTitle` without `DialogDescription`.
- Expected behavior: The dialog should communicate what value is expected and how it will be saved.
- Impact: Same accessibility issue as the meal composer, but in a smaller modal.
- Recommended fix: Add a short `DialogDescription`, for example clarifying that the user is entering pounds and the app stores the metric.
- Source: `frontend/src/components/shell/WeightModal.tsx`.

### 4. Planning source setup flow sends users into a noisy settings section

- Page/flow: Planning -> New plan -> Open settings.
- Steps to reproduce:
  1. Sign in with the seeded account.
  2. Open `/planning`.
  3. Click `New plan`.
  4. Review the blocked state and settings tab.
- Actual behavior: The blocked state says `Connect ATK before live planning`, but the settings section starts with Allrecipes, then America's Test Kitchen, then NYT Cooking. Two of those are labeled `Stored only`, while planning supports ATK only.
- Expected behavior: The Planning settings flow should prioritize the one source that unblocks planning, or isolate planning-supported sources from stored-only sources.
- Impact: Users can land in the right tab but still have to scan unrelated credential blocks before finding the required action.
- Recommended fix: Move America's Test Kitchen to the top when planning is blocked, add an anchor from `Open settings`, or split `Planning source` from `Other saved sources`.
- Screenshot references:
  - `docs/ux-audit-screenshots/mobile-planning-new-plan.png`
  - `docs/ux-audit-screenshots/mobile-planning-settings.png`
  - `docs/ux-audit-screenshots/desktop-planning-settings.png`

### 5. Planning tab layout competes with bottom navigation on mobile

- Page/flow: Planning tabs on mobile.
- Steps to reproduce:
  1. Open `/planning` at `375x812`.
  2. Switch between `New plan` and `Settings`.
- Actual behavior: The two-row tab list sits close to the fixed bottom nav and the next card begins underneath the nav in the captured viewport.
- Expected behavior: Secondary navigation and primary bottom navigation should not visually collide.
- Impact: The page feels crowded and the active planning tab is harder to parse.
- Recommended fix: Add mobile-specific separation below the tabs, or consider a compact segmented control plus an anchored content start.
- Screenshot references:
  - `docs/ux-audit-screenshots/mobile-planning-new-plan.png`
  - `docs/ux-audit-screenshots/mobile-planning-settings.png`

## Low Severity

### 6. Invalid email uses native browser validation while wrong password uses app-styled validation

- Page/flow: Login validation.
- Steps to reproduce:
  1. Open `/login`.
  2. Enter `bad-email` and a password.
  3. Submit.
  4. Then enter a valid email and wrong password.
- Actual behavior: Invalid email shows a native browser validation bubble over the form; wrong password shows the app's styled alert.
- Expected behavior: Validation feedback should be visually consistent and avoid covering the primary CTA.
- Impact: Minor inconsistency, but it makes the login flow feel less polished.
- Recommended fix: Use app-level inline validation for email format or add helper/error text below the field while preserving native semantics.
- Screenshot references:
  - `docs/ux-audit-screenshots/mobile-login-invalid-email.png`
  - `docs/ux-audit-screenshots/mobile-login-wrong-password.png`

### 7. Header quick actions are icon-only on mobile

- Page/flow: Authenticated mobile header.
- Steps to reproduce:
  1. Sign in on mobile.
  2. Inspect the icon cluster in the header.
- Actual behavior: Theme, meal, workout, weight, and profile actions appear as icon-only controls. Desktop has more room and the audit checks tooltips there, but mobile has no visible text affordance.
- Expected behavior: Repeated primary actions should be discoverable without relying on icon recognition alone.
- Impact: New users may not understand the scale, workout, or theme icons. This is partly mitigated by larger labeled CTAs in page content.
- Recommended fix: Keep the icon actions, but consider reducing the mobile cluster to profile/theme only and relying on page CTAs plus bottom nav for task entry points.
- Screenshot references:
  - `docs/ux-audit-screenshots/mobile-dashboard-empty.png`
  - `docs/ux-audit-screenshots/mobile-meals.png`

## What Works

- Successful seeded login navigates to the dashboard.
- Auth-protected pages load at mobile, tablet, and desktop sizes.
- No horizontal overflow was detected by the committed runner.
- Empty states are generally present and specific for meals, workouts, calorie trend, weight trend, and planning setup.
- Primary CTAs are consistently styled and visible.
- Desktop layout is stable and readable across dashboard, meals, workouts, planning, and settings.
- Workout modal includes a `DialogDescription` and did not emit the dialog accessibility warning.

## Improvement Backlog

### Quick wins

- Add missing `DialogDescription` to `MealComposer` and `WeightModal`.
- Add a mobile nav/content regression check that asserts important fields are not covered by fixed navigation.
- Reorder Planning source settings so America's Test Kitchen appears first when it is required.
- Make login email-format errors use the same alert/error language as wrong-password errors.

### Larger refinements

- Revisit the mobile shell structure so bottom navigation behaves more like reserved app chrome than an overlay.
- Split Planning settings into `Planning source` and `Stored recipe sources` sections.
- Add a small mobile discoverability strategy for header icon actions, such as fewer icons or contextual labels.
- Expand the UX audit runner to cover profile drawer, weight modal, logout, save-profile validation, and a full meal estimate/review/save loop.
