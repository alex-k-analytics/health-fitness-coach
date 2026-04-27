import { Router } from "express";
import { z } from "zod";
import { mockStore } from "../db/mockStore.js";
import { prisma } from "../lib/prisma.js";
import { getRequiredAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { AgentService } from "../services/agentService.js";
import { GoogleCalendarService } from "../services/googleCalendarService.js";
import { computeSessionCalories, EXERCISE_CATEGORIES } from "../services/calorieEngine.js";

export const workoutRoutes = Router();
const agent = new AgentService();
const calendar = new GoogleCalendarService();

const workoutLogSchema = z.object({
  title: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  completedAtISO: z.string().datetime()
});

const listWorkoutsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

const createWorkoutSchema = z.object({
  title: z.string().min(1).max(160),
  caloriesBurned: z.number().int().positive().max(5000),
  performedAt: z.string().datetime().optional()
});

const exerciseSetSchema = z.object({
  reps: z.number().int().nonnegative(),
  weightLbs: z.number().nonnegative()
});

const exerciseDataSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(["LIFT", "CARDIO"]),
  category: z.enum(["RUNNING", "WALKING", "CYCLING", "SWIMMING", "ROWING", "WEIGHTLIFTING", "CALISTHENICS", "HIIT", "OTHER"]),
  sets: z.array(exerciseSetSchema).optional(),
  distance: z.number().nonnegative().optional(),
  distanceUnit: z.string().max(20).optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  caloriesBurned: z.number().int().nonnegative().max(10000).optional()
});

const createSessionSchema = z.object({
  activityType: z.enum(["RUNNING", "WALKING", "CYCLING", "SWIMMING", "ROWING", "WEIGHTLIFTING", "CALISTHENICS", "HIIT", "OTHER"]),
  title: z.string().min(1).max(200),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  totalCalories: z.number().int().nonnegative().max(10000).optional(),
  categoryCalories: z.record(z.string(), z.number().int().nonnegative()).optional(),
  exercises: z.array(exerciseDataSchema).default([])
});

const updateSessionSchema = z.object({
  activityType: z.enum(["RUNNING", "WALKING", "CYCLING", "SWIMMING", "ROWING", "WEIGHTLIFTING", "CALISTHENICS", "HIIT", "OTHER"]).optional(),
  title: z.string().min(1).max(200).optional(),
  status: z.enum(["PLANNING", "RUNNING", "COMPLETED"]).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  totalCalories: z.number().int().nonnegative().max(10000).optional(),
  categoryCalories: z.record(z.string(), z.number().int().nonnegative()).optional(),
  performedAt: z.string().datetime().optional(),
  exercises: z.array(exerciseDataSchema).optional()
});

const listSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
  status: z.enum(["PLANNING", "RUNNING", "COMPLETED"]).optional()
});

const serializeWorkout = (workout: {
  id: string;
  title: string;
  caloriesBurned: number;
  performedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: workout.id,
  title: workout.title,
  caloriesBurned: workout.caloriesBurned,
  performedAt: workout.performedAt.toISOString(),
  createdAt: workout.createdAt.toISOString(),
  updatedAt: workout.updatedAt.toISOString()
});

const serializeExercise = (ex: any) => ({
  id: ex.id,
  name: ex.name,
  kind: ex.kind,
  category: ex.category,
  sets: ex.sets,
  distance: ex.distance,
  distanceUnit: ex.distanceUnit,
  durationSeconds: ex.durationSeconds,
  caloriesBurned: ex.caloriesBurned,
  order: ex.order
});

const serializeSession = (session: any) => ({
  id: session.id,
  title: session.title,
  activityType: session.activityType,
  status: session.status,
  startTime: session.startTime?.toISOString(),
  endTime: session.endTime?.toISOString(),
  durationSeconds: session.durationSeconds,
  totalCalories: session.totalCalories,
  categoryCalories: session.categoryCalories,
  performedAt: session.performedAt.toISOString(),
  createdAt: session.createdAt.toISOString(),
  updatedAt: session.updatedAt.toISOString(),
  exercises: (session.exercises ?? []).map(serializeExercise)
});

