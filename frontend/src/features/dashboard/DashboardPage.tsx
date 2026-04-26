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

export function DashboardPage() {
  const { data: nutritionSummary, isLoading: loadingNutrition } = useNutritionSummaryQuery();
  const { data: healthMetrics, isLoading: loadingMetrics } = useHealthMetricsQuery(12);
  const { data: meals, isLoading: loadingMeals } = useMealsQuery(3);
  const { data: sessions, isLoading: loadingSessions } = useWorkoutSessionsQuery(3);

  const todaySummary = nutritionSummary?.today;
  const calorieGoal = nutritionSummary?.goals?.adjustedCalorieGoal ?? nutritionSummary?.goals?.calorieGoal ?? null;
  const calorieProgress = calorieGoal && todaySummary ? getProgressPercent(todaySummary.calories, calorieGoal) : 0;
  const calorieTrend = nutritionSummary?.dailyCalories ?? [];
  const weeklyAverage =
    calorieTrend.length > 0
      ? Math.round(calorieTrend.reduce((sum, d) => sum + d.calories, 0) / calorieTrend.length)
      : 0;
  const weightTrend = (healthMetrics?.metrics ?? [])
    .filter((m) => m.weightKg != null)
    .reverse()
    .slice(0, 6);
  const latestWeight = (healthMetrics?.metrics ?? []).find((m) => m.weightKg != null);

  const maxCalories = calorieTrend.length > 0 ? Math.max(...calorieTrend.map((d) => d.calories), calorieGoal ?? 0) : calorieGoal ?? 2000;
  const maxWeight = weightTrend.length > 0 ? Math.max(...weightTrend.map((m) => m.weightKg!)) : 0;
  const minWeight = weightTrend.length > 0 ? Math.min(...weightTrend.map((m) => m.weightKg!)) : 0;
  const weightRange = maxWeight - minWeight;

  return (
    <div className="px-4 py-4 max-w-6xl mx-auto space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingNutrition ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Calories consumed</CardDescription>
                <CardTitle className="text-2xl">{todaySummary?.calories ?? 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{todaySummary?.mealCount ?? 0} meal{todaySummary?.mealCount !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Workout burn</CardDescription>
                <CardTitle className="text-2xl">{todaySummary?.caloriesBurned ?? 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">calories burned</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Remaining</CardDescription>
                <CardTitle className="text-2xl">
                  {calorieGoal ? Math.max(0, calorieGoal - (todaySummary?.calories ?? 0)) : "—"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">calories left</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Latest weight</CardDescription>
                <CardTitle className="text-2xl">{latestWeight ? formatWeight(latestWeight.weightKg) : "—"}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {latestWeight ? formatDate(latestWeight.recordedAt) : "no data"}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Calorie Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s progress</CardTitle>
          <CardDescription>
            {todaySummary?.calories ?? 0} / {calorieGoal ?? "—"} calories ({calorieProgress}%)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={calorieProgress} max={100} />
        </CardContent>
      </Card>

      {/* 7-Day Calorie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>7-day calorie trend</CardTitle>
          <CardDescription>
            Weekly average: {weeklyAverage} cal
          </CardDescription>
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

      {/* Weight Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Weight trend</CardTitle>
        </CardHeader>
        <CardContent>
          {weightTrend.length < 2 ? (
            <p className="text-sm text-muted-foreground">Need at least 2 weight entries to show trend.</p>
          ) : (
            <svg viewBox={`0 0 ${weightTrend.length * 60} 200`} className="w-full h-40">
              {(() => {
                const points = weightTrend.map((m, i) => ({
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
                          {formatWeight(weightTrend[i].weightKg)}
                        </text>
                        <text x={p.x} y={p.y + 16} textAnchor="middle" className="fill-muted-foreground" fontSize="9">
                          {new Date(weightTrend[i].recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
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

      {/* Recent Meals & Workouts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Meals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent meals</CardTitle>
              <CardDescription>Last 3 logged meals</CardDescription>
            </div>
            <Link to="/meals">
              <Button size="sm">View all</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loadingMeals ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : meals?.meals?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No meals logged yet.</p>
            ) : (
              <div className="space-y-3">
                {(meals?.meals ?? []).slice(0, 3).map((meal) => (
                  <div key={meal.id} className="flex items-start justify-between gap-3 py-2 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{meal.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(meal.eatenAt)}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary">{meal.estimatedCalories ?? 0} cal</Badge>
                        <Badge variant="outline">P {formatMacroValue(meal.proteinGrams)}</Badge>
                        <Badge variant="outline">C {formatMacroValue(meal.carbsGrams)}</Badge>
                        <Badge variant="outline">F {formatMacroValue(meal.fatGrams)}</Badge>
                      </div>
                    </div>
                     <Button size="sm" variant="ghost" disabled className="shrink-0">Edit</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Workouts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent workouts</CardTitle>
              <CardDescription>Last 3 sessions</CardDescription>
            </div>
            <Link to="/workouts">
              <Button size="sm">View all</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loadingSessions ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : sessions?.sessions?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workouts logged yet.</p>
            ) : (
              <div className="space-y-3">
                {(sessions?.sessions ?? []).slice(0, 3).map((s) => (
                  <div key={s.id} className="flex items-start justify-between gap-3 py-2 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.activityType} · {formatDate(s.performedAt)}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary">{s.totalCalories ?? 0} cal</Badge>
                        {s.durationSeconds && (
                          <Badge variant="outline">{Math.round(s.durationSeconds / 60)} min</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16 mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}
