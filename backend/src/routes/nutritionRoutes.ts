import { Router } from "express";
import { z } from "zod";
import { AgentService } from "../services/agentService.js";

export const nutritionRoutes = Router();
const agent = new AgentService();

const photoSubmissionSchema = z.object({
  calorieBalance: z.number(),
  mealLabel: z.string().optional(),
  imageBlobKey: z.string().optional()
});

nutritionRoutes.post("/portion-from-photo", async (req, res) => {
  const parsed = photoSubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const result = await agent.estimateFoodPortionFromPhoto(parsed.data);
  return res.json(result);
});

nutritionRoutes.get("/balance-recommendation", async (_req, res) => {
  const result = await agent.generateDietBalanceRecommendation();
  return res.json(result);
});
