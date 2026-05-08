export type RecipeSourceId = "atk" | "allrecipes" | "nytimes";

export interface RecipeSourceDefinition {
  id: RecipeSourceId;
  label: string;
  loginUrl: string;
  supportedForPlanning: boolean;
}

export interface PlanningRecipeCandidate {
  title: string;
  url: string;
  ingredients: string[];
  totalTimeMinutes?: number | null;
  ratingValue?: number | null;
  ratingCount?: number | null;
  categories: string[];
}

export interface RecipeReview {
  title: string;
  url: string;
  fitsCriteria: boolean;
  criteriaScore: number;
  reasons: string[];
  estimatedTotalTimeMinutes?: number | null;
  ratingValue?: number | null;
  categories: string[];
}

export interface SelectedMeal {
  title: string;
  url: string;
  score: number;
  matchingIngredients: string[];
  missingIngredients: string[];
  reasoning: string;
  criteriaFit: boolean;
  criteriaNotes: string[];
  estimatedTotalTimeMinutes?: number | null;
  ratingValue?: number | null;
  categories: string[];
}

export interface GroceryListItem {
  item: string;
  category: string;
  recipes: string[];
  note: string;
}

export interface WeeklyMealPlan {
  pantryIngredients: string[];
  recipeSources: RecipeSourceId[];
  agentInstructions: string;
  reviewedRecipes: RecipeReview[];
  selectedMeals: SelectedMeal[];
  groceryList: GroceryListItem[];
  notes: string[];
}

export interface MealPlanPreferences {
  dietaryRestrictions: string;
  plannerContext: string;
  defaultMaxRecipes: number | null;
  defaultMaxMeals: number | null;
  defaultUseOpenAi: boolean | null;
  updatedAt: string | null;
}

export interface RecipeSourceCredentialPayload {
  source: RecipeSourceId;
  label: string;
  defaultLoginUrl: string;
  supportedForPlanning: boolean;
  configured: boolean;
  enabled: boolean;
  username: string;
  loginUrl: string;
  hasPassword: boolean;
  updatedAt: string | null;
}

export interface RecipeSourceLogin {
  source: RecipeSourceId;
  username: string;
  password: string;
  loginUrl: string;
  enabled: boolean;
}

export interface ScraperAcquireRequest {
  source: RecipeSourceId;
  login: RecipeSourceLogin;
  pantryIngredients: string[];
  maxRecipes: number;
  options?: {
    headless?: boolean;
  };
}

export interface ScraperAcquireResponse {
  recipes: PlanningRecipeCandidate[];
  scrapedCount: number;
  warnings: string[];
}

export interface MealPlanRunDetail {
  id: string;
  sourceRunId: string | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  progressStage: string | null;
  progressDetail: string | null;
  progressPercent: number;
  request: {
    ingredients: string;
    instructions: string;
    recipeSources: RecipeSourceId[];
    maxRecipes: number;
    maxMeals: number;
    useOpenAi: boolean;
  };
  plan: WeeklyMealPlan | null;
  scrapedRecipes: PlanningRecipeCandidate[];
  scrapedCount: number;
  durationSeconds: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MealPlanRunSummary {
  id: string;
  sourceRunId: string | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  progressStage: string | null;
  progressDetail: string | null;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  ingredientsPreview: string[];
  selectedMeals: string[];
  recipeSources: RecipeSourceId[];
  scrapedCount: number;
  durationSeconds: number | null;
  errorMessage: string | null;
}

export const RECIPE_SOURCE_DEFINITIONS: RecipeSourceDefinition[] = [
  {
    id: "allrecipes",
    label: "Allrecipes",
    loginUrl: "https://www.allrecipes.com/account/sign-in",
    supportedForPlanning: false
  },
  {
    id: "atk",
    label: "America's Test Kitchen",
    loginUrl: "https://www.americastestkitchen.com/sign_in",
    supportedForPlanning: true
  },
  {
    id: "nytimes",
    label: "NYT Cooking",
    loginUrl: "https://cooking.nytimes.com/login",
    supportedForPlanning: false
  }
];
