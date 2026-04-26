import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MealComposer } from "@/features/meals/MealComposer";
import { formatDateTime, formatMacroValue } from "@/lib/mealUtils";
import type { Meal } from "@/types";

export function MealCard({ meal }: { meal: Meal }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-4 pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-semibold truncate">{meal.title}</p>
            <span className="text-xs text-muted-foreground shrink-0">{formatDateTime(meal.eatenAt)}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs">
            <span className="font-medium">{meal.estimatedCalories ?? 0} cal</span>
            <Badge variant="outline" className="text-[10px]">P {formatMacroValue(meal.proteinGrams)}</Badge>
            <Badge variant="outline" className="text-[10px]">C {formatMacroValue(meal.carbsGrams)}</Badge>
            <Badge variant="outline" className="text-[10px]">F {formatMacroValue(meal.fatGrams)}</Badge>
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
      </CardContent>
    </Card>
  );
}
