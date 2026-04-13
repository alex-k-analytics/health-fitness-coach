import { Router } from "express";
import { z } from "zod";
import { mockStore } from "../db/mockStore.js";

export const profileRoutes = Router();

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  dailyCalorieGoal: z.number().int().positive().optional(),
  devices: z.array(z.enum(["dumbbells","barbell","kettlebell","pullup_bar","treadmill","bike","rower","none"])).optional(),
  phoneNumber: z.string().optional()
});

profileRoutes.get("/", (_req, res) => {
  res.json(mockStore.getProfile());
});

profileRoutes.patch("/", (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const updated = mockStore.updateProfile(parsed.data);
  return res.json(updated);
});
