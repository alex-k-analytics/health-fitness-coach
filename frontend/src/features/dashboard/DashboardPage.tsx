import { Link } from "@tanstack/react-router";
import type { ComponentType, ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useNutritionSummaryQuery } from "@/features/dashboard/hooks";
import { useHealthMetricsQuery, useProfileQuery } from "@/features/settings/hooks";
import { useMealsQuery } from "@/features/meals/hooks";
import { useWorkoutSessionsQuery } from "@/features/workouts/hooks";
import {
  useMealPlanRunQuery,
  useMealPlanRunsQuery,
  useMealPlanStatusQuery,
  useRecipeSourcesQuery
} from "@/features/planning/hooks";
import {
  formatDate,
  formatDateTime,
  formatMacroValue,
  formatWeight,
  getProgressPercent,
  kgToLbs
} from "@/lib/mealUtils";
import { getPlanningSourceReadiness } from "@/lib/recipeSources";
import { MealComposer } from "@/features/meals/MealComposer";
import { WorkoutSessionModal } from "@/components/workouts/WorkoutSessionModal";
import { WeightModal } from "@/components/shell/WeightModal";
import { MealCard } from "@/components/shared/MealCard";
import { WorkoutCard } from "@/components/shared/WorkoutCard";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Dumbbell,
  Flame,
  Plus,
  Scale,
  ShoppingBasket,
  Sparkles,
  UtensilsCrossed
} from "lucide-react";
import type {
  HealthMetric,
  Meal,
  MealPlanRunSummary,
  NutritionSummary
} from "@/types";

type PlanningStatus = MealPlanRunSummary["status"];
const DASHBOARD_TODAY_MEAL_LIMIT = 5;

