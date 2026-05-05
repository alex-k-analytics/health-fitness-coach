# Grocery Migration Plan

## Goal

Migrate the useful features from `grocery-deal-agent` into `health-fitness-coach` without carrying over the old Flask app shape.

The target is:

- React frontend inside the existing authenticated app shell
- Express API inside the existing backend
- Prisma-backed persistence in PostgreSQL
- OpenAI-backed planning services implemented in TypeScript
- single-account ownership using the existing `Account` model

This should become a new product area inside Health & Fitness Coach, not a separate app bolted onto it.

## What Migrates

Features to bring over:

- pantry ingredient entry
- weekly planning instructions
- persistent dietary and planning preferences
- per-account recipe source credentials
- source-backed recipe search and scraping
- recipe review summaries
- weekly meal selection
- deduplicated grocery list
- planning run history
- reopen previous runs
- one-recipe reshuffle
- progress/status reporting during long runs

Features not to preserve as-is:

- Flask routes and frontend serving
- SQLAlchemy models
- file-based `planner_context.md`
- file outputs as the main system of record
- in-memory global request locking
- local-browser-profile directories as hidden app state

## Target Architecture

### Frontend

Add a new authenticated planning area to the React app.

Suggested route:

- `/_auth/planning`

Suggested frontend slices:

- `frontend/src/features/planning/`
- `frontend/src/routes/_auth/planning.tsx`
- `frontend/src/components/planning/`

UI sections:

- pantry and instruction form
- recipe source selector
- planner preferences
- progress state
- selected meals
- grocery list
- reviewed recipes
- planning history
- reshuffle action

### Backend

Add a new Express route group:

- `/api/meal-plans`

Suggested backend modules:

- `backend/src/routes/mealPlanRoutes.ts`
- `backend/src/services/mealPlanningService.ts`
- `backend/src/services/mealPlanAgentService.ts`
- `backend/src/services/recipeSourceService.ts`
- `backend/src/services/recipeCredentialService.ts`
- `backend/src/services/recipeAcquisitionService.ts`

The backend should follow the existing HFC pattern:

- Zod validation in routes
- orchestration in services
- Prisma persistence
- ownership checks via `accountId`

### AI and Planning

Port the grocery planner as a TypeScript service, not as a Python subprocess.

Planning should remain hybrid:

- deterministic criteria review
- OpenAI structured selection
- OpenAI critique and reshuffle where helpful
- fallback local ranking when OpenAI is unavailable

This should mirror the architecture already used by HFC nutrition analysis:

- service-owned prompt building
- structured model output
- normalization before persistence
- graceful fallback path

## Proposed Prisma Models

For MVP, use a small number of new models and keep rich plan artifacts in JSON.

### `MealPlannerPreference`

Purpose:

- persistent planning preferences for an account

Suggested fields:

- `accountId` unique FK to `Account`
- `dietaryRestrictions` string nullable
- `plannerContext` string nullable
- `defaultMaxRecipes` int nullable
- `defaultMaxMeals` int nullable
- `defaultUseOpenAi` boolean nullable
- `updatedAt`

### `RecipeSourceCredential`

Purpose:

- store recipe-source login details per account

Suggested fields:

- `id`
- `accountId`
- `source`
- `username`
- `passwordCiphertext`
- `passwordHash`
- `loginUrl`
- `enabled`
- `createdAt`
- `updatedAt`

Constraints:

- unique `(accountId, source)`

### `MealPlanRun`

Purpose:

- store plan requests, status, outputs, and reshuffle lineage

Suggested fields:

- `id`
- `accountId`
- `sourceRunId` nullable
- `status`
- `progressStage`
- `progressPercent`
- `ingredientsText`
- `instructionsText`
- `recipeSources` JSON
- `maxRecipes`
- `maxMeals`
- `useOpenAi`
- `scrapedCount`
- `durationSeconds`
- `selectedMealsJson`
- `reviewedRecipesJson`
- `groceryListJson`
- `notesJson`
- `scrapedRecipesJson`
- `createdAt`
- `updatedAt`

Suggested status enum:

- `PENDING`
- `RUNNING`
- `COMPLETED`
- `FAILED`

## Proposed API Surface

### Preferences

- `GET /api/meal-plans/preferences`
- `PATCH /api/meal-plans/preferences`

Responsibilities:

- return and update dietary restrictions
- return and update planner context
- return and update defaults for planning runs

### Recipe Sources

- `GET /api/meal-plans/sources`
- `POST /api/meal-plans/sources/:source`
- `DELETE /api/meal-plans/sources/:source`

Responsibilities:

- show configured recipe sources
- save credentials
- enable or disable a source
- rotate or clear password

### Planning Runs

- `POST /api/meal-plans/runs`
- `GET /api/meal-plans/runs`
- `GET /api/meal-plans/runs/:id`
- `GET /api/meal-plans/runs/:id/status`
- `POST /api/meal-plans/runs/:id/reshuffle`

Responsibilities:

- create a run
- poll run progress
- read a completed run
- list historical runs
- create a derived run via reshuffle

