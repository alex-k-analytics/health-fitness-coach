import path from "node:path";

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseCsv = (value: string | undefined) =>
  value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: (process.env.NODE_ENV ?? "development") === "production",
  port: parseNumber(process.env.PORT, 4000),
  frontendOrigin:
    process.env.FRONTEND_ORIGIN ??
    process.env.APP_BASE_URL ??
    ((process.env.NODE_ENV ?? "development") === "production" ? "" : "http://localhost:5173"),
  nativeAppOrigins: parseCsv(process.env.NATIVE_APP_ORIGINS ?? "capacitor://localhost,ionic://localhost"),
  appBaseUrl:
    process.env.APP_BASE_URL ??
    process.env.FRONTEND_ORIGIN ??
    ((process.env.NODE_ENV ?? "development") === "production" ? "" : "http://localhost:5173"),
  authCookieName: process.env.AUTH_COOKIE_NAME ?? "health_fitness_session",
  jwtSecret: process.env.JWT_SECRET ?? "change-me-in-production",
  jwtExpiresInDays: parseNumber(process.env.JWT_EXPIRES_IN_DAYS, 7),
  storageDriver: process.env.STORAGE_DRIVER === "gcs" ? "gcs" : "local",
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads"),
  frontendDistDir: path.resolve(process.cwd(), process.env.FRONTEND_DIST_DIR ?? "../frontend/dist"),
  gcsBucketName: process.env.GCS_BUCKET_NAME ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1",
  maxUploadBytes: parseNumber(process.env.MAX_UPLOAD_BYTES, 8 * 1024 * 1024)
} as const;
