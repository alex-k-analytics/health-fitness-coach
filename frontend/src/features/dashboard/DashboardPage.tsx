import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
        ? `${calorieGoal - (todaySummary?.calories ?? 0)} kcal left`
        : `${(todaySummary?.calories ?? 0) - calorieGoal} kcal over`;
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
    <div className="px-4 py-4 max-w-6xl mx-auto space-y-4">

      {/* ── Daily Snapshot ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-primary/80">Today</p>
              <h2 className="text-lg font-semibold leading-tight">Daily snapshot</h2>
            </div>
            <Badge variant="outline">
              {loadingNutrition
                ? "Refreshing"
                : `${todaySummary?.mealCount ?? 0} logged item${(todaySummary?.mealCount ?? 0) === 1 ? "" : "s"}`}
            </Badge>
          </div>

          {loadingNutrition ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg border border-border p-4">
                  <span className="text-xs text-muted-foreground">Calories consumed</span>
                  <p className="text-xl font-bold">{todaySummary?.calories ?? 0}</p>
                  <span className="text-xs text-muted-foreground">
                    {calorieGoal ? `${calorieProgress}% of goal` : "Goal not set"}
                  </span>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <span className="text-xs text-muted-foreground">Workout burn</span>
                  <p className="text-xl font-bold">{todaySummary?.caloriesBurned ?? 0}</p>
                  <span className="text-xs text-muted-foreground">
                    {baseCalorieGoal && calorieGoal
                      ? `${baseCalorieGoal} base + ${todaySummary?.caloriesBurned ?? 0} burned`
                      : "Log workouts to adjust your goal"}
                  </span>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <span className="text-xs text-muted-foreground">Remaining</span>
                  <p className="text-xl font-bold">{calorieGoal ? Math.max(0, calorieGoal - (todaySummary?.calories ?? 0)) : "—"}</p>
                  <span className="text-xs text-muted-foreground">{calorieBalance}</span>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <span className="text-xs text-muted-foreground">Latest weight</span>
                  <p className="text-xl font-bold">{latestWeight ? formatWeight(latestWeight.weightKg) : "—"}</p>
                  <span className="text-xs text-muted-foreground">
                    {latestWeight
                      ? `${formatDate(latestWeight.recordedAt)}${weightDelta === null ? "" : ` · ${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} lb vs prior`}`
                      : "Log weight to start tracking"}
                  </span>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {calorieGoal ? `${calorieProgress}% of adjusted goal` : "Goal not set"}
                  </span>
                  <span className="text-xs text-muted-foreground">{calorieBalance}</span>
                </div>
                <Progress value={calorieProgress} max={100} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Trend Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>7-day calorie trend</CardTitle>
            <CardDescription>{weeklyAverage} cal per day average</CardDescription>
          </CardHeader>
          <CardContent>
            {calorieTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <div className="flex items-end gap-2 h-40">
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
          <CardHeader className="pb-3">
            <CardTitle>Weight trend</CardTitle>
            <CardDescription>{latestWeight ? `Updated ${formatDate(latestWeight.recordedAt)}` : "No entries yet"}</CardDescription>
          </CardHeader>
          <CardContent>
            {weightTrendPoints.length < 2 ? (
              <p className="text-sm text-muted-foreground">Need at least 2 weight entries to show trend.</p>
            ) : (
              <svg viewBox={`0 0 ${weightTrendPoints.length * 60} 200`} className="w-full h-40">
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

      {/* ── Last 3 Logs ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>Last 3 logs</CardTitle>
            <CardDescription>Recent food, drink, and nutrition entries</CardDescription>
          </div>
          <MealComposer trigger={<Button size="sm">+ Log food</Button>} />
        </CardHeader>
        <CardContent>
          {loadingMeals ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : meals?.meals?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-3">No logs yet.</p>
              <MealComposer trigger={<Button>Log your first item</Button>} />
            </div>
          ) : (
            <div className="space-y-2">
              {(meals?.meals ?? []).map((meal) => (
                <article key={meal.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-semibold truncate">{meal.title}</p>
                        <span className="text-xs text-muted-foreground shrink-0">{formatDateTime(meal.eatenAt)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs">
                        <span className="font-medium">{meal.estimatedCalories ?? 0} cal</span>
                        <span className="text-muted-foreground">
                          P {formatMacroValue(meal.proteinGrams)} · C {formatMacroValue(meal.carbsGrams)} · F {formatMacroValue(meal.fatGrams)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        <Badge variant="outline">P {formatMacroValue(meal.proteinGrams)}</Badge>
                        <Badge variant="outline">C {formatMacroValue(meal.carbsGrams)}</Badge>
                        <Badge variant="outline">F {formatMacroValue(meal.fatGrams)}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {meal.servingDescription && <span>{meal.servingDescription}</span>}
                        {meal.images && meal.images.length > 0 && (
                          <span>{meal.images.length} photo{meal.images.length !== 1 ? "s" : ""}</span>
                        )}
                        {meal.analysisStatus && meal.analysisStatus !== "COMPLETED" && (
                          <Badge variant="warning">{meal.analysisStatus}</Badge>
                        )}
                      </div>
                    </div>
                    <MealComposer
                      initialMeal={meal}
                      trigger={<Button size="sm" variant="ghost" className="shrink-0">Edit</Button>}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Last 3 Workouts ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>Last 3 workouts</CardTitle>
            <CardDescription>Recent workout sessions</CardDescription>
          </div>
          <WorkoutSessionModal trigger={<Button size="sm">+ Log workout</Button>} />
        </CardHeader>
        <CardContent>
          {loadingSessions ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : sessions?.sessions?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-3">No workouts logged yet.</p>
              <WorkoutSessionModal trigger={<Button>Log your first workout</Button>} />
            </div>
          ) : (
            <div className="space-y-2">
              {(sessions?.sessions ?? []).map((session) => (
                <article key={session.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-semibold truncate">{session.title}</p>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(session.performedAt))}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        <span className="font-medium">{session.totalCalories ?? 0} cal</span>
                        {session.exercises && session.exercises.length > 0 && (
                          <span className="text-muted-foreground">
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
                              .join(" · ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
