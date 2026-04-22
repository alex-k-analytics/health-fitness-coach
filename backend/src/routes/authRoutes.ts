import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { Router } from "express";
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
    household: {
      id: string;
      name: string;
    };
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
    },
    household: account.member.household
  };
};

const ownerRegistrationSchema = z.object({
  householdName: z.string().min(1).max(120),
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

const inviteAcceptanceSchema = z.object({
  token: z.string().min(20),
  email: z.string().email(),
  displayName: z.string().min(1).max(120),
  password: z.string().min(8).max(128),
  goalSummary: z.string().max(500).optional(),
  calorieGoal: z.number().int().positive().max(10000).optional()
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
      member: {
        include: {
          household: true
        }
      }
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

authRoutes.post("/register-owner", async (req, res) => {
  const parsed = ownerRegistrationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const email = normalizeEmail(parsed.data.email);
  const existing = await prisma.account.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account already exists for that email address" });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const result = await prisma.$transaction(async (tx) => {
    const household = await tx.household.create({
      data: {
        name: parsed.data.householdName.trim()
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
      },
      include: {
        household: true
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
});

authRoutes.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const email = normalizeEmail(parsed.data.email);
  const account = await prisma.account.findUnique({
    where: { email },
    include: {
      member: {
        include: {
          household: true
        }
      }
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

authRoutes.post("/accept-invite", async (req, res) => {
  const parsed = inviteAcceptanceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const email = normalizeEmail(parsed.data.email);
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const invite = await prisma.householdInvite.findUnique({
    where: { tokenHash }
  });

  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
    return res.status(404).json({ error: "Invitation is invalid or expired" });
  }

  if (normalizeEmail(invite.email) !== email) {
    return res.status(400).json({ error: "Invitation email does not match the provided email" });
  }

  const existing = await prisma.account.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account already exists for that email address" });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        email,
        passwordHash
      }
    });

    const member = await tx.householdMember.create({
      data: {
        householdId: invite.householdId,
        accountId: account.id,
        displayName: parsed.data.displayName.trim(),
        role: invite.role,
        goalSummary: parsed.data.goalSummary?.trim() || null,
        calorieGoal: parsed.data.calorieGoal ?? null
      },
      include: {
        household: true
      }
    });

    await tx.householdInvite.update({
      where: { id: invite.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        acceptedByAccountId: account.id
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
});

authRoutes.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  return res.status(204).send();
});

authRoutes.post("/dev/invite-token", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send();
  }

  const email = z.string().email().safeParse(req.body?.email);
  if (!email.success) {
    return res.status(400).json({ error: "Valid email required" });
  }

  const token = randomBytes(24).toString("hex");
  return res.json({ token, email: email.data });
});
