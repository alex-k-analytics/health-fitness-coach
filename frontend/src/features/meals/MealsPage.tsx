import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMealsQuery } from "@/features/meals/hooks";
import { formatDateTime, formatMacroValue } from "@/lib/mealUtils";
import { MealComposer } from "@/features/meals/MealComposer";
import type { Meal } from "@/types";

export function MealsPage() {
  const { data: meals, isLoading } = useMealsQuery(24);

  return (
    <div className="px-4 py-4 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meal Log</h1>
          <p className="text-sm text-muted-foreground">Your recent meals and nutrition entries.</p>
        </div>
        <MealComposer />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent meals</CardTitle>
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
              <p className="text-muted-foreground">No meals logged yet.</p>
              <MealComposer trigger={<Button className="mt-4">Log your first meal</Button>} />
            </div>
          ) : (
            <div className="space-y-3">
              {(meals?.meals ?? []).map((meal: Meal) => (
                <div key={meal.id} className="flex items-start justify-between gap-3 py-3 border-b last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{meal.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(meal.eatenAt)}</p>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <Badge variant="secondary">{meal.estimatedCalories ?? 0} cal</Badge>
                      <Badge variant="outline">P {formatMacroValue(meal.proteinGrams)}</Badge>
                      <Badge variant="outline">C {formatMacroValue(meal.carbsGrams)}</Badge>
                      <Badge variant="outline">F {formatMacroValue(meal.fatGrams)}</Badge>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
