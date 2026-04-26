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

export type WorkoutActivityType =
  | "RUNNING"
  | "WALKING"
  | "CYCLING"
  | "SWIMMING"
  | "ROWING"
  | "WEIGHTLIFTING"
  | "CALISTHENICS"
  | "HIIT"
  | "OTHER";

export type WorkoutSessionStatus = "PLANNING" | "RUNNING" | "COMPLETED";

export type WorkoutExerciseKind = "LIFT" | "CARDIO";

export interface WorkoutSet {
  reps: number;
  weightLbs: number;
}

export interface WorkoutExerciseData {
  name: string;
  kind: WorkoutExerciseKind;
  category: WorkoutActivityType;
  sets?: WorkoutSet[];
  distance?: number;
  distanceUnit?: string;
  durationSeconds?: number;
  caloriesBurned?: number;
}

export interface WorkoutSessionCreateData {
  activityType: WorkoutActivityType;
  title: string;
  startTime?: string;
  endTime?: string;
  durationSeconds?: number;
  totalCalories?: number;
  categoryCalories?: Record<string, number>;
  exercises: WorkoutExerciseData[];
}

export interface WorkoutSessionData {
  id: string;
  activityType: WorkoutActivityType;
  title: string;
  status: WorkoutSessionStatus;
  startTime?: string;
  endTime?: string;
  durationSeconds?: number;
  totalCalories?: number;
  categoryCalories?: Record<string, number>;
  performedAt: string;
  exercises: Array<{
    id: string;
    name: string;
    kind: WorkoutExerciseKind;
    category: WorkoutActivityType;
    sets?: WorkoutSet[];
    distance?: number;
    distanceUnit?: string;
    durationSeconds?: number;
    caloriesBurned?: number;
  }>;
}
