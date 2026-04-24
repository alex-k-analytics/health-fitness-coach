import type { Prisma } from "@prisma/client";
import multer from "multer";
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { getRequiredAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { nutritionAnalysisService } from "../services/nutritionAnalysisService.js";
import { storageService } from "../services/storageService.js";

export const nutritionRoutes = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxUploadBytes,
    files: 8
  }
});

const listMealsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

const summaryQuerySchema = z.object({
  timezone: z.string().min(1).max(80).optional()
});

const createSavedFoodSchema = z.object({
  name: z.string().min(1).max(160),
  brand: z.string().max(160).nullable().optional(),
  servingDescription: z.string().max(160).nullable().optional(),
  servingWeightGrams: z.number().positive().max(5000).nullable().optional(),
  calories: z.number().nonnegative().max(10000).nullable().optional(),
  proteinGrams: z.number().nonnegative().max(1000).nullable().optional(),
  carbsGrams: z.number().nonnegative().max(2000).nullable().optional(),
  fatGrams: z.number().nonnegative().max(1000).nullable().optional(),
  fiberGrams: z.number().nonnegative().max(1000).nullable().optional(),
  sugarGrams: z.number().nonnegative().max(1000).nullable().optional(),
  sodiumMg: z.number().nonnegative().max(50000).nullable().optional(),
  micronutrients: z.array(z.object({
    name: z.string(),
    amount: z.number(),
    unit: z.string()
  })).optional(),
  notes: z.string().max(1000).nullable().optional()
});

const mealInclude = {
  images: {
    orderBy: {
      createdAt: "asc" as const
    }
  },
  savedFood: true
} satisfies Prisma.MealEntryInclude;

const serializeMeal = (
  meal: Prisma.MealEntryGetPayload<{
    include: typeof mealInclude;
  }>
) => ({
  id: meal.id,
  title: meal.title,
  notes: meal.notes,
  eatenAt: meal.eatenAt,
  servingDescription: meal.servingDescription,
  quantity: meal.quantity,
  weightGrams: meal.weightGrams,
  analysisStatus: meal.analysisStatus,
  analysisSummary: meal.analysisSummary,
  confidenceScore: meal.confidenceScore,
  estimatedCalories: meal.estimatedCalories,
  proteinGrams: meal.proteinGrams,
  carbsGrams: meal.carbsGrams,
  fatGrams: meal.fatGrams,
  fiberGrams: meal.fiberGrams,
  sugarGrams: meal.sugarGrams,
  sodiumMg: meal.sodiumMg,
  micronutrients: meal.micronutrients,
  vitamins: meal.vitamins,
  assumptions: meal.assumptions,
  foodBreakdown: meal.foodBreakdown,
  aiModel: meal.aiModel,
  savedFood: meal.savedFood
    ? {
        id: meal.savedFood.id,
        name: meal.savedFood.name,
        brand: meal.savedFood.brand
      }
    : null,
  images: meal.images.map((image) => ({
    id: image.id,
    kind: image.kind,
    originalFileName: image.originalFileName,
    contentType: image.contentType
  })),
  createdAt: meal.createdAt,
  updatedAt: meal.updatedAt
});

const serializeSavedFood = (
  food: Prisma.SavedFoodGetPayload<Record<string, never>>
) => ({
  id: food.id,
  name: food.name,
  brand: food.brand,
  servingDescription: food.servingDescription,
  servingWeightGrams: food.servingWeightGrams,
  calories: food.calories,
  proteinGrams: food.proteinGrams,
  carbsGrams: food.carbsGrams,
  fatGrams: food.fatGrams,
  fiberGrams: food.fiberGrams,
  sugarGrams: food.sugarGrams,
  sodiumMg: food.sodiumMg,
  micronutrients: food.micronutrients,
  notes: food.notes,
  createdAt: food.createdAt
});

const parseOptionalNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseOptionalBoolean = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return ["true", "1", "yes", "on"].includes(String(value).toLowerCase());
};

const getDateKeyInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
};

const getSafeTimeZone = (timeZone: string | undefined) => {
  if (!timeZone) {
    return "UTC";
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
};

const addDaysToDateKey = (dateKey: string, days: number) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return date.toISOString().slice(0, 10);
};

