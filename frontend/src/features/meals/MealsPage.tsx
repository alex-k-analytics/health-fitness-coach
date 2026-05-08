import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useNutritionSummaryQuery } from "@/features/dashboard/hooks";
import { useMealsQuery } from "@/features/meals/hooks";
import { MealComposer } from "@/features/meals/MealComposer";
import { MealCard } from "@/components/shared/MealCard";
import { formatMacroValue, getProgressPercent } from "@/lib/mealUtils";
import { CalendarDays, Flame, History, Plus, UtensilsCrossed } from "lucide-react";
import type { Meal } from "@/types";

export function MealsPage() {
  const { data: meals, isLoading } = useMealsQuery(60);
  const { data: nutritionSummary, isLoading: loadingNutrition } = useNutritionSummaryQuery();
  const mealHistory = meals?.meals ?? [];
  const { todayMeals, historicalMeals } = splitMealsByToday(mealHistory);
  const historicalMealGroups = groupMealsByDate(historicalMeals);
  const today = nutritionSummary?.today;
  const goals = nutritionSummary?.goals;
  const calorieGoal = goals?.adjustedCalorieGoal ?? goals?.calorieGoal ?? null;
  const calorieProgress = calorieGoal ? getProgressPercent(today?.calories ?? 0, calorieGoal) : 0;
  const caloriesRemaining = calorieGoal
    ? Math.max(0, calorieGoal - (today?.calories ?? 0))
    : null;
  const macroSummaries = [
    {
      label: "Protein",
      value: today?.proteinGrams ?? 0,
      goal: goals?.proteinGoalGrams ?? null
    },
    {
      label: "Carbs",
      value: today?.carbsGrams ?? 0,
      goal: goals?.carbGoalGrams ?? null
    },
    {
      label: "Fat",
      value: today?.fatGrams ?? 0,
      goal: goals?.fatGoalGrams ?? null
    }
  ];

  return (
    <div className="page-shell space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Meals</h1>
          <p className="page-description">
            Track today&apos;s food log separately from your longer meal history.
          </p>
        </div>
        <MealComposer
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Log meal
            </Button>
          }
        />
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
                <Flame className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Today&apos;s food log</p>
                <p className="text-xs text-muted-foreground">
                  {today?.mealCount ?? 0} meal{today?.mealCount !== 1 ? "s" : ""} logged
                </p>
              </div>
            </div>
            {loadingNutrition ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-2 w-full" />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-3xl font-bold leading-none">{today?.calories ?? 0}</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      calories logged
                    </p>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {calorieGoal
                      ? `${caloriesRemaining} cal left of ${calorieGoal}`
                      : "Set a calorie goal in Settings"}
                  </p>
                </div>
                <Progress value={calorieProgress} max={100} className="mt-4" />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {macroSummaries.map((macro) => (
          <MacroGoalCard
            key={macro.label}
            label={macro.label}
            value={macro.value}
            goal={macro.goal}
            loading={loadingNutrition}
          />
        ))}
      </div>

      <Card>
        {isLoading ? (
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div>
                  <CardTitle>Today&apos;s Meals</CardTitle>
                  <CardDescription>
                    {todayMeals.length} meal{todayMeals.length !== 1 ? "s" : ""} logged today.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {todayMeals.length === 0 ? (
                <div className="empty-panel min-h-44">
                  <div>
                    <UtensilsCrossed className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      No meals logged for today yet.
                    </p>
                    <MealComposer trigger={<Button className="mt-4">Log today&apos;s first meal</Button>} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayMeals.map((meal) => (
                    <MealCard key={meal.id} meal={meal} />
                  ))}
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>

      <Card>
        {isLoading ? (
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground">
                  <History className="h-4 w-4" />
                </span>
                <div>
                  <CardTitle>Meal History</CardTitle>
                  <CardDescription>
                    Older meals with saved estimates and corrections.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {mealHistory.length === 0 ? (
                <div className="empty-panel min-h-44">
                  <div>
                    <UtensilsCrossed className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No meals logged yet.</p>
                    <MealComposer trigger={<Button className="mt-4">Log your first meal</Button>} />
                  </div>
                </div>
              ) : historicalMealGroups.length === 0 ? (
                <div className="surface-muted p-4 text-sm text-muted-foreground">
                  Older meals will appear here after today.
                </div>
              ) : (
                <div className="space-y-5">
                  {historicalMealGroups.map((group) => (
                    <section key={group.dateKey} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-foreground">
                          {formatHistoryDate(group.dateKey)}
                        </h2>
                        <span className="text-xs text-muted-foreground">
                          {group.meals.length} meal{group.meals.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {group.meals.map((meal) => (
                          <MealCard key={meal.id} meal={meal} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

function splitMealsByToday(meals: Meal[]) {
  const todayKey = getLocalDateKey(new Date());
  return meals.reduce(
    (groups, meal) => {
      if (getLocalDateKey(new Date(meal.eatenAt)) === todayKey) {
        groups.todayMeals.push(meal);
      } else {
        groups.historicalMeals.push(meal);
      }
      return groups;
    },
    { todayMeals: [] as Meal[], historicalMeals: [] as Meal[] }
  );
}

function groupMealsByDate(meals: Meal[]) {
  const groups = new Map<string, Meal[]>();
  meals.forEach((meal) => {
    const dateKey = getLocalDateKey(new Date(meal.eatenAt));
    groups.set(dateKey, [...(groups.get(dateKey) ?? []), meal]);
  });

  return Array.from(groups.entries()).map(([dateKey, groupedMeals]) => ({
    dateKey,
    meals: groupedMeals
  }));
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatHistoryDate(dateKey: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${dateKey}T12:00:00`));
}

function MacroGoalCard({
  label,
  value,
  goal,
  loading
}: {
  label: string;
  value: number;
  goal: number | null;
  loading: boolean;
}) {
  const progress = goal ? getProgressPercent(value, goal) : 0;
  const remaining = goal ? Math.max(0, Math.round(goal - value)) : null;

  return (
    <Card className="py-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{loading ? "—" : formatMacroValue(value)}</p>
          </div>
          <span className="text-xs text-muted-foreground">
            {goal ? `${progress}%` : "No goal"}
          </span>
        </div>
        <Progress value={progress} max={100} className="mt-3" />
        <p className="mt-2 text-xs text-muted-foreground">
          {goal ? `${remaining}g left of ${Math.round(goal)}g` : "Set this goal in Settings"}
        </p>
      </CardContent>
    </Card>
  );
}
