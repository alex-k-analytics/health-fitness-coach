# Health Fitness Coach UX Audit Plan

## Summary

Audit the local seeded app as a user would experience it, with no code changes. The output will be a prioritized UX report covering what works, what breaks, what feels unintuitive, edge cases, visual/design issues, and recommended refinements.

Use seeded credentials from the repo:

- Email: `test@example.com`
- Password: `password123`

Run against the local frontend/backend with Postgres and the scraper service as needed.

## Audit Method

- Start local services: Postgres, backend API, scraper service, and Vite frontend.
- Seed the test account, then sign in through the UI instead of bypassing auth.
- Use the committed Playwright UX audit runner in `frontend/tests/ux-audit/ux-audit.spec.ts`.
- Test responsive layouts at:
  - Mobile: `375x812`
  - Tablet: `768x1024`
  - Desktop: `1440x900`
- Capture screenshots for each major finding and record console errors, failed network requests, broken states, layout overlap, confusing copy, and dead-end flows.

## Rerunning the Audit

Prerequisites:

- Local Postgres and scraper service are running.
- Backend API is running on `http://localhost:4000`.
- Seeded account exists with `test@example.com` / `password123`.

Recommended local sequence:

```bash
docker compose up -d
cd backend
npm run prisma:push
npx tsx src/seed.ts
npm run dev
```

In another terminal:

```bash
cd frontend
npm run ux:audit
```

Useful variants:

- `npm run ux:audit:headed` runs the audit with a visible browser.
- `npm run ux:audit:install` installs the Chromium browser bundle expected by Playwright.
- `UX_AUDIT_BASE_URL=http://localhost:5173 npm run ux:audit` targets a custom frontend URL on macOS/Linux.
- In PowerShell, use `$env:UX_AUDIT_BASE_URL='http://localhost:5173'; npm run ux:audit`.
- Router devtools are disabled by default during local review. Set `VITE_ENABLE_ROUTER_DEVTOOLS=true` only when you explicitly want the TanStack Router devtools overlay while running the app.

Use `localhost` rather than `127.0.0.1` unless the backend CORS config also allows the `127.0.0.1` origin.

The audit writes screenshots and browser/network events to `docs/ux-audit-screenshots/`.

## Fast Agent Inspection

For quick exploratory UX checks, use the optional Playwright CLI workflow in `docs/playwright-cli-inspection.md`. This is intended for faster agent/manual inspection while implementing fixes. It does not replace `npm run ux:audit`, which remains the regression and report-evidence runner.

## Navigation Coverage

### Login

- Empty fields
- Invalid email
- Wrong password
- Successful login
- Redirect behavior
- Session persistence
- Logout

### App Shell

- Header
- Profile drawer
- Weight modal
- Global banners/toasts
- Toast/banner feedback should not push sticky navigation down or create nav/document scrollbars
- Bottom navigation
- Active states
- Safe-area and bottom-nav spacing

### Dashboard

- Initial empty state
- Populated state if data exists
- Recent meals/workouts
- Calorie and weight charts
- Progress cards
- Log-entry entry points

### Meals

- Empty history
- Meal list
- Saved foods/search
- Photo picker
- Meal estimate flow
- Review/edit flow
- Validation
- Loading/error states

### Workouts

- Empty history
- Workout list
- `Start workout`, `Log completed workout`, and `Repeat` entry points
- Mixed session builder with strength and cardio blocks in one workout
- Strength set rows for reps/weight, including add/remove/copy controls
- Full previous set sequence display for repeated or comparable exercises
- Cardio block duration/distance fields added after strength
- Session modal plan/active/review steps
- Timer controls with strength duration treated as optional/secondary
- Validation
- Save behavior
- Edit behavior does not create a duplicate workout

### Planning

- This Week, New Plan, History, and Settings tabs
- Source readiness
- ATK and NYT Cooking both appear as planning-capable sources
- NYT configured but not ready states, including missing saved password
- Combined ATK + NYT ready state with planning unblocked
- Blocked planning state
- Grocery checklist
- Run history delete/confirm
- Reshuffle affordance

### Settings/Profile

- Field validation
- Dirty/save behavior
- Numeric inputs
- Activity selection
- Success/error feedback
- Drawer embedding

## Evaluation Criteria

### Functional Correctness

- User can complete core flows without console errors, failed requests, or stuck loading states.

### UX Clarity

- Primary actions are obvious.
- Labels match outcomes.
- Disabled states explain what is needed.
- Flows do not dead-end.

### Edge Cases

- Empty data
- Long names/text
- Invalid numbers
- Missing photos
- Failed API calls
- Unauthenticated redirects
- Slow/loading states

### Visual/Design Quality

- Responsive layout
- No horizontal scroll
- No occlusion by fixed nav/header
- Consistent spacing
- Readable charts
- Accessible contrast
- Clear focus states

### Accessibility Basics

- Keyboard navigation
- Visible focus
- Labeled inputs
- Dialog focus behavior
- Aria/live-region sanity
- Touch target sizing

## Report Format

Prioritized findings should be grouped by severity:

- `Critical`: blocks core use or data entry.
- `High`: common flow is confusing, broken, or error-prone.
- `Medium`: UX polish, visual inconsistency, unclear hierarchy.
- `Low`: minor copy, spacing, affordance, or enhancement.

Each finding should include:

- Page/flow
- Steps to reproduce
- Actual behavior
- Expected behavior
- Impact
- Recommended fix
- Screenshot reference when useful

Add a final improvement backlog:

- Quick wins
- Larger UX refinements
- Suggested additions to make the app feel more complete

## Assumptions

- The audit uses local seeded data, not production or personal health data.
- This pass produces a report only; it does not change application code.
- If the seeded account has little data, the audit still covers empty and blocked states, then uses controlled inputs to create meals/workouts where practical.
- Workout audit setup may create and then clean up `UX audit...` workout sessions so Repeat and previous-set comparison states can be reviewed deterministically.
- Planning is included because the current route tree and bottom navigation expose `/planning`, even though `frontend/UI_DOCS.md` is partially outdated and still describes a four-tab app.