const createMealBodySchema = z.object({
  title: z.string().min(1).max(160),
  notes: z.string().max(1000).optional(),
  eatenAt: z.string().datetime().optional(),
  servingDescription: z.string().max(160).optional(),
  quantity: z.number().positive().max(1000).optional(),
  weightGrams: z.number().positive().max(5000).optional(),
  savedFoodId: z.string().cuid().optional(),
  saveAsReusableFood: z.boolean().optional()
});

const confirmedAnalysisSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "FALLBACK", "FAILED"]),
  model: z.string(),
  summary: z.string(),
  confidenceScore: z.number().min(0).max(1),
  estimatedCalories: z.number().min(0),
  proteinGrams: z.number().min(0),
  carbsGrams: z.number().min(0),
  fatGrams: z.number().min(0),
  fiberGrams: z.number().min(0),
  sugarGrams: z.number().min(0),
  sodiumMg: z.number().min(0),
  micronutrients: z.array(
    z.object({
      name: z.string(),
      amount: z.number().min(0),
      unit: z.string()
    })
  ),
  vitamins: z.array(
    z.object({
      name: z.string(),
      amount: z.number().min(0),
      unit: z.string()
    })
  ),
  assumptions: z.array(z.string()),
  foodBreakdown: z.array(
    z.object({
      label: z.string(),
      quantityDescription: z.string(),
      calories: z.number().min(0),
      proteinGrams: z.number().min(0),
      carbsGrams: z.number().min(0),
      fatGrams: z.number().min(0)
    })
  ),
  rawAnalysis: z.unknown()
});

const updateMealBodySchema = z.object({
  title: z.string().min(1).max(160),
  notes: z.string().max(1000).nullable().optional(),
  eatenAt: z.string().datetime().optional(),
  servingDescription: z.string().max(160).nullable().optional(),
  quantity: z.number().positive().max(1000).optional(),
  confirmedAnalysis: confirmedAnalysisSchema.optional()
});

const mealUploadFields = [
  { name: "plateImages", maxCount: 5 },
  { name: "labelImages", maxCount: 3 },
  { name: "otherImages", maxCount: 3 }
] as const;

const extractUploadedImages = (files: AuthenticatedRequest["files"]) => {
  const filesByField = (files ?? {}) as Record<string, Express.Multer.File[] | undefined>;

  return [
    ...(filesByField.plateImages ?? []).map((file) => ({ file, kind: "PLATE" as const })),
    ...(filesByField.labelImages ?? []).map((file) => ({ file, kind: "LABEL" as const })),
    ...(filesByField.otherImages ?? []).map((file) => ({ file, kind: "OTHER" as const }))
  ];
};

const resolveSavedFood = async (
  auth: ReturnType<typeof getRequiredAuth>,
  savedFoodId: string | undefined
) => {
  if (!savedFoodId) {
    return null;
  }

  return prisma.savedFood.findFirst({
    where: {
      id: savedFoodId,
      accountId: auth.accountId
    }
  });
};

const resolveAnalysisContext = async (
  req: AuthenticatedRequest,
  parsed: z.infer<typeof createMealBodySchema>
) => {
  const auth = getRequiredAuth(req);
  const [account, savedFood] = await Promise.all([
    prisma.account.findUnique({
      where: {
        id: auth.accountId
      },
      include: {
        healthMetrics: {
          take: 1,
          orderBy: {
            recordedAt: "desc"
          }
        }
      }
    }),
    resolveSavedFood(auth, parsed.savedFoodId)
  ]);

  if (!account) {
    return { ok: false as const, error: { status: 404, message: "Profile not found" } };
  }

  if (parsed.savedFoodId && !savedFood) {
    return { ok: false as const, error: { status: 404, message: "Reusable food was not found" } };
  }

  const uploadedImages = extractUploadedImages(req.files);
  if (uploadedImages.length === 0 && !savedFood && !parsed.weightGrams && !parsed.quantity) {
    return {
      ok: false as const,
      error: {
        status: 400,
        message: "Add food photos, a nutrition label screenshot, a reusable food, or servings"
      }
    };
  }

  return {
    ok: true as const,
    auth,
    account,
    savedFood,
    uploadedImages
  } as const;
};

nutritionRoutes.get("/saved-foods", async (req: AuthenticatedRequest, res) => {
  const auth = getRequiredAuth(req);
  const foods = await prisma.savedFood.findMany({
    where: {
      accountId: auth.accountId
    },
    orderBy: [
      { name: "asc" },
      { createdAt: "desc" }
    ]
  });

  return res.json({ foods: foods.map(serializeSavedFood) });
});

