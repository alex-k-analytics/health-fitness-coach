import { Router } from "express";
import { z } from "zod";
import { mockStore } from "../db/mockStore.js";
import { SmsService } from "../services/smsService.js";

export const integrationRoutes = Router();
const smsService = new SmsService();

integrationRoutes.get("/google/auth-url", (_req, res) => {
  res.json({
    url: "https://accounts.google.com/o/oauth2/v2/auth?...",
    status: "stubbed"
  });
});

const reminderSchema = z.object({
  message: z.string().min(1)
});

integrationRoutes.post("/sms/reminder", async (req, res) => {
  const parsed = reminderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const profile = mockStore.getProfile();
  if (!profile.phoneNumber) {
    return res.status(400).json({ error: "Phone number is not configured" });
  }

  const result = await smsService.sendReminder(profile.phoneNumber, parsed.data.message);
  return res.json(result);
});
