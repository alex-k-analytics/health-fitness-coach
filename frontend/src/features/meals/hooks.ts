import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/api";
import { useShellStore } from "@/stores/shellStore";
import type { Meal, NutritionEstimate, SavedFood } from "@/types";

const MIN_MEALS_QUERY_LIMIT = 1;
const MAX_MEALS_QUERY_LIMIT = 50;

export const RECENT_MEALS_QUERY_LIMIT = MAX_MEALS_QUERY_LIMIT;

function clampMealsQueryLimit(limit: number) {
  if (!Number.isFinite(limit)) return 24;
  return Math.min(
    MAX_MEALS_QUERY_LIMIT,
    Math.max(MIN_MEALS_QUERY_LIMIT, Math.trunc(limit))
  );
}

export function useMealsQuery(limit = 24) {
  const safeLimit = clampMealsQueryLimit(limit);

  return useQuery({
    queryKey: ["meals", safeLimit],
    queryFn: () => apiFetch<{ meals: Meal[] }>(`/nutrition/meals?limit=${safeLimit}`)
  });
}

export function useSavedFoodsQuery() {
  return useQuery({
    queryKey: ["savedFoods"],
    queryFn: () => apiFetch<{ foods: SavedFood[] }>("/nutrition/saved-foods")
  });
}

export function useMealEstimateMutation() {
  const setGlobalNotice = useShellStore.getState().setGlobalNotice;
  const setGlobalError = useShellStore.getState().setGlobalError;

  return useMutation({
    mutationFn: (formData: FormData) =>
      apiFetch<{ analysis: NutritionEstimate }>("/nutrition/estimate", {
        method: "POST",
        body: formData
      }),
    onSuccess: (result) => {
      setGlobalNotice(
        result.analysis.status === "COMPLETED"
          ? "Nutrition estimate ready."
          : "Estimate ready. Review before saving."
      );
    },
    onError: (error) => {
      setGlobalError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });
}

export function useCreateMealMutation() {
  const queryClient = useQueryClient();
  const setGlobalNotice = useShellStore.getState().setGlobalNotice;
  const setGlobalError = useShellStore.getState().setGlobalError;

  return useMutation({
    mutationFn: (formData: FormData) =>
      apiFetch<{ meal: Meal; savedFoodId: string | null }>("/nutrition/meals", {
        method: "POST",
        body: formData
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      queryClient.invalidateQueries({ queryKey: ["nutritionSummary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setGlobalNotice(
        result.savedFoodId ? "Meal saved and added to reusable foods." : "Meal analyzed and saved."
      );
    },
    onError: (error) => {
      setGlobalError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });
}

export function useUpdateMealMutation() {
  const queryClient = useQueryClient();
  const setGlobalNotice = useShellStore.getState().setGlobalNotice;
  const setGlobalError = useShellStore.getState().setGlobalError;

  return useMutation({
    mutationFn: ({ mealId, body }: { mealId: string; body: object }) =>
      apiFetch<{ meal: Meal }>(`/nutrition/meals/${mealId}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      queryClient.invalidateQueries({ queryKey: ["nutritionSummary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setGlobalNotice("Meal updated.");
    },
    onError: (error) => {
      setGlobalError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });
}
