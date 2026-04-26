# Workout Activity Tracking

## Overview

Replace the existing single "Log workout" quick form with a full-featured workout session tracker that supports:

- Activity-specific planning (cardio, strength, HIIT, etc.)
- Live timer or manual time entry
- Exercise autocomplete (backend list + free-text)
- Set tracking (weight x reps per set for lifting)
- Distance/time tracking for cardio sports
- Load previous workouts for comparison and easy reuse
- Client-side calorie calculation (MET + lift-specific formulas)
- Session drafts (resume later)
- Category-wise calorie breakdown on finalization

The existing "Log workout" form will be renamed to "Log simple workout" and remain as a quick-entry alternative.

## Implementation Decisions

- Both "Log workout" and "Log simple workout" write to `WorkoutSession`.
- `WorkoutEntry` becomes a legacy compatibility table only during rollout and can be removed after migration/backfill is verified.
- Session drafts are per-device and stored in `localStorage`. They are not synced across devices.
- Calorie estimates should be reasonably accurate, so the backend is the source of truth for persisted totals.

---

## Calorie Calculation - Hybrid Approach

### Cardio (MET-based)

Formula: `MET x weight_kg x duration_hours`

| Activity | Speed/Pace | MET |
|----------|-----------|-----|
| Walking | <3 mph | 3.0 |
| Walking | 3-4 mph | 3.5 |
| Jogging | 4-5 mph (12-15 min/mi) | 6.0 |
| Running | 5-6 mph (10-12 min/mi) | 9.8 |
| Running | 6-7 mph (8.5-10 min/mi) | 10.5 |
| Running | >7 mph (<8.5 min/mi) | 11.5 |
| Cycling | <10 mph | 4.0 |
| Cycling | 10-12 mph | 6.0 |
| Cycling | 12-14 mph | 8.0 |
| Cycling | 14-16 mph | 10.0 |
| Swimming | Casual | 6.0 |
| Swimming | Moderate | 8.0 |
| Swimming | Vigorous | 10.0 |

If distance is provided, derive pace -> pick MET. If no pace info, use moderate MET.

### Strength (cal/rep x weight)

Formula: `sum(reps x weight_lbs x factor) + rest_overhead`

Rest overhead: `0.5 cal/min x estimated rest minutes between sets`

| Exercise | Factor (cal/rep/lb) | Notes |
|----------|---------------------|-------|
| Deadlift | 0.022 | Largest compound, full body |
| Squat | 0.022 | Largest compound, legs/core |
| Leg Press | 0.019 | Large compound |
| Hip Thrust | 0.019 | Large compound |
| Bench Press | 0.018 | Medium compound |
| Overhead Press | 0.018 | Medium compound, stabilizers |
| Barbell Row | 0.017 | Medium compound, back |
| Pull-ups | 0.016 | Medium compound, bodyweight |
| Dips | 0.016 | Medium compound |
| Incline Bench Press | 0.017 | Medium compound |
| Leg Curl | 0.013 | Isolation |
| Bicep Curl | 0.012 | Isolation |
| Plank | 0 (time-based) | Use MET instead |
| Leg Extension | 0.012 | Isolation |
| Calf Raise | 0.011 | Isolation |
| Tricep Extension | 0.011 | Isolation |
| Lateral Raise | 0.010 | Isolation, light loads |
| Unknown exercises | 0.015 | Default |

---

## Data Models

### Prisma Schema Additions

```prisma
enum WorkoutActivityType {
  RUNNING
  WALKING
  CYCLING
  SWIMMING
  WEIGHTLIFTING
  CALISTHENICS
  HIIT
  OTHER
}

enum WorkoutSessionStatus {
  PLANNING
  RUNNING
  COMPLETED
}

enum WorkoutExerciseKind {
  LIFT
  CARDIO
}

model WorkoutSession {
  id               String               @id @default(cuid())
  accountId        String
  activityType     WorkoutActivityType
  title            String
  status           WorkoutSessionStatus @default(PLANNING)
  startTime        DateTime?
  endTime          DateTime?
  durationSeconds  Int?
  totalCalories    Int?
  categoryCalories Json?                // { "WEIGHTLIFTING": 180, "RUNNING": 245 }
  performedAt      DateTime             @default(now())
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt
}

model WorkoutExercise {
  id               String              @id @default(cuid())
  workoutSessionId String
  accountId        String
  name             String              // from backend list OR free text
  kind             WorkoutExerciseKind
  category         WorkoutActivityType
  sets             Json?               // [{ reps: int, weightLbs: float }]
  distance         Float?
  distanceUnit     String?
  durationSeconds  Int?
  caloriesBurned   Int?
  createdAt        DateTime            @default(now())
}
```

