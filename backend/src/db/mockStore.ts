import type { UserProfile } from "../types.js";

const defaultProfile: UserProfile = {
  id: "user_1",
  name: "Demo User",
  timezone: "America/Los_Angeles",
  dailyCalorieGoal: 2200,
  devices: ["dumbbells", "bike"],
  phoneNumber: "+15555550123"
};

const workoutLogs: Array<{ title: string; durationMinutes: number; completedAtISO: string }> = [];
const conversationLog: Array<{ role: "user" | "assistant"; content: string; createdAtISO: string }> = [];

export const mockStore = {
  getProfile: () => defaultProfile,
  updateProfile: (patch: Partial<UserProfile>) => Object.assign(defaultProfile, patch),
  addWorkoutLog: (log: { title: string; durationMinutes: number; completedAtISO: string }) => workoutLogs.push(log),
  listWorkoutLogs: () => workoutLogs,
  addConversation: (item: { role: "user" | "assistant"; content: string; createdAtISO: string }) =>
    conversationLog.push(item),
  listConversations: () => conversationLog
};
