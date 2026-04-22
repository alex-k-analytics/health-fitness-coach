import type { MealAnalysisStatus } from "@prisma/client";
import OpenAI from "openai";
import { config } from "../config.js";

interface NutritionReferenceFood {
  name: string;
  brand?: string | null;
  servingDescription?: string | null;
  servingWeightGrams?: number | null;
  calories?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
  fiberGrams?: number | null;
  sugarGrams?: number | null;
  sodiumMg?: number | null;
  micronutrients?: unknown;
  notes?: string | null;
}

interface NutritionGoalContext {
  calorieGoal?: number | null;
  proteinGoalGrams?: number | null;
  carbGoalGrams?: number | null;
  fatGoalGrams?: number | null;
  goalSummary?: string | null;
}

interface NutritionMetricContext {
  weightKg?: number | null;
  systolicBloodPressure?: number | null;
  diastolicBloodPressure?: number | null;
}

interface AnalysisImage {
  mimeType: string;
  buffer: Buffer;
  kind: "PLATE" | "LABEL" | "OTHER";
}

export interface NutritionAnalysisInput {
  title: string;
  notes?: string;
  eatenAtISO: string;
  servingDescription?: string;
  quantity?: number;
  weightGrams?: number;
  goals?: NutritionGoalContext;
  recentMetric?: NutritionMetricContext | null;
  savedFood?: NutritionReferenceFood | null;
  images: AnalysisImage[];
}

export interface NutritionAnalysisResult {
  status: MealAnalysisStatus;
  model: string;
  summary: string;
  confidenceScore: number;
  estimatedCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
  sugarGrams: number;
  sodiumMg: number;
  micronutrients: Array<{ name: string; amount: number; unit: string }>;
  vitamins: Array<{ name: string; amount: number; unit: string }>;
  assumptions: string[];
  foodBreakdown: Array<{
    label: string;
    quantityDescription: string;
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  }>;
  rawAnalysis: Record<string, unknown>;
}

interface StructuredAnalysis {
  summary: string;
  confidenceScore: number;
  estimatedCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
  sugarGrams: number;
  sodiumMg: number;
  micronutrients: Array<{ name: string; amount: number; unit: string }>;
  vitamins: Array<{ name: string; amount: number; unit: string }>;
  assumptions: string[];
  foodBreakdown: Array<{
    label: string;
    quantityDescription: string;
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  }>;
}

const openai = config.openAiApiKey ? new OpenAI({ apiKey: config.openAiApiKey }) : null;

const clamp = (value: number, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) =>
  Math.min(Math.max(value, minimum), maximum);

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const nutritionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    confidenceScore: { type: "number", minimum: 0, maximum: 1 },
    estimatedCalories: { type: "number", minimum: 0 },
    proteinGrams: { type: "number", minimum: 0 },
    carbsGrams: { type: "number", minimum: 0 },
    fatGrams: { type: "number", minimum: 0 },
    fiberGrams: { type: "number", minimum: 0 },
    sugarGrams: { type: "number", minimum: 0 },
    sodiumMg: { type: "number", minimum: 0 },
    micronutrients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          amount: { type: "number", minimum: 0 },
          unit: { type: "string" }
        },
        required: ["name", "amount", "unit"]
      }
    },
    vitamins: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          amount: { type: "number", minimum: 0 },
          unit: { type: "string" }
        },
        required: ["name", "amount", "unit"]
      }
    },
    assumptions: {
      type: "array",
      items: { type: "string" }
    },
    foodBreakdown: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          quantityDescription: { type: "string" },
          calories: { type: "number", minimum: 0 },
          proteinGrams: { type: "number", minimum: 0 },
          carbsGrams: { type: "number", minimum: 0 },
          fatGrams: { type: "number", minimum: 0 }
        },
        required: ["label", "quantityDescription", "calories", "proteinGrams", "carbsGrams", "fatGrams"]
      }
    }
  },
  required: [
    "summary",
    "confidenceScore",
    "estimatedCalories",
    "proteinGrams",
    "carbsGrams",
    "fatGrams",
    "fiberGrams",
    "sugarGrams",
    "sodiumMg",
    "micronutrients",
    "vitamins",
    "assumptions",
    "foodBreakdown"
  ]
} as const;

const createPrompt = (input: NutritionAnalysisInput) => {
  const lines = [
    "You are analyzing a meal log for a private household nutrition app.",
    "Estimate nutrition conservatively from the meal photos, nutrition label photos, and user-provided serving details.",
    "Use any visible nutrition label as the highest-confidence source when present.",
    "Return totals for the entire logged serving, not per 100g unless the user only supplied 100g information.",
    "Use the serving details below and state assumptions explicitly.",
    "",
    `Meal title: ${input.title}`,
    `Logged at: ${input.eatenAtISO}`,
    `Serving description: ${input.servingDescription || "not provided"}`,
    `Quantity/count: ${input.quantity ?? "not provided"}`,
    `Weight in grams: ${input.weightGrams ?? "not provided"}`,
    `Notes: ${input.notes || "none"}`,
    `Nutrition goals: ${JSON.stringify(input.goals ?? {})}`,
    `Recent health context: ${JSON.stringify(input.recentMetric ?? {})}`,
    `Reusable food reference: ${JSON.stringify(input.savedFood ?? {})}`,
    `Image count: ${input.images.length}`
  ];

  return lines.join("\n");
};

