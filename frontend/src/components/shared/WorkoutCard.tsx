import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatDate } from "@/lib/mealUtils";
import type { WorkoutSession } from "@/types";

export function WorkoutCard({ session }: { session: WorkoutSession }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-4 pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-semibold truncate">{session.title}</p>
            <span className="text-xs text-muted-foreground shrink-0">
              {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(session.performedAt))}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="font-medium">{session.totalCalories ?? 0} cal</span>
            {session.durationSeconds != null && (
              <span className="text-muted-foreground">{formatDuration(session.durationSeconds)}</span>
            )}
            {session.exercises && session.exercises.length > 0 && (
              <span className="text-muted-foreground">
                {session.exercises
                  .map((ex) => {
                    if (ex.kind === "LIFT" && ex.sets) {
                      return `${ex.name} ${ex.sets.length}x${ex.sets[0]?.reps ?? "?"}`;
                    }
                    if (ex.durationSeconds) {
                      const mins = Math.round(ex.durationSeconds / 60);
                      return `${ex.name} ${mins}m`;
                    }
                    return ex.name;
                  })
                  .join(" \u00b7 ")}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
