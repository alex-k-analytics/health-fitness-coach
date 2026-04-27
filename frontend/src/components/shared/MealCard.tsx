import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MealComposer } from "@/features/meals/MealComposer";
import { apiAssetUrl } from "@/api";
import { formatDateTime, formatMacroValue } from "@/lib/mealUtils";
import type { Meal } from "@/types";

export function MealCard({ meal }: { meal: Meal }) {
  const plateImage = meal.images?.find((image) => image.kind === "PLATE") ?? null;

  return (
    <Card className="py-0">
      <CardContent className="flex items-center justify-between gap-3 p-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {plateImage && (
            <img
              src={apiAssetUrl(`/nutrition/images/${plateImage.id}`)}
              alt=""
              className="h-16 w-16 shrink-0 rounded-md border object-cover"
              loading="lazy"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-sm font-semibold truncate">{meal.title}</p>
              <span className="text-xs text-muted-foreground shrink-0">{formatDateTime(meal.eatenAt)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
              <span className="font-medium">{meal.estimatedCalories ?? 0} cal</span>
              <Badge variant="outline" className="h-5 px-2 text-[10px]">P {formatMacroValue(meal.proteinGrams)}</Badge>
              <Badge variant="outline" className="h-5 px-2 text-[10px]">C {formatMacroValue(meal.carbsGrams)}</Badge>
              <Badge variant="outline" className="h-5 px-2 text-[10px]">F {formatMacroValue(meal.fatGrams)}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
              {meal.servingDescription && <span>{meal.servingDescription}</span>}
              {plateImage && <span>food photo</span>}
              {meal.analysisStatus && meal.analysisStatus !== "COMPLETED" && (
                <Badge variant="warning">{meal.analysisStatus}</Badge>
              )}
            </div>
          </div>
        </div>
        <MealComposer
          initialMeal={meal}
          trigger={<Button size="sm" variant="ghost" className="shrink-0 px-2">Edit</Button>}
        />
      </CardContent>
    </Card>
  );
}
