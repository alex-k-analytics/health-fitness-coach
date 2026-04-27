import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkoutSessionModal } from "@/components/workouts/WorkoutSessionModal";
import { WorkoutCard } from "@/components/shared/WorkoutCard";
import { useWorkoutSessionsQuery } from "@/features/workouts/hooks";
import { Dumbbell } from "lucide-react";
import type { WorkoutSession } from "@/types";

export function WorkoutsPage() {
  const { data: sessions, isLoading: loadingSessions } = useWorkoutSessionsQuery(50);
  const workoutSessions = sessions?.sessions ?? [];
  const weeklySummary = buildWeeklyWorkoutSummary(workoutSessions);

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
          <CardTitle>This Week</CardTitle>
          <CardDescription>Workout totals from completed sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSessions ? (
            <div className="grid gap-3 md:grid-cols-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryTile label="Cardio distance" value={`${formatNumber(weeklySummary.cardioDistanceMiles, 1)} mi`} />
              <SummaryTile label="Weight lifted" value={`${formatNumber(weeklySummary.weightLiftedLbs, 0)} lb`} />
              <SummaryTile label="Calories burned" value={`${Math.round(weeklySummary.caloriesBurned)} cal`} />
            </div>
          )}
        </CardContent>
      </Card>

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
                {workoutSessions.length} completed session{workoutSessions.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workoutSessions.length === 0 ? (
                <div className="text-center py-10">
                  <Dumbbell className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">No workouts logged yet.</p>
                  <WorkoutSessionModal trigger={<Button className="mt-4">Log your first workout</Button>} />
                </div>
              ) : (
                <div className="space-y-2">
                  {workoutSessions.map((s) => (
                    <WorkoutCard key={s.id} session={s} />
                  ))}
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function buildWeeklyWorkoutSummary(sessions: WorkoutSession[]) {
  const { start, end } = getCurrentLocalWeekBounds();
  const weekSessions = sessions.filter((session) => {
    const performedAt = new Date(session.performedAt);
    return performedAt >= start && performedAt < end;
  });

  return weekSessions.reduce(
    (summary, session) => {
      summary.caloriesBurned += session.totalCalories ?? 0;

      session.exercises.forEach((exercise) => {
        if (exercise.kind === "CARDIO") {
          summary.cardioDistanceMiles += exercise.distance ?? 0;
          return;
        }

        summary.weightLiftedLbs += (exercise.sets ?? []).reduce(
          (total, set) => total + set.reps * set.weightLbs,
          0
        );
      });

      return summary;
    },
    { cardioDistanceMiles: 0, weightLiftedLbs: 0, caloriesBurned: 0 }
  );
}

function getCurrentLocalWeekBounds() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return { start, end };
}

function formatNumber(value: number, maximumFractionDigits: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}
