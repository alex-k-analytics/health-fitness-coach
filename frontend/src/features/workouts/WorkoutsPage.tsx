import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkoutSessionModal } from "@/components/workouts/WorkoutSessionModal";
import { useWorkoutsQuery } from "@/features/workouts/hooks";
import { useWorkoutSessionsQuery } from "@/features/workouts/hooks";
import { formatDate, formatDuration } from "@/lib/mealUtils";

export function WorkoutsPage() {
  const { data: workouts, isLoading: loadingWorkouts } = useWorkoutsQuery();
  const { data: sessions, isLoading: loadingSessions } = useWorkoutSessionsQuery(12);

  return (
    <div className="px-4 py-4 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workouts</h1>
          <p className="text-sm text-muted-foreground">Your exercise history and sessions.</p>
        </div>
        <WorkoutSessionModal />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workout sessions</CardTitle>
          <CardDescription>
            {sessions?.sessions?.length ?? 0} completed session{sessions?.sessions?.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSessions ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : sessions?.sessions?.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No workouts logged yet.</p>
              <WorkoutSessionModal trigger={<Button className="mt-4">Log your first workout</Button>} />
            </div>
          ) : (
            <div className="space-y-2">
                {(sessions?.sessions ?? []).map((s) => (
                  <div key={s.id} className="rounded-lg border border-border bg-card p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{s.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.activityType} · {formatDate(s.performedAt)}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        <Badge variant="secondary">{s.totalCalories ?? 0} cal</Badge>
                        {s.durationSeconds != null && (
                          <Badge variant="outline">{formatDuration(s.durationSeconds)}</Badge>
                        )}
                        <Badge variant="outline">{s.exercises?.length ?? 0} exercise{s.exercises?.length !== 1 ? "s" : ""}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {workouts?.workouts && workouts.workouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Workout entries</CardTitle>
            <CardDescription>
              {workouts.workouts.length} quick workout{workouts.workouts.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingWorkouts ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                {workouts.workouts.map((w) => (
                  <div key={w.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-semibold">{w.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(w.performedAt)}</p>
                    </div>
                    <Badge variant="secondary">{w.caloriesBurned} cal</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
