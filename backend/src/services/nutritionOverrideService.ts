import type { NutritionAnalysisResult } from "./nutritionAnalysisService.js";

export interface NutritionOverrides {
  estimatedCalories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  sugarGrams?: number;
}

export const nutritionOverrideKeys = [
  "estimatedCalories",
  "proteinGrams",
  "carbsGrams",
  "fatGrams",
  "fiberGrams",
  "sugarGrams"
] as const satisfies Array<keyof NutritionOverrides>;

export type NutritionOverrideKey = (typeof nutritionOverrideKeys)[number];

export type FinalizedNutritionAnalysis = Omit<
  NutritionAnalysisResult,
  "foodBreakdown"
> & {
  foodBreakdown: NutritionAnalysisResult["foodBreakdown"] | null;
};

const nutritionOverrideLabels: Record<NutritionOverrideKey, string> = {
  estimatedCalories: "calories",
  proteinGrams: "protein",
  carbsGrams: "carbs",
  fatGrams: "fat",
  fiberGrams: "fiber",
  sugarGrams: "sugar"
};

export function applyNutritionOverrides(
  sourceAnalysis: NutritionAnalysisResult,
  nutritionOverrides?: NutritionOverrides | null
): FinalizedNutritionAnalysis {
  const definedEntries = nutritionOverrideKeys.filter(
    (key) => nutritionOverrides?.[key] !== undefined
  );

  if (definedEntries.length === 0) {
    return {
      ...sourceAnalysis
    };
  }

  const correctedFields = definedEntries.map((key) => nutritionOverrideLabels[key]);
  const correctionNote = `User manually corrected ${correctedFields.join(", ")}.`;

  return {
    ...sourceAnalysis,
    ...Object.fromEntries(
      definedEntries.map((key) => [key, nutritionOverrides?.[key]])
    ),
    assumptions: sourceAnalysis.assumptions.includes(correctionNote)
      ? sourceAnalysis.assumptions
      : [...sourceAnalysis.assumptions, correctionNote],
    foodBreakdown: null
  };
}
