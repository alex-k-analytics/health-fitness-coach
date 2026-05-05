import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/api";
import { useShellStore } from "@/stores/shellStore";
import type {
  MealPlanRunDetail,
  MealPlanRunSummary,
  MealPlannerPreferences,
  RecipeSourceCredential
} from "@/types";

export function useMealPlanPreferencesQuery() {
  return useQuery({
    queryKey: ["mealPlanPreferences"],
    queryFn: () => apiFetch<MealPlannerPreferences>("/meal-plans/preferences")
  });
}

export function useRecipeSourcesQuery() {
  return useQuery({
    queryKey: ["mealPlanSources"],
    queryFn: () => apiFetch<{ sources: RecipeSourceCredential[] }>("/meal-plans/sources")
  });
}

export function useMealPlanRunsQuery() {
  return useQuery({
    queryKey: ["mealPlanRuns"],
    queryFn: () => apiFetch<{ runs: MealPlanRunSummary[] }>("/meal-plans/runs")
  });
}

export function useMealPlanRunQuery(runId: string | null) {
  return useQuery({
    queryKey: ["mealPlanRun", runId],
    queryFn: () => apiFetch<MealPlanRunDetail>(`/meal-plans/runs/${runId}`),
    enabled: Boolean(runId)
  });
}

export function useMealPlanStatusQuery(runId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["mealPlanStatus", runId],
    queryFn: () =>
      apiFetch<{
        id: string;
        status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
        progressStage: string | null;
        progressPercent: number;
        errorMessage: string | null;
        updatedAt: string;
      }>(`/meal-plans/runs/${runId}/status`),
    enabled: Boolean(runId) && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 1000;
      return data.status === "PENDING" || data.status === "RUNNING" ? 1000 : false;
    }
  });
}

function createMutationHelpers() {
  const queryClient = useQueryClient();
  const setGlobalNotice = useShellStore.getState().setGlobalNotice;
  const setGlobalError = useShellStore.getState().setGlobalError;
  return { queryClient, setGlobalNotice, setGlobalError };
}

export function useUpdateMealPlanPreferencesMutation() {
  const { queryClient, setGlobalNotice, setGlobalError } = createMutationHelpers();
  return useMutation({
    mutationFn: (body: Partial<MealPlannerPreferences>) =>
      apiFetch<MealPlannerPreferences>("/meal-plans/preferences", {
        method: "PATCH",
        body: JSON.stringify(body)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mealPlanPreferences"] });
      setGlobalNotice("Planning preferences saved.");
    },
    onError: (error) => {
      setGlobalError(error instanceof Error ? error.message : "Unable to save preferences.");
    }
  });
}

export function useSaveRecipeSourceMutation() {
  const { queryClient, setGlobalNotice, setGlobalError } = createMutationHelpers();
  return useMutation({
    mutationFn: ({ source, body }: { source: string; body: Record<string, unknown> }) =>
      apiFetch<{ source: RecipeSourceCredential }>(`/meal-plans/sources/${source}`, {
        method: "POST",
        body: JSON.stringify(body)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mealPlanSources"] });
      setGlobalNotice("Recipe source saved.");
    },
    onError: (error) => {
      setGlobalError(error instanceof Error ? error.message : "Unable to save recipe source.");
    }
  });
}

export function useDeleteRecipeSourceMutation() {
  const { queryClient, setGlobalNotice, setGlobalError } = createMutationHelpers();
  return useMutation({
    mutationFn: (source: string) =>
      apiFetch<{ deleted: boolean }>(`/meal-plans/sources/${source}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mealPlanSources"] });
      setGlobalNotice("Recipe source deleted.");
    },
    onError: (error) => {
      setGlobalError(error instanceof Error ? error.message : "Unable to delete recipe source.");
    }
  });
}

export function useCreateMealPlanRunMutation() {
  const { queryClient, setGlobalNotice, setGlobalError } = createMutationHelpers();
  return useMutation({
    mutationFn: (body: {
      ingredients: string;
      instructions: string;
      recipeSources: string[];
      maxRecipes: number;
      maxMeals: number;
      useOpenAi: boolean;
    }) =>
      apiFetch<{
        runId: string;
        status: "PENDING" | "RUNNING";
        progressStage: string | null;
        progressPercent: number;
      }>("/meal-plans/runs", {
        method: "POST",
        body: JSON.stringify(body)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mealPlanRuns"] });
      setGlobalNotice("Planning run started.");
    },
    onError: (error) => {
      setGlobalError(error instanceof Error ? error.message : "Unable to start planning run.");
    }
  });
}

export function useReshuffleMealPlanMutation() {
  const { queryClient, setGlobalNotice, setGlobalError } = createMutationHelpers();
  return useMutation({
    mutationFn: ({ runId, title, url }: { runId: string; title: string; url: string }) =>
      apiFetch<MealPlanRunDetail>(`/meal-plans/runs/${runId}/reshuffle`, {
        method: "POST",
        body: JSON.stringify({ title, url })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mealPlanRuns"] });
      setGlobalNotice("Meal plan reshuffled.");
    },
    onError: (error) => {
      setGlobalError(error instanceof Error ? error.message : "Unable to reshuffle meal plan.");
    }
  });
}