const createFallback = (input: NutritionAnalysisInput, reason: string): NutritionAnalysisResult => {
  const quantity = input.quantity && input.quantity > 0 ? input.quantity : 1;
  const savedFood = input.savedFood;

  if (savedFood?.calories) {
    const multiplier =
      savedFood.servingWeightGrams && input.weightGrams
        ? input.weightGrams / savedFood.servingWeightGrams
        : quantity;

    return {
      status: "FALLBACK",
      model: "saved-food-fallback",
      summary:
        "Used the reusable food entry as the primary nutrition source because live AI analysis was unavailable.",
      confidenceScore: 0.72,
      estimatedCalories: round((savedFood.calories ?? 0) * multiplier),
      proteinGrams: round((savedFood.proteinGrams ?? 0) * multiplier),
      carbsGrams: round((savedFood.carbsGrams ?? 0) * multiplier),
      fatGrams: round((savedFood.fatGrams ?? 0) * multiplier),
      fiberGrams: round((savedFood.fiberGrams ?? 0) * multiplier),
      sugarGrams: round((savedFood.sugarGrams ?? 0) * multiplier),
      sodiumMg: round((savedFood.sodiumMg ?? 0) * multiplier),
      micronutrients: Array.isArray(savedFood.micronutrients) ? (savedFood.micronutrients as any[]) : [],
      vitamins: [],
      assumptions: [
        reason,
        "Reusable food values were scaled from the saved serving definition."
      ],
      foodBreakdown: [
        {
          label: savedFood.name,
          quantityDescription: input.servingDescription || `${quantity} serving(s)`,
          calories: round((savedFood.calories ?? 0) * multiplier),
          proteinGrams: round((savedFood.proteinGrams ?? 0) * multiplier),
          carbsGrams: round((savedFood.carbsGrams ?? 0) * multiplier),
          fatGrams: round((savedFood.fatGrams ?? 0) * multiplier)
        }
      ],
      rawAnalysis: {
        source: "saved-food-fallback",
        reason
      }
    };
  }

  const weight = input.weightGrams ?? quantity * 120;
  const calories = clamp(weight * 1.6, 120, 1400);
  const protein = round(weight * 0.08);
  const carbs = round(weight * 0.14);
  const fat = round(weight * 0.05);

  return {
    status: "FALLBACK",
    model: "heuristic-fallback",
    summary:
      "Used a conservative heuristic estimate because live AI nutrition analysis was unavailable. Add a nutrition label photo or reusable food entry for better accuracy.",
    confidenceScore: 0.34,
    estimatedCalories: round(calories),
    proteinGrams: protein,
    carbsGrams: carbs,
    fatGrams: fat,
    fiberGrams: round(weight * 0.015),
    sugarGrams: round(weight * 0.025),
    sodiumMg: round(weight * 3.5),
    micronutrients: [],
    vitamins: [],
    assumptions: [
      reason,
      "Estimated from serving size, weight, and a generic mixed-meal density heuristic."
    ],
    foodBreakdown: [
      {
        label: input.title,
        quantityDescription: input.servingDescription || `${quantity} serving(s)`,
        calories: round(calories),
        proteinGrams: protein,
        carbsGrams: carbs,
        fatGrams: fat
      }
    ],
    rawAnalysis: {
      source: "heuristic-fallback",
      reason,
      weight,
      quantity
    }
  };
};

const normalizeStructuredAnalysis = (analysis: StructuredAnalysis): NutritionAnalysisResult => ({
  status: "COMPLETED",
  model: config.openAiModel,
  summary: analysis.summary,
  confidenceScore: clamp(round(analysis.confidenceScore, 2), 0, 1),
  estimatedCalories: round(analysis.estimatedCalories),
  proteinGrams: round(analysis.proteinGrams),
  carbsGrams: round(analysis.carbsGrams),
  fatGrams: round(analysis.fatGrams),
  fiberGrams: round(analysis.fiberGrams),
  sugarGrams: round(analysis.sugarGrams),
  sodiumMg: round(analysis.sodiumMg),
  micronutrients: analysis.micronutrients,
  vitamins: analysis.vitamins,
  assumptions: analysis.assumptions,
  foodBreakdown: analysis.foodBreakdown.map((item) => ({
    ...item,
    calories: round(item.calories),
    proteinGrams: round(item.proteinGrams),
    carbsGrams: round(item.carbsGrams),
    fatGrams: round(item.fatGrams)
  })),
  rawAnalysis: analysis as unknown as Record<string, unknown>
});

export class NutritionAnalysisService {
  async analyzeMeal(input: NutritionAnalysisInput): Promise<NutritionAnalysisResult> {
    if (!openai) {
      return createFallback(input, "OPENAI_API_KEY is not configured.");
    }

    try {
      const response = await openai.responses.create({
        model: config.openAiModel,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: createPrompt(input)
              },
              ...input.images.map((image) => ({
                type: "input_image" as const,
                image_url: `data:${image.mimeType};base64,${image.buffer.toString("base64")}`
              }))
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "nutrition_analysis",
            strict: true,
            schema: nutritionSchema
          }
        }
      } as never);

      const outputText = (response as { output_text?: string }).output_text;
      if (!outputText) {
        return createFallback(input, "OpenAI returned an empty nutrition response.");
      }

      const parsed = JSON.parse(outputText) as StructuredAnalysis;
      return normalizeStructuredAnalysis(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown OpenAI error";
      return createFallback(input, `OpenAI analysis failed: ${message}`);
    }
  }
}

export const nutritionAnalysisService = new NutritionAnalysisService();
