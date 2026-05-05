-- CreateEnum
CREATE TYPE "MealPlanRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "MealPlannerPreference" (
    "accountId" TEXT NOT NULL,
    "dietaryRestrictions" TEXT,
    "plannerContext" TEXT,
    "defaultMaxRecipes" INTEGER,
    "defaultMaxMeals" INTEGER,
    "defaultUseOpenAi" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlannerPreference_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "RecipeSourceCredential" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordCiphertext" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "loginUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeSourceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanRun" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sourceRunId" TEXT,
    "status" "MealPlanRunStatus" NOT NULL DEFAULT 'PENDING',
    "progressStage" TEXT,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "ingredientsText" TEXT NOT NULL,
    "instructionsText" TEXT NOT NULL,
    "recipeSources" JSONB,
    "maxRecipes" INTEGER NOT NULL,
    "maxMeals" INTEGER NOT NULL,
    "useOpenAi" BOOLEAN NOT NULL DEFAULT true,
    "scrapedCount" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" DOUBLE PRECISION,
    "selectedMealsJson" JSONB,
    "reviewedRecipesJson" JSONB,
    "groceryListJson" JSONB,
    "notesJson" JSONB,
    "scrapedRecipesJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeSourceCredential_accountId_source_key" ON "RecipeSourceCredential"("accountId", "source");

-- CreateIndex
CREATE INDEX "RecipeSourceCredential_accountId_source_idx" ON "RecipeSourceCredential"("accountId", "source");

-- CreateIndex
CREATE INDEX "MealPlanRun_accountId_createdAt_idx" ON "MealPlanRun"("accountId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MealPlanRun_accountId_status_updatedAt_idx" ON "MealPlanRun"("accountId", "status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "MealPlanRun_sourceRunId_idx" ON "MealPlanRun"("sourceRunId");

-- AddForeignKey
ALTER TABLE "MealPlannerPreference" ADD CONSTRAINT "MealPlannerPreference_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeSourceCredential" ADD CONSTRAINT "RecipeSourceCredential_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanRun" ADD CONSTRAINT "MealPlanRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanRun" ADD CONSTRAINT "MealPlanRun_sourceRunId_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "MealPlanRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
