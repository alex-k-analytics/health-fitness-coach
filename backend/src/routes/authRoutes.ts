import bcrypt from "bcryptjs";
import { type Request, type Response, Router } from "express";
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

const registrationSchema = z.object({
  displayName: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  goalSummary: z.string().max(500).optional(),
  calorieGoal: z.number().int().positive().max(10000).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

const getRegistrationOpen = async () => (await prisma.account.count()) === 0;

authRoutes.get("/bootstrap-status", async (_req, res) => {
  return res.json({
    registrationOpen: await getRegistrationOpen()
  });
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

const registerHandler = async (req: Request, res: Response) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  if (!(await getRegistrationOpen())) {
    return res.status(403).json({ error: "Account setup is closed. Sign in with your existing credentials." });
  }

  const email = normalizeEmail(parsed.data.email);
  const existing = await prisma.account.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account already exists for that email address" });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  try {
    const account = await prisma.$transaction(async (tx) => {
      if ((await tx.account.count()) > 0) {
        throw new Error("REGISTRATION_CLOSED");
      }

      return tx.account.create({
        data: {
          email,
          passwordHash,
          displayName: parsed.data.displayName.trim(),
          goalSummary: parsed.data.goalSummary?.trim() || null,
          calorieGoal: parsed.data.calorieGoal ?? null
        }
      });
    });

    setAuthCookie(res, {
      accountId: account.id,
      email: account.email
    });

    return res.status(201).json(serializeSession(account));
  } catch (error) {
    if (error instanceof Error && error.message === "REGISTRATION_CLOSED") {
      return res
        .status(403)
        .json({ error: "Account setup is closed. Sign in with your existing credentials." });
    }

    throw error;
  }
};

authRoutes.post("/register", registerHandler);
authRoutes.post("/register-owner", registerHandler);

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

authRoutes.post("/accept-invite", (_req, res) => {
  return res.status(410).json({ error: "Invites are disabled for this deployment." });
});

authRoutes.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  return res.status(204).send();
});
