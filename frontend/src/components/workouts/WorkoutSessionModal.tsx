import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Minus, Play, Pause, Check, Search, Trash2, RotateCcw } from "lucide-react";
import type { WorkoutActivityType, WorkoutExercise, WorkoutExerciseKind, WorkoutSession, WorkoutSet } from "@/types";
import { useExerciseListQuery, useCreateSessionMutation, useUpdateSessionMutation } from "@/features/workouts/hooks";
import { computeSessionCalories, fuzzyMatch } from "@/calorieEngine";
import { formatTimer } from "@/lib/mealUtils";

type WorkoutMode = "CARDIO" | "STRENGTH" | "HIIT" | "OTHER";

const WORKOUT_TYPES: { value: WorkoutMode; label: string; defaultActivityType: WorkoutActivityType }[] = [
  { value: "CARDIO", label: "Cardio", defaultActivityType: "RUNNING" },
  { value: "STRENGTH", label: "Strength", defaultActivityType: "WEIGHTLIFTING" },
  { value: "HIIT", label: "HIIT", defaultActivityType: "HIIT" },
  { value: "OTHER", label: "Other", defaultActivityType: "OTHER" }
];

const CARDIO_TYPES = new Set<WorkoutActivityType>([
  "RUNNING", "WALKING", "CYCLING", "SWIMMING", "ROWING", "HIIT"
]);
const MODE_CATEGORY_KEYS: Record<WorkoutMode, WorkoutActivityType[]> = {
  CARDIO: ["RUNNING", "WALKING", "CYCLING", "SWIMMING", "ROWING"],
  STRENGTH: ["WEIGHTLIFTING", "CALISTHENICS"],
  HIIT: ["HIIT"],
  OTHER: ["OTHER"]
};

interface WorkoutSessionModalProps {
  trigger?: React.ReactNode;
  session?: WorkoutSession;
  onClose?: () => void;
}