## Migration of Grocery Logic

### Move Directly

These concepts should port almost directly, with TS rewrites:

- pantry ingredient normalization
- instruction composition
- criteria review
- candidate ranking
- grocery list deduplication
- reshuffle mechanics
- OpenAI prompt structure
- reviewed recipe summaries

### Adapt Heavily

These concepts need architecture changes:

- persistent planner context
- source credential storage
- planning history
- progress tracking
- recipe acquisition session handling

### Replace Entirely

These should not survive the migration in current form:

- Flask app bootstrapping
- SQLAlchemy storage layer
- on-disk output artifacts as persistence
- global lock based concurrency control

## Recommended Execution Model

### MVP

Use request-driven planning with persisted status in `MealPlanRun`.

Shape:

1. client creates run
2. backend marks run `RUNNING`
3. backend performs recipe acquisition and planning
4. backend saves outputs
5. client polls `/status`

This is the fastest path to feature parity.

### Target

Move long-running acquisition and planning into a background execution model.

Reason:

- browser automation is slow and failure-prone
- Cloud Run request limits and resource ceilings are a real constraint
- session refresh and retries are easier outside a single request lifecycle

Possible target shapes later:

- job table + worker process
- Cloud Run jobs
- Pub/Sub triggered worker

## Recipe Acquisition Strategy

This is the hardest migration area.

Current grocery behavior depends on:

- Playwright
- ATK login/session reuse
- persisted browser state
- interactive login edge cases

Recommended approach:

### Phase 1

- keep ATK as the only supported planning source
- isolate acquisition in `recipeAcquisitionService`
- store source credentials in DB
- keep session-state handling behind one service boundary

### Phase 2

- move session state out of local dev assumptions
- define production-safe storage for session artifacts
- add source-health reporting and reconnect UX

### Phase 3

- add additional planning sources only after the service boundary is stable

## Frontend Migration Plan

### New Planning Route

Add a new route under authenticated shell navigation.

Suggested page sections:

- plan form
- recipe sources management
- planner preferences
- results
- history

### Hooks

Add React Query hooks similar to existing meals/workouts patterns:

- `useMealPlanPreferencesQuery`
- `useUpdateMealPlanPreferencesMutation`
- `useRecipeSourcesQuery`
- `useSaveRecipeSourceMutation`
- `useDeleteRecipeSourceMutation`
- `useMealPlanRunsQuery`
- `useMealPlanRunQuery`
- `useCreateMealPlanRunMutation`
- `useMealPlanStatusQuery`
- `useReshuffleMealPlanMutation`

### Local UI State

For MVP, keep grocery scratch-off checkbox state local to the browser.

That matches the grocery app behavior and avoids unnecessary schema complexity.

## Security and Secrets

Use HFC-native patterns for all secret material.

Requirements:

- reuse authenticated `Account`
- encrypt recipe-source passwords before DB persistence
- use environment-backed encryption key material
- avoid exposing stored passwords in normal read APIs
- keep ownership filtering on every planning record

Production expectations:

- Secret Manager for encryption key material
- HTTPS-only production traffic
- authenticated image/session/source access

## Risks

### 1. Browser Automation in Production

ATK-style acquisition is the biggest operational risk.

Issues:

- session expiration
- captcha or MFA
- headless-browser stability
- Cloud Run execution time and memory pressure

### 2. Synchronous Request Duration

Even if MVP uses direct request processing, it may become fragile under slow source login or scraping.

### 3. State Migration

The grocery app relies on local files for some persistent behavior. HFC should not.

### 4. Scope Creep

Source expansion beyond ATK will increase complexity quickly. Keep source scope narrow until the planning domain is stable.

## Recommended Delivery Phases

### Phase 1: Foundation

- add Prisma models
- add route skeleton
- add frontend route and nav
- add planner preferences UI and API
- add recipe source credential UI and API

### Phase 2: Planning Core

- port deterministic planner logic to TypeScript
- port OpenAI prompts and structured parsing
- create `MealPlanRun` persistence
- build results and history UI

### Phase 3: Acquisition

- port ATK acquisition behind service boundary
- add status polling
- support completed runs end to end

### Phase 4: Reshuffle and Refinement

- implement reshuffle API and UI
- improve critique and variety balancing
- polish reviewed recipe output

### Phase 5: Hardening

- background execution model
- retry and timeout handling
- source reconnection UX
- telemetry and failure visibility

## Recommended Order of Implementation

1. Prisma schema and migrations
2. backend route surface
3. frontend planning screen shell
4. preferences and source credentials
5. TypeScript planner port
6. planning history and result rendering
7. ATK acquisition integration
8. reshuffle
9. background execution hardening

## Definition of Success

The migration is successful when a signed-in HFC user can:

- configure ATK credentials
- set persistent planning preferences
- enter pantry ingredients and instructions
- run a weekly plan inside HFC
- see selected meals, recipe reviews, and grocery list
- reopen prior plan runs
- reshuffle one meal without losing the rest of the plan

without relying on the old Flask app, SQLAlchemy models, or file-based planner state.
