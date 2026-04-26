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
      </Card>

      {workouts?.workouts && workouts.workouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quick entries</CardTitle>
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
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
