import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useNutritionSummaryQuery } from "@/features/dashboard/hooks";
import { useHealthMetricsQuery } from "@/features/settings/hooks";
import { useMealsQuery } from "@/features/meals/hooks";
import { useWorkoutSessionsQuery } from "@/features/workouts/hooks";
import { formatDateTime, formatDate, formatWeight, formatMacroValue, getProgressPercent } from "@/lib/mealUtils";
import { MealComposer } from "@/features/meals/MealComposer";
import { WorkoutSessionModal } from "@/components/workouts/WorkoutSessionModal";
import { MealCard } from "@/components/shared/MealCard";
import { WorkoutCard } from "@/components/shared/WorkoutCard";
import { UtensilsCrossed, Dumbbell, Flame, Scale } from "lucide-react";
import type { Meal } from "@/types";

export function DashboardPage() {
  const { data: nutritionSummary, isLoading: loadingNutrition } = useNutritionSummaryQuery();
  const { data: healthMetrics, isLoading: loadingMetrics } = useHealthMetricsQuery(12);
  const { data: meals, isLoading: loadingMeals } = useMealsQuery(3);
  const { data: sessions, isLoading: loadingSessions } = useWorkoutSessionsQuery(3);

  const todaySummary = nutritionSummary?.today;
  const calorieGoal = nutritionSummary?.goals?.adjustedCalorieGoal ?? nutritionSummary?.goals?.calorieGoal ?? null;
  const baseCalorieGoal = nutritionSummary?.goals?.calorieGoal ?? null;
  const calorieProgress = calorieGoal && todaySummary ? getProgressPercent(todaySummary.calories, calorieGoal) : 0;
  const calorieBalance =
    !calorieGoal
      ? "Goal not set"
      : (todaySummary?.calories ?? 0) <= calorieGoal
        ? `${calorieGoal - (todaySummary?.calories ?? 0)} cal left`
        : `${(todaySummary?.calories ?? 0) - calorieGoal} cal over`;
  const calorieTrend = nutritionSummary?.dailyCalories ?? [];
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

  const maxCalories = calorieTrend.length > 0 ? Math.max(...calorieTrend.map((d) => d.calories), calorieGoal ?? 0) : calorieGoal ?? 2000;
  const maxWeight = weightTrendPoints.length > 0 ? Math.max(...weightTrendPoints.map((m) => m.weightKg!)) : 0;
  const minWeight = weightTrendPoints.length > 0 ? Math.min(...weightTrendPoints.map((m) => m.weightKg!)) : 0;
  const weightRange = maxWeight - minWeight;

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
            {calorieTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data yet.</p>
            ) : (
              <div className="flex items-end gap-2 h-32">
                {calorieTrend.map((d) => {
                  const heightPercent = maxCalories > 0 ? (d.calories / maxCalories) * 100 : 0;
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{d.calories}</span>
                      <div
                        className="w-full bg-primary/80 rounded-t transition-all"
                        style={{ height: `${Math.max(heightPercent, 4)}%` }}
                        title={`${d.calories} cal`}
                      />
                      <span className="text-[10px] text-muted-foreground">{new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}</span>
                    </div>
                  );
                })}
              </div>
            )}
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
            {weightTrendPoints.length < 2 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Need 2+ entries for trend.</p>
            ) : (
              <svg viewBox={`0 0 ${weightTrendPoints.length * 60} 200`} className="w-full h-32">
                {(() => {
                  const points = weightTrendPoints.map((m, i) => ({
                    x: i * 60 + 30,
                    y: 190 - ((m.weightKg! - minWeight) / (weightRange || 1)) * 160
                  }));
                  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                  return (
                    <>
                      <path d={linePath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
                      {points.map((p, i) => (
                        <g key={i}>
                          <circle cx={p.x} cy={p.y} r="4" fill="hsl(var(--primary))" />
                          <text x={p.x} y={p.y - 12} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
                            {formatWeight(weightTrendPoints[i].weightKg)}
                          </text>
                          <text x={p.x} y={p.y + 16} textAnchor="middle" className="fill-muted-foreground" fontSize="9">
                            {new Date(weightTrendPoints[i].recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
            )}
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
          ) : meals?.meals?.length === 0 ? (
            <EmptyState icon={UtensilsCrossed} message="No meals logged yet." action={<MealComposer trigger={<Button size="sm">Log your first meal</Button>} />} />
          ) : (
            <div className="space-y-2">
              {(meals?.meals ?? []).map((meal: Meal) => (
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
