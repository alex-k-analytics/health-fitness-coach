-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MealAnalysisStatus" AS ENUM ('PENDING', 'COMPLETED', 'FALLBACK', 'FAILED');

-- CreateEnum
CREATE TYPE "MealImageKind" AS ENUM ('PLATE', 'LABEL', 'OTHER');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdMember" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "HouseholdRole" NOT NULL DEFAULT 'MEMBER',
    "goalSummary" TEXT,
    "calorieGoal" INTEGER,
    "proteinGoalGrams" DOUBLE PRECISION,
    "carbGoalGrams" DOUBLE PRECISION,
    "fatGoalGrams" DOUBLE PRECISION,
    "heightCm" DOUBLE PRECISION,
    "activityLevel" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdInvite" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "suggestedName" TEXT,
    "role" "HouseholdRole" NOT NULL DEFAULT 'MEMBER',
    "tokenHash" TEXT NOT NULL,
    "invitedByMemberId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "acceptedByAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthMetric" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "SavedFood" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "createdByMemberId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "MealEntry" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
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

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdMember_accountId_key" ON "HouseholdMember"("accountId");

-- CreateIndex
CREATE INDEX "HouseholdMember_householdId_idx" ON "HouseholdMember"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdInvite_tokenHash_key" ON "HouseholdInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "HouseholdInvite_householdId_status_idx" ON "HouseholdInvite"("householdId", "status");

-- CreateIndex
CREATE INDEX "HealthMetric_memberId_recordedAt_idx" ON "HealthMetric"("memberId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "SavedFood_householdId_name_idx" ON "SavedFood"("householdId", "name");

-- CreateIndex
CREATE INDEX "MealEntry_memberId_eatenAt_idx" ON "MealEntry"("memberId", "eatenAt" DESC);

-- CreateIndex
CREATE INDEX "MealEntry_householdId_eatenAt_idx" ON "MealEntry"("householdId", "eatenAt" DESC);

-- CreateIndex
CREATE INDEX "MealImage_mealEntryId_idx" ON "MealImage"("mealEntryId");

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_invitedByMemberId_fkey" FOREIGN KEY ("invitedByMemberId") REFERENCES "HouseholdMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdInvite" ADD CONSTRAINT "HouseholdInvite_acceptedByAccountId_fkey" FOREIGN KEY ("acceptedByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthMetric" ADD CONSTRAINT "HealthMetric_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "HouseholdMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFood" ADD CONSTRAINT "SavedFood_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFood" ADD CONSTRAINT "SavedFood_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "HouseholdMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEntry" ADD CONSTRAINT "MealEntry_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEntry" ADD CONSTRAINT "MealEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "HouseholdMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEntry" ADD CONSTRAINT "MealEntry_savedFoodId_fkey" FOREIGN KEY ("savedFoodId") REFERENCES "SavedFood"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealImage" ADD CONSTRAINT "MealImage_mealEntryId_fkey" FOREIGN KEY ("mealEntryId") REFERENCES "MealEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

