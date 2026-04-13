import type { WorkoutPlanItem } from "../types.js";

export class GoogleCalendarService {
  async scheduleWorkoutItems(userId: string, items: WorkoutPlanItem[]) {
    return {
      userId,
      scheduledCount: items.length,
      status: "stubbed",
      note: "Connect OAuth tokens and Google Calendar API client in phase 2."
    };
  }
}
