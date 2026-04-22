import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { getRequiredAuth, requireOwner, type AuthenticatedRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";

export const householdRoutes = Router();

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const invitationSchema = z.object({
  email: z.string().email(),
  suggestedName: z.string().max(120).optional(),
  role: z.enum(["OWNER", "MEMBER"]).default("MEMBER")
});

householdRoutes.get("/", async (req: AuthenticatedRequest, res) => {
  const auth = getRequiredAuth(req);

  const household = await prisma.household.findUnique({
    where: { id: auth.householdId },
    include: {
      members: {
        include: {
          account: true
        },
        orderBy: {
          createdAt: "asc"
        }
      },
      invites: {
        where: { status: "PENDING" },
        include: {
          invitedBy: true
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  if (!household) {
    return res.status(404).json({ error: "Household not found" });
  }

  return res.json({
    household: {
      id: household.id,
      name: household.name
    },
    members: household.members.map((member) => ({
      id: member.id,
      displayName: member.displayName,
      role: member.role,
      email: member.account.email,
      createdAt: member.createdAt
    })),
    invites: household.invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      suggestedName: invite.suggestedName,
      role: invite.role,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      invitedByName: invite.invitedBy.displayName
    }))
  });
});

householdRoutes.post("/invitations", requireOwner, async (req: AuthenticatedRequest, res) => {
  const parsed = invitationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const auth = getRequiredAuth(req);
  const email = normalizeEmail(parsed.data.email);

  const existingAccount = await prisma.account.findUnique({ where: { email } });
  if (existingAccount) {
    return res.status(409).json({ error: "That email address already belongs to an account" });
  }

  const existingInvite = await prisma.householdInvite.findFirst({
    where: {
      householdId: auth.householdId,
      email,
      status: "PENDING",
      expiresAt: {
        gt: new Date()
      }
    }
  });

  if (existingInvite) {
    return res.status(409).json({ error: "A pending invitation already exists for that email address" });
  }

  const rawToken = randomBytes(24).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const invite = await prisma.householdInvite.create({
    data: {
      householdId: auth.householdId,
      invitedByMemberId: auth.memberId,
      email,
      suggestedName: parsed.data.suggestedName?.trim() || null,
      role: parsed.data.role,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  const baseUrl = config.appBaseUrl.replace(/\/$/, "");
  return res.status(201).json({
    invite: {
      id: invite.id,
      email: invite.email,
      suggestedName: invite.suggestedName,
      role: invite.role,
      expiresAt: invite.expiresAt
    },
    inviteToken: rawToken,
    inviteUrl: `${baseUrl}/?invite=${rawToken}`
  });
});

householdRoutes.post("/invitations/:inviteId/revoke", requireOwner, async (req: AuthenticatedRequest, res) => {
  const auth = getRequiredAuth(req);
  const invite = await prisma.householdInvite.findFirst({
    where: {
      id: req.params.inviteId,
      householdId: auth.householdId
    }
  });

  if (!invite) {
    return res.status(404).json({ error: "Invitation not found" });
  }

  if (invite.status !== "PENDING") {
    return res.status(400).json({ error: "Only pending invitations can be revoked" });
  }

  await prisma.householdInvite.update({
    where: { id: invite.id },
    data: { status: "REVOKED" }
  });

  return res.json({ ok: true });
});
