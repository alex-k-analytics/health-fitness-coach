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
  member: {
    id: string;
    displayName: string;
    role: "OWNER" | "MEMBER";
    goalSummary: string | null;
    calorieGoal: number | null;
    proteinGoalGrams: number | null;
    carbGoalGrams: number | null;
    fatGoalGrams: number | null;
  } | null;
}) => {
  if (!account.member) {
    return {
      authenticated: false
    } as const;
  }

  return {
    authenticated: true,
    account: {
      id: account.id,
      email: account.email
    },
    member: {
      id: account.member.id,
      displayName: account.member.displayName,
      role: account.member.role,
      goalSummary: account.member.goalSummary,
      calorieGoal: account.member.calorieGoal,
      proteinGoalGrams: account.member.proteinGoalGrams,
      carbGoalGrams: account.member.carbGoalGrams,
      fatGoalGrams: account.member.fatGoalGrams
    }
  };
};

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
    where: { id: auth.accountId },
    include: {
      member: true
    }
  });

  if (!account || !account.member) {
    clearAuthCookie(res);
    return res.json({ authenticated: false });
  }

  setAuthCookie(res, {
    accountId: account.id,
    email: account.email,
    memberId: account.member.id,
    householdId: account.member.householdId,
    role: account.member.role
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
    const result = await prisma.$transaction(async (tx) => {
      if ((await tx.account.count()) > 0) {
        throw new Error("REGISTRATION_CLOSED");
      }

      const household = await tx.household.create({
        data: {
          name: "Personal Workspace"
        }
      });

      const account = await tx.account.create({
        data: {
          email,
          passwordHash
        }
      });

      const member = await tx.householdMember.create({
        data: {
          householdId: household.id,
          accountId: account.id,
          displayName: parsed.data.displayName.trim(),
          role: "OWNER",
          goalSummary: parsed.data.goalSummary?.trim() || null,
          calorieGoal: parsed.data.calorieGoal ?? null
        }
      });

      return {
        account,
        member
      };
    });

    setAuthCookie(res, {
      accountId: result.account.id,
      email: result.account.email,
      memberId: result.member.id,
      householdId: result.member.householdId,
      role: result.member.role
    });

    return res.status(201).json(
      serializeSession({
        id: result.account.id,
        email: result.account.email,
        member: result.member
      })
    );
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
    where: { email },
    include: {
      member: true
    }
  });

  if (!account || !account.member) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const passwordMatches = await bcrypt.compare(parsed.data.password, account.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  setAuthCookie(res, {
    accountId: account.id,
    email: account.email,
    memberId: account.member.id,
    householdId: account.member.householdId,
    role: account.member.role
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
