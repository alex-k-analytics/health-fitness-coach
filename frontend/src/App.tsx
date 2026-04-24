import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  startTransition,
  useEffect,
  useRef,
  useState
} from "react";
import { ApiError, apiFetch } from "./api";
import { Card } from "./components/Card";
import type {
  Meal,
  NutritionEstimate,
  NutritionSummary,
  ProfileData,
  SavedFood,
  SessionData
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

const defaultMealForm = () => ({
  title: "",
  notes: "",
  eatenAt: "",
  servingDescription: "",
  quantity: "1",
  savedFoodId: "",
  saveAsReusableFood: false
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

export function App() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [globalError, setGlobalError] = useState("");
  const [globalNotice, setGlobalNotice] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [isMealModalOpen, setIsMealModalOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [nutritionSummary, setNutritionSummary] = useState<NutritionSummary | null>(null);
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);

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
    if (!session?.authenticated) {
      return;
    }

    void loadDashboard();
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
      setSession(nextSession);
    } catch (error) {
      setGlobalError(getApiErrorMessage(error));
      setSession({ authenticated: false });
    }
  }

  async function loadDashboard() {
    setDashboardLoading(true);
    setGlobalError("");

    try {
      const [profileResponse, summaryResponse, foodsResponse, mealsResponse] =
        await Promise.all([
          apiFetch<ProfileData>("/profile/me"),
          apiFetch<NutritionSummary>(
            `/nutrition/summary?timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`
          ),
          apiFetch<{ foods: SavedFood[] }>("/nutrition/saved-foods"),
          apiFetch<{ meals: Meal[] }>("/nutrition/meals?limit=24")
        ]);

      startTransition(() => {
        setProfileData(profileResponse);
        setNutritionSummary(summaryResponse);
        setSavedFoods(foodsResponse.foods);
        setMeals(mealsResponse.meals);
      });
    } catch (error) {
      setGlobalError(getApiErrorMessage(error));
    } finally {
      setDashboardLoading(false);
    }
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
      setSession(nextSession);
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
      setSession({ authenticated: false });
      setGlobalNotice("Signed out.");
      setProfileData(null);
      setNutritionSummary(null);
      setSavedFoods([]);
      setMeals([]);
      setMealEstimate(null);
      setIsMealModalOpen(false);
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
    proteinGrams: 0,
    carbsGrams: 0,
    fatGrams: 0
  };
  const calorieGoal = nutritionSummary?.goals?.calorieGoal ?? profileData?.profile.calorieGoal ?? null;
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
  const displayedMeals = meals.slice(0, 3);

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
        <div className="dashboard-top-row">
          <Card className="compact-card summary-card">
            <div className="summary-card-header">
              <div>
                <p className="eyebrow">Today</p>
                <h2>Daily snapshot</h2>
              </div>
              <span className="status-chip">
                {dashboardLoading
                  ? "Refreshing"
                  : `${todaySummary.mealCount} meal${todaySummary.mealCount === 1 ? "" : "s"}`}
              </span>
            </div>

            <div className="summary-metrics-grid">
              <section className="summary-metric-block">
                <span className="summary-label">Calories today</span>
                <strong>{todaySummary.calories}</strong>
                <small>{calorieGoal ? `${calorieProgress}% of goal` : "Goal not set"}</small>
              </section>

              <section className="summary-metric-block">
                <span className="summary-label">Protein today</span>
                <strong>{todaySummary.proteinGrams}g</strong>
                <small>
                  {nutritionSummary?.goals?.proteinGoalGrams
                    ? `${getProgressPercent(todaySummary.proteinGrams, nutritionSummary.goals.proteinGoalGrams)}% of goal`
                    : "Goal not set"}
                </small>
              </section>
            </div>

            <div className="overview-progress">
              <div className="progress-copy">
                <strong>{calorieGoal ? `${calorieProgress}% of goal` : "Goal not set"}</strong>
                <span>{calorieBalance}</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${calorieProgress}%` }} />
              </div>
            </div>
          </Card>

          <Card className="compact-card meals-card">
            <SectionHeading title="Last 3 meals" description="Most recent logs" />
            {dashboardLoading ? (
              <p className="empty-state">Refreshing meals…</p>
            ) : meals.length === 0 ? (
              <div className="empty-panel">
                <p className="empty-state">No meals logged yet.</p>
                <button className="secondary-button" onClick={() => openMealComposer()} type="button">
                  Log your first meal
                </button>
              </div>
            ) : (
              <div className="meal-list compact-meal-list">
                {displayedMeals.map((meal) => {
                  const mealStateTag = getMealStateTag(meal.analysisStatus);

                  return (
                    <article className="meal-item compact-meal-item" key={meal.id}>
                      <div className="meal-item-header">
                        <div className="meal-row-copy">
                          <strong>{meal.title}</strong>
                          <p className="list-item-copy">{formatDateTime(meal.eatenAt)}</p>
                        </div>
                        <div className="meal-row-side">
                          <strong className="meal-calories">
                            {meal.estimatedCalories ? `${meal.estimatedCalories} kcal` : "No calories"}
                          </strong>
                          <button className="inline-action-button" onClick={() => openMealEditor(meal)} type="button">
                            Edit
                          </button>
                          {mealStateTag ? (
                            <span className={`tag ${mealStateTag.tone}`}>{mealStateTag.label}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="macro-pills compact-pills">
                        {meal.servingDescription ? <span className="pill">{meal.servingDescription}</span> : null}
                        {meal.images.length ? (
                          <span className="pill">
                            {meal.images.length} photo{meal.images.length === 1 ? "" : "s"}
                          </span>
                        ) : null}
                        {meal.savedFood ? <span className="tag subtle">Reusable base</span> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="dashboard-trend-row single-trend-row">
          <Card className="trend-card compact-card">
            <SectionHeading
              title="7-day calorie trend"
              description={`${weeklyAverageCalories} kcal per day average`}
            />
            <DailyTrendChart goalCalories={calorieGoal} points={calorieTrend} />
          </Card>
        </div>
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
            <button className="secondary-button template-new-button" onClick={startNewMeal} type="button">
              New meal
            </button>
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
                min="0.1"
                step="0.1"
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
            <Field label="Food photos">
              <input
                ref={plateInputRef}
                accept="image/*"
                capture="environment"
                multiple
                type="file"
                onChange={(event) => handleFileChange(event, setPlateFiles)}
              />
              <p className="input-help">Take a picture of the meal or upload one from your camera roll.</p>
              <FileSummary files={plateFiles} />
            </Field>
            <Field label="Nutrition label photos">
              <input
                ref={labelInputRef}
                accept="image/*"
                multiple
                type="file"
                onChange={(event) => handleFileChange(event, setLabelFiles)}
              />
              <p className="input-help">
                Add package labels or screenshots of digital nutrition facts.
              </p>
              <FileSummary files={labelFiles} />
            </Field>
            <Field label="Extra reference images">
              <input
                ref={otherInputRef}
                accept="image/*"
                multiple
                type="file"
                onChange={(event) => handleFileChange(event, setOtherFiles)}
              />
              <p className="input-help">Use this for menus, ingredient lists, or anything else that helps.</p>
              <FileSummary files={otherFiles} />
            </Field>
          </div>

          <div className={`analysis-preview ${mealEstimate ? "" : "empty"}`}>
            <SectionHeading
              title="Nutrition preview"
              description="Estimate one serving with ChatGPT, then adjust Servings to scale what gets saved."
            />

            {displayedMealEstimate ? (
              <>
                <div className="analysis-preview-header">
                  <span className={`tag ${displayedMealEstimate.status === "COMPLETED" ? "" : "subtle"}`}>
                    {displayedMealEstimate.status === "COMPLETED" ? "AI estimate" : "Fallback estimate"}
                  </span>
                  <span className="list-item-copy">
                    {getServingCount(mealForm.quantity)} serving
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
                Add a meal title plus a food photo, label screenshot, or reusable food, then click{" "}
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
              {mealEstimating ? "Estimating..." : "Estimate nutrition"}
            </button>
            <button className="primary-button" disabled={mealSaving || !mealEstimate} type="submit">
              {mealSaving ? "Saving..." : "Save meal"}
            </button>
          </div>
        </form>
      </OverlayPanel>

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

function FileSummary({ files }: { files: File[] }) {
  if (files.length === 0) {
    return <p className="input-help">No files selected.</p>;
  }

  return (
    <p className="input-help">
      {files.length} file{files.length > 1 ? "s" : ""}: {files.map((file) => file.name).join(", ")}
    </p>
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
  goalCalories
}: {
  points: NutritionSummary["dailyCalories"];
  goalCalories?: number | null;
}) {
  if (points.length === 0) {
    return <p className="empty-state">No meal data yet.</p>;
  }

  const chartMax = Math.max(...points.map((point) => point.calories), goalCalories ?? 0, 1);
  const goalLinePercent =
    goalCalories && goalCalories > 0 ? Math.min(100, Math.round((goalCalories / chartMax) * 100)) : null;

  return (
    <div className="trend-chart-shell">
      {goalCalories ? <p className="trend-target-note">Target: {goalCalories} kcal</p> : null}
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
              <small>{point.mealCount} meal{point.mealCount === 1 ? "" : "s"}</small>
            </div>
          );
        })}
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
