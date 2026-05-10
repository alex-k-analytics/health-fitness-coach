import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput, NumericValueInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ClipboardCheck,
  Copy,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Timer,
  Trash2
} from "lucide-react";
import type {
  WorkoutActivityType,
  WorkoutExercise,
  WorkoutExerciseHistoryEntry,
  WorkoutExerciseKind,
  WorkoutSession,
  WorkoutSet
} from "@/types";
import {
  useCreateSessionMutation,
  useExerciseHistoryQuery,
  useExerciseListQuery,
  useUpdateSessionMutation
} from "@/features/workouts/hooks";
import { computeSessionCalories, fuzzyMatch } from "@/calorieEngine";
import { formatTimer } from "@/lib/mealUtils";

type EntryIntent = "timer" | "quick";
type Step = "plan" | "active" | "review";

const CATEGORY_OPTIONS: Array<{ value: WorkoutActivityType; label: string }> = [
  { value: "WEIGHTLIFTING", label: "Strength" },
  { value: "CALISTHENICS", label: "Bodyweight" },
  { value: "RUNNING", label: "Run" },
  { value: "WALKING", label: "Walk" },
  { value: "CYCLING", label: "Bike" },
  { value: "ROWING", label: "Row" },
  { value: "SWIMMING", label: "Swim" },
  { value: "HIIT", label: "HIIT" },
  { value: "OTHER", label: "Other" }
];

const CARDIO_TYPES = new Set<WorkoutActivityType>([
  "RUNNING",
  "WALKING",
  "CYCLING",
  "SWIMMING",
  "ROWING",
  "HIIT"
]);

interface WorkoutSessionModalProps {
  trigger?: React.ReactNode;
  session?: WorkoutSession;
  repeatFrom?: WorkoutSession;
  defaultIntent?: EntryIntent;
  onClose?: () => void;
}

