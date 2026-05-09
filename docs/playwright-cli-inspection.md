# Playwright CLI UX Inspection

Use this workflow for fast, agent-friendly UX inspection while iterating. Keep `npm run ux:audit` as the repeatable regression audit because it captures the committed viewport flow, screenshots, browser events, and CI-friendly pass/fail behavior.

## When To Use Each Tool

- Use Playwright Test with `npm run ux:audit` for regression checks, report evidence, viewport coverage, and final verification.
- Use Playwright CLI for quick interactive inspection, visual spot checks, selector exploration, screenshots, console checks, and network checks during implementation.
- Do not replace `frontend/tests/ux-audit/ux-audit.spec.ts` with CLI commands. The CLI path is intentionally lighter weight and more exploratory.

## Prerequisites

Start the normal local stack first:

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
npm run dev
```

If Chromium is not installed for Playwright CLI yet, run:

```bash
npm run ux:inspect:install
```

## Inspection Commands

Open a named browser session:

```bash
cd frontend
npm run ux:inspect
```

Resize to the audit breakpoints:

```bash
npm run ux:inspect:mobile
npm run ux:inspect:tablet
npm run ux:inspect:desktop
```

Capture the current full page:

```bash
npm run ux:inspect:screenshot
```

Open the Playwright CLI dashboard:

```bash
npm run ux:inspect:show
```

Close the named inspection session:

```bash
npm run ux:inspect:close
```

## Useful Direct Commands

The scripts use the named session `health-fitness-coach`. You can run focused checks directly:

```bash
npx playwright-cli -s=health-fitness-coach snapshot
npx playwright-cli -s=health-fitness-coach console warning
npx playwright-cli -s=health-fitness-coach requests
npx playwright-cli -s=health-fitness-coach goto http://localhost:5173/meals
npx playwright-cli -s=health-fitness-coach screenshot --full-page --filename=../docs/ux-audit-screenshots/cli-meals.png
```

## Final Verification

Before marking a UX fix done, still run:

```bash
cd frontend
npm run build
npm run ux:audit
```
