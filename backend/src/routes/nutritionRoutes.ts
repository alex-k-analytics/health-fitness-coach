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

nutritionRoutes.get("/summary", async (req: AuthenticatedRequest, res) => {
  const auth = getRequiredAuth(req);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfTrendWindow = new Date(startOfDay);
  startOfTrendWindow.setDate(startOfTrendWindow.getDate() - 6);

  const [recentMeals, member] = await Promise.all([
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

  const dailyCalories = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfTrendWindow);
    date.setDate(startOfTrendWindow.getDate() + index);

    return {
      date: date.toISOString().slice(0, 10),
      calories: 0,
      mealCount: 0
    };
  });

  const totals = recentMeals.reduce(
    (accumulator, meal) => ({
      calories:
        accumulator.calories +
        (meal.eatenAt >= startOfDay ? (meal.estimatedCalories ?? 0) : 0),
      proteinGrams:
        accumulator.proteinGrams +
        (meal.eatenAt >= startOfDay ? (meal.proteinGrams ?? 0) : 0),
      carbsGrams:
        accumulator.carbsGrams +
        (meal.eatenAt >= startOfDay ? (meal.carbsGrams ?? 0) : 0),
      fatGrams:
        accumulator.fatGrams +
        (meal.eatenAt >= startOfDay ? (meal.fatGrams ?? 0) : 0)
    }),
    { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }
  );

  recentMeals.forEach((meal) => {
    const mealDate = new Date(meal.eatenAt);
    mealDate.setHours(0, 0, 0, 0);
    const dateKey = mealDate.toISOString().slice(0, 10);
    const matchingDay = dailyCalories.find((day) => day.date === dateKey);

    if (matchingDay) {
      matchingDay.calories += meal.estimatedCalories ?? 0;
      matchingDay.mealCount += 1;
    }
  });

  return res.json({
    today: {
      mealCount: recentMeals.filter((meal) => meal.eatenAt >= startOfDay).length,
      calories: Math.round(totals.calories),
      proteinGrams: Math.round(totals.proteinGrams * 10) / 10,
      carbsGrams: Math.round(totals.carbsGrams * 10) / 10,
      fatGrams: Math.round(totals.fatGrams * 10) / 10
    },
    goals: member
      ? {
          calorieGoal: member.calorieGoal,
          proteinGoalGrams: member.proteinGoalGrams,
          carbGoalGrams: member.carbGoalGrams,
          fatGoalGrams: member.fatGoalGrams
        }
      : null,
    latestMetric: member?.healthMetrics[0] ?? null,
    dailyCalories: dailyCalories.map((day) => ({
      date: day.date,
      calories: Math.round(day.calories),
      mealCount: day.mealCount
    }))
  });
});

nutritionRoutes.post(
  "/meals",
  upload.fields([
    { name: "plateImages", maxCount: 5 },
    { name: "labelImages", maxCount: 3 },
    { name: "otherImages", maxCount: 3 }
  ]),
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

    const auth = getRequiredAuth(req);
    const member = await prisma.account.findUnique({
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
    });

    if (!member) {
      return res.status(404).json({ error: "Profile not found" });
    }

    let savedFood:
      | Awaited<ReturnType<typeof prisma.savedFood.findFirst>>
      | null = null;
    if (parsed.data.savedFoodId) {
      savedFood = await prisma.savedFood.findFirst({
        where: {
          id: parsed.data.savedFoodId,
          accountId: auth.accountId
        }
      });

      if (!savedFood) {
        return res.status(404).json({ error: "Reusable food was not found" });
      }
    }

    const filesByField = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;
    const uploadedImages = [
      ...(filesByField.plateImages ?? []).map((file) => ({ file, kind: "PLATE" as const })),
      ...(filesByField.labelImages ?? []).map((file) => ({ file, kind: "LABEL" as const })),
      ...(filesByField.otherImages ?? []).map((file) => ({ file, kind: "OTHER" as const }))
    ];

    if (uploadedImages.length === 0 && !savedFood && !parsed.data.weightGrams && !parsed.data.quantity) {
      return res.status(400).json({
        error: "Add meal photos, select a reusable food, or provide a serving quantity/weight"
      });
    }

    const meal = await prisma.mealEntry.create({
      data: {
        accountId: auth.accountId,
        savedFoodId: savedFood?.id ?? null,
        title: parsed.data.title.trim(),
        notes: parsed.data.notes?.trim() || null,
        eatenAt: parsed.data.eatenAt ? new Date(parsed.data.eatenAt) : new Date(),
        servingDescription: parsed.data.servingDescription?.trim() || null,
        quantity: parsed.data.quantity ?? null,
        weightGrams: parsed.data.weightGrams ?? null,
        analysisStatus: "PENDING"
      }
    });

    const analysis = await nutritionAnalysisService.analyzeMeal({
      title: parsed.data.title.trim(),
      notes: parsed.data.notes?.trim() || undefined,
      eatenAtISO: meal.eatenAt.toISOString(),
      servingDescription: parsed.data.servingDescription?.trim(),
      quantity: parsed.data.quantity,
      weightGrams: parsed.data.weightGrams,
      goals: {
        calorieGoal: member.calorieGoal,
        proteinGoalGrams: member.proteinGoalGrams,
        carbGoalGrams: member.carbGoalGrams,
        fatGoalGrams: member.fatGoalGrams,
        goalSummary: member.goalSummary
      },
      recentMetric: member.healthMetrics[0]
        ? {
            weightKg: member.healthMetrics[0].weightKg,
            systolicBloodPressure: member.healthMetrics[0].systolicBloodPressure,
            diastolicBloodPressure: member.healthMetrics[0].diastolicBloodPressure
          }
        : null,
      savedFood,
      images: uploadedImages.map(({ file, kind }) => ({
        buffer: file.buffer,
        mimeType: file.mimetype,
        kind
      }))
    });

    const imageRecords = await Promise.all(
      uploadedImages.map(async ({ file, kind }) =>
        storageService.saveMealImage({
          accountId: auth.accountId,
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
      const createdFood = await prisma.savedFood.create({
        data: {
          accountId: auth.accountId,
          name: parsed.data.title.trim(),
          servingDescription: parsed.data.servingDescription?.trim() || "Logged serving",
          servingWeightGrams: parsed.data.weightGrams ?? null,
          calories: analysis.estimatedCalories,
          proteinGrams: analysis.proteinGrams,
          carbsGrams: analysis.carbsGrams,
          fatGrams: analysis.fatGrams,
          fiberGrams: analysis.fiberGrams,
          sugarGrams: analysis.sugarGrams,
          sodiumMg: analysis.sodiumMg,
          micronutrients: analysis.micronutrients as Prisma.InputJsonValue,
          notes: analysis.summary
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
