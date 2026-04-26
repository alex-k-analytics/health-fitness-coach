import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition
} from "react";
import { ApiError, apiFetch, setAuthToken } from "./api";
import { Card } from "./components/Card";
import { computeSessionCalories, fuzzyMatch } from "./calorieEngine";
import type {
  HealthMetric,
  Meal,
  NutritionEstimate,
  NutritionSummary,
  ProfileData,
  SavedFood,
  SessionData,
  Workout,
  WorkoutActivityType,
  WorkoutExercise,
  WorkoutExerciseKind,
  WorkoutSet,
  WorkoutSession,
  WorkoutSessionDraft
} from "./types";

type MealTemplateResult =
  {
    key: string;
    title: string;
    subtitle: string;
    detail: string;
    searchText: string;
    food: SavedFood;
  };

const LOGIN_PATH = "/login";
const DASHBOARD_PATH = "/";

const defaultWeightForm = () => ({
  recordedAt: "",
  weightLbs: ""
});

const defaultMealForm = () => ({
  title: "",
  notes: "",
  eatenAt: "",
  servingDescription: "",
  quantity: "1",
  savedFoodId: "",
  saveAsReusableFood: false
});

const defaultWorkoutForm = () => ({
  title: "",
  caloriesBurned: "",
  performedAt: ""
});

const valueToInput = (value: number | string | null | undefined) => (value ?? "").toString();

const toOptionalNumber = (value: string) => {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toNullableNumber = (value: string) => {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));

const formatDateKeyShortDay = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
    new Date(year, month - 1, day)
  );
};

const formatShortDay = (value: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(value));

const toDateTimeLocalInput = (value: string) => {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const getApiErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
};

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";

const getProgressPercent = (current: number, goal?: number | null) => {
  if (!goal || goal <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((current / goal) * 100)));
};

const KG_PER_LB = 0.45359237;

const kgToLbs = (value: number) => value / KG_PER_LB;

const lbsToKg = (value: number) => value * KG_PER_LB;

const formatWeightValue = (value: number | null | undefined) =>
  value === null || value === undefined ? null : kgToLbs(value).toFixed(1);

const formatWeight = (value: number | null | undefined) => {
  const formatted = formatWeightValue(value);
  return formatted ? `${formatted} lb` : "No weight";
};

const getWeightDelta = (metrics: HealthMetric[]) => {
  const weightPoints = metrics.filter((metric) => metric.weightKg !== null);
  if (weightPoints.length < 2) {
    return null;
  }

  const latest = weightPoints[0].weightKg ?? 0;
  const previous = weightPoints[1].weightKg ?? 0;
  return Math.round(kgToLbs(latest - previous) * 10) / 10;
};

const getMealStateTag = (status: Meal["analysisStatus"]) => {
  switch (status) {
    case "PENDING":
      return { label: "Analyzing", tone: "pending" as const };
    case "FALLBACK":
      return { label: "Quick estimate", tone: "warning" as const };
    case "FAILED":
      return { label: "Estimate unavailable", tone: "failed" as const };
    default:
      return null;
  }
};

const getServingCount = (quantity: string) => {
  const parsed = toOptionalNumber(quantity);
  return parsed && parsed > 0 ? parsed : 1;
};

const formatServingCount = (quantity: string) =>
  new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2
  }).format(getServingCount(quantity));

const formatMacroValue = (value: number | null | undefined) =>
  value === null || value === undefined ? "0g" : `${Math.round(value)}g`;

const getMealDetailText = (meal: Meal) => {
  const details = [
    meal.servingDescription,
    meal.images.length
      ? `${meal.images.length} photo${meal.images.length === 1 ? "" : "s"}`
      : null,
    meal.savedFood ? "Reusable" : null
  ].filter(Boolean);

  return details.length ? details.join(" · ") : "No serving details";
};

const scaleNutritionEstimate = (
  estimate: NutritionEstimate,
  multiplier: number
): NutritionEstimate => {
  const scale = (value: number) => Math.round(value * multiplier * 10) / 10;

  return {
    ...estimate,
    estimatedCalories: Math.round(estimate.estimatedCalories * multiplier),
    proteinGrams: scale(estimate.proteinGrams),
    carbsGrams: scale(estimate.carbsGrams),
    fatGrams: scale(estimate.fatGrams),
    fiberGrams: scale(estimate.fiberGrams),
    sugarGrams: scale(estimate.sugarGrams),
    sodiumMg: Math.round(estimate.sodiumMg * multiplier),
    micronutrients: estimate.micronutrients.map((item) => ({
      ...item,
      amount: scale(item.amount)
    })),
    vitamins: estimate.vitamins.map((item) => ({
      ...item,
      amount: scale(item.amount)
    })),
    foodBreakdown: estimate.foodBreakdown.map((item) => ({
      ...item,
      calories: Math.round(item.calories * multiplier),
      proteinGrams: scale(item.proteinGrams),
      carbsGrams: scale(item.carbsGrams),
      fatGrams: scale(item.fatGrams)
    }))
  };
};

const estimateFromMeal = (meal: Meal): NutritionEstimate => ({
  status: meal.analysisStatus,
  model: meal.aiModel ?? "stored-meal",
  summary: meal.analysisSummary ?? "Stored nutrition estimate.",
  confidenceScore: meal.confidenceScore ?? 0.5,
  estimatedCalories: meal.estimatedCalories ?? 0,
  proteinGrams: meal.proteinGrams ?? 0,
  carbsGrams: meal.carbsGrams ?? 0,
  fatGrams: meal.fatGrams ?? 0,
  fiberGrams: meal.fiberGrams ?? 0,
  sugarGrams: meal.sugarGrams ?? 0,
  sodiumMg: meal.sodiumMg ?? 0,
  micronutrients: meal.micronutrients ?? [],
  vitamins: meal.vitamins ?? [],
  assumptions: meal.assumptions ?? [],
  foodBreakdown: meal.foodBreakdown ?? [],
  rawAnalysis: {
    source: "stored-meal",
    mealId: meal.id
  }
});

const isMicronutrientList = (
  value: unknown
): value is Array<{ name: string; amount: number; unit: string }> =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "name" in item &&
      typeof item.name === "string" &&
      "amount" in item &&
      typeof item.amount === "number" &&
      "unit" in item &&
      typeof item.unit === "string"
  );

const estimateFromSavedFood = (food: SavedFood): NutritionEstimate | null => {
  if (food.calories === null) {
    return null;
  }

  const servingDescription = food.servingDescription ?? "1 serving";

  return {
    status: "COMPLETED",
    model: "saved-food",
    summary: food.notes ?? `Stored nutrition for ${servingDescription}.`,
    confidenceScore: 1,
    estimatedCalories: food.calories,
    proteinGrams: food.proteinGrams ?? 0,
    carbsGrams: food.carbsGrams ?? 0,
    fatGrams: food.fatGrams ?? 0,
    fiberGrams: food.fiberGrams ?? 0,
    sugarGrams: food.sugarGrams ?? 0,
    sodiumMg: food.sodiumMg ?? 0,
    micronutrients: isMicronutrientList(food.micronutrients) ? food.micronutrients : [],
    vitamins: [],
    assumptions: ["Used stored nutrition from this reusable food."],
    foodBreakdown: [
      {
        label: food.name,
        quantityDescription: servingDescription,
        calories: food.calories,
        proteinGrams: food.proteinGrams ?? 0,
        carbsGrams: food.carbsGrams ?? 0,
        fatGrams: food.fatGrams ?? 0
      }
    ],
    rawAnalysis: {
      source: "saved-food",
      savedFoodId: food.id
    }
  };
};

const isSavedFoodEstimate = (estimate: NutritionEstimate) =>
  typeof estimate.rawAnalysis === "object" &&
  estimate.rawAnalysis !== null &&
  "source" in estimate.rawAnalysis &&
  estimate.rawAnalysis.source === "saved-food";

