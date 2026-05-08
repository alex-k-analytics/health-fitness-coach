-- AlterTable
ALTER TABLE "MealEntry"
ADD COLUMN "sourceAnalysis" JSONB,
ADD COLUMN "nutritionOverrides" JSONB;
