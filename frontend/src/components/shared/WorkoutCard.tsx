import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkoutSessionModal } from "@/components/workouts/WorkoutSessionModal";
import { formatDuration } from "@/lib/mealUtils";
import { Copy, Pencil } from "lucide-react";
import type { WorkoutSession } from "@/types";

export function WorkoutCard({ session }: { session: WorkoutSession }) {
  const dateLabel = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(session.performedAt));
  const workoutLabel = getWorkoutDisplayLabel(session);
  const exerciseSummary = (session.exercises ?? [])
    .map((exercise) => {
      if (exercise.kind === "LIFT" && exercise.sets?.length) {
        return `${exercise.name} ${exercise.sets.map((set) => `${set.reps}x${set.weightLbs}`).join("/")}`;
      }

      if (exercise.durationSeconds) {
        return `${exercise.name} ${Math.round(exercise.durationSeconds / 60)} min`;
      }

      return exercise.name;
    })
    .filter(Boolean)
    .join(" / ");

  return (
    <Card className="interactive-surface py-0">
      <CardContent className="flex min-h-[96px] flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="max-w-full truncate text-base font-semibold leading-tight">{session.title}</p>
            <span className="shrink-0 text-sm text-muted-foreground">{dateLabel}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{session.totalCalories ?? 0} cal</span>
            {session.durationSeconds != null ? (
              <Badge variant="outline">{formatDuration(session.durationSeconds)}</Badge>
            ) : null}
            <Badge variant={workoutLabel === "Mixed" ? "brand" : "outline"}>{workoutLabel}</Badge>
          </div>

          {exerciseSummary ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{exerciseSummary}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {session.exercises?.length ? (
            <div className="surface-muted hidden px-3 py-2 text-center sm:block">
              <p className="text-lg font-semibold leading-none">{session.exercises.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                exercise{session.exercises.length !== 1 ? "s" : ""}
              </p>
            </div>
          ) : null}
          <WorkoutSessionModal
            repeatFrom={session}
            trigger={
              <Button variant="outline" size="sm">
                <Copy className="h-4 w-4" />
                Repeat
              </Button>
            }
          />
          <WorkoutSessionModal
            session={session}
            trigger={
              <Button variant="ghost" size="sm">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function getWorkoutDisplayLabel(session: WorkoutSession) {
  const exercises = session.exercises ?? [];
  if (exercises.length === 0) return session.activityType.toLowerCase();
  const kinds = new Set(exercises.map((exercise) => exercise.kind));
  if (kinds.size > 1) return "Mixed";
  if (kinds.has("LIFT")) return "Strength";
  const categories = new Set(exercises.map((exercise) => exercise.category));
  if (categories.size > 1) return "Mixed cardio";
  return exercises[0].category.toLowerCase();
}
