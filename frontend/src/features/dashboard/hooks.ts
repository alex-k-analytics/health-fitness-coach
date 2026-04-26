import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api";
import type { NutritionSummary } from "@/types";

export function useNutritionSummaryQuery() {
  return useQuery({
    queryKey: ["nutritionSummary"],
    queryFn: () =>
      apiFetch<NutritionSummary>(
        `/nutrition/summary?timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`
      )
  });
}