nutritionRoutes.post("/saved-foods", async (req: AuthenticatedRequest, res) => {
  const parsed = createSavedFoodSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const auth = getRequiredAuth(req);
  const food = await prisma.savedFood.create({
    data: {
      accountId: auth.accountId,
      name: parsed.data.name.trim(),
      brand: parsed.data.brand?.trim() || null,
      servingDescription: parsed.data.servingDescription?.trim() || null,
      servingWeightGrams: parsed.data.servingWeightGrams ?? null,
      calories: parsed.data.calories ?? null,
      proteinGrams: parsed.data.proteinGrams ?? null,
      carbsGrams: parsed.data.carbsGrams ?? null,
      fatGrams: parsed.data.fatGrams ?? null,
      fiberGrams: parsed.data.fiberGrams ?? null,
      sugarGrams: parsed.data.sugarGrams ?? null,
      sodiumMg: parsed.data.sodiumMg ?? null,
      micronutrients: parsed.data.micronutrients as Prisma.InputJsonValue | undefined,
      notes: parsed.data.notes?.trim() || null
    }
  });

  return res.status(201).json({ food: serializeSavedFood(food) });
});

nutritionRoutes.get("/meals", async (req: AuthenticatedRequest, res) => {
  const parsed = listMealsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const auth = getRequiredAuth(req);
  const meals = await prisma.mealEntry.findMany({
    where: {
      accountId: auth.accountId
    },
    include: mealInclude,
    orderBy: {
      eatenAt: "desc"
    },
    take: parsed.data.limit
  });

  return res.json({ meals: meals.map(serializeMeal) });
});

nutritionRoutes.patch("/meals/:mealId", async (req: AuthenticatedRequest, res) => {
  const parsed = updateMealBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const auth = getRequiredAuth(req);
  const existingMeal = await prisma.mealEntry.findFirst({
    where: {
      id: req.params.mealId,
      accountId: auth.accountId
    }
  });

  if (!existingMeal) {
    return res.status(404).json({ error: "Meal was not found" });
  }

  const analysis = parsed.data.confirmedAnalysis;
  const meal = await prisma.mealEntry.update({
    where: {
      id: existingMeal.id
    },
    data: {
      title: parsed.data.title.trim(),
      notes: parsed.data.notes?.trim() || null,
      eatenAt: parsed.data.eatenAt ? new Date(parsed.data.eatenAt) : existingMeal.eatenAt,
      servingDescription: parsed.data.servingDescription?.trim() || null,
      quantity: parsed.data.quantity ?? null,
      ...(analysis
        ? {
            analysisStatus: analysis.status,
            analysisSummary: analysis.summary,
            confidenceScore: analysis.confidenceScore,
            estimatedCalories: analysis.estimatedCalories,
            proteinGrams: analysis.proteinGrams,
            carbsGrams: analysis.carbsGrams,
            fatGrams: analysis.fatGrams,
            fiberGrams: analysis.fiberGrams,
            sugarGrams: analysis.sugarGrams,
            sodiumMg: analysis.sodiumMg,
            micronutrients: analysis.micronutrients as Prisma.InputJsonValue,
            vitamins: analysis.vitamins as Prisma.InputJsonValue,
            assumptions: analysis.assumptions as Prisma.InputJsonValue,
            foodBreakdown: analysis.foodBreakdown as Prisma.InputJsonValue,
            rawAnalysis: analysis.rawAnalysis as Prisma.InputJsonValue,
            aiModel: analysis.model
          }
        : {})
    },
    include: mealInclude
  });

  return res.json({ meal: serializeMeal(meal) });
});

