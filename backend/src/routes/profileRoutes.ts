import { Router } from "express";
import { z } from "zod";
import { getRequiredAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

export const profileRoutes = Router();

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  goalSummary: z.string().max(500).nullable().optional(),
  calorieGoal: z.number().int().positive().max(10000).nullable().optional(),
  proteinGoalGrams: z.number().nonnegative().max(1000).nullable().optional(),
  carbGoalGrams: z.number().nonnegative().max(2000).nullable().optional(),
  fatGoalGrams: z.number().nonnegative().max(1000).nullable().optional(),
  heightCm: z.number().positive().max(300).nullable().optional(),
  activityLevel: z.string().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

const createHealthMetricSchema = z
  .object({
    recordedAt: z.string().datetime().optional(),
    weightKg: z.number().positive().max(600).nullable().optional(),
    systolicBloodPressure: z.number().int().positive().max(300).nullable().optional(),
    diastolicBloodPressure: z.number().int().positive().max(250).nullable().optional(),
    restingHeartRate: z.number().int().positive().max(250).nullable().optional(),
    bodyFatPercent: z.number().nonnegative().max(100).nullable().optional(),
    waistCm: z.number().positive().max(500).nullable().optional(),
    note: z.string().max(500).nullable().optional()
  })
  .refine(
    (value) =>
      value.weightKg !== undefined ||
      value.systolicBloodPressure !== undefined ||
      value.diastolicBloodPressure !== undefined ||
      value.restingHeartRate !== undefined ||
      value.bodyFatPercent !== undefined ||
      value.waistCm !== undefined,
    { message: "At least one health metric is required" }
  );

const metricQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(52).default(12)
});

profileRoutes.get("/me", async (req: AuthenticatedRequest, res) => {
  const auth = getRequiredAuth(req);
  const account = await prisma.account.findUnique({
    where: { id: auth.accountId },
    include: {
      healthMetrics: {
        take: 1,
        orderBy: {
          recordedAt: "desc"
        }
      }
    }
  });

  if (!account) {
    return res.status(404).json({ error: "Profile not found" });
  }

  return res.json({
    profile: {
      id: account.id,
      displayName: account.displayName,
      goalSummary: account.goalSummary,
      calorieGoal: account.calorieGoal,
      proteinGoalGrams: account.proteinGoalGrams,
      carbGoalGrams: account.carbGoalGrams,
      fatGoalGrams: account.fatGoalGrams,
      heightCm: account.heightCm,
      activityLevel: account.activityLevel,
      notes: account.notes
    },
    latestMetric: account.healthMetrics[0] ?? null
  });
});

profileRoutes.patch("/me", async (req: AuthenticatedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const auth = getRequiredAuth(req);
  const updated = await prisma.account.update({
    where: { id: auth.accountId },
    data: {
      displayName: parsed.data.displayName?.trim(),
      goalSummary: parsed.data.goalSummary === undefined ? undefined : parsed.data.goalSummary?.trim() || null,
      calorieGoal: parsed.data.calorieGoal,
      proteinGoalGrams: parsed.data.proteinGoalGrams,
      carbGoalGrams: parsed.data.carbGoalGrams,
      fatGoalGrams: parsed.data.fatGoalGrams,
      heightCm: parsed.data.heightCm,
      activityLevel:
        parsed.data.activityLevel === undefined ? undefined : parsed.data.activityLevel?.trim() || null,
      notes: parsed.data.notes === undefined ? undefined : parsed.data.notes?.trim() || null
    }
  });

  return res.json({
    profile: {
      id: updated.id,
      displayName: updated.displayName,
      goalSummary: updated.goalSummary,
      calorieGoal: updated.calorieGoal,
      proteinGoalGrams: updated.proteinGoalGrams,
      carbGoalGrams: updated.carbGoalGrams,
      fatGoalGrams: updated.fatGoalGrams,
      heightCm: updated.heightCm,
      activityLevel: updated.activityLevel,
      notes: updated.notes
    }
  });
});

profileRoutes.get("/me/health-metrics", async (req: AuthenticatedRequest, res) => {
  const parsed = metricQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const auth = getRequiredAuth(req);
  const metrics = await prisma.healthMetric.findMany({
    where: {
      accountId: auth.accountId
    },
    orderBy: {
      recordedAt: "desc"
    },
    take: parsed.data.limit
  });

  return res.json({ metrics });
});

profileRoutes.post("/me/health-metrics", async (req: AuthenticatedRequest, res) => {
  const parsed = createHealthMetricSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const auth = getRequiredAuth(req);
  const metric = await prisma.healthMetric.create({
    data: {
      accountId: auth.accountId,
      recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : new Date(),
      weightKg: parsed.data.weightKg,
      systolicBloodPressure: parsed.data.systolicBloodPressure,
      diastolicBloodPressure: parsed.data.diastolicBloodPressure,
      restingHeartRate: parsed.data.restingHeartRate,
      bodyFatPercent: parsed.data.bodyFatPercent,
      waistCm: parsed.data.waistCm,
      note: parsed.data.note?.trim() || null
    }
  });

  return res.status(201).json({ metric });
});
