export type WorkoutDevice =
  | "dumbbells"
  | "barbell"
  | "kettlebell"
  | "pullup_bar"
  | "treadmill"
  | "bike"
  | "rower"
  | "none";

export interface UserProfile {
  id: string;
  name: string;
  timezone: string;
  dailyCalorieGoal: number;
  devices: WorkoutDevice[];
  phoneNumber?: string;
}

export interface WorkoutPlanItem {
  title: string;
  durationMinutes: number;
  intensity: "low" | "moderate" | "high";
  equipment: WorkoutDevice[];
  scheduledForISO?: string;
}