nutritionRoutes.get("/summary", async (req: AuthenticatedRequest, res) => {
  const parsed = summaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const auth = getRequiredAuth(req);
  const timeZone = getSafeTimeZone(parsed.data.timezone);
  const todayKey = getDateKeyInTimeZone(new Date(), timeZone);
  const trendDateKeys = Array.from({ length: 7 }, (_, index) => addDaysToDateKey(todayKey, index - 6));
  const startOfTrendWindow = new Date();
  startOfTrendWindow.setDate(startOfTrendWindow.getDate() - 8);

  const [recentMeals, recentWorkouts, member] = await Promise.all([
    prisma.mealEntry.findMany({
      where: {
        accountId: auth.accountId,
        eatenAt: {
          gte: startOfTrendWindow
        }
      },
      select: {
        eatenAt: true,
        estimatedCalories: true,
        proteinGrams: true,
        carbsGrams: true,
        fatGrams: true
      }
    }),
    prisma.workoutEntry.findMany({
      where: {
        accountId: auth.accountId,
        performedAt: {
          gte: startOfTrendWindow
        }
      },
      select: {
        performedAt: true,
        caloriesBurned: true
      }
    }),
    prisma.account.findUnique({
      where: {
        id: auth.accountId
      },
      include: {
        healthMetrics: {
          take: 1,
          orderBy: {
            recordedAt: "desc"
          }
        }
      }
    })
  ]);

  const dailyCalories = trendDateKeys.map((date) => ({
    date,
    calories: 0,
    mealCount: 0,
    caloriesBurned: 0
  }));

  const caloriesBurnedToday = recentWorkouts.reduce((total, workout) => {
    return total + (getDateKeyInTimeZone(workout.performedAt, timeZone) === todayKey ? workout.caloriesBurned : 0);
  }, 0);

  const totals = recentMeals.reduce(
    (accumulator, meal) => {
      const isToday = getDateKeyInTimeZone(meal.eatenAt, timeZone) === todayKey;

      return {
        calories: accumulator.calories + (isToday ? (meal.estimatedCalories ?? 0) : 0),
        proteinGrams: accumulator.proteinGrams + (isToday ? (meal.proteinGrams ?? 0) : 0),
        carbsGrams: accumulator.carbsGrams + (isToday ? (meal.carbsGrams ?? 0) : 0),
        fatGrams: accumulator.fatGrams + (isToday ? (meal.fatGrams ?? 0) : 0),
        mealCount: accumulator.mealCount + (isToday ? 1 : 0)
      };
    },
    { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, mealCount: 0 }
  );

  recentMeals.forEach((meal) => {
    const dateKey = getDateKeyInTimeZone(meal.eatenAt, timeZone);
    const matchingDay = dailyCalories.find((day) => day.date === dateKey);

    if (matchingDay) {
      matchingDay.calories += meal.estimatedCalories ?? 0;
      matchingDay.mealCount += 1;
    }
  });

  recentWorkouts.forEach((workout) => {
    const dateKey = getDateKeyInTimeZone(workout.performedAt, timeZone);
    const matchingDay = dailyCalories.find((day) => day.date === dateKey);

    if (matchingDay) {
      matchingDay.caloriesBurned += workout.caloriesBurned;
    }
  });

  const baseCalorieGoal = member?.calorieGoal ?? null;
  const adjustedCalorieGoal = baseCalorieGoal === null ? null : baseCalorieGoal + caloriesBurnedToday;

  return res.json({
    today: {
      mealCount: totals.mealCount,
      calories: Math.round(totals.calories),
      caloriesBurned: caloriesBurnedToday,
      netCalories: Math.round(totals.calories - caloriesBurnedToday),
      proteinGrams: Math.round(totals.proteinGrams * 10) / 10,
      carbsGrams: Math.round(totals.carbsGrams * 10) / 10,
      fatGrams: Math.round(totals.fatGrams * 10) / 10
    },
    goals: member
      ? {
          calorieGoal: adjustedCalorieGoal,
          baseCalorieGoal,
          adjustedCalorieGoal,
          proteinGoalGrams: member.proteinGoalGrams,
          carbGoalGrams: member.carbGoalGrams,
          fatGoalGrams: member.fatGoalGrams
        }
      : null,
    latestMetric: member?.healthMetrics[0] ?? null,
    dailyCalories: dailyCalories.map((day) => ({
      date: day.date,
      calories: Math.round(day.calories),
      mealCount: day.mealCount,
      caloriesBurned: day.caloriesBurned,
      netCalories: Math.round(day.calories - day.caloriesBurned)
    }))
  });
});

