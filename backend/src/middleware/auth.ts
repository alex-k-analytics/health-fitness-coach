import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export interface AuthTokenPayload {
  accountId: string;
  email: string;
}

export type AuthenticatedRequest = Request & {
  auth?: AuthTokenPayload;
};

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.isProduction,
  path: "/",
  maxAge: config.jwtExpiresInDays * 24 * 60 * 60 * 1000
};

export function signAuthToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: `${config.jwtExpiresInDays}d` });
}

export function setAuthCookie(res: Response, payload: AuthTokenPayload) {
  res.cookie(config.authCookieName, signAuthToken(payload), cookieOptions);
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(config.authCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/"
  });
}

export function readAuthPayload(req: Request): AuthTokenPayload | null {
  const bearerToken = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice("Bearer ".length)
    : null;
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[config.authCookieName];
  const token = bearerToken ?? cookieToken;

  if (!token) {
    return null;
  }

  try {
    return jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const payload = readAuthPayload(req);
  if (!payload) {
    return res.status(401).json({ error: "Authentication required" });
  }

  req.auth = payload;
  return next();
}

export function getRequiredAuth(req: AuthenticatedRequest) {
  if (!req.auth) {
    throw new Error("Authenticated request expected");
  }

  return req.auth;
}
