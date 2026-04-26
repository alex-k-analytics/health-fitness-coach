import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/api";
import type { ProfileData, HealthMetric, Meal, SavedFood } from "@/types";
import { useShellStore } from "@/stores/shellStore";

export function useProfileQuery() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => apiFetch<ProfileData>("/profile/me")
  });
}

export function useHealthMetricsQuery(limit = 12) {
  return useQuery({
    queryKey: ["healthMetrics", limit],
    queryFn: () => apiFetch<{ metrics: HealthMetric[] }>(`/profile/me/health-metrics?limit=${limit}`)
  });
}

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

export function useProfileMutation() {
  const queryClient = useQueryClient();
  const setGlobalNotice = useShellStore.getState().setGlobalNotice;
  const setGlobalError = useShellStore.getState().setGlobalError;

  return useMutation({
    mutationFn: (data: {
      displayName: string;
      goalSummary: string | null;
      calorieGoal: number | null | undefined;
      proteinGoalGrams: number | null | undefined;
      carbGoalGrams: number | null | undefined;
      fatGoalGrams: number | null | undefined;
      heightCm: number | null | undefined;
      activityLevel: string | null | undefined;
      notes: string | null | undefined;
    }) =>
      apiFetch("/profile/me", {
        method: "PATCH",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["nutritionSummary"] });
      setGlobalNotice("Profile updated.");
    },
    onError: (error) => {
      setGlobalError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });
}

export function useCreateWeightMutation() {
  const queryClient = useQueryClient();
  const setGlobalNotice = useShellStore.getState().setGlobalNotice;
  const setGlobalError = useShellStore.getState().setGlobalError;

  return useMutation({
    mutationFn: (data: { recordedAt?: string; weightKg?: number }) =>
      apiFetch("/profile/me/health-metrics", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["healthMetrics"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["nutritionSummary"] });
      setGlobalNotice("Weight logged.");
    },
    onError: (error) => {
      setGlobalError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });
}
