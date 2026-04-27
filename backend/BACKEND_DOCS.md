# Backend Documentation

## Tech Stack

- **Runtime:** Node.js (ES2022, ESM modules)
- **Framework:** Express.js 4.19.2
- **Language:** TypeScript 5.6.3
- **Database:** PostgreSQL
- **ORM:** Prisma 5.22.0
- **Validation:** Zod 3.23.8 (runtime schema validation on all inputs)
- **Authentication:** JWT + httpOnly cookies (jsonwebtoken, cookie-parser)
- **Password Hashing:** bcryptjs 3.0.3
- **File Uploads:** Multer 2.1.1 (memory storage)
- **AI:** OpenAI 6.34.0 (Responses API, gpt-4.1)
- **Storage:** Google Cloud Storage or local filesystem
- **Dev Runner:** tsx (watch mode)

**Entry point:** `backend/src/server.ts`

## Project Structure

```
backend/
├── .env                              # Environment config
├── package.json
├── tsconfig.json
├── prisma/
│   ├── schema.prisma                 # Database schema (8 models)
│   └── migrations/                   # 3 migrations
├── src/
│   ├── server.ts                     # Express app setup, route mounting, static files
│   ├── config.ts                     # Centralized runtime config from env vars
│   ├── types.ts                      # Shared TypeScript interfaces
│   ├── seed.ts                       # Database seeder (test account: test@example.com / password123)
│   ├── lib/
│   │   └── prisma.ts                 # Singleton PrismaClient (dev caching via globalThis)
│   ├── middleware/
│   │   └── auth.ts                   # JWT auth middleware + cookie helpers
│   ├── routes/
│   │   ├── authRoutes.ts             # /api/auth/* (session, login, logout)
│   │   ├── profileRoutes.ts          # /api/profile/* (profile CRUD, health metrics)
│   │   ├── nutritionRoutes.ts        # /api/nutrition/* (meals, saved foods, AI analysis, images)
│   │   └── workoutRoutes.ts          # /api/workouts/* (simple workouts, sessions, exercises)
│   ├── services/
│   │   ├── agentService.ts           # Stubbed AI workout planning
│   │   ├── calorieEngine.ts          # MET-based calorie calculation
│   │   ├── googleCalendarService.ts  # Stubbed Google Calendar integration
│   │   ├── nutritionAnalysisService.ts # AI meal photo analysis (OpenAI)
│   │   ├── smsService.ts             # Stubbed SMS reminders (Twilio-compatible)
│   │   └── storageService.ts         # Dual-mode file storage (GCS or local)
│   └── db/
│       └── mockStore.ts              # In-memory mock data (legacy/dev stubs)
└── uploads/                          # Local file storage directory
```

## API Endpoints

### Health Check (no auth)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Returns `{ ok: true, service: "health-fitness-coach-api" }` |

### Authentication (`/api/auth/`) — No Auth Required

| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/session` | Returns current session. If authenticated, refreshes cookie and returns `{ authenticated, token, account, member }`. If not, clears cookie and returns `{ authenticated: false }`. |
| POST | `/api/auth/login` | Accepts `{ email, password }` (8-128 chars). bcrypt validation against Account. Sets httpOnly cookie, returns session. |
| POST | `/api/auth/logout` | Clears auth cookie. Returns 204. |

**Auth mechanism:** JWT with `{ accountId, email }` payload in httpOnly cookie `health_fitness_session` (7-day default). Also accepts `Authorization: Bearer <token>` header.

### Profile (`/api/profile/`) — Auth Required

| Method | Path | Description |
|---|---|---|
| GET | `/api/profile/me` | Returns profile (displayName, goals, calorieGoal, macros, height, activityLevel, notes) + latest HealthMetric. |
| PATCH | `/api/profile/me` | Partial profile update. Zod-validated with sensible limits. |
| GET | `/api/profile/me/health-metrics` | Lists up to 52 recent health metrics (default 12), ordered by recordedAt desc. Query: `?limit=N`. |
| POST | `/api/profile/me/health-metrics` | Creates health metric (weightKg, BP, restingHR, bodyFat%, waistCm, note). At least one field required. |

### Nutrition (`/api/nutrition/`) — Auth Required

| Method | Path | Description |
|---|---|---|
| GET | `/api/nutrition/saved-foods` | Lists user's saved/reusable foods, ordered by name. |
| POST | `/api/nutrition/saved-foods` | Creates saved food with full nutrition data (calories, macros, micronutrients). |
| GET | `/api/nutrition/meals` | Lists recent meals (up to 50, default 20) with images and savedFood references, ordered by eatenAt desc. |
| PATCH | `/api/nutrition/meals/:id` | Updates meal title, notes, eatenAt, serving, quantity, or confirmed AI analysis results. |
| GET | `/api/nutrition/summary` | Daily summary: today's totals (calories, macros, meal count, workout burn, net), goals (workout-adjusted calorie goal), latest metric, 7-day trend. Supports `?timezone=...`. |
| POST | `/api/nutrition/estimate` | **AI estimate only (no persist).** Multipart with images (plate:5, label:3, other:3) + meal details. Calls OpenAI, returns analysis without saving. |
| POST | `/api/nutrition/meals` | **Primary meal logging.** Multipart with images + details. Pipeline: create meal -> AI analysis (or use confirmedAnalysis) -> save images -> update meal -> optionally create SavedFood if `saveAsReusableFood=true`. |
| GET | `/api/nutrition/images/:id` | Streams meal image (GCS or local) with Content-Type + cache control. Verifies ownership. |

### Workouts (`/api/workouts/`) — Auth Required

**Legacy stubs (no auth enforcement, uses mockStore):**

| Method | Path | Description |
|---|---|---|
| GET | `/api/workouts/plan` | Stub: generates workout plan from mockStore + AgentService. |
| POST | `/api/workouts/schedule` | Stub: generates plan, calls stubbed GoogleCalendarService. |
| POST | `/api/workouts/log` | Stub: logs workout to in-memory mockStore. |
| GET | `/api/workouts/log` | Stub: returns in-memory workout logs. |
| GET | `/api/workouts/exercises` | Returns exercise category lookup from calorie engine. |

**Simple workouts (auth required):**

| Method | Path | Description |
|---|---|---|
| GET | `/api/workouts/` | Lists WorkoutEntry records (title, caloriesBurned, performedAt), up to 50 (default 20). |
| POST | `/api/workouts/` | Creates simple workout entry (title, caloriesBurned, optional performedAt). |

**Workout sessions (richer model with exercises):**

| Method | Path | Description |
|---|---|---|
| GET | `/api/workouts/sessions` | Lists WorkoutSessions with exercises. Filter by `?status=PLANNING\|RUNNING\|COMPLETED`. Up to 50 (default 12). |
| GET | `/api/workouts/sessions/:id` | Gets single session with exercises. |
| POST | `/api/workouts/sessions` | Creates session with exercises (LIFT or CARDIO). **Backend recomputes calories** from exercises using MET engine + user's body weight. |
| PATCH | `/api/workouts/sessions/:id` | Partial update. If exercises provided, recalculates calories from scratch. |
| DELETE | `/api/workouts/sessions/:id` | Deletes session (cascades to exercises). |

### Agent (`/api/agent/`) — Stubbed, No Auth

| Method | Path | Description |
|---|---|---|
| GET | `/api/agent/history` | Returns in-memory conversation log. |
| POST | `/api/agent/message` | Stubbed AI chat with hardcoded response. |

### Integrations (`/api/integrations/`) — Stubbed, No Auth

| Method | Path | Description |
|---|---|---|
| GET | `/api/integrations/google/auth-url` | Returns stubbed Google OAuth URL. |
| POST | `/api/integrations/sms/reminder` | Stubbed SMS via mock phone number. |

## Database Schema

All models use `cuid()` primary keys. All child models cascade-delete from Account.

### Account (root entity)
Fields: id, email (unique), passwordHash, displayName, goalSummary?, calorieGoal?, proteinGoalGrams?, carbGoalGrams?, fatGoalGrams?, heightCm?, activityLevel?, notes?, createdAt, updatedAt.
Relations: 1-to-many HealthMetric, SavedFood, MealEntry, WorkoutEntry, WorkoutSession, WorkoutExercise.

### HealthMetric
Fields: id, accountId (FK cascade), recordedAt, weightKg?, systolicBloodPressure?, diastolicBloodPressure?, restingHeartRate?, bodyFatPercent?, waistCm?, note?, createdAt.
Index: (accountId, recordedAt DESC).

### SavedFood (reusable food entries)
Fields: id, accountId (FK cascade), name, brand?, servingDescription?, servingWeightGrams?, calories?, proteinGrams?, carbsGrams?, fatGrams?, fiberGrams?, sugarGrams?, sodiumMg?, micronutrients (JSON?), notes?, createdAt, updatedAt.
Index: (accountId, name). Referenced by MealEntry.savedFoodId (SET NULL on delete).

### MealEntry (meal log)
Fields: id, accountId (FK cascade), savedFoodId? (FK SET NULL), title, notes?, eatenAt, servingDescription?, quantity?, weightGrams?, analysisStatus (PENDING/COMPLETED/FALLBACK/FAILED), analysisSummary?, confidenceScore?, estimatedCalories?, proteinGrams?, carbsGrams?, fatGrams?, fiberGrams?, sugarGrams?, sodiumMg?, micronutrients (JSON?), vitamins (JSON?), assumptions (JSON?), foodBreakdown (JSON?), rawAnalysis (JSON?), aiModel?, createdAt, updatedAt.
Index: (accountId, eatenAt DESC). 1-to-many MealImage.

### MealImage
Fields: id, mealEntryId (FK cascade), storageKey, originalFileName, contentType, sizeBytes, kind (PLATE/LABEL/OTHER), createdAt.
Index: (mealEntryId).

### WorkoutEntry (simple model)
Fields: id, accountId (FK cascade), title, caloriesBurned, performedAt, createdAt, updatedAt.
Index: (accountId, performedAt DESC).

### WorkoutSession (rich model)
Fields: id, accountId (FK cascade), activityType (RUNNING/WALKING/CYCLING/SWIMMING/ROWING/WEIGHTLIFTING/CALISTHENICS/HIIT/OTHER), title, status (PLANNING/RUNNING/COMPLETED, default PLANNING), startTime?, endTime?, durationSeconds?, totalCalories?, categoryCalories (JSON?), performedAt, createdAt, updatedAt.
Indexes: (accountId, performedAt DESC), (accountId, status, updatedAt DESC). 1-to-many WorkoutExercise.

### WorkoutExercise
Fields: id, workoutSessionId (FK cascade), accountId (FK cascade), name, kind (LIFT/CARDIO), category (WorkoutActivityType), sets (JSON? — array of {reps, weightLbs}), distance?, distanceUnit?, durationSeconds?, caloriesBurned?, order (default 0), createdAt.
Indexes: (workoutSessionId, order), (accountId, createdAt DESC).

## Services

### Authentication (`middleware/auth.ts`)
- **JWT tokens** with `{ accountId, email }` payload, 7-day expiry
- **httpOnly cookies** (secure in production, sameSite: lax)
- Accepts auth from both cookie and `Authorization: Bearer` header
- `requireAuth` middleware returns 401 if unauthenticated
- `readAuthPayload` checks both cookie and bearer token
- Cookie/sign/clear helpers for route handlers

### Nutrition Analysis (`services/nutritionAnalysisService.ts`)
- Calls **OpenAI Responses API** (gpt-4.1) with structured JSON schema output
- Sends meal photos (plate/label/other) as base64 input images
- Prompt includes meal title, serving details, user goals, health context, saved food reference
- **Fallback chain:** (1) Saved food scaling if AI unavailable, (2) Heuristic calorie estimation from weight/quantity
- Returns: status, summary, confidence, macros, micronutrients, vitamins, assumptions, per-item food breakdown
- Normalizes all values with rounding and clamping

### Calorie Engine (`services/calorieEngine.ts`)
- **MET-based cardio:** Uses activity category MET table, speed-based intensity selection (distance/duration)
- **Strength calories:** Per-exercise factor table (15 exercises), calculates `reps × weightLbs × factor` per set + rest calories
- **Categories:** WALKING, RUNNING, CYCLING, SWIMMING, ROWING, WEIGHTLIFTING, CALISTHENICS, HIIT
- `computeSessionCalories()` aggregates per-exercise into total + by-category breakdown
- Used by workout session create/update to recalculate calories from user's body weight

### Storage Service (`services/storageService.ts`)
- **Dual-mode:** Google Cloud Storage (production) or local filesystem (development)
- Storage key pattern: `accounts/{accountId}/meals/{mealId}/{uuid}-{sanitizedName}`
- Sanitizes filenames, generates UUID-prefixed keys
- `saveMealImage()` persists buffer, returns metadata
- `createReadStream()` for image serving

### Stubbed Services (future implementations)
- **AgentService:** Hardcoded workout plan generation, portion estimation, diet recommendations
- **GoogleCalendarService:** Returns stubbed "connect OAuth in phase 2" response
- **SmsService:** Twilio-compatible stub

## Configuration (`config.ts`)

| Env Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `4000` | Server port |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS allowed origin |
| `APP_BASE_URL` | (same as FRONTEND_ORIGIN) | App base URL |
| `NATIVE_APP_ORIGINS` | `capacitor://localhost,ionic://localhost` | Native app CORS origins (CSV) |
| `AUTH_COOKIE_NAME` | `health_fitness_session` | Cookie name |
| `JWT_SECRET` | `change-me-in-production` | JWT signing secret |
| `JWT_EXPIRES_IN_DAYS` | `7` | Token expiry |
| `STORAGE_DRIVER` | `local` | `gcs` or `local` |
| `UPLOAD_DIR` | `./uploads` | Local upload directory |
| `FRONTEND_DIST_DIR` | `../frontend/dist` | Served frontend build |
| `GCS_BUCKET_NAME` | `""` | GCS bucket name |
| `OPENAI_API_KEY` | `""` | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4.1` | OpenAI model |
| `MAX_UPLOAD_BYTES` | `8388608` (8MB) | Max file upload size |

## Key Patterns & Conventions

- **Zod validation** on every endpoint input with `.safeParse()` — returns 400 with flattened errors
- **Ownership enforcement** — all queries filter by `accountId` from auth payload
- **Serialize functions** — each route file has `serialize*` functions to control response shape (no raw Prisma output leaked)
- **Singleton Prisma client** — cached on `globalThis` in dev for hot-reload safety
- **Timezone-aware** — nutrition summary uses `Intl.DateTimeFormat` for user's timezone
- **Calorie adjustment** — daily calorie goal increases by workout calories burned
- **AI fallback** — nutrition analysis gracefully degrades through saved food -> heuristic estimates
- **CORS** — dynamic origin checking supporting frontend, app base URL, and native app schemes
- **Static file serving** — serves frontend dist in production, SPA fallback for non-`/api` routes
- **Single-user architecture** — no multi-tenant/household support; one account = one user
