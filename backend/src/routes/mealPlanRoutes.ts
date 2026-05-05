import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getRequiredAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { mealPlanningService } from "../services/mealPlanningService.js";
import {
  RECIPE_SOURCE_DEFINITIONS,
  type MealPlanPreferences,
  type MealPlanRunDetail,
  type MealPlanRunSummary,
  type PlanningRecipeCandidate,
  type RecipeSourceId,
  type WeeklyMealPlan
} from "../services/mealPlanningTypes.js";
import { recipeCredentialService } from "../services/recipeCredentialService.js";
import { recipeAcquisitionService } from "../services/recipeAcquisitionService.js";

export const mealPlanRoutes = Router();

const planningSourceIds = RECIPE_SOURCE_DEFINITIONS.filter((source) => source.supportedForPlanning).map((source) => source.id);

const preferencesSchema = z.object({
  dietaryRestrictions: z.string().max(4000).optional(),
  plannerContext: z.string().max(4000).optional(),
  defaultMaxRecipes: z.number().int().min(5).max(120).nullable().optional(),
  defaultMaxMeals: z.number().int().min(1).max(10).nullable().optional(),
  defaultUseOpenAi: z.boolean().nullable().optional()
});

const saveSourceSchema = z.object({
  username: z.string().max(320).optional(),
  password: z.string().max(1000).nullable().optional(),
  loginUrl: z.string().max(1024).nullable().optional(),
  enabled: z.boolean().optional(),
  clearPassword: z.boolean().optional()
});

const createRunSchema = z.object({
  ingredients: z.string().min(1).max(6000),
  instructions: z.string().max(4000).optional(),
  recipeSources: z.array(z.string()).min(1).optional(),
  maxRecipes: z.number().int().min(5).max(120).optional(),
  maxMeals: z.number().int().min(1).max(10).optional(),
  useOpenAi: z.boolean().optional()
});

const reshuffleSchema = z.object({
  title: z.string().min(1).max(500),
  url: z.string().max(2000).optional().default("")
});

function defaultPreferences(preference: {
  dietaryRestrictions: string | null;
  plannerContext: string | null;
  defaultMaxRecipes: number | null;
  defaultMaxMeals: number | null;
  defaultUseOpenAi: boolean | null;
  updatedAt: Date;
} | null): MealPlanPreferences {
  return {
    dietaryRestrictions: preference?.dietaryRestrictions ?? "",
    plannerContext: preference?.plannerContext ?? "",
    defaultMaxRecipes: preference?.defaultMaxRecipes ?? null,
    defaultMaxMeals: preference?.defaultMaxMeals ?? null,
    defaultUseOpenAi: preference?.defaultUseOpenAi ?? null,
    updatedAt: preference?.updatedAt.toISOString() ?? null
  };
}