workoutRoutes.get("/plan", async (_req, res) => {
  const profile = mockStore.getProfile();
  const plan = await agent.generateWorkoutPlan(profile);
  res.json({ plan });
});

workoutRoutes.post("/schedule", async (_req, res) => {
  const profile = mockStore.getProfile();
  const plan = await agent.generateWorkoutPlan(profile);
  const result = await calendar.scheduleWorkoutItems(profile.id, plan);
  res.json(result);
});

workoutRoutes.post("/log", (req, res) => {
  const parsed = workoutLogSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  mockStore.addWorkoutLog(parsed.data);
  return res.status(201).json({ ok: true });
});

workoutRoutes.get("/log", (_req, res) => {
  res.json({ logs: mockStore.listWorkoutLogs() });
});

workoutRoutes.get("/exercises", (_req, res) => {
  res.json({ exercises: EXERCISE_CATEGORIES });
});

workoutRoutes.get("/", async (req: AuthenticatedRequest, res) => {
  const parsed = listWorkoutsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const auth = getRequiredAuth(req);
  const sessions = await prisma.workoutSession.findMany({
    where: {
      accountId: auth.accountId,
      activityType: "OTHER"
    },
    orderBy: {
      performedAt: "desc"
    },
    take: parsed.data.limit
  });

  const workouts = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    caloriesBurned: s.totalCalories ?? 0,
    performedAt: s.performedAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt
  }));

  return res.json({ workouts: workouts.map(serializeWorkout) });
});

workoutRoutes.post("/", async (req: AuthenticatedRequest, res) => {
  const parsed = createWorkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const auth = getRequiredAuth(req);
  const performedAt = parsed.data.performedAt ? new Date(parsed.data.performedAt) : new Date();
  const session = await prisma.workoutSession.create({
    data: {
      accountId: auth.accountId,
      activityType: "OTHER",
      title: parsed.data.title.trim(),
      status: "COMPLETED",
      performedAt,
      endTime: performedAt,
      totalCalories: parsed.data.caloriesBurned,
      categoryCalories: { OTHER: parsed.data.caloriesBurned } as any
    },
    include: { exercises: { orderBy: { order: "asc" } } }
  });

  return res.status(201).json({ workout: serializeSession(session) });
});

// --- Workout Session Endpoints ---

workoutRoutes.get("/sessions", async (req: AuthenticatedRequest, res) => {
  const parsed = listSessionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const auth = getRequiredAuth(req);
  const where: any = { accountId: auth.accountId };
  if (parsed.data.status) {
    where.status = parsed.data.status;
  }

  const sessions = await prisma.workoutSession.findMany({
    where,
    include: { exercises: { orderBy: { order: "asc" } } },
    orderBy: { performedAt: "desc" },
    take: parsed.data.limit
  });

  return res.json({ sessions: sessions.map(serializeSession) });
});

workoutRoutes.get("/sessions/:id", async (req: AuthenticatedRequest, res) => {
  const auth = getRequiredAuth(req);

  const session = await prisma.workoutSession.findFirst({
    where: { id: req.params.id, accountId: auth.accountId },
    include: { exercises: { orderBy: { order: "asc" } } }
  });

  if (!session) {
    return res.status(404).json({ error: "Workout session not found" });
  }

  return res.json({ session: serializeSession(session) });
});

workoutRoutes.post("/sessions", async (req: AuthenticatedRequest, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const auth = getRequiredAuth(req);
  const data = parsed.data;

  // Backend recomputes calories from exercises
  const weightKg = await getAccountWeightKg(auth.accountId);
  const computed = computeSessionCalories(data.exercises, weightKg ?? 70);

  const totalCalories = computed.total || data.totalCalories || null;
  const categoryCalories = Object.keys(computed.byCategory).length
    ? computed.byCategory
    : data.categoryCalories || {};

  const session = await prisma.workoutSession.create({
    data: {
      accountId: auth.accountId,
      activityType: data.activityType,
      title: data.title.trim(),
      status: data.exercises.length ? "COMPLETED" : "COMPLETED",
      startTime: data.startTime ? new Date(data.startTime) : null,
      endTime: data.endTime ? new Date(data.endTime) : new Date(),
      durationSeconds: data.durationSeconds ?? null,
      totalCalories,
      categoryCalories: categoryCalories as any,
      performedAt: new Date(),
      exercises: {
        create: data.exercises.map((ex, i) => ({
          accountId: auth.accountId,
          name: ex.name,
          kind: ex.kind,
          category: ex.category,
          sets: ex.sets as any,
          distance: ex.distance ?? null,
          distanceUnit: ex.distanceUnit ?? null,
          durationSeconds: ex.durationSeconds ?? null,
          caloriesBurned: ex.caloriesBurned ?? computed.byCategory[ex.category] ?? null,
          order: i
        }))
      }
    },
    include: { exercises: { orderBy: { order: "asc" } } }
  });

  return res.status(201).json({ session: serializeSession(session), computedCalories: computed });
});

