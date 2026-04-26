import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMealsQuery } from "@/features/meals/hooks";
import { MealComposer } from "@/features/meals/MealComposer";
import { MealCard } from "@/components/shared/MealCard";
import { UtensilsCrossed } from "lucide-react";
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
