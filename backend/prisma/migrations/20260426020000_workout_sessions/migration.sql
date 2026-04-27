CREATE TYPE "WorkoutActivityType" AS ENUM (
    'RUNNING',
    'WALKING',
    'CYCLING',
    'SWIMMING',
    'ROWING',
    'WEIGHTLIFTING',
    'CALISTHENICS',
    'HIIT',
    'OTHER'
);

CREATE TYPE "WorkoutSessionStatus" AS ENUM (
    'PLANNING',
    'RUNNING',
    'COMPLETED'
);

CREATE TYPE "WorkoutExerciseKind" AS ENUM (
    'LIFT',
    'CARDIO'
);

CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "activityType" "WorkoutActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "WorkoutSessionStatus" NOT NULL DEFAULT 'PLANNING',
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "totalCalories" INTEGER,
    "categoryCalories" JSONB,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkoutExercise" (
    "id" TEXT NOT NULL,
    "workoutSessionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "WorkoutExerciseKind" NOT NULL,
    "category" "WorkoutActivityType" NOT NULL,
    "sets" JSONB,
    "distance" DOUBLE PRECISION,
    "distanceUnit" TEXT,
    "durationSeconds" INTEGER,
    "caloriesBurned" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutExercise_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkoutSession_accountId_performedAt_idx" ON "WorkoutSession"("accountId", "performedAt" DESC);
CREATE INDEX "WorkoutSession_accountId_status_updatedAt_idx" ON "WorkoutSession"("accountId", "status", "updatedAt" DESC);
CREATE INDEX "WorkoutExercise_workoutSessionId_order_idx" ON "WorkoutExercise"("workoutSessionId", "order");
CREATE INDEX "WorkoutExercise_accountId_createdAt_idx" ON "WorkoutExercise"("accountId", "createdAt" DESC);

ALTER TABLE "WorkoutSession"
ADD CONSTRAINT "WorkoutSession_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkoutExercise"
ADD CONSTRAINT "WorkoutExercise_workoutSessionId_fkey"
FOREIGN KEY ("workoutSessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkoutExercise"
ADD CONSTRAINT "WorkoutExercise_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