**Note:** `WorkoutEntry` remains in the schema until migration is confirmed complete. It can be dropped in a future revision.

### Required Schema Details

The final Prisma schema should include the following details in addition to the fields above:

- `Account.workoutSessions WorkoutSession[]`
- `WorkoutSession.account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)`
- `WorkoutSession.exercises WorkoutExercise[]`
- `WorkoutExercise.workoutSession WorkoutSession @relation(fields: [workoutSessionId], references: [id], onDelete: Cascade)`
- `WorkoutExercise.account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)`
- `WorkoutExercise.order Int` to preserve exercise display order within a session
- Indexes:
  - `WorkoutSession @@index([accountId, performedAt(sort: Desc)])`
  - `WorkoutSession @@index([accountId, status, updatedAt(sort: Desc)])`
  - `WorkoutExercise @@index([workoutSessionId, order])`
  - `WorkoutExercise @@index([accountId, createdAt(sort: Desc)])`

### Simple Workout Mapping

The renamed "Log simple workout" flow should create a `WorkoutSession` with:

- `activityType = OTHER`
- `status = COMPLETED`
- `title` from the quick-entry form
- `performedAt` from the selected date/time or `now()`
- `startTime = null`
- `endTime = performedAt`
- `durationSeconds = null`
- `totalCalories` from the submitted value after backend validation
- `categoryCalories = { "OTHER": totalCalories }`
- `exercises = []`

---

## Compatibility And Rollout

Do not perform a one-time application startup migration in request-serving code.

Use a standard Prisma migration plus an explicit backfill step:

1. Add `WorkoutSession`, `WorkoutExercise`, and new enums in a Prisma migration.
2. Keep `WorkoutEntry` temporarily so existing code paths can continue to function during rollout.
3. Run a backfill script or migration task that copies each `WorkoutEntry` into a completed `WorkoutSession`:
   - `status = COMPLETED`
   - `activityType = OTHER`
   - `performedAt = WorkoutEntry.performedAt`
   - `endTime = performedAt`
   - `totalCalories = caloriesBurned`
   - `categoryCalories = { "OTHER": caloriesBurned }`
   - no exercises
4. Update all read paths to use `WorkoutSession` before removing `WorkoutEntry`.
5. Remove `WorkoutEntry` only after dashboard, summary math, and both logging flows are confirmed against production-like data.

### API Compatibility

- Keep `/workouts` as the stable authenticated workout API namespace.
- Add `/workout-sessions` only if there is a strong product or code-organization reason; otherwise prefer:
  - `GET /workouts`
  - `GET /workouts/:id`
  - `POST /workouts`
  - `PATCH /workouts/:id`
  - `DELETE /workouts/:id`
  - `GET /workouts/exercises`
- The full session tracker and the simple logger should both `POST /workouts`.
- During rollout, avoid breaking existing frontend calls that already target `/workouts`.

---

## Backend Endpoints

### GET /exercises

Returns exercise list organized by activity category. Static data.

**Response:**
```json
{
  "exercises": {
    "RUNNING": ["Running", "Jogging", "Sprinting", "Trail Running"],
    "WALKING": ["Walking", "Power Walking", "Hiking"],
    "CYCLING": ["Cycling", "Spin Class", "Mountain Biking"],
    "SWIMMING": ["Freestyle", "Backstroke", "Butterfly", "Breaststroke", "Swimming"],
    "WEIGHTLIFTING": ["Bench Press", "Squat", "Deadlift", "Overhead Press", "Barbell Row", "Pull-ups", "Dumbbell Curl", "Tricep Extension", "Lateral Raise", "Leg Press", "Leg Curl", "Leg Extension", "Calf Raise", "Hip Thrust", "Incline Bench Press"],
    "CALISTHENICS": ["Push-ups", "Pull-ups", "Dips", "Bodyweight Squats", "Plank", "Burpees", "Mountain Climbers", "Lunges", "Pike Push-ups", "Box Jumps"],
    "HIIT": ["HIIT", "Tabata", "Circuit Training"]
  }
}
```

### GET /workout-sessions

List recent completed sessions with exercises. Supports query params:

