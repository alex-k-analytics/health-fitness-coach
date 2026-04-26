import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/api";
import { useShellStore } from "@/stores/shellStore";
import type { Workout, WorkoutSession } from "@/types";

export function useWorkoutsQuery(limit = 24) {
  return useQuery({
    queryKey: ["workouts", limit],
    queryFn: () => apiFetch<{ workouts: Workout[] }>(`/workouts?limit=${limit}`)
  });
}

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
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
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
