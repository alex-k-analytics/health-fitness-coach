import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useNutritionSummaryQuery } from "@/features/dashboard/hooks";
import { useMealsQuery } from "@/features/meals/hooks";
import { MealComposer } from "@/features/meals/MealComposer";
import { MealCard } from "@/components/shared/MealCard";
import { formatMacroValue, getProgressPercent } from "@/lib/mealUtils";
import { UtensilsCrossed } from "lucide-react";
import type { Meal } from "@/types";

export function MealsPage() {
  const { data: meals, isLoading } = useMealsQuery(24);
  const { data: nutritionSummary, isLoading: loadingNutrition } = useNutritionSummaryQuery();
  const today = nutritionSummary?.today;
  const goals = nutritionSummary?.goals;
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
    <div className="px-4 py-4 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meals</h1>
          <p className="text-sm text-muted-foreground">Your recent meals and nutrition entries.</p>
        </div>
        <MealComposer />
      </div>

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
        <CardHeader>
          <CardTitle>Recent Meals</CardTitle>
          <CardDescription>
            {meals?.meals?.length ?? 0} meal{meals?.meals?.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : meals?.meals?.length === 0 ? (
            <div className="text-center py-10">
              <UtensilsCrossed className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground">No meals logged yet.</p>
              <MealComposer trigger={<Button className="mt-4">Log your first meal</Button>} />
            </div>
          ) : (
            <div className="space-y-2">
              {(meals?.meals ?? []).map((meal: Meal) => (
                <MealCard key={meal.id} meal={meal} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
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
