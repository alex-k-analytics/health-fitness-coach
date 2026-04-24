import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { clearAuthCookie, readAuthPayload, setAuthCookie } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

export const authRoutes = Router();

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const serializeSession = (account: {
  id: string;
  email: string;
  displayName: string;
  goalSummary: string | null;
  calorieGoal: number | null;
  proteinGoalGrams: number | null;
  carbGoalGrams: number | null;
  fatGoalGrams: number | null;
}) => ({
  authenticated: true,
  account: {
    id: account.id,
    email: account.email
  },
  member: {
    id: account.id,
    displayName: account.displayName,
    goalSummary: account.goalSummary,
    calorieGoal: account.calorieGoal,
    proteinGoalGrams: account.proteinGoalGrams,
    carbGoalGrams: account.carbGoalGrams,
    fatGoalGrams: account.fatGoalGrams
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

authRoutes.get("/session", async (req, res) => {
  const auth = readAuthPayload(req);
  if (!auth) {
    clearAuthCookie(res);
    return res.json({ authenticated: false });
  }

  const account = await prisma.account.findUnique({
    where: { id: auth.accountId }
  });

  if (!account) {
    clearAuthCookie(res);
    return res.json({ authenticated: false });
  }

  setAuthCookie(res, {
    accountId: account.id,
    email: account.email
  });

  return res.json(serializeSession(account));
});

authRoutes.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const email = normalizeEmail(parsed.data.email);
  const account = await prisma.account.findUnique({
    where: { email }
  });

  if (!account) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const passwordMatches = await bcrypt.compare(parsed.data.password, account.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  setAuthCookie(res, {
    accountId: account.id,
    email: account.email
  });

  return res.json(serializeSession(account));
});

authRoutes.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  return res.status(204).send();
});
