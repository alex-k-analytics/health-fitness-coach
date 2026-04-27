import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkoutSessionModal } from "@/components/workouts/WorkoutSessionModal";
import { WorkoutCard } from "@/components/shared/WorkoutCard";
import { useWorkoutsQuery } from "@/features/workouts/hooks";
import { useWorkoutSessionsQuery } from "@/features/workouts/hooks";
import { formatDate, formatDuration } from "@/lib/mealUtils";
import { Dumbbell } from "lucide-react";

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
        {loadingSessions ? (
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Workout Sessions</CardTitle>
              <CardDescription>
                {sessions?.sessions?.length ?? 0} completed session{sessions?.sessions?.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessions?.sessions?.length === 0 ? (
                <div className="text-center py-10">
                  <Dumbbell className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">No workouts logged yet.</p>
                  <WorkoutSessionModal trigger={<Button className="mt-4">Log your first workout</Button>} />
                </div>
              ) : (
                <div className="space-y-2">
                  {(sessions?.sessions ?? []).map((s) => (
                    <WorkoutCard key={s.id} session={s} />
                  ))}
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>

      {loadingWorkouts ? (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      ) : workouts?.workouts && workouts.workouts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Quick Entries</CardTitle>
            <CardDescription>
              {workouts.workouts.length} quick workout{workouts.workouts.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {workouts.workouts.map((w) => (
                <Card key={w.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-semibold">{w.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(w.performedAt)}</p>
                    </div>
                    <Badge variant="secondary">{w.caloriesBurned} cal</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
