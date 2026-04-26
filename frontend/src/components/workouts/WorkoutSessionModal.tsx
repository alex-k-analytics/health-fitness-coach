import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Minus, Play, Pause, Check, Search, Trash2, Clock, RotateCcw } from "lucide-react";
import type { WorkoutActivityType, WorkoutExercise, WorkoutExerciseKind, WorkoutSet } from "@/types";
import { useExerciseListQuery, useCreateSessionMutation } from "@/features/workouts/hooks";
import { computeSessionCalories, fuzzyMatch } from "@/calorieEngine";
import { formatTimer } from "@/lib/mealUtils";

const ACTIVITY_TYPES: WorkoutActivityType[] = [
  "RUNNING", "WALKING", "CYCLING", "SWIMMING", "ROWING",
  "WEIGHTLIFTING", "CALISTHENICS", "HIIT", "OTHER"
];
const CARDIO_TYPES = new Set<WorkoutActivityType>([
  "RUNNING", "WALKING", "CYCLING", "SWIMMING", "ROWING", "HIIT"
]);

interface WorkoutSessionModalProps {
  trigger?: React.ReactNode;
  onClose?: () => void;
}

export function WorkoutSessionModal({ trigger, onClose }: WorkoutSessionModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"plan" | "active" | "review">("plan");
  const [activityType, setActivityType] = useState<WorkoutActivityType>("WEIGHTLIFTING");
  const [title, setTitle] = useState("Weightlifting");
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [manualMinutes, setManualMinutes] = useState("0");
  const [manualSeconds, setManualSeconds] = useState("0");
  const [useManualTime, setUseManualTime] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { data: exerciseListData } = useExerciseListQuery();
  const createSession = useCreateSessionMutation();

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
    const all = Object.values(exerciseListData?.exercises ?? {}).flat();
    setSearchResults(fuzzyMatch(searchQuery, all, 3));
  }, [searchQuery, exerciseListData]);

  const addExercise = useCallback((name: string) => {
    const kind: WorkoutExerciseKind = CARDIO_TYPES.has(activityType) ? "CARDIO" : "LIFT";
    setExercises((prev) => [...prev, {
      id: crypto.randomUUID(), name, kind, category: activityType,
      sets: kind === "LIFT" ? [{ reps: 10, weightLbs: 0 }] : undefined,
      durationSeconds: kind === "CARDIO" ? 0 : undefined,
      distance: kind === "CARDIO" ? 0 : undefined,
      distanceUnit: kind === "CARDIO" ? "mi" : undefined,
      order: prev.length
    }]);
    setSearchQuery(""); setSearchResults([]);
  }, [activityType]);

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

  const onActivityTypeChange = (type: WorkoutActivityType) => {
    setActivityType(type);
    setTitle(type.charAt(0) + type.slice(1).toLowerCase());
    setExercises([]); setElapsedSeconds(0); setTimerRunning(false);
  };

  const handleStart = () => { setStep("active"); setTimerRunning(true); };
  const handleFinish = () => { setTimerRunning(false); setStep("review"); };
  const handleEdit = () => { setStep("plan"); };

  const handleSave = () => {
    const duration = useManualTime
      ? ((parseInt(manualMinutes, 10) || 0) * 60 + (parseInt(manualSeconds, 10) || 0))
      : elapsedSeconds;
    const result = computeSessionCalories(exercises, 70);
    createSession.mutate({
      activityType,
      title,
      startTime: new Date(Date.now() - duration * 1000).toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds: duration,
      totalCalories: result.total,
      categoryCalories: result.byCategory,
      exercises
    });
    handleClose();
  };

  const handleClose = () => {
    setOpen(false);
    setStep("plan");
    setElapsedSeconds(0);
    setTimerRunning(false);
    setExercises([]);
    setUseManualTime(false);
    setManualMinutes("0");
    setManualSeconds("0");
    onClose?.();
  };

  const durationDisplay = useManualTime
    ? `${manualMinutes}:${manualSeconds.padStart(2, "0")}`
    : formatTimer(elapsedSeconds);

  const totalCalories = computeSessionCalories(exercises, 70).total;

  // ── Step 1: Plan ──
  const renderPlan = () => (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Activity type</Label>
        <div className="flex flex-wrap gap-2">
          {ACTIVITY_TYPES.map((type) => (
            <Button
              key={type}
              variant={activityType === type ? "default" : "outline"}
              size="sm"
              onClick={() => onActivityTypeChange(type)}
            >
              {type}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Morning run" />
      </div>

      <div className="grid gap-2">
        <Label>Add exercise</Label>
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
        {searchResults.length > 0 && (
          <div className="max-h-40 overflow-y-auto border rounded-md bg-background">
            {searchResults.map((name) => (
              <Button
                key={name}
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => addExercise(name)}
              >
                {name}
              </Button>
            ))}
          </div>
        )}
      </div>

      {exercises.length > 0 && (
        <div className="grid gap-3">
          {exercises.map((ex) => (
            <Card key={ex.id}>
              <CardContent className="pt-4 grid gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="text-sm">{ex.name}</strong>
                    <Badge variant="outline" className="ml-2">{ex.kind}</Badge>
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
                  <div className="flex gap-3">
                    <div className="grid gap-1 flex-1">
                      <Label>Duration (min)</Label>
                      <Input type="number" min="0" value={(ex.durationSeconds ?? 0) / 60}
                        onChange={(e) => updateExercise(ex.id!, { durationSeconds: Math.max(0, parseInt(e.target.value, 10) || 0) * 60 })} />
                    </div>
                    <div className="grid gap-1 flex-1">
                      <Label>Distance (mi)</Label>
                      <Input type="number" min="0" value={ex.distance ?? 0}
                        onChange={(e) => updateExercise(ex.id!, { distance: Math.max(0, parseFloat(e.target.value) || 0) })} />
                    </div>
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
        <Button onClick={handleStart} disabled={exercises.length === 0}>
          <Play className="h-4 w-4 mr-1" /> Start Session
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
        <Label htmlFor="manualTime" className="text-sm font-normal">Use manual time</Label>
      </div>
      {useManualTime && (
        <div className="flex gap-3">
          <div className="grid gap-1 flex-1">
            <Label>Minutes</Label>
            <Input type="number" min="0" value={manualMinutes} onChange={(e) => setManualMinutes(e.target.value)} />
          </div>
          <div className="grid gap-1 flex-1">
            <Label>Seconds</Label>
            <Input type="number" min="0" max="59" value={manualSeconds} onChange={(e) => setManualSeconds(e.target.value)} />
          </div>
        </div>
      )}
      <Separator />
      <div className="grid gap-2">
        <Label>Exercises</Label>
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
            <span className="text-xs text-muted-foreground uppercase">Activity</span>
            <Badge>{activityType}</Badge>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground uppercase">Duration</span>
            <span className="text-sm font-semibold">{durationDisplay}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground uppercase">Total calories</span>
            <span className="text-lg font-bold">{result.total} cal</span>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground uppercase">Exercises</span>
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
          <Label>Exercise details</Label>
          {exercises.map((ex) => {
            const exCals = computeSessionCalories([ex], 70).total;
            return (
              <div key={ex.id} className="border rounded-md p-3 grid gap-2">
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
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleEdit}>Edit</Button>
          <Button onClick={handleSave} disabled={createSession.isPending}>
            {createSession.isPending ? "Saving..." : "Save Workout"}
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
            {step === "plan" ? "Plan Workout" : step === "active" ? "Active Workout" : "Review Workout"}
          </DialogTitle>
        </DialogHeader>
        {step === "plan" && renderPlan()}
        {step === "active" && renderActive()}
        {step === "review" && renderReview()}
        <DialogFooter>
          <div className="flex gap-2">
            <Badge variant="outline">Step {step === "plan" ? 1 : step === "active" ? 2 : 3}/3</Badge>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
