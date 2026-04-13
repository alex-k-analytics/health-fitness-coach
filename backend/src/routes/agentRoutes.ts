import { Router } from "express";
import { z } from "zod";
import { mockStore } from "../db/mockStore.js";

export const agentRoutes = Router();

const messageSchema = z.object({
  content: z.string().min(1)
});

agentRoutes.get("/history", (_req, res) => {
  res.json({ items: mockStore.listConversations() });
});

agentRoutes.post("/message", (req, res) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const now = new Date().toISOString();
  mockStore.addConversation({ role: "user", content: parsed.data.content, createdAtISO: now });
  const responseText =
    "I recommend a 30-minute moderate workout today and a protein-focused dinner to stay aligned with your calorie goal.";
  mockStore.addConversation({ role: "assistant", content: responseText, createdAtISO: now });

  return res.json({ response: responseText });
});
