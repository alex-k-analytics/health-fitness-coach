import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/mealUtils";
import type { WorkoutSession } from "@/types";

export function WorkoutCard({ session }: { session: WorkoutSession }) {
  const dateLabel = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(session.performedAt));
  const exerciseSummary = (session.exercises ?? [])
    .map((ex) => {
      if (ex.kind === "LIFT" && ex.sets?.length) {
        return `${ex.name} ${ex.sets.length}x${ex.sets[0]?.reps ?? "?"}`;
      }

      if (ex.durationSeconds) {
        return `${ex.name} ${Math.round(ex.durationSeconds / 60)} min`;
      }

      return ex.name;
    })
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="py-0">
      <CardContent className="flex min-h-[96px] items-center justify-between gap-4 p-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="max-w-full truncate text-base font-semibold leading-tight">{session.title}</p>
            <span className="text-sm text-muted-foreground shrink-0">{dateLabel}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{session.totalCalories ?? 0} cal</span>
            {session.durationSeconds != null && (
              <Badge variant="outline">{formatDuration(session.durationSeconds)}</Badge>
            )}
            <Badge variant="outline">{session.activityType.toLowerCase()}</Badge>
          </div>

          {exerciseSummary && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{exerciseSummary}</p>
          )}
        </div>

        {session.exercises?.length ? (
          <div className="hidden shrink-0 rounded-md border bg-muted/30 px-3 py-2 text-center sm:block">
            <p className="text-lg font-semibold leading-none">{session.exercises.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              exercise{session.exercises.length !== 1 ? "s" : ""}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
