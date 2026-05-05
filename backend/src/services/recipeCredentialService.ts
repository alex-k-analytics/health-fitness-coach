import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";
import {
  RECIPE_SOURCE_DEFINITIONS,
  type RecipeSourceCredentialPayload,
  type RecipeSourceId,
  type RecipeSourceLogin
} from "./mealPlanningTypes.js";

const SOURCE_BY_ID = Object.fromEntries(
  RECIPE_SOURCE_DEFINITIONS.map((source) => [source.id, source])
) as Record<RecipeSourceId, (typeof RECIPE_SOURCE_DEFINITIONS)[number]>;

function defaultLoginUrl(sourceId: RecipeSourceId) {
  if (sourceId === "atk") {
    return config.atkDefaultLoginUrl;
  }
  return SOURCE_BY_ID[sourceId].loginUrl;
}

function assertSource(source: string): RecipeSourceId {
  const key = source.trim().toLowerCase() as RecipeSourceId;
  if (!(key in SOURCE_BY_ID)) {
    throw new Error(`Recipe source must be one of: ${RECIPE_SOURCE_DEFINITIONS.map((item) => item.id).join(", ")}`);
  }
  return key;
}

function keyMaterial() {
  if (!config.recipeSourceCredentialKey.trim()) {
    throw new Error("RECIPE_SOURCE_CREDENTIAL_KEY must be set before saving recipe source passwords.");
  }
  return crypto.createHash("sha256").update(config.recipeSourceCredentialKey.trim(), "utf8").digest();
}

function encryptSecret(secret: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${encrypted.toString("base64")}.${tag.toString("base64")}`;
}

function decryptSecret(payload: string) {
  const [ivPart, bodyPart, tagPart] = payload.split(".");
  if (!ivPart || !bodyPart || !tagPart) {
    throw new Error("Stored recipe source credential could not be decrypted.");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    keyMaterial(),
    Buffer.from(ivPart, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(bodyPart, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

function hashSecret(secret: string) {
  return crypto.createHmac("sha256", keyMaterial()).update(secret, "utf8").digest("hex");
}

function serializeSource(
  sourceId: RecipeSourceId,
  credential: {
    username: string;
    loginUrl: string;
    enabled: boolean;
    passwordCiphertext: string;
    updatedAt: Date;
  } | null
): RecipeSourceCredentialPayload {
  const source = SOURCE_BY_ID[sourceId];
  return {
    source: source.id,
    label: source.label,
    defaultLoginUrl: defaultLoginUrl(sourceId),
    supportedForPlanning: source.supportedForPlanning,
    configured: credential !== null,
    enabled: credential?.enabled ?? false,
    username: credential?.username ?? "",
    loginUrl: credential?.loginUrl ?? defaultLoginUrl(sourceId),
    hasPassword: Boolean(credential?.passwordCiphertext),
    updatedAt: credential?.updatedAt.toISOString() ?? null
  };
}

export class RecipeCredentialService {
  async listSources(accountId: string): Promise<RecipeSourceCredentialPayload[]> {
    const credentials = await prisma.recipeSourceCredential.findMany({
      where: { accountId }
    });
    const bySource = new Map(credentials.map((item) => [item.source as RecipeSourceId, item]));
    return RECIPE_SOURCE_DEFINITIONS.map((source) => serializeSource(source.id, bySource.get(source.id) ?? null));
  }

  async saveSource(input: {
    accountId: string;
    source: string;
    username: string;
    password?: string | null;
    loginUrl?: string | null;
    enabled: boolean;
    clearPassword?: boolean;
  }): Promise<RecipeSourceCredentialPayload> {
    const sourceId = assertSource(input.source);
    const username = input.username.trim();
    const loginUrl = input.loginUrl?.trim() || defaultLoginUrl(sourceId);
    const clearPassword = Boolean(input.clearPassword);

    const existing = await prisma.recipeSourceCredential.findUnique({
      where: {
        accountId_source: {
          accountId: input.accountId,
          source: sourceId
        }
      }
    });

    const data: {
      username: string;
      loginUrl: string;
      enabled: boolean;
      passwordCiphertext?: string;
      passwordHash?: string;
    } = {
      username,
      loginUrl,
      enabled: input.enabled
    };

    if (input.password && input.password.trim()) {
      data.passwordCiphertext = encryptSecret(input.password.trim());
      data.passwordHash = hashSecret(input.password.trim());
    } else if (clearPassword) {
      data.passwordCiphertext = "";
      data.passwordHash = "";
    } else if (!existing) {
      data.passwordCiphertext = "";
      data.passwordHash = "";
    }

    const saved = await prisma.recipeSourceCredential.upsert({
      where: {
        accountId_source: {
          accountId: input.accountId,
          source: sourceId
        }
      },
      update: data,
      create: {
        accountId: input.accountId,
        source: sourceId,
        username,
        loginUrl,
        enabled: input.enabled,
        passwordCiphertext: data.passwordCiphertext ?? "",
        passwordHash: data.passwordHash ?? ""
      }
    });

    return serializeSource(sourceId, saved);
  }

  async deleteSource(accountId: string, source: string) {
    const sourceId = assertSource(source);
    await prisma.recipeSourceCredential.deleteMany({
      where: {
        accountId,
        source: sourceId
      }
    });
    return true;
  }

  async resolvePlanningSourceLogin(accountId: string, source: RecipeSourceId): Promise<RecipeSourceLogin> {
    const credential = await prisma.recipeSourceCredential.findUnique({
      where: {
        accountId_source: {
          accountId,
          source
        }
      }
    });

    if (!credential) {
      return {
        source,
        username: "",
        password: "",
        loginUrl: defaultLoginUrl(source),
        enabled: false
      };
    }

    return {
      source,
      username: credential.username,
      password: credential.passwordCiphertext ? decryptSecret(credential.passwordCiphertext) : "",
      loginUrl: credential.loginUrl || defaultLoginUrl(source),
      enabled: credential.enabled
    };
  }

  isPlanningSource(source: string) {
    return source.trim().toLowerCase() === "atk";
  }

  assertPlanningSources(sourceIds: string[]) {
    const normalized = sourceIds.map((source) => assertSource(source));
    const unsupported = normalized.filter((source) => !SOURCE_BY_ID[source].supportedForPlanning);
    if (unsupported.length > 0) {
      const labels = unsupported.map((source) => SOURCE_BY_ID[source].label).join(", ");
      throw new Error(`Planning is not available for ${labels} yet.`);
    }
    return normalized;
  }
}

export const recipeCredentialService = new RecipeCredentialService();
