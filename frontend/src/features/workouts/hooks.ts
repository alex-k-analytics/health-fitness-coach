import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/api";
import { useShellStore } from "@/stores/shellStore";
import type { WorkoutExerciseHistoryEntry, WorkoutSession } from "@/types";

export function useWorkoutSessionsQuery(limit = 3) {
  return useQuery({
    queryKey: ["workoutSessions", limit],
    queryFn: () => apiFetch<{ sessions: WorkoutSession[] }>(`/workouts/sessions?limit=${limit}&status=COMPLETED`)
  });
}

export function useExerciseListQuery() {
  return useQuery({
    queryKey: ["exerciseList"],
    queryFn: () => apiFetch<{ exercises: Record<string, string[]> }>("/workouts/exercises")
  });
}

export function useExerciseHistoryQuery(names: string[], excludeSessionId?: string) {
  const uniqueNames = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean))).sort();
  const namesKey = uniqueNames.join("|");

  return useQuery({
    queryKey: ["exerciseHistory", namesKey, excludeSessionId ?? ""],
    enabled: uniqueNames.length > 0,
    queryFn: () => {
      const params = new URLSearchParams({ names: uniqueNames.join(",") });
      if (excludeSessionId) params.set("excludeSessionId", excludeSessionId);
      return apiFetch<{ history: Record<string, WorkoutExerciseHistoryEntry | null> }>(`/workouts/exercise-history?${params.toString()}`);
    }
  });
}

export function useCreateWorkoutMutation() {
  const queryClient = useQueryClient();
  const setGlobalNotice = useShellStore.getState().setGlobalNotice;
  const setGlobalError = useShellStore.getState().setGlobalError;

  return useMutation({
    mutationFn: (data: { title: string; caloriesBurned?: number; performedAt?: string }) =>
      apiFetch("/workouts", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workoutSessions"] });
      queryClient.invalidateQueries({ queryKey: ["nutritionSummary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setGlobalNotice("Workout logged.");
    },
    onError: (error) => {
      setGlobalError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });
}

export function useCreateSessionMutation() {
  const queryClient = useQueryClient();
  const setGlobalNotice = useShellStore.getState().setGlobalNotice;
  const setGlobalError = useShellStore.getState().setGlobalError;

  return useMutation({
    mutationFn: (data: {
      activityType: string;
      title: string;
      startTime?: string | null;
      endTime: string;
      durationSeconds?: number;
      totalCalories: number;
      categoryCalories: Record<string, number>;
      exercises: unknown[];
    }) =>
      apiFetch("/workouts/sessions", {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workoutSessions"] });
      queryClient.invalidateQueries({ queryKey: ["nutritionSummary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setGlobalNotice("Workout saved.");
    },
    onError: (error) => {
      setGlobalError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });
}

export function useUpdateSessionMutation() {
  const queryClient = useQueryClient();
  const setGlobalNotice = useShellStore.getState().setGlobalNotice;
  const setGlobalError = useShellStore.getState().setGlobalError;

  return useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: {
        activityType: string;
        title: string;
        startTime?: string | null;
        endTime?: string | null;
        durationSeconds?: number;
        totalCalories: number;
        categoryCalories: Record<string, number>;
        performedAt?: string;
        exercises: unknown[];
      };
    }) =>
      apiFetch(`/workouts/sessions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workoutSessions"] });
      queryClient.invalidateQueries({ queryKey: ["nutritionSummary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setGlobalNotice("Workout updated.");
    },
    onError: (error) => {
      setGlobalError(error instanceof Error ? error.message : "Something went wrong.");
    }
  });
}

export function useDeleteSessionMutation() {
  const queryClient = useQueryClient();
  const setGlobalNotice = useShellStore.getState().setGlobalNotice;
  const setGlobalError = useShellStore.getState().setGlobalError;

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/workouts/sessions/${id}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workoutSessions"] });
      queryClient.invalidateQueries({ queryKey: ["nutritionSummary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setGlobalNotice("Workout deleted.");
    },
    onError: (error) => {
      setGlobalError(error instanceof Error ? error.message : "Unable to delete workout.");
    }
  });
}
