# Grocery Migration Plan

## Summary

Replace the old grocery app shape with a hybrid architecture that keeps `health-fitness-coach` as the only user-facing app and the only system of record.

The migration target is:

- `health-fitness-coach` owns the frontend, auth, API, Prisma/Postgres data, planning preferences, source credentials, planning history, final plan persistence, grocery list rendering, and reshuffle history
- planning logic lives in the HFC backend
- a new in-repo Flask service handles only Playwright-based ATK recipe acquisition
- production uses two Cloud Run services from the same repo
- HFC owns encrypted source credentials and passes decrypted per-run source material to Flask
- the first implementation target is a full-parity ATK MVP with history, reviewed recipes, reopen, and reshuffle

## Architecture

### System ownership

`health-fitness-coach` is the only user-facing application and the system of record.

HFC owns:

- authenticated frontend routes and UI
- account ownership and auth
- Prisma/Postgres persistence
- planning preferences
- recipe-source credential storage
- planning run history
- final plan persistence
- reviewed recipe persistence
- grocery list persistence
- reshuffle history

The new Flask service owns only:

- Playwright browser automation
- ATK login/session handling needed for scraping
- source scraping
- recipe candidate parsing and normalization

The Flask service must not own:

- users
- sessions
- planning history
- planner preferences
- grocery-list persistence
- reshuffle history

The frontend communicates only with HFC and never directly with Flask.

### Frontend shape

Add a new authenticated planning area to HFC.

Required route:

- `/_auth/planning`

Required navigation decision:

- add a fifth bottom-nav tab for `Planning`

Required UI areas:

- pantry ingredient form
- weekly instructions
- planner preferences
- recipe source management and selection
- progress state
- selected meals
- reviewed recipe summaries
- grocery list
- saved run history
- reopen saved run
- one-recipe reshuffle

### Backend shape

Add a new authenticated Express route group:

- `/api/meal-plans`

HFC backend responsibilities:

- validate requests
- load account-scoped preferences and source credentials
- orchestrate recipe acquisition through Flask
- perform criteria review
- perform planning and critique
- generate grocery list
- persist runs and reshuffles
- serve status, detail, and history back to the frontend

Planning logic stays in the HFC backend. It is not delegated to Flask.

## Execution Model

### MVP request flow

The first implementation is request-driven and uses persisted run state.

Required flow:

1. frontend calls HFC `POST /api/meal-plans/runs`
2. HFC validates request and loads account-scoped preferences and source credentials
3. HFC creates `MealPlanRun` with `RUNNING`
4. HFC calls the Flask acquisition service
5. Flask returns normalized recipe candidates
6. HFC performs criteria review, planning, critique, grocery generation, persistence, and reshuffle handling
7. frontend polls HFC status/detail endpoints only

This MVP is acceptable even though it is request-driven, but progress must be persisted in `MealPlanRun`.

### Flask service boundary

The Flask service should expose a narrow internal-only contract.

Suggested internal endpoint:

- `POST /internal/recipes/acquire`

Required request contents:

- source id
- per-run source login/session payload from HFC
- pantry ingredients
- max-recipes
- acquisition options

Required response contents:

- normalized recipe candidates
- scrape metadata
- warnings or recoverable errors

The Flask response must not include user-owned plan state.

## Deployment

The Flask scraper service lives in the same repo but deploys as a separate Cloud Run service.

Production topology:

- HFC web/API Cloud Run service
- separate Flask scraper Cloud Run service

These services share repo and workflows, but not one runtime process.

Do not:

- shell out from Node to Python during request handling
- deploy HFC and Flask as one Cloud Run runtime
- expose Flask directly to the frontend
- allow Flask to read or write HFC plan tables directly

## Public Interfaces and Data Decisions

### Required public interfaces

The doc must preserve these interfaces explicitly:

- `/_auth/planning`
- `/api/meal-plans/preferences`
- `/api/meal-plans/sources`
- `/api/meal-plans/runs`
- `/api/meal-plans/runs/:id`
- `/api/meal-plans/runs/:id/status`
- `/api/meal-plans/runs/:id/reshuffle`

### Required Prisma models

The doc must preserve these model decisions explicitly:

- `MealPlannerPreference`
- `RecipeSourceCredential`
- `MealPlanRun`

Required status decision:

- `MealPlanRun.status = PENDING | RUNNING | COMPLETED | FAILED`

Required storage decision:

- JSON-backed storage for selected meals, reviewed recipes, grocery list, notes, scraped recipes, and recipe source list

## MVP Scope

The first implementation target is full-parity first-pass ATK MVP.

That means the implementation includes:

- pantry ingredient entry
- weekly planning instructions
- persistent planning preferences
- encrypted recipe-source credentials
- live ATK-backed acquisition
- criteria review output
- selected meals
- grocery list
- saved run history
- reopen saved runs
- one-recipe reshuffle

Locked MVP decisions:

- HFC backend owns planning logic
- ATK is the only supported live planning source initially
- scratch-off grocery state remains browser-local for MVP
- request-driven execution is acceptable initially
- progress must be persisted in `MealPlanRun`

## Acceptance Criteria

The updated markdown is complete when it clearly communicates that:

- HFC is the system of record
- Flask is scraping-only
- planning logic runs in HFC
- credentials are owned by HFC and passed per run
- the frontend never talks to Flask
- production topology is two Cloud Run services from one repo
- the first delivery target is full-parity ATK MVP

## Assumptions

- This update is documentation-only.
- The current file is intentionally rewritten rather than lightly appended.
- The file preserves the migration-plan purpose but replaces ambiguous all-in-HFC language with the agreed hybrid architecture.