export function App() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [globalError, setGlobalError] = useState("");
  const [globalNotice, setGlobalNotice] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [isMealModalOpen, setIsMealModalOpen] = useState(false);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [nutritionSummary, setNutritionSummary] = useState<NutritionSummary | null>(null);
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: ""
  });

  const [profileForm, setProfileForm] = useState({
    displayName: "",
    goalSummary: "",
    calorieGoal: "",
    proteinGoalGrams: "",
    carbGoalGrams: "",
    fatGoalGrams: "",
    heightCm: "",
    activityLevel: "",
    notes: ""
  });
  const [profileSaving, setProfileSaving] = useState(false);

  const [weightForm, setWeightForm] = useState(defaultWeightForm);
  const [weightSaving, setWeightSaving] = useState(false);

  const [workoutForm, setWorkoutForm] = useState(defaultWorkoutForm);
  const [workoutSaving, setWorkoutSaving] = useState(false);

  // Full workout session modal state
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionStep, setSessionStep] = useState<"plan" | "active" | "review">("plan");
  const [sessionActivityType, setSessionActivityType] = useState<WorkoutActivityType>("WEIGHTLIFTING");
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionExercises, setSessionExercises] = useState<WorkoutExercise[]>([]);
  const [sessionCalories, setSessionCalories] = useState({ total: 0, byCategory: {} as Record<string, number> });
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualSeconds, setManualSeconds] = useState("");
  const [hasUsedTimer, setHasUsedTimer] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonSession, setComparisonSession] = useState<WorkoutSession | null>(null);
  const [comparisonCollapsed, setComparisonCollapsed] = useState(true);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseList, setExerciseList] = useState<Record<string, string[]>>({});
  const [exerciseSuggestions, setExerciseSuggestions] = useState<string[]>([]);
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);

  // Workout sessions for dashboard history
  const [workoutSessions, setWorkoutSessions] = useState<WorkoutSession[]>([]);

  const [mealForm, setMealForm] = useState(defaultMealForm);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [mealSearchQuery, setMealSearchQuery] = useState("");
  const [mealTemplateLabel, setMealTemplateLabel] = useState<string | null>(null);
  const [plateFiles, setPlateFiles] = useState<File[]>([]);
  const [labelFiles, setLabelFiles] = useState<File[]>([]);
  const [otherFiles, setOtherFiles] = useState<File[]>([]);
  const [mealEstimate, setMealEstimate] = useState<NutritionEstimate | null>(null);
  const [mealEstimateBaseServings, setMealEstimateBaseServings] = useState(1);
  const [mealEstimating, setMealEstimating] = useState(false);
  const [mealSaving, setMealSaving] = useState(false);
  const plateInputRef = useRef<HTMLInputElement | null>(null);
  const labelInputRef = useRef<HTMLInputElement | null>(null);
  const otherInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    const isLoginPath = window.location.pathname === LOGIN_PATH;

    if (!session.authenticated && !isLoginPath) {
      window.history.replaceState(null, "", LOGIN_PATH);
      return;
    }

    if (session.authenticated && isLoginPath) {
      window.history.replaceState(null, "", DASHBOARD_PATH);
    }
  }, [session]);

  useEffect(() => {
    if (!session?.authenticated) {
      return;
    }

    void loadDashboard();
    void loadExerciseList();
  }, [session?.authenticated]);

  useEffect(() => {
    if (!profileData) {
      return;
    }

    setProfileForm({
      displayName: profileData.profile.displayName,
      goalSummary: profileData.profile.goalSummary ?? "",
      calorieGoal: valueToInput(profileData.profile.calorieGoal),
      proteinGoalGrams: valueToInput(profileData.profile.proteinGoalGrams),
      carbGoalGrams: valueToInput(profileData.profile.carbGoalGrams),
      fatGoalGrams: valueToInput(profileData.profile.fatGoalGrams),
      heightCm: valueToInput(profileData.profile.heightCm),
      activityLevel: profileData.profile.activityLevel ?? "",
      notes: profileData.profile.notes ?? ""
    });
  }, [profileData]);

  useEffect(() => {
    if (!mealEstimate) {
      return;
    }

    if (editingMealId) {
      return;
    }

    if (mealForm.savedFoodId && isSavedFoodEstimate(mealEstimate)) {
      return;
    }

    setMealEstimate(null);
  }, [
    editingMealId,
    mealForm.title,
    mealForm.notes,
    mealForm.eatenAt,
    mealForm.servingDescription,
    mealForm.savedFoodId,
    plateFiles,
    labelFiles,
    otherFiles
  ]);

  async function loadSession() {
    try {
      const nextSession = await apiFetch<SessionData>("/auth/session");
      setAuthToken(nextSession.token);
      setSession(nextSession);
    } catch (error) {
      setAuthToken(null);
      setGlobalError(getApiErrorMessage(error));
      setSession({ authenticated: false });
    }
  }

  async function loadDashboard() {
    setDashboardLoading(true);
    setGlobalError("");

    try {
      const [profileResponse, metricsResponse, summaryResponse, foodsResponse, mealsResponse, workoutsResponse, sessionsResponse] =
        await Promise.all([
          apiFetch<ProfileData>("/profile/me"),
          apiFetch<{ metrics: HealthMetric[] }>("/profile/me/health-metrics?limit=12"),
          apiFetch<NutritionSummary>(
            `/nutrition/summary?timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`
          ),
          apiFetch<{ foods: SavedFood[] }>("/nutrition/saved-foods"),
          apiFetch<{ meals: Meal[] }>("/nutrition/meals?limit=24"),
          apiFetch<{ workouts: Workout[] }>("/workouts?limit=24"),
          apiFetch<{ sessions: WorkoutSession[] }>("/workouts/sessions?limit=3&status=COMPLETED")
        ]);

      startTransition(() => {
        setProfileData(profileResponse);
        setHealthMetrics(metricsResponse.metrics);
        setNutritionSummary(summaryResponse);
        setSavedFoods(foodsResponse.foods);
        setMeals(mealsResponse.meals);
        setWorkouts(workoutsResponse.workouts);
        setWorkoutSessions(sessionsResponse.sessions);
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthToken(null);
        setSession({ authenticated: false });
        return;
      }

      setGlobalError(getApiErrorMessage(error));
    } finally {
      setDashboardLoading(false);
    }
  }

  async function loadExerciseList() {
    try {
      const result = await apiFetch<{ exercises: Record<string, string[]> }>("/workouts/exercises");
      setExerciseList(result.exercises);
    } catch {}
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setGlobalError("");
    setGlobalNotice("");

    try {
      const nextSession = await apiFetch<SessionData>("/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm)
      });
      setAuthToken(nextSession.token);
      setSession(nextSession);
      window.history.replaceState(null, "", DASHBOARD_PATH);
      setGlobalNotice("Signed in.");
    } catch (error) {
      setGlobalError(getApiErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await apiFetch<void>("/auth/logout", { method: "POST" });
      setAuthToken(null);
      setSession({ authenticated: false });
      window.history.replaceState(null, "", LOGIN_PATH);
      setGlobalNotice("Signed out.");
      setProfileData(null);
      setHealthMetrics([]);
      setNutritionSummary(null);
      setSavedFoods([]);
      setMeals([]);
      setWorkouts([]);
      setMealEstimate(null);
      setIsMealModalOpen(false);
      setIsWeightModalOpen(false);
      setIsWorkoutModalOpen(false);
      setIsProfileDrawerOpen(false);
    } catch (error) {
      setGlobalError(getApiErrorMessage(error));
    }
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileSaving(true);
    setGlobalError("");
    setGlobalNotice("");

    try {
      await apiFetch("/profile/me", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: profileForm.displayName,
          goalSummary: profileForm.goalSummary || null,
          calorieGoal: toNullableNumber(profileForm.calorieGoal),
          proteinGoalGrams: toNullableNumber(profileForm.proteinGoalGrams),
          carbGoalGrams: toNullableNumber(profileForm.carbGoalGrams),
          fatGoalGrams: toNullableNumber(profileForm.fatGoalGrams),
          heightCm: toNullableNumber(profileForm.heightCm),
          activityLevel: profileForm.activityLevel || null,
          notes: profileForm.notes || null
        })
      });

      await Promise.all([loadDashboard(), loadSession()]);
      setIsProfileDrawerOpen(false);
      setGlobalNotice("Profile updated.");
    } catch (error) {
      setGlobalError(getApiErrorMessage(error));
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleWeightSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWeightSaving(true);
    setGlobalError("");
    setGlobalNotice("");

    try {
      await apiFetch("/profile/me/health-metrics", {
        method: "POST",
        body: JSON.stringify({
          recordedAt: weightForm.recordedAt ? new Date(weightForm.recordedAt).toISOString() : undefined,
          weightKg: (() => {
            const weightLbs = toOptionalNumber(weightForm.weightLbs);
            return weightLbs === undefined ? undefined : lbsToKg(weightLbs);
          })()
        })
      });

      setWeightForm(defaultWeightForm());
      await loadDashboard();
      setIsWeightModalOpen(false);
      setGlobalNotice("Weight logged.");
    } catch (error) {
      setGlobalError(getApiErrorMessage(error));
    } finally {
      setWeightSaving(false);
    }
  }

  async function handleWorkoutSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkoutSaving(true);
    setGlobalError("");
    setGlobalNotice("");

    try {
      await apiFetch("/workouts", {
        method: "POST",
        body: JSON.stringify({
          title: workoutForm.title,
          caloriesBurned: toOptionalNumber(workoutForm.caloriesBurned),
          performedAt: workoutForm.performedAt
            ? new Date(workoutForm.performedAt).toISOString()
            : undefined
        })
      });

      setWorkoutForm(defaultWorkoutForm());
      await loadDashboard();
      setIsWorkoutModalOpen(false);
      setGlobalNotice("Workout logged.");
    } catch (error) {
      setGlobalError(getApiErrorMessage(error));
    } finally {
      setWorkoutSaving(false);
    }
  }

  function buildMealFormData() {
    const formData = new FormData();
    formData.append("title", mealForm.title);
    if (mealForm.notes) formData.append("notes", mealForm.notes);
    if (mealForm.eatenAt) formData.append("eatenAt", new Date(mealForm.eatenAt).toISOString());
    if (mealForm.servingDescription) formData.append("servingDescription", mealForm.servingDescription);
    if (mealForm.quantity) formData.append("quantity", mealForm.quantity);
    if (mealForm.savedFoodId) formData.append("savedFoodId", mealForm.savedFoodId);
    formData.append("saveAsReusableFood", String(mealForm.saveAsReusableFood));
    plateFiles.forEach((file) => formData.append("plateImages", file));
    labelFiles.forEach((file) => formData.append("labelImages", file));
    otherFiles.forEach((file) => formData.append("otherImages", file));
    return formData;
  }

  function buildMealUpdateBody(analysis: NutritionEstimate) {
    return {
      title: mealForm.title,
      notes: mealForm.notes || null,
      eatenAt: mealForm.eatenAt ? new Date(mealForm.eatenAt).toISOString() : undefined,
      servingDescription: mealForm.servingDescription || null,
      quantity: getServingCount(mealForm.quantity),
      confirmedAnalysis: analysis
    };
  }

  async function handleMealEstimate() {
    setMealEstimating(true);
    setGlobalError("");
    setGlobalNotice("");

    try {
      const result = await apiFetch<{ analysis: NutritionEstimate }>("/nutrition/estimate", {
        method: "POST",
        body: buildMealFormData()
      });

      setMealEstimate(result.analysis);
      setMealEstimateBaseServings(getServingCount(mealForm.quantity));
      setGlobalNotice(
        result.analysis.status === "COMPLETED"
          ? "Nutrition estimate ready."
          : "Estimate ready. Review before saving."
      );
    } catch (error) {
      setGlobalError(getApiErrorMessage(error));
    } finally {
      setMealEstimating(false);
    }
  }

  async function handleMealSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mealEstimate) {
      setGlobalError("Estimate nutrition first so you can review the calories and macros before saving.");
      return;
    }

    setMealSaving(true);
    setGlobalError("");
    setGlobalNotice("");

    try {
      const servingMultiplier = getServingCount(mealForm.quantity) / mealEstimateBaseServings;
      const scaledAnalysis = scaleNutritionEstimate(mealEstimate, servingMultiplier);

      if (editingMealId) {
        const result = await apiFetch<{ meal: Meal }>(`/nutrition/meals/${editingMealId}`, {
          method: "PATCH",
          body: JSON.stringify(buildMealUpdateBody(scaledAnalysis))
        });

        startNewMeal();
        setIsMealModalOpen(false);
        await loadDashboard();
        setGlobalNotice(`Updated ${result.meal.title}.`);
        return;
      }

      const formData = buildMealFormData();
      formData.append("confirmedAnalysis", JSON.stringify(scaledAnalysis));
      formData.append("reusableAnalysis", JSON.stringify(mealEstimate));

      const result = await apiFetch<{ meal: Meal; savedFoodId: string | null }>("/nutrition/meals", {
        method: "POST",
        body: formData
      });

      startNewMeal();
      setIsMealModalOpen(false);
      await loadDashboard();
      setGlobalNotice(
        result.savedFoodId ? "Meal saved and added to reusable foods." : "Meal analyzed and saved."
      );
    } catch (error) {
      setGlobalError(getApiErrorMessage(error));
    } finally {
      setMealSaving(false);
    }
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
    setter: (files: File[]) => void
  ) {
    setter(Array.from(event.target.files ?? []));
  }

  function resetMealComposer() {
    setEditingMealId(null);
    setMealForm(defaultMealForm());
    setPlateFiles([]);
    setLabelFiles([]);
    setOtherFiles([]);
    setMealEstimate(null);
    setMealEstimateBaseServings(1);

    if (plateInputRef.current) plateInputRef.current.value = "";
    if (labelInputRef.current) labelInputRef.current.value = "";
    if (otherInputRef.current) otherInputRef.current.value = "";
  }

  function startNewMeal() {
    resetMealComposer();
    setMealSearchQuery("");
    setMealTemplateLabel(null);
  }

  function openMealComposer(food?: SavedFood) {
    startNewMeal();

    if (food) {
      applySavedFoodTemplate(food);
    }

    setIsMealModalOpen(true);
  }

  function openMealEditor(meal: Meal) {
    resetMealComposer();

    const servings = meal.quantity && meal.quantity > 0 ? meal.quantity : 1;
    setEditingMealId(meal.id);
    setMealForm({
      ...defaultMealForm(),
      title: meal.title,
      notes: meal.notes ?? "",
      eatenAt: toDateTimeLocalInput(meal.eatenAt),
      servingDescription: meal.servingDescription ?? "",
      quantity: valueToInput(servings),
      savedFoodId: meal.savedFood?.id ?? ""
    });
    setMealEstimate(estimateFromMeal(meal));
    setMealEstimateBaseServings(servings);
    setMealSearchQuery("");
    setMealTemplateLabel(`Editing ${meal.title}`);
    setIsMealModalOpen(true);
  }

  function applySavedFoodTemplate(food: SavedFood) {
    resetMealComposer();

    setMealForm({
      ...defaultMealForm(),
      savedFoodId: food.id,
      title: food.name,
      servingDescription: food.servingDescription ?? "",
      quantity: "1"
    });
    setMealSearchQuery(food.name);
    setMealTemplateLabel(food.brand ? `${food.name} · ${food.brand}` : food.name);
    setMealEstimate(estimateFromSavedFood(food));
    setMealEstimateBaseServings(1);
  }

  const currentMemberName = session?.member?.displayName ?? "User";
  const currentMemberInitials = getInitials(currentMemberName);
  const hasMealEstimateInputs =
    plateFiles.length > 0 ||
    labelFiles.length > 0 ||
    otherFiles.length > 0 ||
    Boolean(mealForm.savedFoodId) ||
    Boolean(mealForm.quantity);
  const canEstimateMeal = Boolean(mealForm.title.trim()) && hasMealEstimateInputs;
  const todaySummary = nutritionSummary?.today ?? {
    mealCount: 0,
    calories: 0,
    caloriesBurned: 0,
    netCalories: 0,
    proteinGrams: 0,
    carbsGrams: 0,
    fatGrams: 0
  };
  const baseCalorieGoal = nutritionSummary?.goals?.baseCalorieGoal ?? profileData?.profile.calorieGoal ?? null;
  const calorieGoal =
    nutritionSummary?.goals?.adjustedCalorieGoal ??
    nutritionSummary?.goals?.calorieGoal ??
    profileData?.profile.calorieGoal ??
    null;
  const calorieProgress = getProgressPercent(todaySummary.calories, calorieGoal);
  const calorieBalance =
    calorieGoal === null
      ? "Set a calorie goal in profile."
      : todaySummary.calories <= calorieGoal
        ? `${calorieGoal - todaySummary.calories} kcal left`
        : `${todaySummary.calories - calorieGoal} kcal over`;

  const calorieTrend = nutritionSummary?.dailyCalories ?? [];
  const weeklyAverageCalories = calorieTrend.length
    ? Math.round(calorieTrend.reduce((sum, point) => sum + point.calories, 0) / calorieTrend.length)
    : 0;
  const normalizedMealSearch = mealSearchQuery.trim().toLowerCase();
  const displayedMealEstimate = mealEstimate
    ? scaleNutritionEstimate(mealEstimate, getServingCount(mealForm.quantity) / mealEstimateBaseServings)
    : null;
  const selectedSavedFoodEstimateReady = mealEstimate ? isSavedFoodEstimate(mealEstimate) : false;
  const mealTemplates: MealTemplateResult[] = [
    ...savedFoods.map((food) => ({
      key: `saved-food-${food.id}`,
      title: food.name,
      subtitle: food.brand ?? "Reusable food",
      detail: food.servingDescription ?? "Saved serving",
      searchText: [food.name, food.brand, food.servingDescription, food.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      food
    }))
  ];
  const mealSearchResults = mealTemplates
    .filter((template) => !normalizedMealSearch || template.searchText.includes(normalizedMealSearch))
    .slice(0, 8);
  const matchingMealTemplateCount = mealTemplates.filter(
    (template) => !normalizedMealSearch || template.searchText.includes(normalizedMealSearch)
  ).length;
  const displayedMeals = meals.slice(0, 3);
  const weightTrend = healthMetrics.filter((metric) => metric.weightKg !== null).slice().reverse();
  const weightTrendPoints = weightTrend.slice(-6);
  const latestWeight = healthMetrics.find((metric) => metric.weightKg !== null) ?? null;
  const weightDelta = getWeightDelta(healthMetrics);

  // Session calorie weight
  const sessionWeightKg = latestWeight?.weightKg ?? null;
  const sessionWeightKgForCalc = sessionWeightKg ?? 70;

  // Session calorie recalculation
  const recalcSessionCalories = useCallback(() => {
    const result = computeSessionCalories(sessionExercises, sessionWeightKgForCalc);
    setSessionCalories(result);
  }, [sessionExercises, sessionWeightKgForCalc]);

  // Draft management
  const DRAFT_KEY = "workout-draft";

  const saveDraft = useCallback(() => {
    const draft: WorkoutSessionDraft = {
      activityType: sessionActivityType,
      title: sessionTitle,
      exercises: sessionExercises,
      elapsedSeconds,
      status: sessionStep === "plan" ? "PLANNING" : "RUNNING",
      manualMinutes,
      manualSeconds,
      hasUsedTimer,
      step: sessionStep
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [sessionActivityType, sessionTitle, sessionExercises, elapsedSeconds, manualMinutes, manualSeconds, hasUsedTimer, sessionStep]);

  const loadDraft = useCallback((): WorkoutSessionDraft | null => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  // Session modal open/close
  const openSessionModal = useCallback((withComparison?: WorkoutSession) => {
    const draft = loadDraft();
    if (draft && !withComparison) {
      setSessionActivityType(draft.activityType);
      setSessionTitle(draft.title);
      setSessionExercises(draft.exercises);
      setElapsedSeconds(draft.elapsedSeconds);
      setManualMinutes(draft.manualMinutes ?? "");
      setManualSeconds(draft.manualSeconds ?? "");
      setHasUsedTimer(draft.hasUsedTimer);
      setSessionStep(draft.step);
      setComparisonMode(false);
      setComparisonSession(null);
      setComparisonCollapsed(true);
    } else {
      setSessionStep(withComparison ? "plan" : "plan");
      setSessionActivityType(withComparison ? withComparison.activityType : "WEIGHTLIFTING");
      setSessionTitle(withComparison ? "Copy of " + withComparison.title : "");
      setSessionExercises(withComparison ? withComparison.exercises.map((e) => ({ ...e })) : []);
      setElapsedSeconds(0);
      setManualMinutes("");
      setManualSeconds("");
      setHasUsedTimer(false);
      if (withComparison) {
        setComparisonMode(true);
        setComparisonSession(withComparison);
        setComparisonCollapsed(true);
      } else {
        setComparisonMode(false);
        setComparisonSession(null);
        setComparisonCollapsed(true);
      }
    }
    setIsSessionModalOpen(true);
  }, [loadDraft]);

  const logSameWorkout = useCallback((session: WorkoutSession) => {
    openSessionModal(session);
  }, [openSessionModal]);

  const closeSessionModal = useCallback(() => {
    saveDraft();
    setIsSessionModalOpen(false);
  }, [saveDraft]);

  // Exercise management
  const addExercise = useCallback((name: string) => {
    const kind: WorkoutExerciseKind =
      ["WEIGHTLIFTING", "CALISTHENICS"].includes(sessionActivityType) ? "LIFT" : "CARDIO";
    const newExercise: WorkoutExercise = {
      name,
      kind,
      category: sessionActivityType,
      sets: kind === "LIFT" ? [{ reps: 0, weightLbs: 0 }] : undefined,
      durationSeconds: kind === "CARDIO" ? 0 : undefined,
      distance: kind === "CARDIO" ? undefined : undefined
    };
    setSessionExercises((prev) => [...prev, newExercise]);
    setExerciseSearch("");
    setExerciseSuggestions([]);
    setEditingExerciseIndex(null);
  }, [sessionActivityType]);

  const removeExercise = useCallback((index: number) => {
    setSessionExercises((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateExercise = useCallback((index: number, patch: Partial<WorkoutExercise>) => {
    setSessionExercises((prev) =>
      prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex))
    );
  }, []);

  const addSet = useCallback((exerciseIndex: number) => {
    setSessionExercises((prev) =>
      prev.map((ex, i) =>
        i === exerciseIndex
          ? { ...ex, sets: [...(ex.sets ?? []), { reps: 0, weightLbs: 0 }] }
          : ex
      )
    );
  }, []);

  const removeSet = useCallback((exerciseIndex: number, setIndex: number) => {
    setSessionExercises((prev) =>
      prev.map((ex, i) =>
        i === exerciseIndex
          ? { ...ex, sets: ex.sets?.filter((_, si) => si !== setIndex) }
          : ex
      )
    );
  }, []);

  const updateSet = useCallback((exerciseIndex: number, setIndex: number, patch: Partial<WorkoutSet>) => {
    setSessionExercises((prev) =>
      prev.map((ex, i) =>
        i === exerciseIndex && ex.sets
          ? {
              ...ex,
              sets: ex.sets.map((s, si) => (si === setIndex ? { ...s, ...patch } : s))
            }
          : ex
      )
    );
  }, []);

  // Exercise search suggestions
  useEffect(() => {
    if (!exerciseSearch.trim()) {
      setExerciseSuggestions([]);
      return;
    }
    const allExercises = Object.values(exerciseList).flat();
    const results = fuzzyMatch(exerciseSearch, allExercises);
    setExerciseSuggestions(results);
  }, [exerciseSearch, exerciseList]);

  // Timer
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Auto-save draft on changes
  useEffect(() => {
    if (isSessionModalOpen) {
      saveDraft();
    }
  }, [sessionTitle, sessionActivityType, sessionExercises, sessionStep, isSessionModalOpen, saveDraft]);

  // Recalculate calories when exercises change
  useEffect(() => {
    recalcSessionCalories();
  }, [recalcSessionCalories]);

  // Timer handling
  const startTimer = () => { setIsTimerRunning(true); setHasUsedTimer(true); };
  const pauseTimer = () => { setIsTimerRunning(false); };
  const stopTimer = () => { setIsTimerRunning(false); setElapsedSeconds(0); };

  const getTotalDuration = () => {
    if (hasUsedTimer) return Math.max(elapsedSeconds, (parseInt(manualMinutes) || 0) * 60 + (parseInt(manualSeconds) || 0));
    const manual = (parseInt(manualMinutes) || 0) * 60 + (parseInt(manualSeconds) || 0);
    if (manual > 0) return manual;
    return sessionExercises.reduce((sum, ex) => sum + (ex.durationSeconds ?? 0), 0);
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    return `${m} min`;
  };

  // Save session
  const handleSessionSave = useCallback(async () => {
    setSessionSaving(true);
    setGlobalError("");
    setGlobalNotice("");
    try {
      const duration = getTotalDuration();
      const body = {
        activityType: sessionActivityType,
        title: sessionTitle || "Workout",
        startTime: null,
        endTime: new Date().toISOString(),
        durationSeconds: duration > 0 ? duration : undefined,
        totalCalories: sessionCalories.total,
        categoryCalories: sessionCalories.byCategory,
        exercises: sessionExercises
      };
      await apiFetch("/workouts/sessions", {
        method: "POST",
        body: JSON.stringify(body)
      });
      clearDraft();
      setIsSessionModalOpen(false);
      resetSessionState();
      await loadDashboard();
      setGlobalNotice("Workout saved.");
    } catch (error) {
      setGlobalError(getApiErrorMessage(error));
    } finally {
      setSessionSaving(false);
    }
  }, [sessionActivityType, sessionTitle, sessionExercises, sessionCalories, getTotalDuration, clearDraft, loadDashboard]);

  const resetSessionState = () => {
    setSessionStep("plan");
    setSessionActivityType("WEIGHTLIFTING");
    setSessionTitle("");
    setSessionExercises([]);
    setSessionCalories({ total: 0, byCategory: {} });
    setIsTimerRunning(false);
    setElapsedSeconds(0);
    setManualMinutes("");
    setManualSeconds("");
    setHasUsedTimer(false);
    setComparisonMode(false);
    setComparisonSession(null);
    setComparisonCollapsed(true);
    setExerciseSearch("");
    setExerciseSuggestions([]);
    setEditingExerciseIndex(null);
  };

  if (!session) {
    return (
      <main className="app-shell loading-shell">
        <Card className="hero-card">
          <p className="eyebrow">Loading private health workspace</p>
          <h1>Health & Nutrition Coach</h1>
          <p className="subtitle">Preparing your dashboard, reusable meals, and progress trends.</p>
        </Card>
      </main>
    );
  }

  if (!session.authenticated) {
    return (
      <main className="app-shell auth-shell">
        <section className="hero auth-hero">
          <p className="eyebrow">Private Health Coach</p>
          <h1>Track meals and nutrition from food photos and label screenshots.</h1>
          <p className="subtitle">
            This workspace is private. Sign in with your existing email and password, then log a
            meal by taking a picture of the plate, snapping the nutrition label, or uploading a
            screenshot of digital nutrition facts.
          </p>

          <div className="feature-grid auth-feature-grid">
            <Card className="feature-card auth-feature-card">
              <h2>Photo-first meal logging</h2>
              <p>Upload food photos, packaging photos, or screenshots before you save the meal.</p>
            </Card>
            <Card className="feature-card auth-feature-card">
              <h2>Estimate before submit</h2>
              <p>Review calories and macros from the AI estimate first, then confirm and store it.</p>
            </Card>
            <Card className="feature-card auth-feature-card">
              <h2>Private account</h2>
              <p>No public signup. Access is locked down to the credentials you already created.</p>
            </Card>
          </div>
        </section>

        <Card className="auth-card auth-login-card">
          <p className="eyebrow">Private Access</p>
          <h2>Sign in</h2>
          <p className="subtitle auth-card-subtitle">
            Use the email and password you already created to enter your dashboard.
          </p>

          {globalError && <p className="status-banner error">{globalError}</p>}
          {globalNotice && <p className="status-banner success">{globalNotice}</p>}

          <form className="form-stack" onSubmit={handleAuthSubmit}>
            <Field label="Email">
              <input
                required
                autoComplete="email"
                type="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
              />
            </Field>
            <Field label="Password">
              <input
                required
                autoComplete="current-password"
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
              />
            </Field>

            <button className="primary-button" disabled={authLoading} type="submit">
              {authLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </Card>
      </main>
    );
  }

  return (
    <main className="app-shell dashboard-shell">
      <header className="dashboard-header">
        <div className="dashboard-header-copy">
          <p className="eyebrow">Private account</p>
          <h1>Daily health dashboard</h1>
        </div>

        <div className="dashboard-toolbar">
          <button className="primary-button" onClick={() => openMealComposer()} type="button">
            Log food
          </button>
          <button
            className="primary-button"
            onClick={() => setIsWeightModalOpen(true)}
            type="button"
          >
            Log weight
          </button>
          <button
             className="primary-button"
             onClick={() => openSessionModal()}
             type="button"
           >
             Log workout
           </button>
           <button
             className="secondary-button"
             onClick={() => setIsWorkoutModalOpen(true)}
             type="button"
           >
             Log simple workout
           </button>
          <button
            aria-label="Open profile"
            className="avatar-trigger"
            onClick={() => setIsProfileDrawerOpen(true)}
            type="button"
          >
            <span className="avatar-badge">{currentMemberInitials}</span>
            <span className="avatar-copy">
              <strong>{currentMemberName}</strong>
            </span>
          </button>
        </div>
      </header>

      {globalError && <p className="status-banner error">{globalError}</p>}
      {globalNotice && <p className="status-banner success">{globalNotice}</p>}

      <div className="dashboard-stack">
        <Card className="compact-card summary-card summary-strip-card">
          <div className="summary-card-header">
            <div>
              <p className="eyebrow">Today</p>
              <h2>Daily snapshot</h2>
            </div>
            <span className="status-chip">
              {dashboardLoading
                ? "Refreshing"
                : `${todaySummary.mealCount} logged item${todaySummary.mealCount === 1 ? "" : "s"}`}
            </span>
          </div>

          <div className="summary-strip">
            <section className="summary-metric-block">
              <span className="summary-label">Calories consumed</span>
              <strong>{todaySummary.calories}</strong>
              <small>{calorieGoal ? `${calorieProgress}% of adjusted goal` : "Goal not set"}</small>
            </section>

            <section className="summary-metric-block">
              <span className="summary-label">Workout burn</span>
              <strong>{todaySummary.caloriesBurned}</strong>
              <small>
                {baseCalorieGoal && calorieGoal
                  ? `${baseCalorieGoal} base + ${todaySummary.caloriesBurned} burned`
                  : "Log workouts to adjust your goal"}
              </small>
            </section>

            <section className="summary-metric-block">
              <span className="summary-label">Remaining</span>
              <strong>{calorieGoal ? Math.max(0, calorieGoal - todaySummary.calories) : "—"}</strong>
              <small>{calorieBalance}</small>
            </section>

            <section className="summary-metric-block">
              <span className="summary-label">Latest weight</span>
              <strong>{formatWeight(latestWeight?.weightKg)}</strong>
              <small>
                {latestWeight
                  ? `${formatDate(latestWeight.recordedAt)}${weightDelta === null ? "" : ` · ${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} lb vs prior`}`
                  : "Log weight to start tracking"}
              </small>
            </section>
          </div>

          <div className="overview-progress">
            <div className="progress-copy">
              <strong>{calorieGoal ? `${calorieProgress}% of adjusted goal` : "Goal not set"}</strong>
              <span>{calorieBalance}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${calorieProgress}%` }} />
            </div>
          </div>
        </Card>

        <div className="dashboard-trend-row">
          <Card className="trend-card compact-card">
            <SectionHeading
              title="7-day calorie trend"
              description={`${weeklyAverageCalories} kcal consumed per day average`}
            />
            <DailyTrendChart
              baseGoalCalories={baseCalorieGoal}
              goalCalories={calorieGoal}
              points={calorieTrend}
              workoutCaloriesToday={todaySummary.caloriesBurned}
            />
          </Card>

          <Card className="trend-card compact-card">
            <SectionHeading
              title="Weight trend"
              description={latestWeight ? `Updated ${formatDate(latestWeight.recordedAt)}` : "No entries yet"}
            />
            <WeightTrendChart points={weightTrendPoints} />
          </Card>
        </div>

        <Card className="compact-card meals-card meal-history-card">
          <div className="section-heading-row">
            <SectionHeading title="Last 3 logs" description="Recent food, drink, and nutrition entries" />
            <button
              aria-label="Add meal"
              className="icon-button meal-add-button"
              onClick={() => openMealComposer()}
              type="button"
            >
              +
            </button>
          </div>
          {dashboardLoading ? (
            <p className="empty-state">Refreshing logs…</p>
          ) : meals.length === 0 ? (
            <div className="empty-panel">
              <p className="empty-state">No logs yet.</p>
              <button className="secondary-button" onClick={() => openMealComposer()} type="button">
                Log your first item
              </button>
            </div>
          ) : (
            <div className="meal-list meal-history-list">
              <div className="meal-table-header" aria-hidden="true">
                <span>Meal</span>
                <span>Calories</span>
                <span>Macros</span>
                <span>Details</span>
                <span />
              </div>
              {displayedMeals.map((meal) => {
                const mealStateTag = getMealStateTag(meal.analysisStatus);

                return (
                  <article className="meal-log-item" key={meal.id}>
                    <div className="meal-log-row">
                      <div className="meal-log-title">
                        <strong>{meal.title}</strong>
                        <span>{formatDateTime(meal.eatenAt)}</span>
                      </div>

                      <strong className="meal-calories">
                        {meal.estimatedCalories ? `${meal.estimatedCalories} kcal` : "No calories"}
                      </strong>

                      <div className="meal-log-macros" aria-label="Meal macros">
                        P {formatMacroValue(meal.proteinGrams)} · C {formatMacroValue(meal.carbsGrams)} · F{" "}
                        {formatMacroValue(meal.fatGrams)}
                      </div>

                      <div className="meal-log-meta">
                        <span>{getMealDetailText(meal)}</span>
                        {mealStateTag ? (
                          <span className={`tag ${mealStateTag.tone}`}>{mealStateTag.label}</span>
                        ) : null}
                      </div>

                      <div className="meal-log-actions">
                        <button className="inline-action-button" onClick={() => openMealEditor(meal)} type="button">
                          Edit
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="compact-card workout-history-card">
          <div className="section-heading-row">
            <SectionHeading title="Last 3 Workouts" description="Recent workout sessions" />
            <button
              aria-label="Add workout"
              className="icon-button workout-add-button"
              onClick={() => openSessionModal()}
              type="button"
            >
              +
            </button>
          </div>
          {dashboardLoading ? (
            <p className="empty-state">Refreshing workouts…</p>
          ) : workoutSessions.length === 0 ? (
            <div className="empty-panel">
              <p className="empty-state">No workouts logged yet.</p>
              <button className="secondary-button" onClick={() => openSessionModal()} type="button">
                Log your first workout
              </button>
            </div>
          ) : (
            <div className="workout-history-list">
              {workoutSessions.map((session) => (
                <article className="workout-history-item" key={session.id}>
                  <div className="workout-history-row">
                    <div className="workout-history-title">
                      <strong>{session.title}</strong>
                      <span>
                        {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
                          new Date(session.performedAt)
                        )}
                      </span>
                    </div>
                    <strong className="workout-history-calories">
                      {session.totalCalories ? `${session.totalCalories} kcal` : "—"}
                    </strong>
                    <div className="workout-history-exercises">
                      <span>
                        {session.exercises
                          .map((ex) => {
                            if (ex.kind === "LIFT" && ex.sets) {
                              return `${ex.name} ${ex.sets.length}×${ex.sets[0]?.reps ?? "?"}`;
                            }
                            if (ex.durationSeconds) {
                              const mins = Math.round(ex.durationSeconds / 60);
                              return `${ex.name} ${mins} min`;
                            }
                            return ex.name;
                          })
                          .join(" | ")}
                      </span>
                    </div>
                    <div className="workout-history-actions">
                      <button
                        className="inline-action-button"
                        onClick={() => logSameWorkout(session)}
                        type="button"
                      >
                        Log same
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

      </div>

      <OverlayPanel
        description="Start from a reusable food, a recent one-off meal, or a fresh photo or nutrition label."
        onClose={() => {
          setIsMealModalOpen(false);
          startNewMeal();
        }}
        open={isMealModalOpen}
        title="Add meal"
        variant="dialog"
      >
        <form className="form-stack" onSubmit={handleMealSave}>
          <SectionHeading
            title="Start with"
            description="Only reusable foods you save appear here."
          />

          <div className="template-toolbar">
            <Field label="Search saved foods">
              <input
                placeholder="Search reusable foods"
                value={mealSearchQuery}
                onChange={(event) => setMealSearchQuery(event.target.value)}
              />
            </Field>
          </div>

          <div className="template-results">
            {mealSearchResults.length === 0 ? (
              <p className="empty-state">No saved meals match that search yet.</p>
            ) : (
              mealSearchResults.map((template) => (
                <article className="template-card" key={template.key}>
                  <div className="template-card-copy">
                    <div className="template-card-heading">
                      <strong>{template.title}</strong>
                      <span className="template-badge">Reusable</span>
                    </div>
                    <span>{template.subtitle}</span>
                    <small>{template.detail}</small>
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() => applySavedFoodTemplate(template.food)}
                    type="button"
                  >
                    Use as base
                  </button>
                </article>
              ))
            )}
          </div>
          {matchingMealTemplateCount > mealSearchResults.length ? (
            <p className="input-help">
              Showing {mealSearchResults.length} of {matchingMealTemplateCount} saved foods. Search to narrow the list.
            </p>
          ) : null}

          <div className={`template-status ${mealTemplateLabel ? "" : "neutral"}`}>
            <strong>{mealTemplateLabel ? `Using ${mealTemplateLabel}` : "New meal"}</strong>
            <span>
              {mealTemplateLabel
                ? "Adjust the amount, add fresh photos, then save this entry."
                : "Add a food photo, a nutrition label, or pick a reusable food."}
            </span>
          </div>

          <TwoColumnFields>
            <Field label="Meal title">
              <input
                required
                value={mealForm.title}
                onChange={(event) => setMealForm({ ...mealForm, title: event.target.value })}
              />
            </Field>
            <Field label="When">
              <input
                type="datetime-local"
                value={mealForm.eatenAt}
                onChange={(event) => setMealForm({ ...mealForm, eatenAt: event.target.value })}
              />
            </Field>
            <Field label="Serving">
              <input
                placeholder="bowl, slice, bar, shake"
                value={mealForm.servingDescription}
                onChange={(event) =>
                  setMealForm({ ...mealForm, servingDescription: event.target.value })
                }
              />
            </Field>
            <Field label="Servings">
              <input
                aria-label="Servings"
                inputMode="decimal"
                min="0.01"
                step="any"
                type="number"
                value={mealForm.quantity}
                onChange={(event) => setMealForm({ ...mealForm, quantity: event.target.value })}
              />
            </Field>
          </TwoColumnFields>

          <Field label="Notes">
            <textarea
              placeholder="Optional context for the estimate"
              rows={2}
              value={mealForm.notes}
              onChange={(event) => setMealForm({ ...mealForm, notes: event.target.value })}
            />
          </Field>

          <div className="upload-grid">
            <div className="field">
              <span>Food photos</span>
              <FileUploadControl
                accept="image/*"
                files={plateFiles}
                inputRef={plateInputRef}
                onChange={(event) => handleFileChange(event, setPlateFiles)}
              />
              <p className="input-help">Take a picture of the meal or upload one from your camera roll.</p>
            </div>
            <div className="field">
              <span>Nutrition label photos</span>
              <FileUploadControl
                accept="image/*"
                files={labelFiles}
                inputRef={labelInputRef}
                onChange={(event) => handleFileChange(event, setLabelFiles)}
              />
              <p className="input-help">
                Add package labels or screenshots of digital nutrition facts.
              </p>
            </div>
            <div className="field">
              <span>Extra reference images</span>
              <FileUploadControl
                accept="image/*"
                files={otherFiles}
                inputRef={otherInputRef}
                onChange={(event) => handleFileChange(event, setOtherFiles)}
              />
              <p className="input-help">Use this for menus, ingredient lists, or anything else that helps.</p>
            </div>
          </div>

          <div className={`analysis-preview ${mealEstimate ? "" : "empty"}`}>
            <SectionHeading
              title="Nutrition preview"
              description={
                selectedSavedFoodEstimateReady
                  ? "Using stored nutrition from this reusable food. Adjust Servings to scale what gets saved."
                  : "Estimate one serving with ChatGPT, then adjust Servings to scale what gets saved."
              }
            />

            {displayedMealEstimate ? (
              <>
                <div className="analysis-preview-header">
                  <span className={`tag ${displayedMealEstimate.status === "COMPLETED" ? "" : "subtle"}`}>
                    {selectedSavedFoodEstimateReady
                      ? "Stored nutrition"
                      : displayedMealEstimate.status === "COMPLETED"
                        ? "AI estimate"
                        : "Fallback estimate"}
                  </span>
                  <span className="list-item-copy">
                    {formatServingCount(mealForm.quantity)} serving
                    {getServingCount(mealForm.quantity) === 1 ? "" : "s"} · Confidence{" "}
                    {Math.round(displayedMealEstimate.confidenceScore * 100)}%
                  </span>
                </div>

                <div className="summary-metrics-grid">
                  <section className="summary-metric-block">
                    <span className="summary-label">Calories</span>
                    <strong>{Math.round(displayedMealEstimate.estimatedCalories)}</strong>
                    <small>{displayedMealEstimate.summary}</small>
                  </section>
                  <section className="summary-metric-block">
                    <span className="summary-label">Protein</span>
                    <strong>{displayedMealEstimate.proteinGrams}g</strong>
                    <small>Carbs {displayedMealEstimate.carbsGrams}g · Fat {displayedMealEstimate.fatGrams}g</small>
                  </section>
                </div>

                {displayedMealEstimate.foodBreakdown.length ? (
                  <div className="analysis-breakdown">
                    {displayedMealEstimate.foodBreakdown.map((item) => (
                      <article className="analysis-breakdown-item" key={`${item.label}-${item.quantityDescription}`}>
                        <strong>{item.label}</strong>
                        <span>{item.quantityDescription}</span>
                        <small>
                          {Math.round(item.calories)} kcal · P {item.proteinGrams}g · C {item.carbsGrams}g · F {item.fatGrams}g
                        </small>
                      </article>
                    ))}
                  </div>
                ) : null}

                {displayedMealEstimate.assumptions.length ? (
                  <div className="analysis-assumptions">
                    <p className="section-label">Assumptions</p>
                    <ul className="analysis-list">
                      {displayedMealEstimate.assumptions.map((assumption) => (
                        <li key={assumption}>{assumption}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="empty-state">
                Add a meal title plus a food photo, label screenshot, or reusable food with stored calories, then click{" "}
                <strong>Estimate nutrition</strong>.
              </p>
            )}
          </div>

          <label className="checkbox-row">
            <input
              checked={mealForm.saveAsReusableFood}
              type="checkbox"
              onChange={(event) =>
                setMealForm({ ...mealForm, saveAsReusableFood: event.target.checked })
              }
            />
            <span>Save this meal as a reusable food after analysis</span>
          </label>

          <div className="panel-actions">
            <button
              className="ghost-button"
              onClick={() => {
                setIsMealModalOpen(false);
                startNewMeal();
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              className="secondary-button"
              disabled={mealEstimating || mealSaving || !canEstimateMeal}
              onClick={handleMealEstimate}
              type="button"
            >
              {mealEstimating
                ? "Estimating..."
                : selectedSavedFoodEstimateReady
                  ? "Re-estimate nutrition"
                  : "Estimate nutrition"}
            </button>
            <button className="primary-button" disabled={mealSaving || !mealEstimate} type="submit">
              {mealSaving ? "Saving..." : "Save meal"}
            </button>
          </div>
        </form>
      </OverlayPanel>

      <OverlayPanel
        description="Add a weight entry without leaving the dashboard."
        onClose={() => {
          setIsWeightModalOpen(false);
          setWeightForm(defaultWeightForm());
        }}
        open={isWeightModalOpen}
        title="Log weight"
        variant="dialog"
      >
        <form className="form-stack" onSubmit={handleWeightSave}>
          <TwoColumnFields>
            <Field label="Weight (lb)">
              <input
                required
                min="0"
                step="0.1"
                type="number"
                value={weightForm.weightLbs}
                onChange={(event) => setWeightForm({ ...weightForm, weightLbs: event.target.value })}
              />
            </Field>
            <Field label="When">
              <input
                type="datetime-local"
                value={weightForm.recordedAt}
                onChange={(event) => setWeightForm({ ...weightForm, recordedAt: event.target.value })}
              />
            </Field>
          </TwoColumnFields>

          <div className="panel-actions">
            <button
              className="ghost-button"
              onClick={() => {
                setIsWeightModalOpen(false);
                setWeightForm(defaultWeightForm());
              }}
              type="button"
            >
              Cancel
            </button>
            <button className="primary-button" disabled={weightSaving || !weightForm.weightLbs} type="submit">
              {weightSaving ? "Saving..." : "Save weight"}
            </button>
          </div>
        </form>
      </OverlayPanel>

      <OverlayPanel
        description="Log calories burned so today's calorie budget adjusts automatically."
        onClose={() => {
          setIsWorkoutModalOpen(false);
          setWorkoutForm(defaultWorkoutForm());
        }}
        open={isWorkoutModalOpen}
        title="Log simple workout"
        variant="dialog"
      >
        <form className="form-stack" onSubmit={handleWorkoutSave}>
          <Field label="Workout">
            <input
              required
              placeholder="Walk, run, lift, bike"
              value={workoutForm.title}
              onChange={(event) => setWorkoutForm({ ...workoutForm, title: event.target.value })}
            />
          </Field>

          <TwoColumnFields>
            <Field label="Calories burned">
              <input
                required
                min="1"
                step="1"
                type="number"
                value={workoutForm.caloriesBurned}
                onChange={(event) =>
                  setWorkoutForm({ ...workoutForm, caloriesBurned: event.target.value })
                }
              />
            </Field>
            <Field label="When">
              <input
                type="datetime-local"
                value={workoutForm.performedAt}
                onChange={(event) =>
                  setWorkoutForm({ ...workoutForm, performedAt: event.target.value })
                }
              />
            </Field>
          </TwoColumnFields>

          <div className="panel-actions">
            <button
              className="ghost-button"
              onClick={() => {
                setIsWorkoutModalOpen(false);
                setWorkoutForm(defaultWorkoutForm());
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={workoutSaving || !workoutForm.title.trim() || !workoutForm.caloriesBurned}
              type="submit"
            >
              {workoutSaving ? "Saving..." : "Save workout"}
            </button>
          </div>
        </form>
      </OverlayPanel>

      {/* Full workout session modal */}
      <OverlayPanel
        description="Plan, track, and save your workout with detailed exercises and calorie estimates."
        onClose={closeSessionModal}
        open={isSessionModalOpen}
        title={sessionStep === "plan" ? "Plan workout" : sessionStep === "active" ? "Active workout" : "Review workout"}
        variant="dialog"
      >
        <div className="workout-session-modal">
          {/* Activity type pills */}
          <div className="activity-type-pills">
            {["RUNNING", "WALKING", "CYCLING", "SWIMMING", "ROWING", "WEIGHTLIFTING", "CALISTHENICS", "HIIT", "OTHER"].map(
              (type) => (
                <button
                  key={type}
                  className={`activity-type-pill ${sessionActivityType === type ? "active" : ""}`}
                  onClick={() => {
                    setSessionActivityType(type as WorkoutActivityType);
                    setSessionExercises((prev) =>
                      prev.map((ex) => ({ ...ex, category: type as WorkoutActivityType }))
                    );
                  }}
                  type="button"
                >
                  {type === "WEIGHTLIFTING"
                    ? "Weightlifting"
                    : type.charAt(0) + type.slice(1).toLowerCase()}
                </button>
              )
            )}
          </div>

          {/* Title */}
          <Field label="Title">
            <input
              placeholder="Morning routine, leg day, 5K run..."
              value={sessionTitle}
              onChange={(event) => setSessionTitle(event.target.value)}
            />
          </Field>

          {/* Comparison table */}
          {comparisonMode && comparisonSession && (
            <div className="workout-comparison">
              <div
                className="workout-comparison-header"
                onClick={() => setComparisonCollapsed(!comparisonCollapsed)}
              >
                <strong>Compare with: {comparisonSession.title}</strong>
                <span className="workout-comparison-summary">
                  Prev: {comparisonSession.totalCalories ?? "—"} kcal |{" "}
                  {comparisonSession.durationSeconds ? formatDuration(comparisonSession.durationSeconds) : "—"} |{" "}
                  Current: {sessionCalories.total} kcal | {formatDuration(getTotalDuration())}
                </span>
                <span className="collapse-icon">{comparisonCollapsed ? "▾" : "▴"}</span>
                <button
                  className="ghost-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setComparisonMode(false);
                    setComparisonSession(null);
                  }}
                  type="button"
                >
                  Clear
                </button>
              </div>
              {!comparisonCollapsed && (
                <div className="workout-comparison-table">
                  <div className="comparison-table-header">
                    <span>Exercise</span>
                    <span>Previous</span>
                    <span>Current</span>
                    <span>Δ</span>
                  </div>
                  {comparisonSession.exercises.map((prevEx) => {
                    const currEx = sessionExercises.find((ex) => ex.name === prevEx.name);
                    const prevWeight =
                      prevEx.sets?.reduce((s, set) => s + set.weightLbs * set.reps, 0) ?? 0;
                    const currWeight =
                      currEx?.sets?.reduce((s, set) => s + set.weightLbs * set.reps, 0) ?? 0;
                    const indicator =
                      !currEx
                        ? "missing"
                        : currWeight >= prevWeight && prevWeight > 0
                          ? "up"
                          : currWeight < prevWeight
                            ? "warn"
                            : "neutral";
                    return (
                      <div key={prevEx.name} className={`comparison-row ${indicator}`}>
                        <span>{prevEx.name}</span>
                        <span>{prevWeight > 0 ? `${prevWeight} vol` : prevEx.durationSeconds ? formatDuration(prevEx.durationSeconds) : "—"}</span>
                        <span>
                          {currEx
                            ? currWeight > 0
                              ? `${currWeight} vol`
                              : currEx.durationSeconds
                                ? formatDuration(currEx.durationSeconds)
                                : "—"
                            : "missing"}
                        </span>
                        <span className={`tag ${indicator}`}>
                          {indicator === "up"
                            ? "stronger"
                            : indicator === "warn"
                              ? "lighter"
                              : indicator === "missing"
                                ? "missing"
                                : "same"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Load previous workout (when not in comparison mode) */}
          {!comparisonMode && workoutSessions.length > 0 && (
            <div className="load-previous-section">
              <button
                className="ghost-button"
                onClick={() => {
                  const prev = workoutSessions[0];
                  setSessionTitle("Copy of " + prev.title);
                  setSessionActivityType(prev.activityType);
                  setSessionExercises(prev.exercises.map((e) => ({ ...e })));
                  setComparisonMode(true);
                  setComparisonSession(prev);
                  setComparisonCollapsed(true);
                }}
                type="button"
              >
                Load last workout: {workoutSessions[0].title}
              </button>
            </div>
          )}

          {/* Exercise builder */}
          <div className="exercise-builder">
            <div className="exercise-builder-header">
              <strong>Exercises</strong>
            </div>

            <div className="exercise-search-row">
              <input
                className="exercise-search-input"
                placeholder="Search exercises (type to add)..."
                value={exerciseSearch}
                onChange={(event) => setExerciseSearch(event.target.value)}
                onFocus={() => {
                  if (exerciseSearch.trim()) {
                    const allExercises = Object.values(exerciseList).flat();
                    setExerciseSuggestions(fuzzyMatch(exerciseSearch, allExercises));
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && exerciseSearch.trim()) {
                    event.preventDefault();
                    addExercise(exerciseSearch.trim());
                  }
                }}
              />
              {exerciseSearch.trim() && (
                <button
                  className="ghost-button add-exercise-btn"
                  onClick={() => addExercise(exerciseSearch.trim())}
                  type="button"
                >
                  + Add
                </button>
              )}
            </div>

            {/* Suggestions dropdown */}
            {exerciseSuggestions.length > 0 && (
              <div className="exercise-suggestions">
                {exerciseSuggestions.map((name) => (
                  <button
                    key={name}
                    className="suggestion-item"
                    onClick={() => addExercise(name)}
                    type="button"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            {/* Exercise list */}
            {sessionExercises.map((exercise, index) => {
              const exerciseCals = computeSessionCalories([exercise], sessionWeightKgForCalc).total;
              return (
                <div key={index} className="exercise-card">
                  <div className="exercise-card-header">
                    <strong>{exercise.name}</strong>
                    <button
                      className="inline-action-button"
                      onClick={() => removeExercise(index)}
                      type="button"
                    >
                      ✕
                    </button>
                  </div>

                  {exercise.kind === "LIFT" ||
                  (["WEIGHTLIFTING", "CALISTHENICS"].includes(exercise.category) && exercise.kind !== "CARDIO") ? (
                    <div className="set-rows">
                      {exercise.sets?.map((set, setIndex) => (
                        <div key={setIndex} className="set-row">
                          <input
                            type="number"
                            min="0"
                            placeholder="lbs"
                            value={set.weightLbs || ""}
                            onChange={(event) =>
                              updateSet(index, setIndex, {
                                weightLbs: parseFloat(event.target.value) || 0
                              })
                            }
                          />
                          <span>×</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="reps"
                            value={set.reps || ""}
                            onChange={(event) =>
                              updateSet(index, setIndex, {
                                reps: parseInt(event.target.value) || 0
                              })
                            }
                          />
                          <button
                            className="inline-action-button"
                            onClick={() => removeSet(index, setIndex)}
                            type="button"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        className="ghost-button add-set-btn"
                        onClick={() => addSet(index)}
                        type="button"
                      >
                        + Set
                      </button>
                    </div>
                  ) : (
                    <div className="cardio-inputs">
                      <div className="two-column-grid">
                        <Field label="Duration (min)">
                          <input
                            type="number"
                            min="0"
                            placeholder="minutes"
                            value={(exercise.durationSeconds && exercise.durationSeconds / 60) || ""}
                            onChange={(event) =>
                              updateExercise(index, {
                                durationSeconds: (parseInt(event.target.value) || 0) * 60
                              })
                            }
                          />
                        </Field>
                        <Field label="Distance">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="distance"
                            value={exercise.distance || ""}
                            onChange={(event) =>
                              updateExercise(index, {
                                distance: parseFloat(event.target.value) || undefined
                              })
                            }
                          />
                        </Field>
                      </div>
                    </div>
                  )}

                  <div className="exercise-calories-estimate">
                    Est. {exerciseCals} kcal
                  </div>
                </div>
              );
            })}

            {sessionExercises.length === 0 && (
              <p className="empty-state">
                Search above to add exercises. Press Enter or click "Add" to include.
              </p>
            )}
          </div>

          {/* Timing section */}
          <div className="timing-section">
            <div className="timing-toggle">
              <label className="checkbox-row">
                <input
                  checked={hasUsedTimer}
                  type="checkbox"
                  onChange={() => {
                    setHasUsedTimer(!hasUsedTimer);
                    if (hasUsedTimer) {
                      setIsTimerRunning(false);
                      setElapsedSeconds(0);
                    }
                  }}
                />
                <span>Use timer</span>
              </label>
            </div>

            {hasUsedTimer && (
              <div className="workout-timer">
                <div className="workout-timer-value" aria-label={`Timer: ${formatTimer(elapsedSeconds)}`}>
                  {formatTimer(elapsedSeconds)}
                </div>
                <div className="timer-controls">
                  {!isTimerRunning ? (
                    <button className="primary-button" onClick={startTimer} type="button">
                      {elapsedSeconds > 0 ? "Resume" : "Start"}
                    </button>
                  ) : (
                    <button className="secondary-button" onClick={pauseTimer} type="button">
                      Pause
                    </button>
                  )}
                  <button className="ghost-button" onClick={stopTimer} type="button">
                    Reset
                  </button>
                </div>
              </div>
            )}

            <div className="manual-time-entry">
              <TwoColumnFields>
                <Field label="Manual minutes">
                  <input
                    type="number"
                    min="0"
                    placeholder="min"
                    value={manualMinutes}
                    onChange={(event) => setManualMinutes(event.target.value)}
                  />
                </Field>
                <Field label="Manual seconds">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    placeholder="sec"
                    value={manualSeconds}
                    onChange={(event) => setManualSeconds(event.target.value)}
                  />
                </Field>
              </TwoColumnFields>
            </div>
          </div>

          {/* Category breakdown & summary */}
          <div className="category-breakdown">
            <strong>Calorie breakdown</strong>
            {Object.entries(sessionCalories.byCategory).length > 0 ? (
              Object.entries(sessionCalories.byCategory).map(([category, cals]) => (
                <div key={category} className="category-breakdown-item">
                  <span>
                    {category === "WEIGHTLIFTING"
                      ? "Strength"
                      : category === "CALISTHENICS"
                        ? "Calisthenics"
                        : category.charAt(0) + category.slice(1).toLowerCase()}
                  </span>
                  <strong>{cals} kcal</strong>
                </div>
              ))
            ) : (
              <p className="empty-state">Add exercises to see calorie estimates.</p>
            )}
            <div className="category-breakdown-total">
              <strong>Total</strong>
              <strong>{sessionCalories.total} kcal</strong>
              <span>Duration: {formatDuration(getTotalDuration())}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="panel-actions">
            <button className="ghost-button" onClick={closeSessionModal} type="button">
              Cancel
            </button>
            {sessionStep === "plan" && sessionExercises.length > 0 && (
              <button
                className="secondary-button"
                onClick={() => {
                  setSessionStep("active");
                  setHasUsedTimer(true);
                }}
                type="button"
              >
                Start workout
              </button>
            )}
            {sessionStep === "active" && (
              <button
                className="secondary-button"
                onClick={() => {
                  pauseTimer();
                  setSessionStep("review");
                }}
                type="button"
              >
                End workout
              </button>
            )}
            {sessionStep === "review" && (
              <>
                <button
                  className="secondary-button"
                  onClick={() => setSessionStep("plan")}
                  type="button"
                >
                  Edit
                </button>
                <button
                  className="primary-button"
                  disabled={sessionSaving || sessionExercises.length === 0}
                  onClick={handleSessionSave}
                  type="button"
                >
                  {sessionSaving ? "Saving..." : "Save workout"}
                </button>
              </>
            )}
            {sessionStep === "plan" && sessionExercises.length === 0 && (
              <button
                className="primary-button"
                disabled
                type="button"
              >
                Add exercises first
              </button>
            )}
          </div>
        </div>
      </OverlayPanel>

      {/* Profile drawer */}
      <OverlayPanel
        description="Update your profile settings and sign out of your private account."
        onClose={() => setIsProfileDrawerOpen(false)}
        open={isProfileDrawerOpen}
        title="Profile"
        variant="drawer"
      >
        <div className="drawer-profile-header">
          <div className="drawer-avatar">{currentMemberInitials}</div>
          <div>
            <strong>{currentMemberName}</strong>
            <p className="list-item-copy">{session.account?.email}</p>
          </div>
        </div>

        <form className="form-stack" onSubmit={handleProfileSave}>
          <Field label="Display name">
            <input
              required
              value={profileForm.displayName}
              onChange={(event) => setProfileForm({ ...profileForm, displayName: event.target.value })}
            />
          </Field>

          <TwoColumnFields>
            <Field label="Activity level">
              <input
                value={profileForm.activityLevel}
                onChange={(event) => setProfileForm({ ...profileForm, activityLevel: event.target.value })}
              />
            </Field>
            <Field label="Height (cm)">
              <input
                min="0"
                type="number"
                value={profileForm.heightCm}
                onChange={(event) => setProfileForm({ ...profileForm, heightCm: event.target.value })}
              />
            </Field>
            <Field label="Daily calories">
              <input
                min="0"
                type="number"
                value={profileForm.calorieGoal}
                onChange={(event) => setProfileForm({ ...profileForm, calorieGoal: event.target.value })}
              />
            </Field>
            <Field label="Protein goal (g)">
              <input
                min="0"
                type="number"
                value={profileForm.proteinGoalGrams}
                onChange={(event) =>
                  setProfileForm({ ...profileForm, proteinGoalGrams: event.target.value })
                }
              />
            </Field>
            <Field label="Carb goal (g)">
              <input
                min="0"
                type="number"
                value={profileForm.carbGoalGrams}
                onChange={(event) => setProfileForm({ ...profileForm, carbGoalGrams: event.target.value })}
              />
            </Field>
            <Field label="Fat goal (g)">
              <input
                min="0"
                type="number"
                value={profileForm.fatGoalGrams}
                onChange={(event) => setProfileForm({ ...profileForm, fatGoalGrams: event.target.value })}
              />
            </Field>
          </TwoColumnFields>

          <Field label="Goal summary">
            <textarea
              rows={3}
              value={profileForm.goalSummary}
              onChange={(event) => setProfileForm({ ...profileForm, goalSummary: event.target.value })}
            />
          </Field>

          <Field label="Notes">
            <textarea
              rows={3}
              value={profileForm.notes}
              onChange={(event) => setProfileForm({ ...profileForm, notes: event.target.value })}
            />
          </Field>

          <div className="panel-actions panel-actions-spread">
            <button className="ghost-button" onClick={handleLogout} type="button">
              Sign out
            </button>
            <button className="primary-button" disabled={profileSaving} type="submit">
              {profileSaving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      </OverlayPanel>
    </main>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TwoColumnFields({ children }: { children: ReactNode }) {
  return <div className="two-column-grid">{children}</div>;
}

function FileUploadControl({
  accept,
  files,
  inputRef,
  onChange
}: {
  accept: string;
  files: File[];
  inputRef: RefObject<HTMLInputElement>;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const status =
    files.length === 0
      ? "No files selected"
      : files.length === 1
        ? files[0].name
        : `${files.length} files selected`;

  return (
    <div className="file-upload-control">
      <input
        ref={inputRef}
        accept={accept}
        className="visually-hidden-file-input"
        multiple
        type="file"
        onChange={onChange}
      />
      <button className="file-upload-button" onClick={() => inputRef.current?.click()} type="button">
        Choose files
      </button>
      <span className="file-upload-status" title={files.map((file) => file.name).join(", ") || status}>
        {status}
      </span>
    </div>
  );
}


function SnapshotTile({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="snapshot-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function DailyTrendChart({
  points,
  goalCalories,
  baseGoalCalories,
  workoutCaloriesToday
}: {
  points: NutritionSummary["dailyCalories"];
  goalCalories?: number | null;
  baseGoalCalories?: number | null;
  workoutCaloriesToday: number;
}) {
  if (points.length === 0) {
    return <p className="empty-state">No calorie data yet.</p>;
  }

  const chartMax = Math.max(...points.map((point) => point.calories), goalCalories ?? 0, 1);
  const goalLinePercent =
    goalCalories && goalCalories > 0 ? Math.min(100, Math.round((goalCalories / chartMax) * 100)) : null;

  return (
    <div className="trend-chart-shell">
      {goalCalories ? (
        <div className="chart-context">
          <p className="trend-target-note">
            Adjusted target: {goalCalories} kcal
            {baseGoalCalories
              ? ` (${baseGoalCalories} base + ${workoutCaloriesToday} workout burn today)`
              : ""}
          </p>
          <div className="chart-legend" aria-label="Calorie chart legend">
            <span><i className="legend-swatch consumed" /> Consumed</span>
            <span><i className="legend-swatch target" /> Adjusted target</span>
          </div>
        </div>
      ) : null}
      <div className="trend-bars">
        {points.map((point) => {
          const height = point.calories === 0 ? 0 : Math.max(16, Math.round((point.calories / chartMax) * 100));
          const style = { height: `${height}%` } as CSSProperties;

          return (
            <div className="trend-column" key={point.date}>
              <div className="trend-track">
                {goalLinePercent !== null ? (
                  <div className="trend-goal-line" style={{ bottom: `${goalLinePercent}%` }} />
                ) : null}
                <div className="trend-fill" style={style} />
              </div>
              <strong>{point.calories}</strong>
              <span>{formatDateKeyShortDay(point.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeightTrendChart({ points }: { points: HealthMetric[] }) {
  if (points.length === 0) {
    return <p className="empty-state">No weight data yet.</p>;
  }

  const weights = points.map((point) => point.weightKg ?? 0);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const width = 560;
  const height = 210;
  const paddingX = 28;
  const paddingY = 20;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;
  const labelGridStyle = {
    gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`
  } satisfies CSSProperties;

  const coordinates = points.map((point, index) => {
    const weight = point.weightKg ?? minWeight;
    const x =
      points.length === 1
        ? width / 2
        : paddingX + (index / (points.length - 1)) * usableWidth;
    const y =
      maxWeight === minWeight
        ? height / 2
        : height - paddingY - ((weight - minWeight) / (maxWeight - minWeight)) * usableHeight;

    return { id: point.id, recordedAt: point.recordedAt, x, y };
  });

  const pathData = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div className="weight-chart">
      <svg
        aria-hidden="true"
        className="weight-chart-plot"
        viewBox={`0 0 ${width} ${height}`}
      >
        {[0, 1, 2, 3].map((lineIndex) => {
          const y = paddingY + (usableHeight / 3) * lineIndex;
          return (
            <line
              className="weight-chart-grid"
              key={lineIndex}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
            />
          );
        })}
        {coordinates.length > 1 ? <path className="weight-chart-line" d={pathData} /> : null}
        {coordinates.map((point, index) => {
          const labelY = Math.max(point.y - 10, paddingY + 12);

          return (
            <text
              className="weight-chart-value"
              key={`${point.id}-value`}
              textAnchor="middle"
              x={point.x}
              y={labelY}
            >
              {kgToLbs(weights[index]).toFixed(1)}
            </text>
          );
        })}
        {coordinates.map((point) => (
          <circle
            className="weight-chart-point"
            cx={point.x}
            cy={point.y}
            key={point.id}
            r="4"
          />
        ))}
      </svg>
      <div className="weight-chart-labels" style={labelGridStyle}>
        {points.map((point) => (
          <small key={point.id}>{formatShortDay(point.recordedAt)}</small>
        ))}
      </div>
    </div>
  );
}

function OverlayPanel({
  open,
  onClose,
  title,
  description,
  children,
  variant
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
  variant: "dialog" | "drawer";
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="overlay-shell" onClick={onClose} role="presentation">
      <section
        aria-label={title}
        aria-modal="true"
        className={`overlay-panel ${variant === "drawer" ? "drawer-panel" : "dialog-panel"}`}
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="overlay-panel-header">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            Close
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
