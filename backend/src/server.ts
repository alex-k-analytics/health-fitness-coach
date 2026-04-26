import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { requireAuth } from "./middleware/auth.js";
import { authRoutes } from "./routes/authRoutes.js";
import { profileRoutes } from "./routes/profileRoutes.js";
import { nutritionRoutes } from "./routes/nutritionRoutes.js";
import { workoutRoutes } from "./routes/workoutRoutes.js";

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      const allowedOrigins = [
        config.frontendOrigin,
        config.appBaseUrl,
        ...config.nativeAppOrigins
      ].filter(Boolean);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "health-fitness-coach-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", requireAuth, profileRoutes);
app.use("/api/nutrition", requireAuth, nutritionRoutes);
app.use("/api/workouts", requireAuth, workoutRoutes);

if (fs.existsSync(config.frontendDistDir)) {
  app.use(express.static(config.frontendDistDir));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    return res.sendFile(path.join(config.frontendDistDir, "index.html"));
  });
}

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
