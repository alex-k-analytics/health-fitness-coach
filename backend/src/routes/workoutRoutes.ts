import { Router } from "express";
import { z } from "zod";
import { mockStore } from "../db/mockStore.js";
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
