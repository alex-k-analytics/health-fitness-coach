import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/api";
import { useShellStore } from "@/stores/shellStore";
import type { Meal, NutritionEstimate, SavedFood } from "@/types";
import { getServingCount, scaleNutritionEstimate } from "@/lib/mealUtils";

export function useMealsQuery(limit = 24) {
  return useQuery({
    queryKey: ["meals", limit],
    queryFn: () => apiFetch<{ meals: Meal[] }>(`/nutrition/meals?limit=${limit}`)
  });
}

export function useSavedFoodsQuery() {
  return useQuery({
    queryKey: ["savedFoods"],
    queryFn: () => apiFetch<{ foods: SavedFood[] }>("/nutrition/saved-foods")
  });
}

export function useMealEstimateMutation() {
  const queryClient = useQueryClient();
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
    mutationFn: (data: { formData: FormData; confirmedAnalysis: NutritionEstimate; reusableAnalysis: NutritionEstimate }) =>
      apiFetch<{ meal: Meal; savedFoodId: string | null }>("/nutrition/meals", {
        method: "POST",
        body: data.formData
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