export function WorkoutSessionModal({ trigger, session, onClose }: WorkoutSessionModalProps) {
  const isEditing = Boolean(session);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"plan" | "active" | "review">("plan");
  const [workoutMode, setWorkoutMode] = useState<WorkoutMode>("STRENGTH");
  const [activityType, setActivityType] = useState<WorkoutActivityType>("WEIGHTLIFTING");
  const [title, setTitle] = useState("Strength");
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [manualMinutes, setManualMinutes] = useState("0");
  const [manualSeconds, setManualSeconds] = useState("0");
  const [useManualTime, setUseManualTime] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { data: exerciseListData, isLoading: loadingExercises } = useExerciseListQuery();
  const createSession = useCreateSessionMutation();
  const updateSession = useUpdateSessionMutation();

  useEffect(() => {
    if (timerRunning && !useManualTime) {
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning, useManualTime]);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) { setSearchResults([]); return; }
    const categoryKeys = MODE_CATEGORY_KEYS[workoutMode];
    const all = categoryKeys.flatMap((key) => exerciseListData?.exercises?.[key] ?? []);
    setSearchResults(fuzzyMatch(searchQuery, all, 3));
  }, [searchQuery, exerciseListData, workoutMode]);

  useEffect(() => {
    if (!open) return;

    if (session) {
      const mode = getWorkoutMode(session.activityType);
      const duration = session.durationSeconds ?? 0;
      setStep("plan");
      setWorkoutMode(mode);
      setActivityType(session.activityType);
      setTitle(session.title);
      setExercises(cloneSessionExercises(session.exercises));
      setElapsedSeconds(mode === "STRENGTH" ? duration : 0);
      setManualMinutes(String(Math.floor(duration / 60)));
      setManualSeconds(String(duration % 60));
      setUseManualTime(true);
      setTimerRunning(false);
      setSearchQuery("");
      setSearchResults([]);
      return;
    }

    resetDraft();
  }, [open, session]);

  const addExercise = useCallback((name: string) => {
    const category = resolveExerciseCategory(name, workoutMode, exerciseListData?.exercises);
    const kind: WorkoutExerciseKind = CARDIO_TYPES.has(category) ? "CARDIO" : "LIFT";
    const modeLabel = WORKOUT_TYPES.find((item) => item.value === workoutMode)?.label ?? "Workout";
    setActivityType(category);
    setTitle((currentTitle) => currentTitle.trim() === "" || currentTitle === modeLabel ? name : currentTitle);
    setExercises((prev) => [...prev, {
      id: crypto.randomUUID(), name, kind, category,
      sets: kind === "LIFT" ? [{ reps: 10, weightLbs: 0 }] : undefined,
      durationSeconds: kind === "CARDIO" ? 0 : undefined,
      distance: kind === "CARDIO" ? 0 : undefined,
      distanceUnit: kind === "CARDIO" ? "mi" : undefined,
      order: prev.length
    }]);
    setSearchQuery(""); setSearchResults([]);
  }, [exerciseListData, workoutMode]);

  const removeExercise = useCallback((id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateExercise = useCallback((id: string, updates: Partial<WorkoutExercise>) => {
    setExercises((prev) => prev.map((e) => e.id === id ? { ...e, ...updates } : e));
  }, []);

  const addSet = useCallback((exerciseId: string) => {
    setExercises((prev) => prev.map((e) => e.id === exerciseId ? { ...e, sets: [...(e.sets ?? []), { reps: 10, weightLbs: 0 }] } : e));
  }, []);

  const removeSet = useCallback((exerciseId: string, idx: number) => {
    setExercises((prev) => prev.map((e) => e.id === exerciseId ? { ...e, sets: e.sets?.filter((_, i) => i !== idx) } : e));
  }, []);

  const updateSet = useCallback((exerciseId: string, idx: number, updates: Partial<WorkoutSet>) => {
    setExercises((prev) => prev.map((e) => {
      if (e.id !== exerciseId || !e.sets) return e;
      return { ...e, sets: e.sets.map((s, i) => i === idx ? { ...s, ...updates } : s) };
    }));
  }, []);

  const createDefaultExercise = useCallback((mode: WorkoutMode): WorkoutExercise => {
    const type = WORKOUT_TYPES.find((item) => item.value === mode)?.defaultActivityType ?? "OTHER";
    const kind: WorkoutExerciseKind = mode === "STRENGTH" ? "LIFT" : "CARDIO";
    const label = WORKOUT_TYPES.find((item) => item.value === mode)?.label ?? "Workout";
    return {
      id: crypto.randomUUID(),
      name: label,
      kind,
      category: type,
      sets: kind === "LIFT" ? [{ reps: 10, weightLbs: 0 }] : undefined,
      durationSeconds: kind === "CARDIO" ? 0 : undefined,
      distance: kind === "CARDIO" ? 0 : undefined,
      distanceUnit: kind === "CARDIO" ? "mi" : undefined,
      order: 0
    };
  }, []);

  const onWorkoutModeChange = (mode: WorkoutMode) => {
    const type = WORKOUT_TYPES.find((item) => item.value === mode)?.defaultActivityType ?? "OTHER";
    const label = WORKOUT_TYPES.find((item) => item.value === mode)?.label ?? "Workout";
    setWorkoutMode(mode);
    setActivityType(type);
    setTitle(label);
    setExercises([]);
    setSearchQuery("");
    setSearchResults([]);
    setElapsedSeconds(0); setTimerRunning(false);
  };

  const handleStart = () => {
    const nextExercises = exercises.length > 0
      ? exercises
      : [createDefaultExercise(workoutMode)];

    setExercises(nextExercises);
    setStep("active");
    setTimerRunning(!useManualTime);
  };
  const handleReviewChanges = () => {
    const duration = useManualTime
      ? (parseInt(manualMinutes, 10) || 0) * 60 + (parseInt(manualSeconds, 10) || 0)
      : elapsedSeconds;

    setExercises((prev) => prev.map((ex) => (
      ex.kind === "CARDIO" && (!ex.durationSeconds || ex.durationSeconds === 0)
        ? { ...ex, durationSeconds: duration }
        : ex
    )));
    setTimerRunning(false);
    setStep("review");
  };
  const handleFinish = () => {
    const duration = useManualTime
      ? ((parseInt(manualMinutes, 10) || 0) * 60 + (parseInt(manualSeconds, 10) || 0))
      : elapsedSeconds;

    setExercises((prev) => prev.map((ex) => (
      ex.kind === "CARDIO" && (!ex.durationSeconds || ex.durationSeconds === 0)
        ? { ...ex, durationSeconds: duration }
        : ex
    )));
    setTimerRunning(false);
    setStep("review");
  };
  const handleEdit = () => { setStep("plan"); };

  const handleSave = () => {
    const duration = useManualTime
      ? ((parseInt(manualMinutes, 10) || 0) * 60 + (parseInt(manualSeconds, 10) || 0))
      : elapsedSeconds;
    const result = computeSessionCalories(exercises, 70);
    const primaryActivityType = exercises[0]?.category ?? activityType;
    const endTime = session?.endTime ?? new Date().toISOString();
    const payload = {
      activityType: primaryActivityType,
      title,
      startTime: new Date(new Date(endTime).getTime() - duration * 1000).toISOString(),
      endTime,
      durationSeconds: duration,
      totalCalories: result.total,
      categoryCalories: result.byCategory,
      exercises
    };

    if (session) {
      updateSession.mutate({
        id: session.id,
        data: {
          ...payload,
          performedAt: session.performedAt
        }
      });
    } else {
      createSession.mutate(payload);
    }
    handleClose();
  };

  const handleClose = () => {
    setOpen(false);
    resetDraft();
    onClose?.();
  };

  const resetDraft = () => {
    setStep("plan");
    setWorkoutMode("STRENGTH");
    setActivityType("WEIGHTLIFTING");
    setTitle("Strength");
    setElapsedSeconds(0);
    setTimerRunning(false);
    setExercises([]);
    setUseManualTime(false);
    setManualMinutes("0");
    setManualSeconds("0");
    setSearchQuery("");
    setSearchResults([]);
  };

  const isTimedWorkout = workoutMode !== "STRENGTH";
  const durationDisplay = useManualTime
    ? `${manualMinutes}:${manualSeconds.padStart(2, "0")}`
    : formatTimer(elapsedSeconds);

  // ── Step 1: Plan ──
  const renderPlan = () => (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Workout Type</Label>
        <div className="flex flex-wrap gap-2">
           {WORKOUT_TYPES.map(({ value, label }) => (
             <Button
               key={value}
               variant={workoutMode === value ? "default" : "outline"}
               size="sm"
               onClick={() => onWorkoutModeChange(value)}
             >
               {label}
             </Button>
           ))}
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Morning run" />
      </div>

      {isEditing && (
        <div className="flex gap-3">
          <div className="grid gap-1 flex-1">
            <Label>Minutes</Label>
            <Input inputMode="numeric" value={manualMinutes} onChange={(e) => setManualMinutes(cleanDurationPart(e.target.value))} />
          </div>
          <div className="grid gap-1 flex-1">
            <Label>Seconds</Label>
            <Input inputMode="numeric" value={manualSeconds} onChange={(e) => setManualSeconds(cleanDurationPart(e.target.value, 59))} />
          </div>
        </div>
      )}

      {workoutMode !== "OTHER" && (
      <div className="grid gap-2">
        <Label>Add Exercise</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search exercises..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        {(loadingExercises || searchQuery.length >= 2) && (
          <Card className="max-h-40 overflow-y-auto">
            {loadingExercises ? (
              <div className="space-y-1 p-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((name) => (
                <Button
                  key={name}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => addExercise(name)}
                >
                  {name}
                </Button>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-muted-foreground">No exercises found.</p>
            )}
          </Card>
        )}
      </div>
      )}

      {exercises.length === 0 && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          {workoutMode === "OTHER"
            ? "Start the session to log a simple timed workout."
            : "Search for a specific exercise, or start now and fill in details later."}
        </div>
      )}

      {exercises.length > 0 && (
        <div className="grid gap-3">
          {exercises.map((ex) => (
            <Card key={ex.id}>
              <CardContent className="pt-4 grid gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="text-sm">{ex.name}</strong>
                    <Badge variant="outline" className="ml-2">{ex.kind === "LIFT" ? "Strength" : ex.kind === "CARDIO" ? "Cardio" : ex.kind}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeExercise(ex.id ?? "")} disabled={!ex.id}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {ex.kind === "LIFT" ? (
                  <div className="grid gap-2">
                    {(ex.sets ?? []).map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-8">Set {i + 1}</span>
                        <Input type="number" min="0" className="w-20" placeholder="reps"
                          value={s.reps} onChange={(e) => updateSet(ex.id!, i, { reps: parseInt(e.target.value, 10) || 0 })} />
                        <Input type="number" min="0" className="w-20" placeholder="lbs"
                          value={s.weightLbs} onChange={(e) => updateSet(ex.id!, i, { weightLbs: parseInt(e.target.value, 10) || 0 })} />
                        {(ex.sets?.length ?? 0) > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeSet(ex.id!, i)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => addSet(ex.id!)}>
                      <Plus className="h-3 w-3 mr-1" /> Add set
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-1">
                      <Label>Distance (mi)</Label>
                      <DistanceInput
                        value={ex.distance}
                        onChange={(distance) => updateExercise(ex.id!, { distance })}
                      />
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Est. {computeSessionCalories([ex], 70).total} cal
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleClose}>Cancel</Button>
        <Button onClick={isEditing ? handleReviewChanges : handleStart}>
          {isEditing ? <Check className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
          {isEditing ? "Review Changes" : "Start Session"}
        </Button>
      </div>
    </div>
  );

  // ── Step 2: Active ──
  const renderActive = () => (
    <div className="grid gap-4">
      <div className="text-center">
        <div className="text-4xl font-mono font-bold">{durationDisplay}</div>
        <div className="flex justify-center gap-2 mt-3">
          <Button onClick={() => setTimerRunning((t) => !t)}>
            {timerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={() => { setElapsedSeconds(0); setTimerRunning(false); }}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="manualTime" checked={useManualTime} onChange={(e) => setUseManualTime(e.target.checked)} />
        <Label htmlFor="manualTime" className="text-sm font-normal">Enter time manually</Label>
      </div>
      {useManualTime && (
        <div className="flex gap-3">
          <div className="grid gap-1 flex-1">
            <Label>Minutes</Label>
            <Input inputMode="numeric" value={manualMinutes} onChange={(e) => setManualMinutes(cleanDurationPart(e.target.value))} />
          </div>
          <div className="grid gap-1 flex-1">
            <Label>Seconds</Label>
            <Input inputMode="numeric" value={manualSeconds} onChange={(e) => setManualSeconds(cleanDurationPart(e.target.value, 59))} />
          </div>
        </div>
      )}
      {isTimedWorkout && exercises[0] && workoutMode !== "OTHER" && (
        <div className="grid gap-1">
          <Label>Distance (mi)</Label>
          <DistanceInput
            value={exercises[0].distance}
            onChange={(distance) => updateExercise(exercises[0].id!, { distance })}
          />
        </div>
      )}
      <Separator />
      <div className="grid gap-2">
        <Label>Planned Exercises</Label>
        {exercises.map((ex) => (
          <div key={ex.id} className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-muted-foreground" />
            <span>{ex.name}</span>
            <span className="text-muted-foreground text-xs">
              {ex.kind === "LIFT" ? `${ex.sets?.length ?? 0} sets` : `${(ex.durationSeconds ?? 0) / 60} min`}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleEdit}>Back to Plan</Button>
        <Button onClick={handleFinish}>
          <Check className="h-4 w-4 mr-1" /> Finish
        </Button>
      </div>
    </div>
  );

  // ── Step 3: Review ──
  const renderReview = () => {
    const result = computeSessionCalories(exercises, 70);
    return (
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Activity</span>
            <Badge>{WORKOUT_TYPES.find((t) => t.value === workoutMode)?.label ?? workoutMode}</Badge>
          </div>
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</span>
            <span className="text-sm font-semibold">{durationDisplay}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Calories</span>
            <span className="text-lg font-bold">{result.total} cal</span>
          </div>
          <div className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Exercises</span>
            <span className="text-sm font-semibold">{exercises.length} exercise{exercises.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        {Object.entries(result.byCategory).map(([cat, cals]) => (
          <div key={cat} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{cat}</span>
            <span className="font-semibold">{cals} cal</span>
          </div>
        ))}
        <Separator />
        <div className="grid gap-2">
          <Label>Exercise Details</Label>
          {exercises.map((ex) => {
            const exCals = computeSessionCalories([ex], 70).total;
            return (
              <Card key={ex.id} className="p-3">
                <CardContent className="p-0 grid gap-2">
                  <div className="flex justify-between">
                  <strong className="text-sm">{ex.name}</strong>
                  <span className="text-xs text-muted-foreground">{exCals} cal</span>
                </div>
                {ex.kind === "LIFT" ? (
                  <div className="text-xs text-muted-foreground">
                    {(ex.sets ?? []).map((s, i) => (
                      <span key={i}>{s.reps} reps × {s.weightLbs} lb{i < (ex.sets?.length ?? 0) - 1 ? ", " : ""}</span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {(ex.durationSeconds ?? 0) / 60} min, {ex.distance ?? 0} mi
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleEdit}>Edit</Button>
          <Button onClick={handleSave} disabled={createSession.isPending || updateSession.isPending}>
            {createSession.isPending || updateSession.isPending
              ? "Saving..."
              : isEditing ? "Update Workout" : "Save Workout"}
          </Button>
        </div>
      </div>
    );
  };

  // ── Main render ──
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else setOpen(o); }}>
      <DialogTrigger asChild>
        {trigger || <Button>Log Workout</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? "Edit Workout"
              : step === "plan" ? "Plan Workout" : step === "active" ? "Active Workout" : "Review Workout"}
          </DialogTitle>
        </DialogHeader>
        {step === "plan" && renderPlan()}
        {step === "active" && renderActive()}
        {step === "review" && renderReview()}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={step === "plan" ? "text-primary font-semibold" : ""}>Plan</span>
          <span>→</span>
          <span className={step === "active" ? "text-primary font-semibold" : ""}>Active</span>
          <span>→</span>
          <span className={step === "review" ? "text-primary font-semibold" : ""}>Review</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DistanceInput({ value, onChange }: { value: number | undefined; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(formatDistanceInput(value));

  useEffect(() => {
    setDraft(formatDistanceInput(value));
  }, [value]);

  return (
    <Input
      inputMode="decimal"
      value={draft}
      onChange={(event) => {
        const nextDraft = cleanDistanceDraft(event.target.value);
        setDraft(nextDraft);
        onChange(parseDistanceDraft(nextDraft));
      }}
      onBlur={() => setDraft(formatDistanceInput(parseDistanceDraft(draft)))}
    />
  );
}

function resolveExerciseCategory(
  name: string,
  mode: WorkoutMode,
  exercisesByCategory?: Record<string, string[]>
): WorkoutActivityType {
  const allowedCategories = MODE_CATEGORY_KEYS[mode];
  const normalizedName = name.toLowerCase();

  for (const category of allowedCategories) {
    const exercises = exercisesByCategory?.[category] ?? [];
    if (exercises.some((candidate) => candidate.toLowerCase() === normalizedName)) {
      return category;
    }
  }

  return WORKOUT_TYPES.find((item) => item.value === mode)?.defaultActivityType ?? "OTHER";
}

function cleanDurationPart(value: string, max?: number): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "0";

  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return "0";

  return String(max === undefined ? parsed : Math.min(parsed, max));
}

function formatDistanceInput(value: number | undefined): string {
  if (!value || !Number.isFinite(value)) return "0";
  return String(value);
}

function cleanDistanceDraft(value: string): string {
  const normalized = value.replace(/[^\d.]/g, "");
  const firstDecimal = normalized.indexOf(".");
  if (firstDecimal === -1) {
    return normalizeWholeDistance(normalized);
  }

  const whole = normalizeWholeDistance(normalized.slice(0, firstDecimal));
  const decimal = normalized.slice(firstDecimal + 1).replace(/\./g, "");
  return `${whole}.${decimal}`;
}

function normalizeWholeDistance(value: string): string {
  const stripped = value.replace(/^0+(?=\d)/, "");
  return stripped || "0";
}

function parseDistanceDraft(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getWorkoutMode(activityType: WorkoutActivityType): WorkoutMode {
  if (activityType === "HIIT") return "HIIT";
  if (activityType === "WEIGHTLIFTING" || activityType === "CALISTHENICS") return "STRENGTH";
  if (activityType === "OTHER") return "OTHER";
  return "CARDIO";
}

function cloneSessionExercises(exercises: WorkoutExercise[]): WorkoutExercise[] {
  return exercises.map((exercise, index) => ({
    ...exercise,
    sets: exercise.sets?.map((set) => ({ ...set })),
    order: exercise.order ?? index
  }));
}
