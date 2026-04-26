export interface SessionData {
  authenticated: boolean;
  token?: string;
  account?: {
    id: string;
    email: string;
  };
  member?: {
    id: string;
    displayName: string;
    goalSummary: string | null;
    calorieGoal: number | null;
    proteinGoalGrams: number | null;
    carbGoalGrams: number | null;
    fatGoalGrams: number | null;
  };
}

export interface HealthMetric {
  id: string;
  recordedAt: string;
  weightKg: number | null;
  systolicBloodPressure: number | null;
  diastolicBloodPressure: number | null;
  restingHeartRate: number | null;
  bodyFatPercent: number | null;
  waistCm: number | null;
  note: string | null;
  createdAt: string;
}

export interface ProfileData {
  profile: {
    id: string;
    displayName: string;
    goalSummary: string | null;
    calorieGoal: number | null;
    proteinGoalGrams: number | null;
    carbGoalGrams: number | null;
    fatGoalGrams: number | null;
    heightCm: number | null;
    activityLevel: string | null;
    notes: string | null;
  };
  latestMetric: HealthMetric | null;
}

export interface NutritionEstimate {
  status: "PENDING" | "COMPLETED" | "FALLBACK" | "FAILED";
  model: string;
  summary: string;
  confidenceScore: number;
  estimatedCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
  sugarGrams: number;
  sodiumMg: number;
  micronutrients: Array<{ name: string; amount: number; unit: string }>;
  vitamins: Array<{ name: string; amount: number; unit: string }>;
  assumptions: string[];
  foodBreakdown: Array<{
    label: string;
    quantityDescription: string;
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  }>;
  rawAnalysis: unknown;
}

export interface NutritionSummary {
  today: {
    mealCount: number;
    calories: number;
    caloriesBurned: number;
    netCalories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  };
  goals: {
    calorieGoal: number | null;
    baseCalorieGoal: number | null;
    adjustedCalorieGoal: number | null;
    proteinGoalGrams: number | null;
    carbGoalGrams: number | null;
    fatGoalGrams: number | null;
  } | null;
  latestMetric: HealthMetric | null;
  dailyCalories: Array<{
    date: string;
    calories: number;
    mealCount: number;
    caloriesBurned: number;
    netCalories: number;
  }>;
}

export interface Workout {
  id: string;
  title: string;
  caloriesBurned: number;
  performedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkoutActivityType =
  | "RUNNING"
  | "WALKING"
  | "CYCLING"
  | "SWIMMING"
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

export interface WorkoutExercise {
  id?: string;
  name: string;
  kind: WorkoutExerciseKind;
  category: WorkoutActivityType;
  sets?: WorkoutSet[];
  distance?: number;
  distanceUnit?: string;
  durationSeconds?: number;
  caloriesBurned?: number;
  order?: number;
}

export interface WorkoutSession {
  id: string;
  title: string;
  activityType: WorkoutActivityType;
  status: WorkoutSessionStatus;
  startTime?: string;
  endTime?: string;
  durationSeconds?: number;
  totalCalories?: number;
  categoryCalories?: Record<string, number>;
  performedAt: string;
  createdAt: string;
  updatedAt: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutSessionDraft {
  activityType: WorkoutActivityType;
  title: string;
  exercises: WorkoutExercise[];
  elapsedSeconds: number;
  status: WorkoutSessionStatus;
  manualMinutes?: string;
  manualSeconds?: string;
  hasUsedTimer: boolean;
  step: "plan" | "active" | "review";
}

export interface SavedFood {
  id: string;
  name: string;
  brand: string | null;
  servingDescription: string | null;
  servingWeightGrams: number | null;
  calories: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  sugarGrams: number | null;
  sodiumMg: number | null;
  micronutrients: unknown;
  notes: string | null;
  createdAt: string;
}

export interface Meal {
  id: string;
  title: string;
  notes: string | null;
  eatenAt: string;
  servingDescription: string | null;
  quantity: number | null;
  weightGrams: number | null;
  analysisStatus: "PENDING" | "COMPLETED" | "FALLBACK" | "FAILED";
  analysisSummary: string | null;
  confidenceScore: number | null;
  estimatedCalories: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  sugarGrams: number | null;
  sodiumMg: number | null;
  micronutrients: Array<{ name: string; amount: number; unit: string }> | null;
  vitamins: Array<{ name: string; amount: number; unit: string }> | null;
  assumptions: string[] | null;
  foodBreakdown:
    | Array<{
        label: string;
        quantityDescription: string;
        calories: number;
        proteinGrams: number;
        carbsGrams: number;
        fatGrams: number;
      }>
    | null;
  aiModel: string | null;
  savedFood:
    | {
        id: string;
        name: string;
        brand: string | null;
      }
    | null;
  images: Array<{
    id: string;
    kind: "PLATE" | "LABEL" | "OTHER";
    originalFileName: string;
    contentType: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