- `limit` (default 12)
- `status` - filter by status (`COMPLETED`, `PLANNING`, `RUNNING`)

**Response:**
```json
{
  "sessions": [
    {
      "id": "string",
      "title": "Morning Routine",
      "activityType": "WEIGHTLIFTING",
      "performedAt": "2026-04-26T08:00:00Z",
      "totalCalories": 310,
      "durationSeconds": 3120,
      "categoryCalories": { "WEIGHTLIFTING": 310 },
      "status": "COMPLETED",
      "exercises": [
        {
          "id": "string",
          "name": "Bench Press",
          "kind": "LIFT",
          "category": "WEIGHTLIFTING",
          "sets": [
            { "reps": 8, "weightLbs": 135 },
            { "reps": 8, "weightLbs": 155 },
            { "reps": 8, "weightLbs": 175 }
          ],
          "distance": null,
          "distanceUnit": null,
          "durationSeconds": null,
          "caloriesBurned": 120
        }
      ]
    }
  ]
}
```

### GET /workout-sessions/:id

Session detail with full exercise data. Same shape as above but single session.

### POST /workout-sessions

Create and save a completed workout session.

**Request body:**
```json
{
  "activityType": "WEIGHTLIFTING",
  "title": "Morning Routine",
  "startTime": "2026-04-26T08:00:00Z",
  "endTime": "2026-04-26T08:52:00Z",
  "durationSeconds": 3120,
  "totalCalories": 310,
  "categoryCalories": { "WEIGHTLIFTING": 310 },
  "exercises": [
    {
      "name": "Bench Press",
      "kind": "LIFT",
      "category": "WEIGHTLIFTING",
      "sets": [
        { "reps": 8, "weightLbs": 135 },
        { "reps": 8, "weightLbs": 155 },
        { "reps": 8, "weightLbs": 175 }
      ],
      "caloriesBurned": 120
    }
  ]
}
```

### PATCH /workout-sessions/:id

Update exercise data mid-session (add sets, update status, etc.). Partial body allowed.

### DELETE /workout-sessions/:id

Discard a draft session.

### Existing Endpoints To Preserve Or Revisit

The current route file also contains:

- `GET /workouts/plan`
- `POST /workouts/schedule`
- `GET /workouts/log`
- `POST /workouts/log`

The implementation should explicitly decide whether these remain unchanged, move to another route file, or are deprecated in a separate cleanup pass. They should not be implicitly broken by the session-tracking rollout.

## Calorie Source Of Truth

Client-side calculation is still useful for live UX, previews, and comparisons, but persisted totals should be finalized by the backend.

### Backend Responsibility

- The frontend sends structured exercise data, draft totals, and the displayed estimate.
- The backend recomputes `totalCalories` and `categoryCalories` from the submitted exercise payload before saving.
- If the backend-computed total differs materially from the client estimate, the backend value wins.
- The response should return the persisted totals so the UI can reflect the final saved number.

### Accuracy Rules

- Cardio calories use the latest known account weight when available.
- If no recent weight exists, use this fallback order:
  1. explicit weight provided in the request for calculation only
  2. latest recorded health metric weight
  3. no calorie total for weight-based formulas until the user provides weight
- Strength and calisthenics estimates should prefer structured exercise formulas when supported.
- Unknown free-text exercises should fall back to conservative defaults rather than optimistic estimates.
- Time-based bodyweight movements such as planks should use MET-based duration formulas, not lift set formulas.

### Tracking Modes

The exercise model should support three tracking modes even if they are represented by two broad kinds in the UI:

- set-based: reps/weight sets
- duration-based: time only
- distance-based: time plus distance

`CALISTHENICS` and `HIIT` can map to different modes depending on the specific exercise.

## Draft Lifecycle

Drafts are per-device and `localStorage`-backed.

### Source Of Truth

- `localStorage` is the only draft store for `PLANNING` and `RUNNING` sessions until the user saves.
- Do not create server-side draft rows for partially completed sessions in the initial version.
- `PATCH /workout-sessions/:id` is for editing saved sessions or future server-persisted sessions, not for every timer tick.

### Draft Behavior

- Save draft on close, step changes, significant exercise edits, timer pause, and before page unload.
- Use a stable key that is scoped by account and device context, for example:
  - `workout-draft-{accountId}`
- Only one active draft is supported in v1.
- Starting a new workout while a draft exists should offer:
  - resume draft
  - discard draft and start fresh
