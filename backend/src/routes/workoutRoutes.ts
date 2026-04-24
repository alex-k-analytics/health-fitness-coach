import { Router } from "express";
import { z } from "zod";
import { mockStore } from "../db/mockStore.js";
import { prisma } from "../lib/prisma.js";
import { getRequiredAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { AgentService } from "../services/agentService.js";
import { GoogleCalendarService } from "../services/googleCalendarService.js";

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
  performedAt: workout.performedAt,
  createdAt: workout.createdAt,
  updatedAt: workout.updatedAt
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

workoutRoutes.get("/", async (req: AuthenticatedRequest, res) => {
  const parsed = listWorkoutsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const auth = getRequiredAuth(req);
  const workouts = await prisma.workoutEntry.findMany({
    where: {
      accountId: auth.accountId
    },
    orderBy: {
      performedAt: "desc"
    },
    take: parsed.data.limit
  });

  return res.json({ workouts: workouts.map(serializeWorkout) });
});

workoutRoutes.post("/", async (req: AuthenticatedRequest, res) => {
  const parsed = createWorkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const auth = getRequiredAuth(req);
  const workout = await prisma.workoutEntry.create({
    data: {
      accountId: auth.accountId,
      title: parsed.data.title.trim(),
      caloriesBurned: parsed.data.caloriesBurned,
      performedAt: parsed.data.performedAt ? new Date(parsed.data.performedAt) : new Date()
    }
  });

  return res.status(201).json({ workout: serializeWorkout(workout) });
});
