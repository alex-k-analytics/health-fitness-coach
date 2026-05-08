import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkoutSessionModal } from "@/components/workouts/WorkoutSessionModal";
import { WorkoutCard } from "@/components/shared/WorkoutCard";
import { useWorkoutSessionsQuery } from "@/features/workouts/hooks";
import { Activity, CalendarDays, Dumbbell, Flame, Plus, Timer, TrendingUp } from "lucide-react";
import type { ComponentType } from "react";
import type { WorkoutSession } from "@/types";

export function WorkoutsPage() {
  const { data: sessions, isLoading: loadingSessions } = useWorkoutSessionsQuery(50);
  const workoutSessions = sessions?.sessions ?? [];
  const weeklySummary = buildWeeklyWorkoutSummary(workoutSessions);

  return (
    <div className="page-shell space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Training</h1>
          <p className="page-description">Start a live session, log a completed workout, and review recent training volume.</p>
        </div>
        <WorkoutSessionModal
          defaultIntent="timer"
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Start workout
            </Button>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="card-accent-brand">
          <CardHeader>
            <CardTitle>Log Training</CardTitle>
            <CardDescription>Choose the path that matches what you are doing now.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <WorkoutSessionModal
              defaultIntent="timer"
              trigger={
                <Button className="min-h-12 justify-start" size="lg">
                  <Timer className="h-5 w-5" />
                  Start a timed session
                </Button>
              }
            />
            <WorkoutSessionModal
              defaultIntent="quick"
              trigger={
                <Button className="min-h-12 justify-start" size="lg" variant="outline">
                  <Dumbbell className="h-5 w-5" />
                  Log a completed workout
                </Button>
              }
            />
            <div className="surface-muted flex items-start gap-3 p-3 text-sm text-muted-foreground">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <p>Use timed sessions while training. Use completed logs for workouts from earlier today or imported notes.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>This Week</CardTitle>
            <CardDescription>Completed sessions since Sunday.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSessions ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryTile icon={CalendarDays} label="Sessions" value={String(weeklySummary.sessionCount)} />
                <SummaryTile icon={TrendingUp} label="Cardio distance" value={`${formatNumber(weeklySummary.cardioDistanceMiles, 1)} mi`} />
                <SummaryTile icon={Dumbbell} label="Weight lifted" value={`${formatNumber(weeklySummary.weightLiftedLbs, 0)} lb`} />
                <SummaryTile icon={Flame} label="Calories burned" value={`${Math.round(weeklySummary.caloriesBurned)} cal`} />
              </div>
            )}
          </CardContent>
        </Card>
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
              <CardTitle>Recent Sessions</CardTitle>
              <CardDescription>
                {workoutSessions.length} completed session{workoutSessions.length !== 1 ? "s" : ""} total
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workoutSessions.length === 0 ? (
                <div className="empty-panel">
                  <div>
                    <Dumbbell className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-muted-foreground">No workouts logged yet.</p>
                    <WorkoutSessionModal defaultIntent="timer" trigger={<Button className="mt-4">Start your first workout</Button>} />
                  </div>
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

function SummaryTile({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="surface-muted p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
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
      summary.sessionCount += 1;
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
    { sessionCount: 0, cardioDistanceMiles: 0, weightLiftedLbs: 0, caloriesBurned: 0 }
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