function parseJsonArray<T>(value: Prisma.JsonValue | null | undefined, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function parseRecipeSources(value: Prisma.JsonValue | null | undefined): RecipeSourceId[] {
  if (!Array.isArray(value)) return ["atk"];
  return value
    .map((item) => String(item))
    .filter((item): item is RecipeSourceId => planningSourceIds.includes(item as RecipeSourceId));
}

function parsePlan(run: {
  selectedMealsJson: Prisma.JsonValue | null;
  reviewedRecipesJson: Prisma.JsonValue | null;
  groceryListJson: Prisma.JsonValue | null;
  notesJson: Prisma.JsonValue | null;
  recipeSources: Prisma.JsonValue | null;
  ingredientsText: string;
  instructionsText: string;
}): WeeklyMealPlan | null {
  const selectedMeals = parseJsonArray(run.selectedMealsJson, []);
  const reviewedRecipes = parseJsonArray(run.reviewedRecipesJson, []);
  const groceryList = parseJsonArray(run.groceryListJson, []);
  const notes = parseJsonArray<string>(run.notesJson, []);
  if (!selectedMeals.length && !reviewedRecipes.length && !groceryList.length && !notes.length) {
    return null;
  }
  return {
    pantryIngredients: mealPlanningService.parsePantryIngredients(run.ingredientsText),
    recipeSources: parseRecipeSources(run.recipeSources),
    agentInstructions: run.instructionsText,
    selectedMeals,
    reviewedRecipes,
    groceryList,
    notes
  } as WeeklyMealPlan;
}

function serializeSummary(run: {
  id: string;
  sourceRunId: string | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  progressStage: string | null;
  progressPercent: number;
  ingredientsText: string;
  recipeSources: Prisma.JsonValue | null;
  selectedMealsJson: Prisma.JsonValue | null;
  scrapedCount: number;
  durationSeconds: number | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): MealPlanRunSummary {
  const ingredientPreview = mealPlanningService.parsePantryIngredients(run.ingredientsText).slice(0, 5);
  const selectedMeals = parseJsonArray<{ title?: string }>(run.selectedMealsJson, [])
    .map((meal) => String(meal?.title ?? "").trim())
    .filter(Boolean);

  return {
    id: run.id,
    sourceRunId: run.sourceRunId,
    status: run.status,
    progressStage: run.progressStage,
    progressPercent: run.progressPercent,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    ingredientsPreview: ingredientPreview,
    selectedMeals,
    recipeSources: parseRecipeSources(run.recipeSources),
    scrapedCount: run.scrapedCount,
    durationSeconds: run.durationSeconds,
    errorMessage: run.errorMessage
  };
}

function serializeDetail(run: {
  id: string;
  sourceRunId: string | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  progressStage: string | null;
  progressPercent: number;
  ingredientsText: string;
  instructionsText: string;
  recipeSources: Prisma.JsonValue | null;
  maxRecipes: number;
  maxMeals: number;
  useOpenAi: boolean;
  selectedMealsJson: Prisma.JsonValue | null;
  reviewedRecipesJson: Prisma.JsonValue | null;
  groceryListJson: Prisma.JsonValue | null;
  notesJson: Prisma.JsonValue | null;
  scrapedRecipesJson: Prisma.JsonValue | null;
  scrapedCount: number;
  durationSeconds: number | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): MealPlanRunDetail {
  return {
    id: run.id,
    sourceRunId: run.sourceRunId,
    status: run.status,
    progressStage: run.progressStage,
    progressPercent: run.progressPercent,
    request: {
      ingredients: run.ingredientsText,
      instructions: run.instructionsText,
      recipeSources: parseRecipeSources(run.recipeSources),
      maxRecipes: run.maxRecipes,
      maxMeals: run.maxMeals,
      useOpenAi: run.useOpenAi
    },
    plan: parsePlan(run),
    scrapedRecipes: parseJsonArray<PlanningRecipeCandidate>(run.scrapedRecipesJson, []),
    scrapedCount: run.scrapedCount,
    durationSeconds: run.durationSeconds,
    errorMessage: run.errorMessage,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString()
  };
}

async function updateRunProgress(runId: string, stage: string, progressPercent: number) {
  await prisma.mealPlanRun.update({
    where: { id: runId },
    data: {
      status: "RUNNING",
      progressStage: stage,
      progressPercent
    }
  });
}

async function processMealPlanRun(input: {
  runId: string;
  accountId: string;
  ingredients: string;
  instructions: string;
  recipeSources: RecipeSourceId[];
  maxRecipes: number;
  maxMeals: number;
  useOpenAi: boolean;
}) {
  const startedAt = Date.now();
  try {
    await updateRunProgress(input.runId, "Preparing pantry ingredients", 8);
    const preferences = defaultPreferences(
      await prisma.mealPlannerPreference.findUnique({
        where: { accountId: input.accountId }
      })
    );
    const pantryIngredients = mealPlanningService.parsePantryIngredients(input.ingredients);
    const combinedInstructions = mealPlanningService.composeInstructions(preferences, input.instructions);

    if (pantryIngredients.length === 0) {
      throw new Error("Enter at least one pantry ingredient.");
    }

    await updateRunProgress(input.runId, "Loading recipe source credentials", 14);
    const sourceLogins = await Promise.all(
      input.recipeSources.map((source) => recipeCredentialService.resolvePlanningSourceLogin(input.accountId, source))
    );
    const atkLogin = sourceLogins[0];

    await updateRunProgress(input.runId, "Acquiring recipe candidates", 28);
    const acquisition = await recipeAcquisitionService.acquireRecipes({
      source: input.recipeSources[0],
      login: atkLogin,
      pantryIngredients,
      maxRecipes: input.maxRecipes,
      options: { headless: true }
    });

    await updateRunProgress(input.runId, "Building weekly plan", 68);
    const plan = await mealPlanningService.buildPlan({
      pantryIngredients,
      recipeSources: input.recipeSources,
      recipes: acquisition.recipes,
      instructions: combinedInstructions,
      maxMeals: input.maxMeals,
      useOpenAi: input.useOpenAi
    });
    if (acquisition.warnings.length > 0) {
      plan.notes = [...plan.notes, ...acquisition.warnings];
    }

    await prisma.mealPlanRun.update({
      where: { id: input.runId },
      data: {
        status: "COMPLETED",
        progressStage: "Complete",
        progressPercent: 100,
        selectedMealsJson: toInputJson(plan.selectedMeals),
        reviewedRecipesJson: toInputJson(plan.reviewedRecipes),
        groceryListJson: toInputJson(plan.groceryList),
        notesJson: toInputJson(plan.notes),
        scrapedRecipesJson: toInputJson(acquisition.recipes),
        scrapedCount: acquisition.scrapedCount,
        durationSeconds: Math.round((Date.now() - startedAt) / 100) / 10,
        errorMessage: null
      }
    });
  } catch (error) {
    await prisma.mealPlanRun.update({
      where: { id: input.runId },
      data: {
        status: "FAILED",
        progressStage: "Failed",
        progressPercent: 100,
        errorMessage: error instanceof Error ? error.message : "Unknown planning error"
      }
    });
  }
}

mealPlanRoutes.get("/preferences", async (req: AuthenticatedRequest, res) => {
  const auth = getRequiredAuth(req);
  const preference = await prisma.mealPlannerPreference.findUnique({
    where: { accountId: auth.accountId }
  });
  return res.json(defaultPreferences(preference));
});

mealPlanRoutes.patch("/preferences", async (req: AuthenticatedRequest, res) => {
  const parsed = preferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const auth = getRequiredAuth(req);
  const saved = await prisma.mealPlannerPreference.upsert({
    where: { accountId: auth.accountId },
    update: {
      dietaryRestrictions: parsed.data.dietaryRestrictions?.trim(),
      plannerContext: parsed.data.plannerContext?.trim(),
      defaultMaxRecipes: parsed.data.defaultMaxRecipes,
      defaultMaxMeals: parsed.data.defaultMaxMeals,
      defaultUseOpenAi: parsed.data.defaultUseOpenAi
    },
    create: {
      accountId: auth.accountId,
      dietaryRestrictions: parsed.data.dietaryRestrictions?.trim() ?? "",
      plannerContext: parsed.data.plannerContext?.trim() ?? "",
      defaultMaxRecipes: parsed.data.defaultMaxRecipes ?? null,
      defaultMaxMeals: parsed.data.defaultMaxMeals ?? null,
      defaultUseOpenAi: parsed.data.defaultUseOpenAi ?? true
    }
  });
  return res.json(defaultPreferences(saved));
});

mealPlanRoutes.get("/sources", async (req: AuthenticatedRequest, res) => {
  const auth = getRequiredAuth(req);
  const sources = await recipeCredentialService.listSources(auth.accountId);
  return res.json({ sources });
});

mealPlanRoutes.post("/sources/:source", async (req: AuthenticatedRequest, res) => {
  const parsed = saveSourceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const auth = getRequiredAuth(req);
  try {
    const source = await recipeCredentialService.saveSource({
      accountId: auth.accountId,
      source: req.params.source,
      username: parsed.data.username ?? "",
      password: parsed.data.password ?? null,
      loginUrl: parsed.data.loginUrl ?? null,
      enabled: parsed.data.enabled ?? true,
      clearPassword: parsed.data.clearPassword ?? false
    });
    return res.json({ source });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to save source." });
  }
});

mealPlanRoutes.delete("/sources/:source", async (req: AuthenticatedRequest, res) => {
  const auth = getRequiredAuth(req);
  try {
    await recipeCredentialService.deleteSource(auth.accountId, req.params.source);
    return res.json({ deleted: true });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to delete source." });
  }
});

mealPlanRoutes.post("/runs", async (req: AuthenticatedRequest, res) => {
  const parsed = createRunSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const auth = getRequiredAuth(req);

  let recipeSources: RecipeSourceId[] = ["atk"];
  try {
    recipeSources = recipeCredentialService.assertPlanningSources(parsed.data.recipeSources ?? ["atk"]);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid recipe sources." });
  }

  const preference = defaultPreferences(
    await prisma.mealPlannerPreference.findUnique({
      where: { accountId: auth.accountId }
    })
  );

  const run = await prisma.mealPlanRun.create({
    data: {
      accountId: auth.accountId,
      status: "PENDING",
      progressStage: "Queued",
      progressPercent: 0,
      ingredientsText: parsed.data.ingredients,
      instructionsText: mealPlanningService.composeInstructions(preference, parsed.data.instructions ?? ""),
      recipeSources: toInputJson(recipeSources),
      maxRecipes: parsed.data.maxRecipes ?? preference.defaultMaxRecipes ?? 20,
      maxMeals: parsed.data.maxMeals ?? preference.defaultMaxMeals ?? 5,
      useOpenAi: parsed.data.useOpenAi ?? preference.defaultUseOpenAi ?? true
    }
  });

  setImmediate(() => {
    void processMealPlanRun({
      runId: run.id,
      accountId: auth.accountId,
      ingredients: parsed.data.ingredients,
      instructions: parsed.data.instructions ?? "",
      recipeSources,
      maxRecipes: run.maxRecipes,
      maxMeals: run.maxMeals,
      useOpenAi: run.useOpenAi
    });
  });

  return res.status(202).json({
    runId: run.id,
    status: run.status,
    progressStage: run.progressStage,
    progressPercent: run.progressPercent
  });
});

mealPlanRoutes.get("/runs", async (req: AuthenticatedRequest, res) => {
  const auth = getRequiredAuth(req);
  const runs = await prisma.mealPlanRun.findMany({
    where: { accountId: auth.accountId },
    orderBy: { createdAt: "desc" },
    take: 25
  });
  return res.json({ runs: runs.map((run) => serializeSummary(run)) });
});

mealPlanRoutes.get("/runs/:id", async (req: AuthenticatedRequest, res) => {
  const auth = getRequiredAuth(req);
  const run = await prisma.mealPlanRun.findFirst({
    where: {
      id: req.params.id,
      accountId: auth.accountId
    }
  });
  if (!run) {
    return res.status(404).json({ error: "Meal plan run not found." });
  }
  return res.json(serializeDetail(run));
});

mealPlanRoutes.get("/runs/:id/status", async (req: AuthenticatedRequest, res) => {
  const auth = getRequiredAuth(req);
  const run = await prisma.mealPlanRun.findFirst({
    where: {
      id: req.params.id,
      accountId: auth.accountId
    },
    select: {
      id: true,
      status: true,
      progressStage: true,
      progressPercent: true,
      errorMessage: true,
      updatedAt: true
    }
  });
  if (!run) {
    return res.status(404).json({ error: "Meal plan run not found." });
  }
  return res.json({
    id: run.id,
    status: run.status,
    progressStage: run.progressStage,
    progressPercent: run.progressPercent,
    errorMessage: run.errorMessage,
    updatedAt: run.updatedAt.toISOString()
  });
});

mealPlanRoutes.post("/runs/:id/reshuffle", async (req: AuthenticatedRequest, res) => {
  const parsed = reshuffleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const auth = getRequiredAuth(req);
  const sourceRun = await prisma.mealPlanRun.findFirst({
    where: {
      id: req.params.id,
      accountId: auth.accountId
    }
  });
  if (!sourceRun) {
    return res.status(404).json({ error: "Meal plan run not found." });
  }

  const currentPlan = parsePlan(sourceRun);
  if (!currentPlan) {
    return res.status(400).json({ error: "Meal plan run is not complete yet." });
  }
  const scrapedRecipes = parseJsonArray<PlanningRecipeCandidate>(sourceRun.scrapedRecipesJson, []);
  if (scrapedRecipes.length === 0) {
    return res.status(400).json({ error: "No scraped recipes are available for reshuffle." });
  }

  try {
    const updatedPlan = await mealPlanningService.reshuffle({
      pantryIngredients: currentPlan.pantryIngredients,
      recipeSources: currentPlan.recipeSources,
      recipes: scrapedRecipes,
      currentPlan,
      replacedTitle: parsed.data.title,
      replacedUrl: parsed.data.url,
      useOpenAi: sourceRun.useOpenAi
    });

    const newRun = await prisma.mealPlanRun.create({
      data: {
        accountId: auth.accountId,
        sourceRunId: sourceRun.id,
        status: "COMPLETED",
        progressStage: "Complete",
        progressPercent: 100,
        ingredientsText: sourceRun.ingredientsText,
        instructionsText: sourceRun.instructionsText,
        recipeSources: sourceRun.recipeSources ?? undefined,
        maxRecipes: sourceRun.maxRecipes,
        maxMeals: sourceRun.maxMeals,
        useOpenAi: sourceRun.useOpenAi,
        scrapedCount: sourceRun.scrapedCount,
        durationSeconds: 0.1,
        selectedMealsJson: toInputJson(updatedPlan.selectedMeals),
        reviewedRecipesJson: toInputJson(updatedPlan.reviewedRecipes),
        groceryListJson: toInputJson(updatedPlan.groceryList),
        notesJson: toInputJson(updatedPlan.notes),
        scrapedRecipesJson: toInputJson(scrapedRecipes)
      }
    });

    const fullRun = await prisma.mealPlanRun.findUnique({ where: { id: newRun.id } });
    if (!fullRun) {
      return res.status(404).json({ error: "Reshuffled meal plan run not found." });
    }
    return res.json(serializeDetail(fullRun));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to reshuffle meal plan." });
  }
});