- Delete the draft after successful save or explicit discard.

## Backend Integration Requirements

The new workout model affects existing calorie-budget math and dashboard rendering.

- Nutrition summary reads must move from `WorkoutEntry` to `WorkoutSession`.
- Only `COMPLETED` sessions should count toward adjusted calorie goals and historical burn totals.
- `PLANNING` and `RUNNING` sessions must not affect calorie-budget math.
- Dashboard workout history should read from `WorkoutSession`, including simple workouts created through the quick logger.

---

## Frontend - Calorie Engine

### MET Values Table

```ts
const MET_TABLE: Record<string, Record<string, number>> = {
  WALKING: { slow: 3.0, moderate: 3.5 },
  RUNNING: { jog: 6.0, moderate: 9.8, fast: 10.5, sprint: 11.5 },
  CYCLING: { slow: 4.0, moderate: 6.0, fast: 8.0, sprint: 10.0 },
  SWIMMING: { casual: 6.0, moderate: 8.0, vigorous: 10.0 },
  WEIGHTLIFTING: { moderate: 3.5, vigorous: 6.0 },
  CALISTHENICS: { moderate: 3.5, vigorous: 6.0 },
  HIIT: { default: 8.0 },
};
```

### Lift Factors

```ts
const LIFT_FACTORS: Record<string, number> = {
  "Deadlift": 0.022,
  "Squat": 0.022,
  "Leg Press": 0.019,
  "Hip Thrust": 0.019,
  "Bench Press": 0.018,
  "Overhead Press": 0.018,
  "Barbell Row": 0.017,
  "Incline Bench Press": 0.017,
  "Pull-ups": 0.016,
  "Dips": 0.016,
  "Leg Curl": 0.013,
  "Bicep Curl": 0.012,
  "Leg Extension": 0.012,
  "Calf Raise": 0.011,
  "Tricep Extension": 0.011,
  "Lateral Raise": 0.010,
};
```

### Calculation Functions

```ts
function calculateCalories(exercise: ExerciseDraft, weightKg: number): number {
  switch (exercise.category) {
    case "RUNNING":
    case "WALKING":
    case "CYCLING":
    case "SWIMMING":
      return calculateCardioCalories(exercise, weightKg);
    case "WEIGHTLIFTING":
    case "CALISTHENICS":
    case "HIIT":
      return calculateStrengthCalories(exercise, weightKg);
    default:
      return 0;
  }
}

function calculateCardioCalories(exercise: ExerciseDraft, weightKg: number): number {
  const durationHours = (exercise.durationSeconds ?? 0) / 3600;
  const met = resolveMet(exercise.category, exercise);
  return Math.round(met * weightKg * durationHours);
}

function calculateStrengthCalories(exercise: ExerciseDraft, weightKg: number): number {
  if (!exercise.sets?.length) return 0;

  const factor = LIFT_FACTORS[exercise.name] ?? 0.015;
  const setCalories = exercise.sets.reduce(
    (total, set) => total + set.reps * set.weightLbs * factor,
    0
  );

  // Estimate rest: 90 seconds between sets
  const restMinutes = (exercise.sets.length - 1) * 1.5;
  const restCalories = restMinutes * 0.5;

  return Math.round(setCalories + restCalories);
}

function resolveMet(category: string, exercise: ExerciseDraft): number {
  // Derive MET from speed/distance/time or use defaults
  // ...
}
```

---

## Frontend - Workout Session Modal

### State Variables

```ts
const [isWorkoutSessionOpen, setIsWorkoutSessionOpen] = useState(false);
const [workoutStep, setWorkoutStep] = useState<"plan" | "active" | "review">("plan");
const [comparisonMode, setComparisonMode] = useState(false);
const [comparisonWorkout, setComparisonWorkout] = useState<WorkoutSession | null>(null);
const [comparisonCollapsed, setComparisonCollapsed] = useState(true);
const [isTimerRunning, setIsTimerRunning] = useState(false);
const [elapsedSeconds, setElapsedSeconds] = useState(0);
const [sessionExercises, setSessionExercises] = useState<WorkoutExerciseDraft[]>([]);
const [sessionCalories, setSessionCalories] = useState({ total: 0, byCategory: {} as Record<string, number> });
const [manualMinutes, setManualMinutes] = useState("");
const [manualSeconds, setManualSeconds] = useState("");
const [hasUsedTimer, setHasUsedTimer] = useState(false);
```