export function DashboardPage() {
  const { data: nutritionSummary, isLoading: loadingNutrition } =
    useNutritionSummaryQuery();
  const { data: profile } = useProfileQuery();
  const { data: healthMetrics, isLoading: loadingMetrics } =
    useHealthMetricsQuery(12);
  const { data: meals, isLoading: loadingMeals } = useMealsQuery(60);
  const { data: sessions, isLoading: loadingSessions } =
    useWorkoutSessionsQuery(8);
  const { data: planningRuns, isLoading: loadingPlanningRuns } =
    useMealPlanRunsQuery();
  const { data: recipeSources, isLoading: loadingRecipeSources } =
    useRecipeSourcesQuery();

  const selectedRunSummary = selectDashboardPlanningRun(planningRuns?.runs ?? []);
  const selectedRunId = selectedRunSummary?.id ?? null;
  const runIsActive =
    selectedRunSummary?.status === "PENDING" ||
    selectedRunSummary?.status === "RUNNING";
  const { data: selectedRunDetail, isLoading: loadingSelectedRun } =
    useMealPlanRunQuery(selectedRunId);
  const { data: livePlanningStatus } = useMealPlanStatusQuery(
    selectedRunId,
    Boolean(selectedRunId && runIsActive)
  );

  const mealHistory = meals?.meals ?? [];
  const fallbackToday = buildTodayNutritionSummary(mealHistory);
  const todaySummary = nutritionSummary?.today ?? fallbackToday;
  const calorieGoal =
    nutritionSummary?.goals?.adjustedCalorieGoal ??
    nutritionSummary?.goals?.calorieGoal ??
    profile?.profile.calorieGoal ??
    null;
  const baseCalorieGoal =
    nutritionSummary?.goals?.baseCalorieGoal ??
    profile?.profile.calorieGoal ??
    null;
  const calorieProgress =
    calorieGoal && todaySummary
      ? getProgressPercent(todaySummary.calories, calorieGoal)
      : 0;
  const caloriesRemaining = calorieGoal
    ? Math.max(0, calorieGoal - (todaySummary?.calories ?? 0))
    : null;
  const calorieOverage =
    calorieGoal && (todaySummary?.calories ?? 0) > calorieGoal
      ? (todaySummary?.calories ?? 0) - calorieGoal
      : 0;
  const calorieBalanceValue = !calorieGoal
    ? "-"
    : calorieOverage > 0
      ? `${calorieOverage} cal over`
      : `${caloriesRemaining} cal left`;
  const calorieBalanceSub = calorieGoal
    ? `${todaySummary?.calories ?? 0} of ${calorieGoal} cal`
    : "Set a calorie goal";
  const calorieBalance = !calorieGoal
    ? "Goal not set"
    : (todaySummary?.calories ?? 0) <= calorieGoal
      ? `${calorieGoal - (todaySummary?.calories ?? 0)} cal left`
      : `${(todaySummary?.calories ?? 0) - calorieGoal} cal over`;
  const calorieTrend = nutritionSummary?.dailyCalories?.length
    ? nutritionSummary.dailyCalories
    : buildDailyCaloriesFromMeals(mealHistory);
  const weeklyAverage =
    calorieTrend.length > 0
      ? Math.round(
          calorieTrend.reduce((sum, d) => sum + d.calories, 0) /
            calorieTrend.length
        )
      : 0;

  const weightPoints = (healthMetrics?.metrics ?? []).filter(
    (m) => m.weightKg != null
  );
  const latestWeight = weightPoints[0] ?? null;
  const weightTrendPoints = weightPoints.slice(0, 6).reverse();
  const weightDelta =
    weightPoints.length >= 2
      ? Math.round(
          (((weightPoints[0].weightKg ?? 0) -
            (weightPoints[1].weightKg ?? 0)) /
            0.45359237) *
            10
        ) / 10
      : null;

  const activePlan = selectedRunDetail?.plan ?? null;
  const planningStatus =
    livePlanningStatus ?? selectedRunDetail ?? selectedRunSummary ?? null;
  const sourceReadiness = getPlanningSourceReadiness(recipeSources?.sources ?? []);
  const sourceReady = sourceReadiness.ready;
  const planningLoading =
    loadingPlanningRuns ||
    loadingRecipeSources ||
    (Boolean(selectedRunId) && loadingSelectedRun);
  const groceryTotal = activePlan?.groceryList.length ?? 0;
  const checkedItems = selectedRunId ? loadCheckedItems(selectedRunId) : new Set<string>();
  const groceryChecked =
    activePlan?.groceryList.filter((item) =>
      checkedItems.has(groceryItemKey(item))
    ).length ?? 0;
  const groceryRemaining = Math.max(0, groceryTotal - groceryChecked);
  const selectedMeals = activePlan?.selectedMeals ?? [];
  const planAction = getPlanningAction({
    hasRun: Boolean(selectedRunSummary),
    sourceReady,
    status: planningStatus?.status ?? null,
    hasPlan: Boolean(activePlan),
    groceryRemaining
  });

  const todayMeals = mealHistory.filter((meal) => isTodayMeal(meal));
  const displayedMeals = todayMeals.slice(0, DASHBOARD_TODAY_MEAL_LIMIT);
  const todayMealCount = todaySummary?.mealCount ?? todayMeals.length;
  const hiddenTodayMealCount = Math.max(0, todayMealCount - displayedMeals.length);
  const latestMeal = mealHistory[0] ?? null;
  const workoutSessions = sessions?.sessions ?? [];
  const displayedWorkouts = workoutSessions.slice(0, 3);
  const todayWorkoutBurn = todaySummary?.caloriesBurned ?? 0;
  const macroSummaries = [
    {
      label: "Protein",
      value: todaySummary?.proteinGrams ?? 0,
      goal: nutritionSummary?.goals?.proteinGoalGrams ?? profile?.profile.proteinGoalGrams ?? null
    },
    {
      label: "Carbs",
      value: todaySummary?.carbsGrams ?? 0,
      goal: nutritionSummary?.goals?.carbGoalGrams ?? profile?.profile.carbGoalGrams ?? null
    },
    {
      label: "Fat",
      value: todaySummary?.fatGrams ?? 0,
      goal: nutritionSummary?.goals?.fatGoalGrams ?? profile?.profile.fatGoalGrams ?? null
    }
  ];

  return (
    <div className="page-shell space-y-6">
      <div className="page-header">
        <div>
          <Badge variant="brand" className="mb-3 px-3 py-1 text-[11px] uppercase tracking-[0.2em]">
            Daily command center
          </Badge>
          <h1 className="page-title">Today</h1>
          <p className="page-description">
            Calories, training, weight, and weekly meal planning in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MealComposer
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Log meal
              </Button>
            }
          />
          <WorkoutSessionModal
            defaultIntent="quick"
            trigger={
              <Button size="sm" variant="outline">
                <Dumbbell className="h-4 w-4" />
                Log workout
              </Button>
            }
          />
          <WeightModal
            trigger={
              <Button size="sm" variant="outline">
                <Scale className="h-4 w-4" />
                Log weight
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loadingNutrition ? (
          <>
            <CommandMetricSkeleton />
            <CommandMetricSkeleton />
          </>
        ) : (
          <>
            <CommandMetric
              icon={Flame}
              label="Calorie balance"
              value={calorieBalanceValue}
              sub={calorieBalanceSub}
              tone={calorieGoal && (todaySummary?.calories ?? 0) > calorieGoal ? "warning" : "brand"}
            />
            <CommandMetric
              icon={Activity}
              label="Workout burn"
              value={`${todayWorkoutBurn} cal`}
              sub={baseCalorieGoal ? `${baseCalorieGoal} base goal` : "Log workouts to adjust"}
              tone="success"
            />
          </>
        )}
        {planningLoading ? (
          <CommandMetricSkeleton />
        ) : (
          <CommandMetric
            icon={ShoppingBasket}
            label="Meal plan"
            value={planningStatus ? planningStatusLabel(planningStatus.status) : "Ready"}
            sub={
              activePlan
                ? `${groceryRemaining} groceries left`
                : sourceReady
                  ? "Start this week's plan"
                  : "Connect a recipe source"
            }
            tone={planningStatusTone(planningStatus?.status)}
          />
        )}
        {loadingMetrics ? (
          <CommandMetricSkeleton />
        ) : (
          <CommandMetric
            icon={Scale}
            label="Weight"
            value={latestWeight ? formatWeight(latestWeight.weightKg) : "-"}
            sub={
              latestWeight
                ? `${formatDate(latestWeight.recordedAt)}${weightDelta != null ? ` - ${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} lb` : ""}`
                : "Log to start"
            }
          />
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="card-accent-brand">
          <CardHeader>
            <div>
              <CardTitle>Nutrition Today</CardTitle>
              <CardDescription>
                {loadingNutrition
                  ? "Loading today's food log..."
                  : `${todaySummary?.mealCount ?? 0} meal${todaySummary?.mealCount !== 1 ? "s" : ""} logged`}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {loadingNutrition ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-2 w-full" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </div>
            ) : (
              <>
                <div className="surface-muted p-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-3xl font-bold leading-none">
                        {todaySummary?.calories ?? 0}
                      </p>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        calories logged
                      </p>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {calorieGoal
                        ? `${calorieBalance} of ${calorieGoal}`
                        : "Set a calorie goal in Settings"}
                    </p>
                  </div>
                  <Progress value={calorieProgress} max={100} className="mt-4" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {macroSummaries.map((macro) => (
                    <MacroMiniCard key={macro.label} {...macro} />
                  ))}
                </div>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <MealComposer
                trigger={
                  <Button size="sm">
                    <Plus className="h-4 w-4" />
                    Log food
                  </Button>
                }
              />
              <Button size="sm" variant="outline" asChild>
                <Link to="/meals">
                  View food log
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <PlanningCommandPanel
          loading={planningLoading}
          sourceReady={sourceReady}
          status={planningStatus}
          progressDetail={planningStatus?.progressDetail ?? null}
          progressPercent={planningStatus?.progressPercent ?? 0}
          activePlan={Boolean(activePlan)}
          groceryTotal={groceryTotal}
          groceryChecked={groceryChecked}
          groceryRemaining={groceryRemaining}
          selectedMealCount={selectedMeals.length}
          selectedMeals={selectedMeals.slice(0, 3).map((meal) => meal.title)}
          scrapedCount={selectedRunDetail?.scrapedCount ?? selectedRunSummary?.scrapedCount ?? 0}
          planAction={planAction}
          sourceReadinessMessage={sourceReadiness.message}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityListCard
          title="Today's Meals"
          description={
            loadingMeals
              ? "Loading..."
              : formatTodayMealsSummary(todaySummary, todayMealCount)
          }
          action={
            <div className="flex flex-wrap gap-2">
              <MealComposer
                trigger={
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4" />
                    Log meal
                  </Button>
                }
              />
              <Button size="sm" variant="ghost" asChild>
                <Link to="/meals">
                  View log
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          }
        >
          {loadingMeals ? (
            <ActivitySkeleton />
          ) : displayedMeals.length === 0 ? (
            <TodayMealsEmptyState latestMeal={latestMeal} />
          ) : (
            <TodayMealsPreview
              meals={displayedMeals}
              hiddenCount={hiddenTodayMealCount}
              totalCount={todayMealCount}
            />
          )}
        </ActivityListCard>

        <ActivityListCard
          title="Recent Workouts"
          description={
            loadingSessions
              ? "Loading..."
              : `${workoutSessions.length} recent session${workoutSessions.length !== 1 ? "s" : ""}`
          }
          action={
            <WorkoutSessionModal
              defaultIntent="quick"
              trigger={
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                  Log workout
                </Button>
              }
            />
          }
        >
          {loadingSessions ? (
            <ActivitySkeleton />
          ) : displayedWorkouts.length === 0 ? (
            <EmptyState
              icon={Dumbbell}
              message="No workouts logged yet."
              action={
                <WorkoutSessionModal
                  defaultIntent="timer"
                  trigger={<Button size="sm">Start your first workout</Button>}
                />
              }
            />
          ) : (
            <div className="space-y-2">
              {displayedWorkouts.map((session) => (
                <WorkoutCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </ActivityListCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Calorie Trend</CardTitle>
            <CardDescription>
              {loadingNutrition ? "Loading..." : `${weeklyAverage} cal avg`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingNutrition ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <CalorieTrendChart
                points={calorieTrend}
                goalCalories={calorieGoal}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weight Trend</CardTitle>
            <CardDescription>
              {loadingMetrics
                ? "Loading..."
                : latestWeight
                  ? `Updated ${formatDate(latestWeight.recordedAt)}`
                  : "No entries"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMetrics ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <WeightTrendChart points={weightTrendPoints} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function selectDashboardPlanningRun(runs: MealPlanRunSummary[]) {
  const sorted = [...runs].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return (
    sorted.find((run) => run.status === "PENDING" || run.status === "RUNNING") ??
    sorted.find((run) => run.status === "COMPLETED") ??
    sorted[0] ??
    null
  );
}

function planningStatusLabel(status: PlanningStatus) {
  if (status === "COMPLETED") return "Plan ready";
  if (status === "FAILED") return "Needs attention";
  if (status === "RUNNING") return "Planning";
  return "Queued";
}

function planningStatusTone(status?: PlanningStatus | null) {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED") return "warning";
  if (status === "RUNNING" || status === "PENDING") return "brand";
  return "default";
}

function planningStatusVariant(status?: PlanningStatus | null) {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED") return "destructive";
  if (status === "RUNNING" || status === "PENDING") return "brand";
  return "outline";
}

function getPlanningAction({
  hasRun,
  sourceReady,
  status,
  hasPlan,
  groceryRemaining
}: {
  hasRun: boolean;
  sourceReady: boolean;
  status: PlanningStatus | null;
  hasPlan: boolean;
  groceryRemaining: number;
}) {
  if (!sourceReady) return "Set up planning";
  if (!hasRun) return "Start plan";
  if (status === "RUNNING" || status === "PENDING") return "Check status";
  if (status === "FAILED") return "Review run";
  if (hasPlan && groceryRemaining > 0) return "Open grocery list";
  if (hasPlan) return "View plan";
  return "Start plan";
}

function localStorageKey(runId: string) {
  return `meal-plan-checked-items:${runId}`;
}

function loadCheckedItems(runId: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(localStorageKey(runId));
    const values = raw ? JSON.parse(raw) : [];
    return new Set<string>(Array.isArray(values) ? values : []);
  } catch {
    return new Set<string>();
  }
}

function groceryItemKey(item: { item: string; category: string }) {
  return `${item.item.toLowerCase()}|${item.category.toLowerCase()}`;
}

function buildTodayNutritionSummary(meals: Meal[]): NutritionSummary["today"] {
  const todayKey = getLocalDateKey(new Date());
  return meals.reduce<NutritionSummary["today"]>(
    (summary, meal) => {
      if (getLocalDateKey(new Date(meal.eatenAt)) !== todayKey) return summary;

      return {
        mealCount: summary.mealCount + 1,
        calories: summary.calories + (meal.estimatedCalories ?? 0),
        caloriesBurned: 0,
        netCalories: summary.netCalories + (meal.estimatedCalories ?? 0),
        proteinGrams: summary.proteinGrams + (meal.proteinGrams ?? 0),
        carbsGrams: summary.carbsGrams + (meal.carbsGrams ?? 0),
        fatGrams: summary.fatGrams + (meal.fatGrams ?? 0)
      };
    },
    {
      mealCount: 0,
      calories: 0,
      caloriesBurned: 0,
      netCalories: 0,
      proteinGrams: 0,
      carbsGrams: 0,
      fatGrams: 0
    }
  );
}

function buildDailyCaloriesFromMeals(
  meals: Meal[]
): NutritionSummary["dailyCalories"] {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index - 6);
    return {
      date: getLocalDateKey(date),
      calories: 0,
      mealCount: 0,
      caloriesBurned: 0,
      netCalories: 0
    };
  });

  meals.forEach((meal) => {
    const day = days.find(
      (item) => item.date === getLocalDateKey(new Date(meal.eatenAt))
    );
    if (!day) return;

    day.calories += meal.estimatedCalories ?? 0;
    day.mealCount += 1;
    day.netCalories = day.calories - day.caloriesBurned;
  });

  return days.map((day) => ({
    ...day,
    calories: Math.round(day.calories),
    netCalories: Math.round(day.netCalories)
  }));
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateKeyShortDay(dateKey: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
    new Date(`${dateKey}T12:00:00`)
  );
}

function CommandMetric({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default"
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "brand" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/10 text-warning"
        : tone === "brand"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground";

  return (
    <div className="surface-panel flex min-h-24 items-start gap-3 p-4">
      <div className={`rounded-md p-2 ${toneClass}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-lg font-semibold text-foreground">{value}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {sub}
        </p>
      </div>
    </div>
  );
}

function PlanningCommandPanel({
  loading,
  sourceReady,
  status,
  progressDetail,
  progressPercent,
  activePlan,
  groceryTotal,
  groceryChecked,
  groceryRemaining,
  selectedMealCount,
  selectedMeals,
  scrapedCount,
  planAction,
  sourceReadinessMessage
}: {
  loading: boolean;
  sourceReady: boolean;
  status: { status: PlanningStatus } | null;
  progressDetail: string | null;
  progressPercent: number;
  activePlan: boolean;
  groceryTotal: number;
  groceryChecked: number;
  groceryRemaining: number;
  selectedMealCount: number;
  selectedMeals: string[];
  scrapedCount: number;
  planAction: string;
  sourceReadinessMessage: string;
}) {
  return (
    <Card className="card-accent-success">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Weekly Meal Plan</CardTitle>
            <CardDescription>
              Current plan, grocery progress, and planning status.
            </CardDescription>
          </div>
          {status ? (
            <Badge variant={planningStatusVariant(status.status)}>
              {planningStatusLabel(status.status)}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-9 w-32" />
          </div>
        ) : !sourceReady ? (
          <div className="surface-muted border-warning/30 bg-warning/10 p-4">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-4 w-4 text-warning" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Recipe source needed
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {sourceReadinessMessage}
                </p>
              </div>
            </div>
          </div>
        ) : status?.status === "RUNNING" || status?.status === "PENDING" ? (
          <div className="surface-muted p-4" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {planningStatusLabel(status.status)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {progressDetail ?? `${scrapedCount} recipes scanned`}
                  </p>
                </div>
              </div>
              <Badge variant="brand">{progressPercent}%</Badge>
            </div>
            <Progress value={progressPercent} max={100} className="mt-4 h-2" />
          </div>
        ) : activePlan ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <PlanStat
                icon={ShoppingBasket}
                label="Groceries left"
                value={String(groceryRemaining)}
                sub={`${groceryChecked} of ${groceryTotal} checked`}
              />
              <PlanStat
                icon={UtensilsCrossed}
                label="Selected meals"
                value={String(selectedMealCount)}
                sub={`${scrapedCount} recipes scanned`}
              />
            </div>
            <Progress
              value={groceryTotal ? Math.round((groceryChecked / groceryTotal) * 100) : 0}
              max={100}
              className="h-2 bg-success/10"
              aria-label={`Grocery checklist ${groceryChecked} of ${groceryTotal} checked`}
            />
            <div className="space-y-2">
              {selectedMeals.length > 0 ? (
                selectedMeals.map((meal) => (
                  <div key={meal} className="surface-muted flex items-center gap-2 p-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    <span className="line-clamp-1 font-medium text-foreground">{meal}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No selected meals are saved on this run.
                </p>
              )}
            </div>
          </>
        ) : status?.status === "FAILED" ? (
          <div className="surface-muted border-destructive/30 bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Planning needs attention
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Open Planning to review the run and start a fresh plan.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-panel min-h-40">
            <div className="max-w-sm">
              <ClipboardList className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-3 text-sm font-semibold text-foreground">
                No weekly plan selected
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start a plan from pantry ingredients and weekly constraints.
              </p>
            </div>
          </div>
        )}
        <Button asChild className="w-full sm:w-auto">
          <Link to="/planning">
            {planAction}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function PlanStat({
  icon: Icon,
  label,
  value,
  sub
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="surface-muted flex items-start gap-3 p-3">
      <div className="rounded-md bg-success/10 p-2 text-success">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function MacroMiniCard({
  label,
  value,
  goal
}: {
  label: string;
  value: number;
  goal: number | null;
}) {
  const progress = goal ? getProgressPercent(value, goal) : 0;
  const remaining = goal ? Math.max(0, Math.round(goal - value)) : null;

  return (
    <div className="surface-muted p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-bold">{formatMacroValue(value)}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {goal ? `${progress}%` : "No goal"}
        </span>
      </div>
      <Progress value={progress} max={100} className="mt-3 h-2" />
      <p className="mt-2 text-xs text-muted-foreground">
        {goal ? `${remaining}g left` : "Set in Settings"}
      </p>
    </div>
  );
}

function TodayMealsPreview({
  meals,
  hiddenCount,
  totalCount
}: {
  meals: Meal[];
  hiddenCount: number;
  totalCount: number;
}) {
  return (
    <div className="space-y-2">
      {meals.map((meal) => (
        <MealCard key={meal.id} meal={meal} />
      ))}
      {hiddenCount > 0 ? (
        <Link
          to="/meals"
          className="surface-muted interactive-surface flex cursor-pointer items-center justify-between gap-3 p-3 text-sm"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
              +{hiddenCount}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {hiddenCount} more meal{hiddenCount !== 1 ? "s" : ""} today
              </p>
              <p className="text-xs text-muted-foreground">
                {totalCount} total meal{totalCount !== 1 ? "s" : ""} logged today
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}
    </div>
  );
}

function TodayMealsEmptyState({ latestMeal }: { latestMeal: Meal | null }) {
  return (
    <div className="empty-panel min-h-40">
      <div className="max-w-sm">
        <UtensilsCrossed className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-semibold text-foreground">
          No meals logged today.
        </p>
        {latestMeal ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Last meal logged {formatDateTime(latestMeal.eatenAt)}.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Start today&apos;s log when you eat.
          </p>
        )}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <MealComposer
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Log meal
              </Button>
            }
          />
          {latestMeal ? (
            <Button size="sm" variant="outline" asChild>
              <Link to="/meals">
                Meal history
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatTodayMealsSummary(
  today: NutritionSummary["today"] | undefined,
  mealCount: number
) {
  if (mealCount === 0) return "No meals logged today";
  return `${mealCount} today - ${Math.round(today?.calories ?? 0)} cal - ${formatMacroValue(today?.proteinGrams)} protein`;
}

function isTodayMeal(meal: Meal) {
  return getLocalDateKey(new Date(meal.eatenAt)) === getLocalDateKey(new Date());
}

function ActivityListCard({
  title,
  description,
  action,
  children
}: {
  title: string;
  description: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div data-slot="card-action">{action}</div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  message,
  action
}: {
  icon: ComponentType<{ className?: string }>;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-panel min-h-40">
      <div>
        <Icon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="mb-3 text-sm text-muted-foreground">{message}</p>
        {action}
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

function CommandMetricSkeleton() {
  return (
    <div className="surface-panel flex min-h-24 items-start gap-3 p-4">
      <Skeleton className="h-8 w-8 rounded-md" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

function CalorieTrendChart({
  points,
  goalCalories
}: {
  points: NutritionSummary["dailyCalories"];
  goalCalories: number | null;
}) {
  const hasMealData = points.some((point) => point.calories > 0);
  const width = 720;
  const height = 260;
  const padding = { top: 20, right: 18, bottom: 44, left: 54 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxCalories = Math.max(...points.map((point) => point.calories));
  const chartMax = Math.max(3000, goalCalories ?? 0, maxCalories);
  const ticks = [chartMax, Math.round(chartMax / 2), 0];

  if (!points.length || !hasMealData) {
    return (
      <div className="empty-panel h-[260px]">
        <p className="text-sm text-muted-foreground">No calorie data yet.</p>
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[260px] w-full overflow-visible"
      role="img"
      aria-label="7 day calorie trend"
    >
      {ticks.map((tick) => {
        const y = padding.top + (1 - tick / chartMax) * plotHeight;
        return (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="hsl(var(--border))"
              strokeWidth="1"
            />
            <text
              x={padding.left - 10}
              y={y + 4}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize="12"
            >
              {tick}
            </text>
          </g>
        );
      })}
      {goalCalories && goalCalories > 0 && goalCalories <= chartMax ? (
        <g>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + (1 - goalCalories / chartMax) * plotHeight}
            y2={padding.top + (1 - goalCalories / chartMax) * plotHeight}
            stroke="hsl(var(--success))"
            strokeDasharray="6 5"
            strokeWidth="2"
          />
          <text
            x={width - padding.right}
            y={Math.max(
              12,
              padding.top + (1 - goalCalories / chartMax) * plotHeight - 8
            )}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize="12"
          >
            goal
          </text>
        </g>
      ) : null}
      {points.map((point, index) => {
        const slotWidth = plotWidth / points.length;
        const barWidth = Math.min(44, slotWidth * 0.54);
        const x =
          padding.left + index * slotWidth + (slotWidth - barWidth) / 2;
        const barHeight =
          point.calories === 0
            ? 0
            : Math.max(8, (point.calories / chartMax) * plotHeight);
        const y = padding.top + plotHeight - barHeight;

        return (
          <g key={point.date}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="5"
              fill="hsl(var(--primary))"
              opacity={point.calories === 0 ? 0.18 : 0.9}
            />
            {point.calories === 0 ? (
              <circle
                cx={x + barWidth / 2}
                cy={padding.top + plotHeight}
                r="3"
                fill="hsl(var(--muted-foreground))"
                opacity="0.45"
              />
            ) : (
              <text
                x={x + barWidth / 2}
                y={Math.max(12, y - 8)}
                textAnchor="middle"
                className="fill-foreground"
                fontSize="13"
                fontWeight="700"
              >
                {point.calories}
              </text>
            )}
            <text
              x={x + barWidth / 2}
              y={height - 14}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize="13"
            >
              {formatDateKeyShortDay(point.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function WeightTrendChart({ points }: { points: HealthMetric[] }) {
  if (points.length < 2) {
    return (
      <div className="empty-panel h-[260px]">
        <p className="text-sm text-muted-foreground">
          Need 2+ entries for trend.
        </p>
      </div>
    );
  }

  const weights = points.map((point) => point.weightKg ?? 0);
  const weightsLbs = weights.map(kgToLbs);
  const rawMin = Math.min(...weightsLbs);
  const rawMax = Math.max(...weightsLbs);
  const range = Math.max(rawMax - rawMin, 2);
  const minWeight = Math.floor((rawMin - range * 0.18) * 2) / 2;
  const maxWeight = Math.ceil((rawMax + range * 0.18) * 2) / 2;
  const width = 720;
  const height = 260;
  const padding = { top: 22, right: 24, bottom: 44, left: 58 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const ticks = [maxWeight, (maxWeight + minWeight) / 2, minWeight];
  const coordinates = points.map((point, index) => {
    const weight = kgToLbs(point.weightKg ?? 0);
    const x =
      padding.left + (index / Math.max(points.length - 1, 1)) * plotWidth;
    const y =
      padding.top +
      (1 - (weight - minWeight) / (maxWeight - minWeight)) * plotHeight;
    return { point, x, y, weight };
  });
  const linePath = coordinates
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
  const firstPoint = coordinates[0];
  const lastPoint = coordinates[coordinates.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[260px] w-full overflow-visible"
      role="img"
      aria-label="Weight trend"
    >
      {ticks.map((tick) => {
        const y =
          padding.top +
          (1 - (tick - minWeight) / (maxWeight - minWeight)) * plotHeight;
        return (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="hsl(var(--border))"
              strokeWidth="1"
            />
            <text
              x={padding.left - 10}
              y={y + 4}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize="12"
            >
              {tick.toFixed(1)}
            </text>
          </g>
        );
      })}
      <path
        d={linePath}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`${linePath} L ${lastPoint.x} ${padding.top + plotHeight} L ${firstPoint.x} ${padding.top + plotHeight} Z`}
        fill="hsl(var(--primary))"
        opacity="0.08"
      />
      {coordinates.map(({ point, x, y, weight }) => (
        <g key={point.id}>
          <circle
            cx={x}
            cy={y}
            r="6"
            fill="hsl(var(--card))"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
          />
          <text
            x={x}
            y={Math.max(13, y - 12)}
            textAnchor="middle"
            className="fill-foreground"
            fontSize="13"
            fontWeight="700"
          >
            {weight.toFixed(1)}
          </text>
          <text
            x={x}
            y={height - 14}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="13"
          >
            {new Date(point.recordedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric"
            })}
          </text>
        </g>
      ))}
    </svg>
  );
}