workoutRoutes.patch("/sessions/:id", async (req: AuthenticatedRequest, res) => {
  const parsed = updateSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const auth = getRequiredAuth(req);
  const data = parsed.data;

  const existing = await prisma.workoutSession.findFirst({
    where: { id: req.params.id, accountId: auth.accountId },
    include: { exercises: { orderBy: { order: "asc" } } }
  });

  if (!existing) {
    return res.status(404).json({ error: "Workout session not found" });
  }

  // Recompute calories if exercises changed
  let recalculatedCalories = null;
  if (data.exercises !== undefined) {
    const weightKg = await getAccountWeightKg(auth.accountId);
    recalculatedCalories = computeSessionCalories(data.exercises, weightKg ?? 70);
  }

  const updateData: any = {};
  if (data.activityType) updateData.activityType = data.activityType;
  if (data.title) updateData.title = data.title.trim();
  if (data.status) updateData.status = data.status;
  if (data.startTime) updateData.startTime = new Date(data.startTime);
  if (data.endTime) updateData.endTime = new Date(data.endTime);
  if (data.durationSeconds !== undefined) updateData.durationSeconds = data.durationSeconds;
  if (data.performedAt) updateData.performedAt = new Date(data.performedAt);
  if (recalculatedCalories) {
    updateData.totalCalories = recalculatedCalories.total;
    updateData.categoryCalories = recalculatedCalories.byCategory as any;
  } else if (data.totalCalories !== undefined) {
    updateData.totalCalories = data.totalCalories;
  }
  if (data.categoryCalories) {
    updateData.categoryCalories = data.categoryCalories as any;
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (data.exercises !== undefined) {
      await tx.workoutExercise.deleteMany({
        where: { workoutSessionId: existing.id, accountId: auth.accountId }
      });

      if (data.exercises.length > 0) {
        await tx.workoutExercise.createMany({
          data: data.exercises.map((ex, i) => ({
            workoutSessionId: existing.id,
            accountId: auth.accountId,
            name: ex.name,
            kind: ex.kind,
            category: ex.category,
            sets: ex.sets as any,
            distance: ex.distance ?? null,
            distanceUnit: ex.distanceUnit ?? null,
            durationSeconds: ex.durationSeconds ?? null,
            caloriesBurned: ex.caloriesBurned ?? recalculatedCalories?.byCategory[ex.category] ?? null,
            order: i
          }))
        });
      }
    }

    return tx.workoutSession.update({
      where: { id: existing.id },
      data: updateData,
      include: { exercises: { orderBy: { order: "asc" } } }
    });
  });

  return res.json({ session: serializeSession(updated) });
});

workoutRoutes.delete("/sessions/:id", async (req: AuthenticatedRequest, res) => {
  const auth = getRequiredAuth(req);

  const existing = await prisma.workoutSession.findFirst({
    where: { id: req.params.id, accountId: auth.accountId }
  });

  if (!existing) {
    return res.status(404).json({ error: "Workout session not found" });
  }

  await prisma.workoutSession.delete({
    where: { id: existing.id }
  });

  return res.status(204).send();
});

async function getAccountWeightKg(accountId: string): Promise<number | null> {
  const metric = await prisma.healthMetric.findFirst({
    where: { accountId },
    orderBy: { recordedAt: "desc" },
    select: { weightKg: true }
  });
  return metric?.weightKg ?? null;
}