### Step 1 - Plan

```text
+--------------------------------------------------+
| Log workout                                      |
| [Close]                                          |
|                                                  |
| Activity: [Running] [Walking] [Cycling] [...]    |
| Title:    [____________________]                 |
|                                                  |
| Previous workout (collapsed) [v]                 |
| "Morning Routine" | 4/26 | 310 kcal              |
| (expandable table with previous vs current)      |
|                                                  |
| Exercises:                                       |
| [+ Add exercise]                                 |
|                                                  |
| - Bench Press                             [x]    |
|   Sets: [135]x[8] [155]x[8] [+ Set]              |
|   Est. 180 kcal                                  |
|                                                  |
| - Run 2 miles                             [x]    |
|   [____ min] [2.0 mi]                            |
|   Est. 165 kcal                                  |
|                                                  |
| Time: [ ] Use timer  [x] Manual: [47] min        |
|                                                  |
| Total: 345 kcal | Duration: 47 min               |
|                                                  |
|                 [Cancel] [Start workout]         |
+--------------------------------------------------+
```

### Step 2 - Active (Timer)

- Large centered timer display (MM:SS)
- Start / Pause / Stop controls
- Exercises listed with completion toggles
- For cardio: can update distance live
- "End workout" -> Step 3

### Step 3 - Review & Save

- Category breakdown:
  ```text
  Cardio - 245 kcal (Run 30 min, Bike 15 min)
  Strength - 180 kcal (Bench 4x8, Squat 4x10)
  -----------------------------------------------
  Total - 425 kcal | Duration 52 min
  ```
- Full exercise list with sets/details
- "Save" -> POSTs to `/workout-sessions`
- "Edit" -> back to Step 1

---

## Comparison Table - Collapsible

- Loaded with previous workout, collapsed by default
- Summary always visible: "Previous: 280 kcal | 48 min | Current: 310 kcal | 52 min"
- Click header to expand -> shows exercise-by-exercise table
- Visual indicators:
  - `up` - current >= previous total weight (progress)
  - `warn` - current < previous (regression)
  - `missing` - exercise missing from current
- "Clear & start fresh" button removes loaded workout

---

## Session Drafts - Resume Later

- If user closes the modal mid-session (`PLANNING` or `RUNNING`), save draft to `localStorage`
- Key: `workout-draft-{date}`
- Draft includes: activity type, title, exercises with sets, elapsed seconds, status
- When reopening "Log workout", check for pending draft -> show "Resume workout" option
- Draft persists until workout is saved or explicitly discarded

---

## Exercise Autocomplete - Fuzzy Matching

- Typing "bench" shows: "Bench Press", "Incline Bench Press"
- Typing "sq" shows: "Squat", "Bodyweight Squats"
- Substring match + fuzzy (Levenshtein) for typos
- Also allows any free-text if nothing matches
- Free-text exercises stored as-is in `name` field

---

## Dashboard Changes

### Button Row

```text
[Log food] [Log weight] [Log workout] [Log simple workout] [Profile]
```

- **Log workout** -> full session tracker (new)
- **Log simple workout** -> quick calorie entry (renamed from existing)

### "Last 3 Workouts" Section

Placed below meal history card:

```text
+--------------------------------------------------+
| Last 3 Workouts                                  |
|                                                  |
| Morning Routine                     4/26 | 310   |
| Bench 3x8 | Squat 3x8 | OHP 3x8                |
|                                                  |
| Run + Bike                          4/24 | 245   |
| Run 3 mi | Bike 5 mi                            |
|                                                  |
| Calisthenics                       4/22 | 180    |
| Push-ups 4x20 | Plank 3x60 s                   |
|                                     [Log workout]|
+--------------------------------------------------+
```

- Click to expand -> category breakdown
- "Log same workout" button -> opens new session pre-loaded with those exercises

---

## Files to Modify

| File | Changes |
|------|---------|
| `backend/prisma/schema.prisma` | Add `WorkoutSession`, `WorkoutExercise`, enums |
| `backend/src/types.ts` | New TypeScript types |
| `backend/src/routes/workoutRoutes.ts` | Stable `/workouts` API, session CRUD, compatibility behavior, exercise list |
| `backend/src/db/mockStore.ts` | Session/exercise CRUD |
| `backend/src/routes/nutritionRoutes.ts` | Switch summary math from `WorkoutEntry` to `WorkoutSession` and count only completed sessions |
| `frontend/src/types.ts` | New interfaces |
| `frontend/src/App.tsx` | Rename simple workout, add full session modal (3 steps, timer, exercise builder, comparison, drafts) |
| `frontend/src/styles.css` | New component styles |

