# Overview

## Product Summary

Health & Fitness Coach is a private single-account nutrition and workout tracking app. It combines meal logging, health metric tracking, workout logging, reusable saved foods, and AI-assisted nutrition estimation from meal photos and nutrition labels.

The app is designed around one personal account rather than a multi-tenant or social product. Users sign in, manage their goals, log meals and workouts, and review day-level progress and trends.

## Core User Flow

1. Sign in to the private account
2. Set profile goals such as calories and macro targets
3. Log health metrics like weight or blood pressure
4. Log meals with text details and optional food, label, or screenshot images
5. Review AI-estimated nutrition, then save meals
6. Reuse saved foods for quicker future entries
7. Log workout sessions and review weekly exercise totals
8. Monitor dashboard summaries, calorie trends, and weight trends

## Main Features

- Email/password authentication with cookie and bearer-token support
- Single private account model
- Profile and goal management
- Health metric tracking
- Photo-first meal logging
- Nutrition label and screenshot support
- OpenAI-powered nutrition estimation
- Saved-food fallback and heuristic fallback when live AI is unavailable
- Reusable saved foods
- Daily nutrition summary with workout-adjusted calorie goals
- Workout session logging with structured exercises
- Weekly workout summaries for cardio distance, lifted weight, and calories burned
- Web frontend plus iOS Capacitor wrapper
- PostgreSQL persistence with Prisma
- Local or GCS-backed meal image storage

## System Shape

The application is split into a React frontend and an Express backend.

- `frontend/`: React, Vite, TypeScript, TanStack Router
- `backend/`: Express, TypeScript, Prisma, OpenAI integration
- `infra/terraform/`: Cloud Run, Cloud SQL, GCS, Artifact Registry, Secret Manager
- `Dockerfile`: production image that serves the built frontend and API together

Runtime shapes:

- Local development: separate Vite frontend and Express API
- Production: one Cloud Run service serving both API and built frontend
- iOS: Capacitor wrapper around the same web frontend

## Frontend Surface

The current frontend centers on authenticated routes for:

- Dashboard
- Meals
- Workouts
- Settings

The dashboard aggregates:

- today’s calories and macros
- workout burn
- calorie-goal progress
- recent meals
- recent workout sessions
- calorie trend
- weight trend

## Backend Surface

The backend exposes authenticated route groups for:

- `/api/auth`
- `/api/profile`
- `/api/nutrition`
- `/api/workouts`

The main active product areas are:

- profile and goals
- health metrics
- meal creation and nutrition analysis
- saved foods
- workout entries and workout sessions
- nutrition summary and trend reporting

## Data Model

Core persisted entities:

- `Account`
- `HealthMetric`
- `SavedFood`
- `MealEntry`
- `MealImage`
- `WorkoutEntry`
- `WorkoutSession`
- `WorkoutExercise`

In practical terms, the app stores:

- profile and goals
- historical health measurements
- meals and nutrition analysis results
- uploaded meal images
- reusable food references
- workout history and exercise details

## AI and Estimation Model

The app is not a general conversational coach today. Its real production AI value is concentrated in nutrition analysis.

For meal logging, the backend:

- accepts plate, label, and other images
- sends those images plus serving context to the OpenAI Responses API
- requests structured nutrition output
- stores the resulting calories, macros, assumptions, micronutrients, vitamins, and food breakdown

If live AI analysis is unavailable, the system degrades gracefully:

- first to saved-food scaling when a reusable food exists
- then to conservative heuristic meal estimation

## Design Notes

- The app is intentionally private and account-centric.
- The strongest production AI feature is nutrition estimation, not general coaching.
- Workout planning and integrations exist in partial or stubbed form, but meal analysis is the mature AI path.
- The backend enforces ownership on authenticated data access and serves the frontend in production.
