import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useNutritionSummaryQuery } from "@/features/dashboard/hooks";
import {
    useHealthMetricsQuery,
    useProfileQuery,
} from "@/features/settings/hooks";
import { useMealsQuery } from "@/features/meals/hooks";
import { useWorkoutSessionsQuery } from "@/features/workouts/hooks";
import {
    formatDate,
    formatWeight,
    getProgressPercent,
    kgToLbs,
} from "@/lib/mealUtils";
import { MealComposer } from "@/features/meals/MealComposer";
import { WorkoutSessionModal } from "@/components/workouts/WorkoutSessionModal";
import { MealCard } from "@/components/shared/MealCard";
import { WorkoutCard } from "@/components/shared/WorkoutCard";
import { UtensilsCrossed, Dumbbell, Flame, Scale } from "lucide-react";
import type { HealthMetric, Meal, NutritionSummary } from "@/types";

export function DashboardPage() {
    const { data: nutritionSummary, isLoading: loadingNutrition } =
        useNutritionSummaryQuery();
    const { data: profile } = useProfileQuery();
    const { data: healthMetrics, isLoading: loadingMetrics } =
        useHealthMetricsQuery(12);
    const { data: meals, isLoading: loadingMeals } = useMealsQuery(24);
    const { data: sessions, isLoading: loadingSessions } =
        useWorkoutSessionsQuery(3);

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
                      calorieTrend.length,
              )
            : 0;
    const weightPoints = (healthMetrics?.metrics ?? []).filter(
        (m) => m.weightKg != null,
    );
    const latestWeight = weightPoints[0] ?? null;
    const weightTrendPoints = weightPoints.slice(0, 6).reverse();
    const weightDelta =
        weightPoints.length >= 2
            ? Math.round(
                  (((weightPoints[0].weightKg ?? 0) -
                      (weightPoints[1].weightKg ?? 0)) /
                      0.45359237) *
                      10,
              ) / 10
            : null;

    const displayedMeals = mealHistory.slice(0, 3);

    const anyLoading = loadingNutrition || loadingMetrics;

    return (
        <div className="px-4 py-4 max-w-6xl mx-auto space-y-6">
            {/* ── Stats Row ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {loadingNutrition ? (
                    <>
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                    </>
                ) : (
                    <>
                        <StatCard
                            icon={Flame}
                            label="Consumed"
                            value={`${todaySummary?.calories ?? 0}`}
                            unit="cal"
                            sub={
                                calorieGoal
                                    ? `${calorieProgress}% of goal`
                                    : "No goal set"
                            }
                        />
                        <StatCard
                            icon={Dumbbell}
                            label="Workout burn"
                            value={`${todaySummary?.caloriesBurned ?? 0}`}
                            unit="cal"
                            sub={
                                baseCalorieGoal
                                    ? `${baseCalorieGoal} base goal`
                                    : "Log workouts to adjust"
                            }
                        />
                        <StatCard
                            icon={UtensilsCrossed}
                            label="Remaining"
                            value={
                                calorieGoal
                                    ? String(
                                          Math.max(
                                              0,
                                              calorieGoal -
                                                  (todaySummary?.calories ?? 0),
                                          ),
                                      )
                                    : "—"
                            }
                            unit="cal"
                            sub={calorieBalance}
                        />
                    </>
                )}
                {loadingMetrics ? (
                    <StatCardSkeleton />
                ) : (
                    <StatCard
                        icon={Scale}
                        label="Weight"
                        value={
                            latestWeight
                                ? formatWeight(latestWeight.weightKg)
                                : "—"
                        }
                        sub={
                            latestWeight
                                ? `${formatDate(latestWeight.recordedAt)}${weightDelta != null ? ` · ${weightDelta > 0 ? "+" : ""}${weightDelta.toFixed(1)} lb` : ""}`
                                : "Log to start"
                        }
                    />
                )}
            </div>

            {/* ── Calorie Progress Bar ── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle>Daily Calories</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    {loadingNutrition ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                            <Skeleton className="h-2 w-full" />
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">
                                    {calorieGoal
                                        ? `${calorieProgress}% of goal`
                                        : "No goal set"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {calorieBalance}
                                </span>
                            </div>
                            <Progress value={calorieProgress} max={100} />
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ── Trend Row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Calorie Trend</CardTitle>
                        <CardDescription>
                            {loadingNutrition
                                ? "Loading..."
                                : `${weeklyAverage} cal avg`}
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

            {/* ── Recent Meals ── */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Meals</CardTitle>
                    <CardDescription>
                        {loadingNutrition
                            ? "..."
                            : `${todaySummary?.mealCount ?? 0} today`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between mb-4">
                        <MealComposer
                            trigger={<Button size="sm">+ Log</Button>}
                        />
                    </div>
                    {loadingMeals ? (
                        <div className="space-y-3">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : displayedMeals.length === 0 ? (
                        <EmptyState
                            icon={UtensilsCrossed}
                            message="No meals logged yet."
                            action={
                                <MealComposer
                                    trigger={
                                        <Button size="sm">
                                            Log your first meal
                                        </Button>
                                    }
                                />
                            }
                        />
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
                <CardHeader>
                    <CardTitle>Recent Workouts</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between mb-4">
                        <WorkoutSessionModal
                            trigger={<Button size="sm">+ Log</Button>}
                        />
                    </div>
                    {loadingSessions ? (
                        <div className="space-y-3">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : sessions?.sessions?.length === 0 ? (
                        <EmptyState
                            icon={Dumbbell}
                            message="No workouts logged yet."
                            action={
                                <WorkoutSessionModal
                                    trigger={
                                        <Button size="sm">
                                            Log your first workout
                                        </Button>
                                    }
                                />
                            }
                        />
                    ) : (
                        <div className="space-y-2">
                            {(sessions?.sessions ?? []).map((session) => (
                                <WorkoutCard
                                    key={session.id}
                                    session={session}
                                />
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
            if (getLocalDateKey(new Date(meal.eatenAt)) !== todayKey)
                return summary;

            return {
                mealCount: summary.mealCount + 1,
                calories: summary.calories + (meal.estimatedCalories ?? 0),
                caloriesBurned: 0,
                netCalories:
                    summary.netCalories + (meal.estimatedCalories ?? 0),
                proteinGrams: summary.proteinGrams + (meal.proteinGrams ?? 0),
                carbsGrams: summary.carbsGrams + (meal.carbsGrams ?? 0),
                fatGrams: summary.fatGrams + (meal.fatGrams ?? 0),
            };
        },
        {
            mealCount: 0,
            calories: 0,
            caloriesBurned: 0,
            netCalories: 0,
            proteinGrams: 0,
            carbsGrams: 0,
            fatGrams: 0,
        },
    );
}

function buildDailyCaloriesFromMeals(
    meals: Meal[],
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
            netCalories: 0,
        };
    });

    meals.forEach((meal) => {
        const day = days.find(
            (item) => item.date === getLocalDateKey(new Date(meal.eatenAt)),
        );
        if (!day) return;

        day.calories += meal.estimatedCalories ?? 0;
        day.mealCount += 1;
        day.netCalories = day.calories - day.caloriesBurned;
    });

    return days.map((day) => ({
        ...day,
        calories: Math.round(day.calories),
        netCalories: Math.round(day.netCalories),
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
        new Date(`${dateKey}T12:00:00`),
    );
}

function CalorieTrendChart({
    points,
    goalCalories,
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
    const chartMax = 3000;
    const ticks = [chartMax, Math.round(chartMax / 2), 0];

    if (!points.length || !hasMealData) {
        return (
            <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed bg-muted/20">
                <p className="text-sm text-muted-foreground">
                    No calorie data yet.
                </p>
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
                        y1={
                            padding.top +
                            (1 - goalCalories / chartMax) * plotHeight
                        }
                        y2={
                            padding.top +
                            (1 - goalCalories / chartMax) * plotHeight
                        }
                        stroke="hsl(var(--success))"
                        strokeDasharray="6 5"
                        strokeWidth="2"
                    />
                    <text
                        x={width - padding.right}
                        y={Math.max(
                            12,
                            padding.top +
                                (1 - goalCalories / chartMax) * plotHeight -
                                8,
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
                    padding.left +
                    index * slotWidth +
                    (slotWidth - barWidth) / 2;
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
            <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed bg-muted/20">
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
                    (1 - (tick - minWeight) / (maxWeight - minWeight)) *
                        plotHeight;
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
                        {new Date(point.recordedAt).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric" },
                        )}
                    </text>
                </g>
            ))}
        </svg>
    );
}

function StatCard({
    icon: Icon,
    label,
    value,
    unit,
    sub,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    unit?: string;
    sub?: string;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex flex-col gap-1">
                <p className="text-xl font-bold">
                    {value}
                    {unit ? ` ${unit}` : ""}
                </p>
                {sub && (
                    <span className="text-xs text-muted-foreground">{sub}</span>
                )}
            </CardContent>
        </Card>
    );
}

function EmptyState({
    icon: Icon,
    message,
    action,
}: {
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

function StatCardSkeleton() {
    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Skeleton className="h-3.5 w-3.5" />
                    <Skeleton className="h-3 w-12" />
                </div>
            </CardHeader>
            <CardContent className="pt-0 flex flex-col gap-1">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-24" />
            </CardContent>
        </Card>
    );
}