---

## Implementation Order

1. Backend schema (`WorkoutSession`, `WorkoutExercise`, enums, relations, indexes)
2. Prisma migration and explicit backfill from `WorkoutEntry`
3. Backend route compatibility plan (`/workouts` remains stable)
4. Backend workout CRUD and exercise list endpoints
5. Backend summary integration (`nutritionRoutes` reads `WorkoutSession`)
6. Backend calorie recomputation and validation
7. Backend mockStore updates if still needed for non-persistent workout utilities
8. Frontend types
9. Frontend calorie preview engine (client estimate only)
10. Frontend rename (existing -> "Log simple workout")
11. Frontend simple workout flow mapped to `WorkoutSession`
12. Frontend modal Step 1 (activity type, exercise builder, autocomplete, load previous, comparison)
13. Frontend modal Step 2 (timer, active session)
14. Frontend modal Step 3 (review, category breakdown, save persisted totals)
15. Frontend dashboard (workout history, draft resume)
16. CSS (all new styles)
17. Verification and rollout checks

## Verification And Rollout Checks

### Migration Verification

- Confirm every legacy `WorkoutEntry` produced exactly one completed `WorkoutSession`.
- Confirm legacy totals match migrated `totalCalories`.
- Confirm no backfilled sessions are double-counted in dashboard summary math.

### API Verification

- `GET /workouts` returns both migrated legacy workouts and newly created workout sessions in the expected sort order.
- `POST /workouts` accepts both:
  - simple workout payloads
  - full session payloads with exercises
- `PATCH /workouts/:id` does not allow cross-account access and preserves exercise ordering.

### Product Verification

- Saving a simple workout updates the dashboard workout list and adjusted calorie goal.
- Saving a full workout updates the dashboard workout list and adjusted calorie goal.
- Draft resume works after modal close and page reload on the same device.
- Draft does not affect calorie-budget math until the session is completed.
- Previous-workout compare and "log same workout" both load valid exercise data.

### Regression Checks

- Existing authentication and dashboard load still succeed.
- The meal summary chart still computes consumed, burned, and net calories correctly.
- The renamed "Log simple workout" flow remains faster than the full tracker flow.

---

## UI Components to Build

### Activity Type Pills

- Pill buttons for: Running, Walking, Cycling, Swimming, Weightlifting, Calisthenics, HIIT, Other
- Selected state with accent color
- Click to select, only one active at a time

### Exercise Builder

- Autocomplete input with fuzzy matching
- "Add exercise" button opens picker
- LIFT exercises: set builder rows
- CARDIO exercises: duration + distance inputs

### Set Builder

- Rows of: `[weight] x [reps]` inputs
- "+ Set" button adds row
- "x" button removes row
- Live calorie estimate per exercise

### Workout Timer

- Large centered MM:SS display
- Start / Pause / Stop controls
- Manual time input alternative

### Comparison Table

- Collapsible header with summary
- Table: Exercise | Previous | Current
- Visual indicators (`up`, `warn`, `missing`)

### Category Breakdown

- Grouped by activity type
- Shows kcal and exercise summary per category
- Total line at bottom

### Workout History Card

- Compact list of last 3 sessions
- Title, date, total calories, exercise highlights
- Expand for details
- "Log same workout" CTA

---

## CSS Classes to Add

| Class | Purpose |
|-------|---------|
| `.activity-type-pills` | Flex wrap of activity type buttons |
| `.activity-type-pill` | Individual pill button |
| `.exercise-builder` | Card-based exercise layout |
| `.set-rows` | Grid of weight/reps inputs |
| `.set-row` | Individual set input row |
| `.workout-timer` | Large centered timer display |
| `.workout-timer-value` | Timer number |
| `.workout-comparison` | Comparison table container |
| `.workout-comparison-header` | Collapsible header |
| `.workout-comparison-table` | Previous vs current table |
| `.workout-comparison-summary` | Totals line |
| `.category-breakdown` | Category kcal grouping |
| `.category-breakdown-item` | Per-category line |
| `.workout-history-card` | Recent workouts card |
| `.workout-history-item` | Single workout entry |
