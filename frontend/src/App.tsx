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
  BootstrapStatus,
  HealthMetric,
  Meal,
  NutritionSummary,
  ProfileData,
  SavedFood,
  SessionData
} from "./types";

type AuthMode = "login" | "register";

type MealTemplateResult =
  | {
      key: string;
      kind: "meal";
      title: string;
      subtitle: string;
      detail: string;
      searchText: string;
      meal: Meal;
    }
  | {
      key: string;
      kind: "savedFood";
      title: string;
      subtitle: string;
      detail: string;
      searchText: string;
      food: SavedFood;
    };

const defaultWeightForm = () => ({
  recordedAt: "",
  weightLbs: ""
});

const defaultMealForm = () => ({
  title: "",
  notes: "",
  eatenAt: "",
  servingDescription: "",
  quantity: "",
  weightGrams: "",
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

const formatShortDay = (value: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(value));

const KG_PER_LB = 0.45359237;

const kgToLbs = (value: number) => value / KG_PER_LB;

const lbsToKg = (value: number) => value * KG_PER_LB;

const formatWeightValue = (value: number | null | undefined) =>
  value === null || value === undefined ? null : kgToLbs(value).toFixed(1);

const formatWeight = (value: number | null | undefined) => {
  const formatted = formatWeightValue(value);
  return formatted ? `${formatted} lb` : "No weight";
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

export function App() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);
  const [globalError, setGlobalError] = useState("");
  const [globalNotice, setGlobalNotice] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [isMealModalOpen, setIsMealModalOpen] = useState(false);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [nutritionSummary, setNutritionSummary] = useState<NutritionSummary | null>(null);
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: ""
  });
  const [registerForm, setRegisterForm] = useState({
    displayName: "",
    email: "",
    password: "",
    goalSummary: "",
    calorieGoal: ""
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

  const [mealForm, setMealForm] = useState(defaultMealForm);
  const [mealSearchQuery, setMealSearchQuery] = useState("");
  const [mealTemplateLabel, setMealTemplateLabel] = useState<string | null>(null);
  const [plateFiles, setPlateFiles] = useState<File[]>([]);
  const [labelFiles, setLabelFiles] = useState<File[]>([]);
  const [otherFiles, setOtherFiles] = useState<File[]>([]);
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

  async function loadSession() {
    try {
      const nextSession = await apiFetch<SessionData>("/auth/session");
      if (nextSession.authenticated) {
        setRegistrationOpen(false);
        setAuthMode("login");
      } else {
        const bootstrapStatus = await apiFetch<BootstrapStatus>("/auth/bootstrap-status");
        setRegistrationOpen(bootstrapStatus.registrationOpen);
        setAuthMode(bootstrapStatus.registrationOpen ? "register" : "login");
      }
      setSession(nextSession);
    } catch (error) {
      setGlobalError(getApiErrorMessage(error));
      setSession({ authenticated: false });
      setRegistrationOpen(false);
    }
  }

  async function loadDashboard() {
    setDashboardLoading(true);
    setGlobalError("");

    try {
      const [profileResponse, metricsResponse, summaryResponse, foodsResponse, mealsResponse] =
        await Promise.all([
          apiFetch<ProfileData>("/profile/me"),
          apiFetch<{ metrics: HealthMetric[] }>("/profile/me/health-metrics?limit=12"),
          apiFetch<NutritionSummary>("/nutrition/summary"),
          apiFetch<{ foods: SavedFood[] }>("/nutrition/saved-foods"),
          apiFetch<{ meals: Meal[] }>("/nutrition/meals?limit=24")
        ]);

      startTransition(() => {
        setProfileData(profileResponse);
        setHealthMetrics(metricsResponse.metrics);
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
      let nextSession: SessionData;

      if (authMode === "register") {
        nextSession = await apiFetch<SessionData>("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            displayName: registerForm.displayName,
            email: registerForm.email,
            password: registerForm.password,
            goalSummary: registerForm.goalSummary || undefined,
            calorieGoal: toOptionalNumber(registerForm.calorieGoal)
          })
        });
      } else {
        nextSession = await apiFetch<SessionData>("/auth/login", {
          method: "POST",
          body: JSON.stringify(loginForm)
        });
      }

      setSession(nextSession);
      setRegistrationOpen(false);
      setAuthMode("login");
      setGlobalNotice(authMode === "register" ? "Account created and signed in." : "Signed in.");
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
      setRegistrationOpen(false);
      setAuthMode("login");
      setGlobalNotice("Signed out.");
      setProfileData(null);
      setHealthMetrics([]);
      setNutritionSummary(null);
      setSavedFoods([]);
      setMeals([]);
      setIsMealModalOpen(false);
      setIsWeightModalOpen(false);
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

  async function handleMealSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMealSaving(true);
    setGlobalError("");
    setGlobalNotice("");

    try {
      const formData = new FormData();
      formData.append("title", mealForm.title);
      if (mealForm.notes) formData.append("notes", mealForm.notes);
      if (mealForm.eatenAt) formData.append("eatenAt", new Date(mealForm.eatenAt).toISOString());
      if (mealForm.servingDescription) formData.append("servingDescription", mealForm.servingDescription);
      if (mealForm.quantity) formData.append("quantity", mealForm.quantity);
      if (mealForm.weightGrams) formData.append("weightGrams", mealForm.weightGrams);
      if (mealForm.savedFoodId) formData.append("savedFoodId", mealForm.savedFoodId);
      formData.append("saveAsReusableFood", String(mealForm.saveAsReusableFood));
      plateFiles.forEach((file) => formData.append("plateImages", file));
      labelFiles.forEach((file) => formData.append("labelImages", file));
      otherFiles.forEach((file) => formData.append("otherImages", file));

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
    setMealForm(defaultMealForm());
    setPlateFiles([]);
    setLabelFiles([]);
    setOtherFiles([]);

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

  function applySavedFoodTemplate(food: SavedFood) {
    resetMealComposer();

    setMealForm({
      ...defaultMealForm(),
      savedFoodId: food.id,
      title: food.name,
      servingDescription: food.servingDescription ?? "",
      weightGrams: valueToInput(food.servingWeightGrams)
    });
    setMealSearchQuery(food.name);
    setMealTemplateLabel(food.brand ? `${food.name} · ${food.brand}` : food.name);
  }

  function applyMealTemplate(meal: Meal) {
    resetMealComposer();

    setMealForm({
      ...defaultMealForm(),
      title: meal.title,
      notes: meal.notes ?? "",
      servingDescription: meal.servingDescription ?? "",
      quantity: valueToInput(meal.quantity),
      weightGrams: valueToInput(meal.weightGrams),
      savedFoodId: meal.savedFood?.id ?? ""
    });
    setMealSearchQuery(meal.title);
    setMealTemplateLabel(meal.title);
  }

  const currentMemberName = session?.member?.displayName ?? "User";
  const currentMemberInitials = getInitials(currentMemberName);
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
  const mealTemplates: MealTemplateResult[] = [
    ...meals.map((meal) => ({
      key: `meal-${meal.id}`,
      kind: "meal" as const,
      title: meal.title,
      subtitle: meal.servingDescription ?? "Recent meal",
      detail: `Last logged ${formatDateTime(meal.eatenAt)}${meal.estimatedCalories ? ` · ${meal.estimatedCalories} kcal` : ""}`,
      searchText: [
        meal.title,
        meal.notes,
        meal.servingDescription,
        meal.savedFood?.name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      meal
    })),
    ...savedFoods.map((food) => ({
      key: `saved-food-${food.id}`,
      kind: "savedFood" as const,
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

  const weightTrend = healthMetrics.filter((metric) => metric.weightKg !== null).slice().reverse();
  const weightTrendPoints = weightTrend.slice(-6);
  const latestWeight = healthMetrics.find((metric) => metric.weightKg !== null) ?? null;
  const weightDelta = getWeightDelta(healthMetrics);

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
        <section className="hero">
          <p className="eyebrow">Private health coach</p>
          <h1>Track meals, weight, and daily progress in one place.</h1>
          <p className="subtitle">
            This app is private and protected by email and password. Log meals with photos, keep a
            reusable meal library, and start with simple weight tracking.
          </p>

          <div className="feature-grid">
            <Card className="feature-card">
              <h2>Daily dashboard</h2>
              <p>See calories, macros, weight, and short-term trends at a glance.</p>
            </Card>
            <Card className="feature-card">
              <h2>Reusable meal flow</h2>
              <p>Save a meal while logging it so the next entry starts faster.</p>
            </Card>
            <Card className="feature-card">
              <h2>Private account</h2>
              <p>Your data stays inside a single personal account instead of a shared workspace.</p>
            </Card>
          </div>
        </section>

        <Card className="auth-card">
          <div className="segmented-control">
            <button
              type="button"
              className={authMode === "login" ? "active" : ""}
              onClick={() => setAuthMode("login")}
            >
              Sign In
            </button>
            {registrationOpen ? (
              <button
                type="button"
                className={authMode === "register" ? "active" : ""}
                onClick={() => setAuthMode("register")}
              >
                Create Account
              </button>
            ) : null}
          </div>

          {globalError && <p className="status-banner error">{globalError}</p>}
          {globalNotice && <p className="status-banner success">{globalNotice}</p>}
          {!registrationOpen ? (
            <p className="list-item-copy">
              Account setup is complete. Sign in with the email and password you already created.
            </p>
          ) : null}

          <form className="form-stack" onSubmit={handleAuthSubmit}>
            {authMode === "login" && (
              <>
                <Field label="Email">
                  <input
                    required
                    type="email"
                    value={loginForm.email}
                    onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                  />
                </Field>
                <Field label="Password">
                  <input
                    required
                    type="password"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                  />
                </Field>
              </>
            )}

            {authMode === "register" && (
              <>
                <Field label="Your name">
                  <input
                    required
                    value={registerForm.displayName}
                    onChange={(event) =>
                      setRegisterForm({ ...registerForm, displayName: event.target.value })
                    }
                  />
                </Field>
                <Field label="Email">
                  <input
                    required
                    type="email"
                    value={registerForm.email}
                    onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })}
                  />
                </Field>
                <Field label="Password">
                  <input
                    required
                    type="password"
                    value={registerForm.password}
                    onChange={(event) =>
                      setRegisterForm({ ...registerForm, password: event.target.value })
                    }
                  />
                </Field>
                <Field label="Goal summary">
                  <textarea
                    rows={3}
                    value={registerForm.goalSummary}
                    onChange={(event) =>
                      setRegisterForm({ ...registerForm, goalSummary: event.target.value })
                    }
                  />
                </Field>
                <Field label="Daily calorie goal">
                  <input
                    type="number"
                    min="0"
                    value={registerForm.calorieGoal}
                    onChange={(event) =>
                      setRegisterForm({ ...registerForm, calorieGoal: event.target.value })
                    }
                  />
                </Field>
              </>
            )}

            <button className="primary-button" disabled={authLoading} type="submit">
              {authLoading ? "Working..." : authMode === "register" ? "Create account" : "Sign in"}
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
            className="secondary-button weight-log-button"
            onClick={() => setIsWeightModalOpen(true)}
            type="button"
          >
            Log weight
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

        <div className="dashboard-trend-row">
          <Card className="trend-card compact-card">
            <SectionHeading
              title="7-day calorie trend"
              description={`${weeklyAverageCalories} kcal per day average`}
            />
            <DailyTrendChart goalCalories={calorieGoal} points={calorieTrend} />
          </Card>

          <Card className="trend-card compact-card">
            <SectionHeading
              title="Weight trend"
              description={latestWeight ? `Updated ${formatDate(latestWeight.recordedAt)}` : "No entries yet"}
            />
            <WeightTrendChart points={weightTrendPoints} />
          </Card>
        </div>
      </div>

      <OverlayPanel
        description="Search an existing meal or reusable food, or choose New meal before editing the details."
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
            title="Find a saved meal"
            description="Search recent meals or reusable foods, then use one as a starting point. Choose New meal to clear the form."
          />

          <div className="template-toolbar">
            <Field label="Search saved meals">
              <input
                placeholder="Search meals you have already logged"
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
                      <span className="template-badge">
                        {template.kind === "meal" ? "Meal" : "Reusable"}
                      </span>
                    </div>
                    <span>{template.subtitle}</span>
                    <small>{template.detail}</small>
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() =>
                      template.kind === "meal"
                        ? applyMealTemplate(template.meal)
                        : applySavedFoodTemplate(template.food)
                    }
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
                : "Enter a brand new meal below, or search above to load an existing one first."}
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
                placeholder="1 bowl, 2 slices, 1 shake"
                value={mealForm.servingDescription}
                onChange={(event) =>
                  setMealForm({ ...mealForm, servingDescription: event.target.value })
                }
              />
            </Field>
            <Field label="Quantity">
              <input
                min="0"
                step="0.1"
                type="number"
                value={mealForm.quantity}
                onChange={(event) => setMealForm({ ...mealForm, quantity: event.target.value })}
              />
            </Field>
            <Field label="Weight (g)">
              <input
                min="0"
                step="0.1"
                type="number"
                value={mealForm.weightGrams}
                onChange={(event) => setMealForm({ ...mealForm, weightGrams: event.target.value })}
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
            <Field label="Plate photos">
              <input
                ref={plateInputRef}
                accept="image/*"
                multiple
                type="file"
                onChange={(event) => handleFileChange(event, setPlateFiles)}
              />
              <FileSummary files={plateFiles} />
            </Field>
            <Field label="Label photos">
              <input
                ref={labelInputRef}
                accept="image/*"
                multiple
                type="file"
                onChange={(event) => handleFileChange(event, setLabelFiles)}
              />
              <FileSummary files={labelFiles} />
            </Field>
            <Field label="Other photos">
              <input
                ref={otherInputRef}
                accept="image/*"
                multiple
                type="file"
                onChange={(event) => handleFileChange(event, setOtherFiles)}
              />
              <FileSummary files={otherFiles} />
            </Field>
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
            <button className="primary-button" disabled={mealSaving} type="submit">
              {mealSaving ? "Analyzing..." : "Save meal"}
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
              <span>{formatShortDay(point.date)}</span>
              <small>{point.mealCount} meal{point.mealCount === 1 ? "" : "s"}</small>
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
