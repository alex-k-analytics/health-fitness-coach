import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useNutritionSummaryQuery } from "@/features/dashboard/hooks";
import { useHealthMetricsQuery, useProfileQuery } from "@/features/settings/hooks";
import { useMealsQuery } from "@/features/meals/hooks";
import { useWorkoutSessionsQuery } from "@/features/workouts/hooks";
import { formatDate, formatWeight, getProgressPercent, kgToLbs } from "@/lib/mealUtils";
import { MealComposer } from "@/features/meals/MealComposer";
import { WorkoutSessionModal } from "@/components/workouts/WorkoutSessionModal";
import { MealCard } from "@/components/shared/MealCard";
import { WorkoutCard } from "@/components/shared/WorkoutCard";
import { UtensilsCrossed, Dumbbell, Flame, Scale } from "lucide-react";
import type { HealthMetric, Meal, NutritionSummary } from "@/types";

export function DashboardPage() {
  const { data: nutritionSummary, isLoading: loadingNutrition } = useNutritionSummaryQuery();
  const { data: profile } = useProfileQuery();
  const { data: healthMetrics, isLoading: loadingMetrics } = useHealthMetricsQuery(12);
  const { data: meals, isLoading: loadingMeals } = useMealsQuery(24);
  const { data: sessions, isLoading: loadingSessions } = useWorkoutSessionsQuery(3);

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
  const calorieProgress = calorieGoal && todaySummary ? getProgressPercent(todaySummary.calories, calorieGoal) : 0;
  const calorieBalance =
    !calorieGoal
      ? "Goal not set"
      : (todaySummary?.calories ?? 0) <= calorieGoal
        ? `${calorieGoal - (todaySummary?.calories ?? 0)} cal left`
        : `${(todaySummary?.calories ?? 0) - calorieGoal} cal over`;
  const calorieTrend =
    nutritionSummary?.dailyCalories?.length ? nutritionSummary.dailyCalories : buildDailyCaloriesFromMeals(mealHistory);
  const weeklyAverage =
    calorieTrend.length > 0
      ? Math.round(calorieTrend.reduce((sum, d) => sum + d.calories, 0) / calorieTrend.length)
      : 0;
  const weightTrend = (healthMetrics?.metrics ?? [])
    .filter((m) => m.weightKg != null)
    .reverse();
  const weightTrendPoints = weightTrend.slice(0, 6);
  const latestWeight = weightTrend[0] ?? null;

  const weightPoints = (healthMetrics?.metrics ?? []).filter((m) => m.weightKg != null).reverse();
  const weightDelta =
    weightPoints.length >= 2
      ? Math.round(((weightPoints[0].weightKg ?? 0) - (weightPoints[1].weightKg ?? 0)) / 0.45359237 * 10) / 10
      : null;

  const displayedMeals = mealHistory.slice(0, 3);

  return (
    <div className="px-4 py-4 max-w-6xl mx-auto space-y-6">

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Flame}
          label="Consumed"
          value={loadingNutrition ? "—" : `${todaySummary?.calories ?? 0}`}
          unit="cal"
          sub={calorieGoal ? `${calorieProgress}% of goal` : "No goal set"}
        />
        <StatCard
          icon={Dumbbell}
          label="Workout burn"
          value={loadingNutrition ? "—" : `${todaySummary?.caloriesBurned ?? 0}`}
          unit="cal"
          sub={baseCalorieGoal ? `${baseCalorieGoal} base goal` : "Log workouts to adjust"}
        />
        <StatCard
          icon={UtensilsCrossed}
          label="Remaining"
          value={loadingNutrition ? "—" : (calorieGoal ? String(Math.max(0, calorieGoal - (todaySummary?.calories ?? 0))) : "—")}
          unit="cal"
          sub={calorieBalance}
        />
        <StatCard
          icon={Scale}
          label="Weight"
          value={loadingMetrics ? "—" : (latestWeight ? formatWeight(latestWeight.weightKg) : "—")}
          sub={latestWeight ? `${formatDate(latestWeight.recordedAt)}${weightDelta != null ? ` · ${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} lb` : ""}` : "Log to start"}
        />
      </div>

      {/* ── Calorie Progress Bar ── */}
      {!loadingNutrition && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{calorieGoal ? `${calorieProgress}% of goal` : "No goal set"}</span>
              <span className="text-xs text-muted-foreground">{calorieBalance}</span>
            </div>
            <Progress value={calorieProgress} max={100} />
          </CardContent>
        </Card>
      )}

      {/* ── Trend Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Calorie Trend</h3>
                <p className="text-xs text-muted-foreground">{weeklyAverage} cal avg</p>
              </div>
            </div>
            <CalorieTrendChart points={calorieTrend} goalCalories={calorieGoal} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Weight Trend</h3>
                <p className="text-xs text-muted-foreground">{latestWeight ? `Updated ${formatDate(latestWeight.recordedAt)}` : "No entries"}</p>
              </div>
            </div>
            <WeightTrendChart points={weightTrendPoints} />
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Meals ── */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold">Recent Meals</h3>
              <p className="text-xs text-muted-foreground">
                {loadingNutrition ? "..." : `${todaySummary?.mealCount ?? 0} today`}
              </p>
            </div>
            <MealComposer trigger={<Button size="sm">+ Log</Button>} />
          </div>
          {loadingMeals ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : displayedMeals.length === 0 ? (
            <EmptyState icon={UtensilsCrossed} message="No meals logged yet." action={<MealComposer trigger={<Button size="sm">Log your first meal</Button>} />} />
          ) : (
            <div className="space-y-2">
              {displayedMeals.map((meal: Meal) => (
                <MealCard key={meal.id} meal={meal} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Recent Workouts ── */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold">Recent Workouts</h3>
            </div>
            <WorkoutSessionModal trigger={<Button size="sm">+ Log</Button>} />
          </div>
          {loadingSessions ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : sessions?.sessions?.length === 0 ? (
            <EmptyState icon={Dumbbell} message="No workouts logged yet." action={<WorkoutSessionModal trigger={<Button size="sm">Log your first workout</Button>} />} />
          ) : (
            <div className="space-y-2">
              {(sessions?.sessions ?? []).map((session) => (
                <WorkoutCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
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
    { mealCount: 0, calories: 0, caloriesBurned: 0, netCalories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 }
  );
}

function buildDailyCaloriesFromMeals(meals: Meal[]): NutritionSummary["dailyCalories"] {
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
    const day = days.find((item) => item.date === getLocalDateKey(new Date(meal.eatenAt)));
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
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(`${dateKey}T12:00:00`));
}

function CalorieTrendChart({
  points,
  goalCalories
}: {
  points: NutritionSummary["dailyCalories"];
  goalCalories: number | null;
}) {
  const hasMealData = points.some((point) => point.calories > 0);
  const chartMax = Math.max(...points.map((point) => point.calories), goalCalories ?? 0, 1);
  const goalPercent = goalCalories ? Math.min(100, (goalCalories / chartMax) * 100) : null;

  if (!points.length || !hasMealData) {
    return <p className="text-sm text-muted-foreground text-center py-12">No calorie data yet.</p>;
  }

  return (
    <div className="relative h-44 pt-3">
      {goalPercent !== null && (
        <div
          className="absolute left-0 right-0 border-t border-dashed border-primary/50"
          style={{ bottom: `${goalPercent}%` }}
          aria-hidden="true"
        />
      )}
      <div className="relative z-10 flex h-full items-end gap-2">
        {points.map((point) => {
          const heightPercent = point.calories > 0 ? Math.max(12, (point.calories / chartMax) * 100) : 0;
          return (
            <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="h-4 text-[10px] font-medium text-muted-foreground">{point.calories || ""}</span>
              <div className="flex h-28 w-full items-end rounded-sm bg-muted/60 px-1">
                <div
                  className="w-full rounded-t-sm bg-primary/85 transition-all"
                  style={{ height: `${heightPercent}%` }}
                  title={`${point.calories} cal`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{formatDateKeyShortDay(point.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeightTrendChart({ points }: { points: HealthMetric[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-muted-foreground text-center py-12">Need 2+ entries for trend.</p>;
  }

  const weights = points.map((point) => point.weightKg ?? 0);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const width = 560;
  const height = 190;
  const paddingX = 42;
  const paddingY = 28;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;
  const coordinates = points.map((point, index) => {
    const weight = point.weightKg ?? minWeight;
    const x = paddingX + (index / Math.max(points.length - 1, 1)) * usableWidth;
    const y =
      maxWeight === minWeight
        ? height / 2
        : height - paddingY - ((weight - minWeight) / (maxWeight - minWeight)) * usableHeight;
    return { point, x, y, weight };
  });
  const linePath = coordinates.map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full overflow-visible" role="img" aria-label="Weight trend">
      {[0, 1, 2].map((lineIndex) => {
        const y = paddingY + (usableHeight / 2) * lineIndex;
        return (
          <line
            key={lineIndex}
            x1={paddingX}
            x2={width - paddingX}
            y1={y}
            y2={y}
            stroke="hsl(var(--border))"
            strokeWidth="1"
          />
        );
      })}
      <path d={linePath} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {coordinates.map(({ point, x, y, weight }) => (
        <g key={point.id}>
          <circle cx={x} cy={y} r="5" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="3" />
          <text x={x} y={Math.max(12, y - 12)} textAnchor="middle" className="fill-foreground" fontSize="12" fontWeight="600">
            {kgToLbs(weight).toFixed(1)}
          </text>
          <text x={x} y={height - 6} textAnchor="middle" className="fill-muted-foreground" fontSize="11">
            {new Date(point.recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </text>
        </g>
      ))}
    </svg>
  );
}

function StatCard({ icon: Icon, label, value, unit, sub }: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          <span className="text-xs">{label}</span>
        </div>
        <p className="text-xl font-bold">{value}{unit ? ` ${unit}` : ""}</p>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, message, action }: {
  icon: React.ElementType;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-8">
      <Icon className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground mb-3">{message}</p>
      {action}
    </div>
  );
}
