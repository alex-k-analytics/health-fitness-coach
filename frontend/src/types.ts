export interface SessionData {
  authenticated: boolean;
  account?: {
    id: string;
    email: string;
  };
  member?: {
    id: string;
    displayName: string;
    role: "OWNER" | "MEMBER";
    goalSummary: string | null;
    calorieGoal: number | null;
    proteinGoalGrams: number | null;
    carbGoalGrams: number | null;
    fatGoalGrams: number | null;
  };
  household?: {
    id: string;
    name: string;
  };
}

export interface HouseholdData {
  household: {
    id: string;
    name: string;
  };
  members: Array<{
    id: string;
    displayName: string;
    role: "OWNER" | "MEMBER";
    email: string;
    createdAt: string;
  }>;
  invites: Array<{
    id: string;
    email: string;
    suggestedName: string | null;
    role: "OWNER" | "MEMBER";
    expiresAt: string;
    createdAt: string;
    invitedByName: string;
  }>;
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
    role: "OWNER" | "MEMBER";
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

export interface NutritionSummary {
  today: {
    mealCount: number;
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  };
  goals: {
    calorieGoal: number | null;
    proteinGoalGrams: number | null;
    carbGoalGrams: number | null;
    fatGoalGrams: number | null;
  } | null;
  latestMetric: HealthMetric | null;
  dailyCalories: Array<{
    date: string;
    calories: number;
    mealCount: number;
  }>;
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