nutritionRoutes.post(
  "/estimate",
  upload.fields(mealUploadFields),
  async (req: AuthenticatedRequest, res) => {
    const parsed = createMealBodySchema.safeParse({
      title: req.body.title,
      notes: req.body.notes || undefined,
      eatenAt: req.body.eatenAt || undefined,
      servingDescription: req.body.servingDescription || undefined,
      quantity: parseOptionalNumber(req.body.quantity),
      weightGrams: parseOptionalNumber(req.body.weightGrams),
      savedFoodId: req.body.savedFoodId || undefined,
      saveAsReusableFood: parseOptionalBoolean(req.body.saveAsReusableFood)
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const context = await resolveAnalysisContext(req, parsed.data);
    if (!context.ok) {
      const error = context.error;
      return res.status(error.status).json({ error: error.message });
    }

    const eatenAt = parsed.data.eatenAt ? new Date(parsed.data.eatenAt) : new Date();
    const analysis = await nutritionAnalysisService.analyzeMeal({
      title: parsed.data.title.trim(),
      notes: parsed.data.notes?.trim() || undefined,
      eatenAtISO: eatenAt.toISOString(),
      servingDescription: parsed.data.servingDescription?.trim(),
      quantity: parsed.data.quantity,
      weightGrams: parsed.data.weightGrams,
      goals: {
        calorieGoal: context.account.calorieGoal,
        proteinGoalGrams: context.account.proteinGoalGrams,
        carbGoalGrams: context.account.carbGoalGrams,
        fatGoalGrams: context.account.fatGoalGrams,
        goalSummary: context.account.goalSummary
      },
      recentMetric: context.account.healthMetrics[0]
        ? {
            weightKg: context.account.healthMetrics[0].weightKg,
            systolicBloodPressure: context.account.healthMetrics[0].systolicBloodPressure,
            diastolicBloodPressure: context.account.healthMetrics[0].diastolicBloodPressure
          }
        : null,
      savedFood: context.savedFood,
      images: context.uploadedImages.map(({ file, kind }) => ({
        buffer: file.buffer,
        mimeType: file.mimetype,
        kind
      }))
    });

    return res.json({ analysis });
  }
);

nutritionRoutes.post(
  "/meals",
  upload.fields(mealUploadFields),
  async (req: AuthenticatedRequest, res) => {
    const parsed = createMealBodySchema.safeParse({
      title: req.body.title,
      notes: req.body.notes || undefined,
      eatenAt: req.body.eatenAt || undefined,
      servingDescription: req.body.servingDescription || undefined,
      quantity: parseOptionalNumber(req.body.quantity),
      weightGrams: parseOptionalNumber(req.body.weightGrams),
      savedFoodId: req.body.savedFoodId || undefined,
      saveAsReusableFood: parseOptionalBoolean(req.body.saveAsReusableFood)
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const context = await resolveAnalysisContext(req, parsed.data);
    if (!context.ok) {
      const error = context.error;
      return res.status(error.status).json({ error: error.message });
    }

    const meal = await prisma.mealEntry.create({
      data: {
        accountId: context.auth.accountId,
        savedFoodId: context.savedFood?.id ?? null,
        title: parsed.data.title.trim(),
        notes: parsed.data.notes?.trim() || null,
        eatenAt: parsed.data.eatenAt ? new Date(parsed.data.eatenAt) : new Date(),
        servingDescription: parsed.data.servingDescription?.trim() || null,
        quantity: parsed.data.quantity ?? null,
        weightGrams: parsed.data.weightGrams ?? null,
        analysisStatus: "PENDING"
      }
    });

    let analysis;
    let reusableAnalysis;
    if (req.body.confirmedAnalysis) {
      let parsedAnalysisJson: unknown;
      try {
        parsedAnalysisJson = JSON.parse(String(req.body.confirmedAnalysis));
      } catch {
        return res.status(400).json({ error: "Confirmed analysis payload is not valid JSON" });
      }

      const confirmedAnalysis = confirmedAnalysisSchema.safeParse(parsedAnalysisJson);
      if (!confirmedAnalysis.success) {
        return res.status(400).json({ error: confirmedAnalysis.error.flatten() });
      }

      analysis = confirmedAnalysis.data;

      if (req.body.reusableAnalysis) {
        let parsedReusableAnalysisJson: unknown;
        try {
          parsedReusableAnalysisJson = JSON.parse(String(req.body.reusableAnalysis));
        } catch {
          return res.status(400).json({ error: "Reusable analysis payload is not valid JSON" });
        }

        const parsedReusableAnalysis = confirmedAnalysisSchema.safeParse(parsedReusableAnalysisJson);
        if (!parsedReusableAnalysis.success) {
          return res.status(400).json({ error: parsedReusableAnalysis.error.flatten() });
        }

        reusableAnalysis = parsedReusableAnalysis.data;
      }
    } else {
      analysis = await nutritionAnalysisService.analyzeMeal({
        title: parsed.data.title.trim(),
        notes: parsed.data.notes?.trim() || undefined,
        eatenAtISO: meal.eatenAt.toISOString(),
        servingDescription: parsed.data.servingDescription?.trim(),
        quantity: parsed.data.quantity,
        weightGrams: parsed.data.weightGrams,
        goals: {
          calorieGoal: context.account.calorieGoal,
          proteinGoalGrams: context.account.proteinGoalGrams,
          carbGoalGrams: context.account.carbGoalGrams,
          fatGoalGrams: context.account.fatGoalGrams,
          goalSummary: context.account.goalSummary
        },
        recentMetric: context.account.healthMetrics[0]
          ? {
              weightKg: context.account.healthMetrics[0].weightKg,
              systolicBloodPressure: context.account.healthMetrics[0].systolicBloodPressure,
              diastolicBloodPressure: context.account.healthMetrics[0].diastolicBloodPressure
            }
          : null,
        savedFood: context.savedFood,
        images: context.uploadedImages.map(({ file, kind }) => ({
          buffer: file.buffer,
          mimeType: file.mimetype,
          kind
        }))
      });
    }

    const imageRecords = await Promise.all(
      context.uploadedImages.map(async ({ file, kind }) =>
        storageService.saveMealImage({
          accountId: context.auth.accountId,
          mealEntryId: meal.id,
          image: {
            buffer: file.buffer,
            contentType: file.mimetype,
            originalName: file.originalname,
            sizeBytes: file.size,
            kind
          }
        })
      )
    );

    let createdFoodId: string | null = null;
    if (parsed.data.saveAsReusableFood) {
      const savedAnalysis = reusableAnalysis ?? analysis;
      const createdFood = await prisma.savedFood.create({
        data: {
          accountId: context.auth.accountId,
          name: parsed.data.title.trim(),
          servingDescription: parsed.data.servingDescription?.trim() || "1 serving",
          servingWeightGrams: parsed.data.weightGrams ?? null,
          calories: savedAnalysis.estimatedCalories,
          proteinGrams: savedAnalysis.proteinGrams,
          carbsGrams: savedAnalysis.carbsGrams,
          fatGrams: savedAnalysis.fatGrams,
          fiberGrams: savedAnalysis.fiberGrams,
          sugarGrams: savedAnalysis.sugarGrams,
          sodiumMg: savedAnalysis.sodiumMg,
          micronutrients: savedAnalysis.micronutrients as Prisma.InputJsonValue,
          notes: savedAnalysis.summary
        }
      });
      createdFoodId = createdFood.id;
    }

    const finalMeal = await prisma.mealEntry.update({
      where: { id: meal.id },
      data: {
        analysisStatus: analysis.status,
        analysisSummary: analysis.summary,
        confidenceScore: analysis.confidenceScore,
        estimatedCalories: analysis.estimatedCalories,
        proteinGrams: analysis.proteinGrams,
        carbsGrams: analysis.carbsGrams,
        fatGrams: analysis.fatGrams,
        fiberGrams: analysis.fiberGrams,
        sugarGrams: analysis.sugarGrams,
        sodiumMg: analysis.sodiumMg,
        micronutrients: analysis.micronutrients as Prisma.InputJsonValue,
        vitamins: analysis.vitamins as Prisma.InputJsonValue,
        assumptions: analysis.assumptions as Prisma.InputJsonValue,
        foodBreakdown: analysis.foodBreakdown as Prisma.InputJsonValue,
        rawAnalysis: analysis.rawAnalysis as Prisma.InputJsonValue,
        aiModel: analysis.model,
        images: {
          create: imageRecords
        }
      },
      include: mealInclude
    });

    return res.status(201).json({
      meal: serializeMeal(finalMeal),
      savedFoodId: createdFoodId
    });
  }
);

nutritionRoutes.get("/images/:imageId", async (req: AuthenticatedRequest, res) => {
  const auth = getRequiredAuth(req);
  const image = await prisma.mealImage.findFirst({
    where: {
      id: req.params.imageId,
      mealEntry: {
        accountId: auth.accountId
      }
    }
  });

  if (!image) {
    return res.status(404).json({ error: "Image not found" });
  }

  res.setHeader("Content-Type", image.contentType);
  res.setHeader("Cache-Control", "private, max-age=60");

  const stream = storageService.createReadStream(image.storageKey);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.status(404).json({ error: "Image is unavailable" });
    } else {
      res.end();
    }
  });

  return stream.pipe(res);
});