export function WorkoutSessionModal({
  trigger,
  session,
  repeatFrom,
  defaultIntent = "timer",
  onClose
}: WorkoutSessionModalProps) {
  const isEditing = Boolean(session);
  const isRepeating = Boolean(repeatFrom && !session);
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("plan");
  const [entryIntent, setEntryIntent] = useState<EntryIntent>(defaultIntent);
  const [addCategory, setAddCategory] = useState<WorkoutActivityType>("WEIGHTLIFTING");
  const [title, setTitle] = useState("Strength workout");
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
  const exerciseNames = useMemo(() => exercises.map((exercise) => exercise.name), [exercises]);
  const historyQuery = useExerciseHistoryQuery(exerciseNames, session?.id);
  const createSession = useCreateSessionMutation();
  const updateSession = useUpdateSessionMutation();
  const repeatedHistory = useMemo(() => buildRepeatedHistory(repeatFrom), [repeatFrom]);

  useEffect(() => {
    if (timerRunning && !useManualTime) {
      timerRef.current = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, useManualTime]);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const candidates = exerciseListData?.exercises?.[addCategory] ?? [];
    setSearchResults(fuzzyMatch(searchQuery, candidates, 3));
  }, [addCategory, exerciseListData, searchQuery]);

  useEffect(() => {
    if (!open) return;

    if (session) {
      const duration = session.durationSeconds ?? 0;
      setStep("plan");
      setEntryIntent("quick");
      setAddCategory(session.exercises[0]?.category ?? session.activityType);
      setTitle(session.title);
      setExercises(cloneSessionExercises(session.exercises));
      setElapsedSeconds(duration);
      setManualMinutes(String(Math.floor(duration / 60)));
      setManualSeconds(String(duration % 60));
      setUseManualTime(true);
      setTimerRunning(false);
      setSearchQuery("");
      setSearchResults([]);
      return;
    }

    if (repeatFrom) {
      setStep("plan");
      setEntryIntent(defaultIntent);
      setAddCategory(repeatFrom.exercises[0]?.category ?? repeatFrom.activityType);
      setTitle(repeatFrom.title);
      setExercises(cloneSessionExercises(repeatFrom.exercises));
      setElapsedSeconds(0);
      setManualMinutes(defaultIntent === "quick" ? String(Math.floor((repeatFrom.durationSeconds ?? 1800) / 60)) : "0");
      setManualSeconds(defaultIntent === "quick" ? String((repeatFrom.durationSeconds ?? 1800) % 60) : "0");
      setUseManualTime(defaultIntent === "quick");
      setTimerRunning(false);
      setSearchQuery("");
      setSearchResults([]);
      return;
    }

    resetDraft(defaultIntent);
  }, [defaultIntent, open, repeatFrom, session]);

  const comparisonByName = useMemo(() => {
    const fetched = historyQuery.data?.history ?? {};
    return new Map(
      exercises.map((exercise) => {
        const repeated = repeatedHistory.get(exercise.name.toLowerCase());
        return [exercise.name.toLowerCase(), repeated ?? fetched[exercise.name] ?? null];
      })
    );
  }, [exercises, historyQuery.data?.history, repeatedHistory]);

  const durationSeconds = getDurationSeconds({
    elapsedSeconds,
    manualMinutes,
    manualSeconds,
    useManualTime
  });
  const durationDisplay = useManualTime
    ? `${manualMinutes || "0"}:${(manualSeconds || "0").padStart(2, "0")}`
    : formatTimer(elapsedSeconds);
  const hasCardio = exercises.some((exercise) => exercise.kind === "CARDIO");
  const hasLift = exercises.some((exercise) => exercise.kind === "LIFT");
  const workoutLabel = getWorkoutDisplayLabel(exercises);
  const modalTitle = getModalTitle({ isEditing, isRepeating, entryIntent, step });

  const addExercise = useCallback((name: string, category = addCategory) => {
    const kind: WorkoutExerciseKind = CARDIO_TYPES.has(category) ? "CARDIO" : "LIFT";
    setExercises((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        name,
        kind,
        category,
        sets: kind === "LIFT" ? [{ reps: 10, weightLbs: 0 }] : undefined,
        durationSeconds: kind === "CARDIO" ? 0 : undefined,
        distance: kind === "CARDIO" ? 0 : undefined,
        distanceUnit: kind === "CARDIO" ? "mi" : undefined,
        order: previous.length
      }
    ]);
    setTitle((currentTitle) => {
      if (currentTitle.trim() && currentTitle !== "Strength workout" && currentTitle !== "Workout") return currentTitle;
      return kind === "LIFT" ? "Strength workout" : name;
    });
    setSearchQuery("");
    setSearchResults([]);
  }, [addCategory]);

  const removeExercise = useCallback((id: string) => {
    setExercises((previous) => previous.filter((exercise) => exercise.id !== id));
  }, []);

  const updateExercise = useCallback((id: string, updates: Partial<WorkoutExercise>) => {
    setExercises((previous) => previous.map((exercise) => exercise.id === id ? { ...exercise, ...updates } : exercise));
  }, []);

  const moveExercise = useCallback((id: string, direction: -1 | 1) => {
    setExercises((previous) => {
      const index = previous.findIndex((exercise) => exercise.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= previous.length) return previous;
      const next = [...previous];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next.map((exercise, order) => ({ ...exercise, order }));
    });
  }, []);

  const addSet = useCallback((exerciseId: string) => {
    setExercises((previous) => previous.map((exercise) => {
      if (exercise.id !== exerciseId) return exercise;
      const sets = exercise.sets ?? [];
      const lastSet = sets[sets.length - 1] ?? { reps: 10, weightLbs: 0 };
      return { ...exercise, sets: [...sets, { ...lastSet }] };
    }));
  }, []);

  const removeSet = useCallback((exerciseId: string, index: number) => {
    setExercises((previous) => previous.map((exercise) => (
      exercise.id === exerciseId
        ? { ...exercise, sets: exercise.sets?.filter((_, setIndex) => setIndex !== index) }
        : exercise
    )));
  }, []);

  const updateSet = useCallback((exerciseId: string, index: number, updates: Partial<WorkoutSet>) => {
    setExercises((previous) => previous.map((exercise) => {
      if (exercise.id !== exerciseId || !exercise.sets) return exercise;
      return {
        ...exercise,
        sets: exercise.sets.map((set, setIndex) => setIndex === index ? { ...set, ...updates } : set)
      };
    }));
  }, []);

  const copyPreviousSet = useCallback((exercise: WorkoutExercise, setIndex: number) => {
    const previousSet = comparisonByName.get(exercise.name.toLowerCase())?.exercise.sets?.[setIndex];
    if (!previousSet || !exercise.id) return;
    updateSet(exercise.id, setIndex, previousSet);
  }, [comparisonByName, updateSet]);

  const copyAllPreviousSets = useCallback((exercise: WorkoutExercise) => {
    const previousSets = comparisonByName.get(exercise.name.toLowerCase())?.exercise.sets;
    if (!previousSets?.length || !exercise.id) return;
    updateExercise(exercise.id, { sets: previousSets.map((set) => ({ ...set })) });
  }, [comparisonByName, updateExercise]);

  const onEntryIntentChange = (intent: EntryIntent) => {
    setEntryIntent(intent);
    setUseManualTime(intent === "quick");
    setTimerRunning(false);
    if (intent === "quick" && manualMinutes === "0" && manualSeconds === "0") {
      setManualMinutes(hasLift && !hasCardio ? "0" : "30");
    }
  };

  const handleStart = () => {
    if (exercises.length === 0) {
      addExercise(CATEGORY_OPTIONS.find((category) => category.value === addCategory)?.label ?? "Workout", addCategory);
    }
    setUseManualTime(false);
    setStep("active");
    setTimerRunning(true);
  };

  const handleReview = () => {
    const finalized = withSessionDuration(exercises, durationSeconds);
    setExercises(finalized);
    setTimerRunning(false);
    setStep("review");
  };

  const handleSave = () => {
    const finalizedExercises = withSessionDuration(exercises, durationSeconds).map((exercise, order) => ({
      ...exercise,
      order
    }));
    const result = computeSessionCalories(finalizedExercises, 70);
    const primaryActivityType = finalizedExercises[0]?.category ?? addCategory;
    const endTime = session?.endTime ?? new Date().toISOString();
    const shouldSaveDuration = durationSeconds > 0 || finalizedExercises.some((exercise) => exercise.kind === "CARDIO");
    const payload = {
      activityType: primaryActivityType,
      title: title.trim() || workoutLabel,
      startTime: shouldSaveDuration ? new Date(new Date(endTime).getTime() - durationSeconds * 1000).toISOString() : null,
      endTime,
      durationSeconds: shouldSaveDuration ? durationSeconds : undefined,
      totalCalories: result.total,
      categoryCalories: result.byCategory,
      exercises: finalizedExercises
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
    resetDraft(defaultIntent);
    onClose?.();
  };

  const resetDraft = (intent: EntryIntent = defaultIntent) => {
    setStep("plan");
    setEntryIntent(intent);
    setAddCategory("WEIGHTLIFTING");
    setTitle("Strength workout");
    setElapsedSeconds(0);
    setTimerRunning(false);
    setExercises([]);
    setUseManualTime(intent === "quick");
    setManualMinutes(intent === "quick" ? "30" : "0");
    setManualSeconds("0");
    setSearchQuery("");
    setSearchResults([]);
  };

  const renderEntryMode = () => {
    if (isEditing || isRepeating) return null;
    return (
      <div className="grid gap-2">
        <Label>Logging mode</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={entryIntent === "timer" ? "default" : "outline"}
            className="h-auto min-h-14 flex-col items-start justify-center gap-1 px-3 py-2"
            onClick={() => onEntryIntentChange("timer")}
          >
            <span className="inline-flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Start workout
            </span>
            <span className="text-xs font-normal opacity-80">Track while training</span>
          </Button>
          <Button
            type="button"
            variant={entryIntent === "quick" ? "default" : "outline"}
            className="h-auto min-h-14 flex-col items-start justify-center gap-1 px-3 py-2"
            onClick={() => onEntryIntentChange("quick")}
          >
            <span className="inline-flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Log completed
            </span>
            <span className="text-xs font-normal opacity-80">Manual time optional</span>
          </Button>
        </div>
      </div>
    );
  };

  const renderTimeControls = (context: "plan" | "active" | "review") => (
    <div className="surface-muted grid gap-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Session time</p>
          <p className="text-xs text-muted-foreground">
            {hasLift && !hasCardio ? "Optional for strength sessions" : "Used for cardio pace and calories"}
          </p>
        </div>
        <span className="font-mono text-xl font-bold">{durationDisplay}</span>
      </div>
      {context === "active" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => setTimerRunning((running) => !running)}>
            {timerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {timerRunning ? "Pause" : "Resume"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => { setElapsedSeconds(0); setTimerRunning(false); }}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${formId}-${context}-manual-time`}
          checked={useManualTime}
          onCheckedChange={(checked) => {
            const nextUseManualTime = Boolean(checked);
            setUseManualTime(nextUseManualTime);
            if (nextUseManualTime) setTimerRunning(false);
          }}
        />
        <Label htmlFor={`${formId}-${context}-manual-time`} className="text-sm font-normal">Enter time manually</Label>
      </div>
      {useManualTime ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <Label htmlFor={`${formId}-${context}-minutes`}>Minutes</Label>
            <NumericInput id={`${formId}-${context}-minutes`} value={manualMinutes} onValueChange={setManualMinutes} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`${formId}-${context}-seconds`}>Seconds</Label>
            <NumericInput id={`${formId}-${context}-seconds`} value={manualSeconds} max={59} onValueChange={setManualSeconds} />
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderExercisePicker = () => (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label>Add block</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((category) => (
            <Button
              key={category.value}
              type="button"
              size="sm"
              variant={addCategory === category.value ? "default" : "outline"}
              onClick={() => {
                setAddCategory(category.value);
                setSearchQuery("");
                setSearchResults([]);
              }}
            >
              {category.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${formId}-exercise-search`}>Exercise</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id={`${formId}-exercise-search`}
              className="pl-9"
              placeholder={`Search or type ${getCategoryLabel(addCategory).toLowerCase()}...`}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <Button type="button" variant="outline" onClick={() => searchQuery.trim() && addExercise(searchQuery.trim())}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
        {(loadingExercises || searchQuery.length >= 2) ? (
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
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => addExercise(name)}
                >
                  {name}
                </Button>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-muted-foreground">No matches. Use Add to create a custom block.</p>
            )}
          </Card>
        ) : null}
      </div>
    </div>
  );

  const renderExerciseEditor = () => (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>Workout blocks</Label>
        <Badge variant={hasLift && hasCardio ? "brand" : "outline"}>{workoutLabel}</Badge>
      </div>
      {exercises.length === 0 ? (
        <div className="surface-muted p-3 text-sm text-muted-foreground">
          Add a strength, cardio, HIIT, or other block to build the session.
        </div>
      ) : (
        exercises.map((exercise, index) => (
          <ExerciseBlock
            key={exercise.id}
            exercise={exercise}
            index={index}
            total={exercises.length}
            formId={formId}
            comparison={comparisonByName.get(exercise.name.toLowerCase()) ?? null}
            onMove={moveExercise}
            onRemove={removeExercise}
            onUpdateExercise={updateExercise}
            onAddSet={addSet}
            onRemoveSet={removeSet}
            onUpdateSet={updateSet}
            onCopyPreviousSet={copyPreviousSet}
            onCopyAllPreviousSets={copyAllPreviousSets}
          />
        ))
      )}
    </div>
  );

  const renderPlan = () => (
    <div className="grid gap-4">
      {renderEntryMode()}
      <div className="grid gap-2">
        <Label htmlFor={`${formId}-title`}>Title</Label>
        <Input id={`${formId}-title`} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Upper body + treadmill" />
      </div>
      {(entryIntent === "quick" || isEditing) ? renderTimeControls("plan") : null}
      {renderExercisePicker()}
      {renderExerciseEditor()}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
        <Button type="button" onClick={entryIntent === "quick" || isEditing ? handleReview : handleStart}>
          {entryIntent === "quick" || isEditing ? <Check className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {entryIntent === "quick" || isEditing ? "Review workout" : "Start workout"}
        </Button>
      </div>
    </div>
  );

  const renderActive = () => (
    <div className="grid gap-4">
      {renderTimeControls("active")}
      {renderExercisePicker()}
      {renderExerciseEditor()}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setStep("plan")}>Back</Button>
        <Button type="button" onClick={handleReview}>
          <Check className="h-4 w-4" />
          Finish workout
        </Button>
      </div>
    </div>
  );

  const renderReview = () => {
    const result = computeSessionCalories(withSessionDuration(exercises, durationSeconds), 70);
    return (
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ReviewMetric label="Type" value={workoutLabel} />
          <ReviewMetric label="Exercises" value={String(exercises.length)} />
          <ReviewMetric label="Duration" value={durationSeconds > 0 ? durationDisplay : "Optional"} />
          <ReviewMetric label="Calories" value={`${result.total} cal`} />
        </div>
        <Separator />
        <div className="grid gap-2">
          <Label>Exercise details</Label>
          {withSessionDuration(exercises, durationSeconds).map((exercise) => (
            <Card key={exercise.id} className="p-3">
              <CardContent className="grid gap-2 p-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm">{exercise.name}</strong>
                  <Badge variant="outline">{exercise.kind === "LIFT" ? "Strength" : getCategoryLabel(exercise.category)}</Badge>
                </div>
                {exercise.kind === "LIFT" ? (
                  <p className="text-xs text-muted-foreground">{formatSetSequence(exercise.sets)}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{formatCardioSummary(exercise)}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setStep("plan")}>Edit</Button>
          <Button type="button" onClick={handleSave} disabled={createSession.isPending || updateSession.isPending || exercises.length === 0}>
            {createSession.isPending || updateSession.isPending ? "Saving..." : isEditing ? "Update workout" : "Save workout"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose(); else setOpen(nextOpen); }}>
      <DialogTrigger asChild>{trigger || <Button>Log workout</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl sm:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogDescription>{getModalDescription({ isEditing, isRepeating, entryIntent, step })}</DialogDescription>
        </DialogHeader>
        {step === "plan" ? renderPlan() : null}
        {step === "active" ? renderActive() : null}
        {step === "review" ? renderReview() : null}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {(entryIntent === "quick" || isEditing ? ["plan", "review"] : ["plan", "active", "review"]).map((item, index) => (
            <span key={item} className="inline-flex items-center gap-2">
              {index > 0 ? <span>/</span> : null}
              <span className={step === item ? "font-semibold text-primary" : ""}>{item}</span>
            </span>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExerciseBlock({
  exercise,
  index,
  total,
  formId,
  comparison,
  onMove,
  onRemove,
  onUpdateExercise,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
  onCopyPreviousSet,
  onCopyAllPreviousSets
}: {
  exercise: WorkoutExercise;
  index: number;
  total: number;
  formId: string;
  comparison: WorkoutExerciseHistoryEntry | null;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onUpdateExercise: (id: string, updates: Partial<WorkoutExercise>) => void;
  onAddSet: (id: string) => void;
  onRemoveSet: (id: string, index: number) => void;
  onUpdateSet: (id: string, index: number, updates: Partial<WorkoutSet>) => void;
  onCopyPreviousSet: (exercise: WorkoutExercise, index: number) => void;
  onCopyAllPreviousSets: (exercise: WorkoutExercise) => void;
}) {
  const previousSets = comparison?.exercise.sets ?? [];
  return (
    <Card>
      <CardContent className="grid gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-sm">{exercise.name}</strong>
              <Badge variant="outline">{exercise.kind === "LIFT" ? "Strength" : getCategoryLabel(exercise.category)}</Badge>
            </div>
            {comparison ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Compared with {comparison.sessionTitle} from {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(comparison.performedAt))}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => exercise.id && onMove(exercise.id, -1)} disabled={index === 0 || !exercise.id}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => exercise.id && onMove(exercise.id, 1)} disabled={index + 1 >= total || !exercise.id}>
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => exercise.id && onRemove(exercise.id)} disabled={!exercise.id}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {exercise.kind === "LIFT" ? (
          <div className="grid gap-3">
            {previousSets.length > 0 ? (
              <div className="surface-muted flex flex-wrap items-center justify-between gap-2 p-3 text-xs">
                <span className="text-muted-foreground">Previous: {formatSetSequence(previousSets)}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => onCopyAllPreviousSets(exercise)}>
                  <Copy className="h-3 w-3" />
                  Copy all
                </Button>
              </div>
            ) : null}
            <div className="grid gap-2">
              {(exercise.sets ?? []).map((set, setIndex) => (
                <div key={`${exercise.id}-set-${setIndex}`} className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[4rem_1fr_1fr_auto] sm:items-end">
                  <div className="text-xs font-medium text-muted-foreground">Set {setIndex + 1}</div>
                  <div className="grid gap-1">
                    <Label className="text-xs" htmlFor={`${formId}-${exercise.id}-${setIndex}-reps`}>Reps</Label>
                    <NumericValueInput
                      id={`${formId}-${exercise.id}-${setIndex}-reps`}
                      value={set.reps}
                      onValueChange={(reps) => exercise.id && onUpdateSet(exercise.id, setIndex, { reps })}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs" htmlFor={`${formId}-${exercise.id}-${setIndex}-weight`}>Weight lb</Label>
                    <NumericValueInput
                      id={`${formId}-${exercise.id}-${setIndex}-weight`}
                      mode="decimal"
                      value={set.weightLbs}
                      onValueChange={(weightLbs) => exercise.id && onUpdateSet(exercise.id, setIndex, { weightLbs })}
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onCopyPreviousSet(exercise, setIndex)}
                      disabled={!previousSets[setIndex]}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    {(exercise.sets?.length ?? 0) > 1 ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => exercise.id && onRemoveSet(exercise.id, setIndex)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => exercise.id && onAddSet(exercise.id)} disabled={!exercise.id}>
              <Plus className="h-3 w-3" />
              Add set
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {comparison ? (
              <div className="surface-muted p-3 text-xs text-muted-foreground sm:col-span-2">
                Previous: {formatCardioSummary(comparison.exercise)}
              </div>
            ) : null}
            <div className="grid gap-1">
              <Label htmlFor={`${formId}-${exercise.id}-distance`}>Distance (mi)</Label>
              <NumericValueInput
                id={`${formId}-${exercise.id}-distance`}
                mode="decimal"
                value={exercise.distance}
                onValueChange={(distance) => exercise.id && onUpdateExercise(exercise.id, { distance })}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`${formId}-${exercise.id}-duration`}>Block minutes</Label>
              <NumericValueInput
                id={`${formId}-${exercise.id}-duration`}
                value={Math.round((exercise.durationSeconds ?? 0) / 60)}
                onValueChange={(minutes) => exercise.id && onUpdateExercise(exercise.id, { durationSeconds: minutes * 60 })}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-muted p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function buildRepeatedHistory(session?: WorkoutSession) {
  const history = new Map<string, WorkoutExerciseHistoryEntry>();
  if (!session) return history;
  for (const exercise of session.exercises) {
    history.set(exercise.name.toLowerCase(), {
      sessionId: session.id,
      sessionTitle: session.title,
      performedAt: session.performedAt,
      exercise
    });
  }
  return history;
}

function cloneSessionExercises(exercises: WorkoutExercise[]): WorkoutExercise[] {
  return exercises.map((exercise, index) => ({
    ...exercise,
    id: crypto.randomUUID(),
    sets: exercise.sets?.map((set) => ({ ...set })),
    order: index
  }));
}

function withSessionDuration(exercises: WorkoutExercise[], duration: number) {
  return exercises.map((exercise) => (
    exercise.kind === "CARDIO" && (!exercise.durationSeconds || exercise.durationSeconds === 0)
      ? { ...exercise, durationSeconds: duration }
      : exercise
  ));
}

function getDurationSeconds({
  elapsedSeconds,
  manualMinutes,
  manualSeconds,
  useManualTime
}: {
  elapsedSeconds: number;
  manualMinutes: string;
  manualSeconds: string;
  useManualTime: boolean;
}) {
  if (!useManualTime) return elapsedSeconds;
  return (parseInt(manualMinutes, 10) || 0) * 60 + (parseInt(manualSeconds, 10) || 0);
}

function getWorkoutDisplayLabel(exercises: WorkoutExercise[]) {
  if (exercises.length === 0) return "Workout";
  const kinds = new Set(exercises.map((exercise) => exercise.kind));
  if (kinds.size > 1) return "Mixed";
  if (kinds.has("LIFT")) return "Strength";
  const categories = new Set(exercises.map((exercise) => exercise.category));
  return categories.size > 1 ? "Mixed cardio" : getCategoryLabel(exercises[0].category);
}

function getCategoryLabel(category: WorkoutActivityType) {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category.toLowerCase();
}

function formatSetSequence(sets?: WorkoutSet[]) {
  if (!sets?.length) return "No sets";
  return sets.map((set, index) => `${index + 1}: ${set.reps} x ${set.weightLbs} lb`).join(" | ");
}

function formatCardioSummary(exercise: WorkoutExercise) {
  const minutes = Math.round((exercise.durationSeconds ?? 0) / 60);
  const distance = exercise.distance ?? 0;
  if (distance > 0 && minutes > 0) return `${distance} mi, ${minutes} min`;
  if (distance > 0) return `${distance} mi`;
  if (minutes > 0) return `${minutes} min`;
  return "No cardio details";
}

function getModalTitle({
  isEditing,
  isRepeating,
  entryIntent,
  step
}: {
  isEditing: boolean;
  isRepeating: boolean;
  entryIntent: EntryIntent;
  step: Step;
}) {
  if (isEditing) return step === "review" ? "Review workout changes" : "Edit workout";
  if (isRepeating) return step === "review" ? "Review repeated workout" : "Repeat workout";
  if (entryIntent === "quick") return step === "review" ? "Review completed workout" : "Log completed workout";
  if (step === "active") return "Active workout";
  if (step === "review") return "Review workout";
  return "Start workout";
}

function getModalDescription({
  isEditing,
  isRepeating,
  entryIntent,
  step
}: {
  isEditing: boolean;
  isRepeating: boolean;
  entryIntent: EntryIntent;
  step: Step;
}) {
  if (isEditing) return "Update the workout blocks, then review before saving.";
  if (isRepeating) return "Adjust the cloned exercises and compare against the prior set sequence.";
  if (entryIntent === "quick") return "Log a completed workout with strength and cardio blocks in one session.";
  if (step === "active") return "Track sets, cardio, and optional elapsed time in one session.";
  return "Build a mixed workout, then start tracking or save it after review.";
}
