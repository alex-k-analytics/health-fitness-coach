-- Move profile fields onto Account
ALTER TABLE "Account"
ADD COLUMN "displayName" TEXT,
ADD COLUMN "goalSummary" TEXT,
ADD COLUMN "calorieGoal" INTEGER,
ADD COLUMN "proteinGoalGrams" DOUBLE PRECISION,
ADD COLUMN "carbGoalGrams" DOUBLE PRECISION,
ADD COLUMN "fatGoalGrams" DOUBLE PRECISION,
ADD COLUMN "heightCm" DOUBLE PRECISION,
ADD COLUMN "activityLevel" TEXT,
ADD COLUMN "notes" TEXT;

UPDATE "Account" AS account
SET
  "displayName" = member."displayName",
  "goalSummary" = member."goalSummary",
  "calorieGoal" = member."calorieGoal",
  "proteinGoalGrams" = member."proteinGoalGrams",
  "carbGoalGrams" = member."carbGoalGrams",
  "fatGoalGrams" = member."fatGoalGrams",
  "heightCm" = member."heightCm",
  "activityLevel" = member."activityLevel",
  "notes" = member."notes"
FROM "HouseholdMember" AS member
WHERE member."accountId" = account."id";

UPDATE "Account"
SET "displayName" = COALESCE("displayName", split_part("email", '@', 1))
WHERE "displayName" IS NULL;

ALTER TABLE "Account"
ALTER COLUMN "displayName" SET NOT NULL;

-- Drop old household-based tables
DROP TABLE "MealImage";
DROP TABLE "MealEntry";
DROP TABLE "SavedFood";
DROP TABLE "HealthMetric";
DROP TABLE "HouseholdInvite";
DROP TABLE "HouseholdMember";
DROP TABLE "Household";

DROP TYPE "InvitationStatus";
DROP TYPE "HouseholdRole";

-- Recreate tables with single-user ownership
CREATE TABLE "HealthMetric" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DOUBLE PRECISION,
    "systolicBloodPressure" INTEGER,
    "diastolicBloodPressure" INTEGER,
    "restingHeartRate" INTEGER,
    "bodyFatPercent" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedFood" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "servingDescription" TEXT,
    "servingWeightGrams" DOUBLE PRECISION,
    "calories" DOUBLE PRECISION,
    "proteinGrams" DOUBLE PRECISION,
    "carbsGrams" DOUBLE PRECISION,
    "fatGrams" DOUBLE PRECISION,
    "fiberGrams" DOUBLE PRECISION,
    "sugarGrams" DOUBLE PRECISION,
    "sodiumMg" DOUBLE PRECISION,
    "micronutrients" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedFood_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "savedFoodId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "eatenAt" TIMESTAMP(3) NOT NULL,
    "servingDescription" TEXT,
    "quantity" DOUBLE PRECISION,
    "weightGrams" DOUBLE PRECISION,
    "analysisStatus" "MealAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "analysisSummary" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "estimatedCalories" DOUBLE PRECISION,
    "proteinGrams" DOUBLE PRECISION,
    "carbsGrams" DOUBLE PRECISION,
    "fatGrams" DOUBLE PRECISION,
    "fiberGrams" DOUBLE PRECISION,
    "sugarGrams" DOUBLE PRECISION,
    "sodiumMg" DOUBLE PRECISION,
    "micronutrients" JSONB,
    "vitamins" JSONB,
    "assumptions" JSONB,
    "foodBreakdown" JSONB,
    "rawAnalysis" JSONB,
    "aiModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealImage" (
    "id" TEXT NOT NULL,
    "mealEntryId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "kind" "MealImageKind" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HealthMetric_accountId_recordedAt_idx" ON "HealthMetric"("accountId", "recordedAt" DESC);
CREATE INDEX "SavedFood_accountId_name_idx" ON "SavedFood"("accountId", "name");
CREATE INDEX "MealEntry_accountId_eatenAt_idx" ON "MealEntry"("accountId", "eatenAt" DESC);
CREATE INDEX "MealImage_mealEntryId_idx" ON "MealImage"("mealEntryId");

ALTER TABLE "HealthMetric"
ADD CONSTRAINT "HealthMetric_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedFood"
ADD CONSTRAINT "SavedFood_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MealEntry"
ADD CONSTRAINT "MealEntry_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MealEntry"
ADD CONSTRAINT "MealEntry_savedFoodId_fkey"
FOREIGN KEY ("savedFoodId") REFERENCES "SavedFood"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MealImage"
ADD CONSTRAINT "MealImage_mealEntryId_fkey"
FOREIGN KEY ("mealEntryId") REFERENCES "MealEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
