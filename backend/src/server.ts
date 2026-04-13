import "dotenv/config";
import cors from "cors";
import express from "express";
import { profileRoutes } from "./routes/profileRoutes.js";
import { workoutRoutes } from "./routes/workoutRoutes.js";
import { nutritionRoutes } from "./routes/nutritionRoutes.js";
import { agentRoutes } from "./routes/agentRoutes.js";
import { integrationRoutes } from "./routes/integrationRoutes.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "health-fitness-coach-api" });
});

app.use("/api/profile", profileRoutes);
app.use("/api/workouts", workoutRoutes);
app.use("/api/nutrition", nutritionRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/integrations", integrationRoutes);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
