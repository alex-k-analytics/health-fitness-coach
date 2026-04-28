import { useState, useCallback, useId, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, FileText, Image, ChevronRight, Sparkles, Search, X } from "lucide-react";
import { useMealEstimateMutation, useCreateMealMutation, useUpdateMealMutation, useSavedFoodsQuery } from "@/features/meals/hooks";
import type { Meal, NutritionEstimate, SavedFood } from "@/types";
import { getServingCount, scaleNutritionEstimate, toDateTimeLocalInput, valueToInput } from "@/lib/mealUtils";

interface MealComposerProps {
  trigger?: React.ReactNode;
  initialMeal?: Meal;
  initialFood?: SavedFood;
  onClose?: () => void;
}

export function MealComposer({ trigger, initialMeal, initialFood, onClose }: MealComposerProps) {
  const initialEstimate = useMemo(() => estimateFromMeal(initialMeal), [initialMeal]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"input" | "estimate" | "confirm">(initialEstimate ? "confirm" : "input");
  const [title, setTitle] = useState(initialMeal?.title ?? initialFood?.name ?? "");
  const [notes, setNotes] = useState(initialMeal?.notes ?? "");
  const [eatenAt, setEatenAt] = useState(initialMeal ? toDateTimeLocalInput(initialMeal.eatenAt) : "");
  const [servingDescription, setServingDescription] = useState(initialMeal?.servingDescription ?? initialFood?.servingDescription ?? "");
  const [quantity, setQuantity] = useState(valueToInput(initialMeal?.quantity ?? 1));
  const [savedFoodId, setSavedFoodId] = useState(initialMeal?.savedFood?.id ?? initialFood?.id ?? "");
  const [savedFoodSearch, setSavedFoodSearch] = useState("");
  const [saveAsReusableFood, setSaveAsReusableFood] = useState(false);
  const [plateFiles, setPlateFiles] = useState<File[]>([]);
  const [labelFiles, setLabelFiles] = useState<File[]>([]);
  const [otherFiles, setOtherFiles] = useState<File[]>([]);
  const [estimate, setEstimate] = useState<NutritionEstimate | null>(initialEstimate);
  const [estimateBaseServings, setEstimateBaseServings] = useState(getServingCount(valueToInput(initialMeal?.quantity ?? 1)));

  const estimateMutation = useMealEstimateMutation();
  const createMutation = useCreateMealMutation();
  const updateMutation = useUpdateMealMutation();
  const { data: savedFoods, isLoading: loadingSavedFoods } = useSavedFoodsQuery();

  const isEdit = !!initialMeal;
  const isFromSavedFood = !!initialFood && !initialMeal;
  const savedFoodOptions = savedFoods?.foods ?? [];
  const selectedSavedFood = savedFoodOptions.find((food) => food.id === savedFoodId) ?? initialFood ?? null;
  const filteredSavedFoods = useMemo(() => {
    const query = savedFoodSearch.trim().toLowerCase();
    if (!query) return savedFoodOptions.slice(0, 8);

    return savedFoodOptions
      .filter((food) => {
        const text = [
          food.name,
          food.brand,
          food.servingDescription,
          food.calories === null ? null : `${Math.round(food.calories)} cal`
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return text.includes(query);
      })
      .slice(0, 8);
  }, [savedFoodOptions, savedFoodSearch]);

  const handleEstimate = useCallback(() => {
    const formData = buildFormData();
    estimateMutation.mutate(formData, {
      onSuccess: (result) => {
        setEstimate(result.analysis);
        setEstimateBaseServings(getServingCount(quantity));
        setStep("confirm");
      }
    });
  }, [title, notes, eatenAt, servingDescription, quantity, savedFoodId, saveAsReusableFood, plateFiles, labelFiles, otherFiles, estimateMutation]);

  const handleSave = useCallback(() => {
    if (!estimate) return;
    const formData = buildFormData();
    const servingMultiplier = getServingCount(quantity) / estimateBaseServings;
    const scaledAnalysis = scaleNutritionEstimate(estimate, servingMultiplier);

    if (isEdit) {
      formData.append("confirmedAnalysis", JSON.stringify(scaledAnalysis));
      updateMutation.mutate({ mealId: initialMeal!.id, body: { confirmedAnalysis: scaledAnalysis, title, notes: notes || null, eatenAt: eatenAt ? new Date(eatenAt).toISOString() : undefined, servingDescription: servingDescription || null, quantity: getServingCount(quantity) } });
    } else {
      formData.append("confirmedAnalysis", JSON.stringify(scaledAnalysis));
      formData.append("reusableAnalysis", JSON.stringify(estimate));
      createMutation.mutate({ formData, confirmedAnalysis: scaledAnalysis, reusableAnalysis: estimate });
    }
    reset();
    setOpen(false);
    onClose?.();
  }, [estimate, quantity, estimateBaseServings, isEdit, initialMeal, title, notes, eatenAt, servingDescription, createMutation, updateMutation, onClose]);

  const handleSaveSavedFood = useCallback(() => {
    if (!selectedSavedFood) return;
    const savedFoodEstimate = estimateFromSavedFood(selectedSavedFood);
    if (!savedFoodEstimate) return;

    const formData = buildFormData();
    const scaledAnalysis = scaleNutritionEstimate(savedFoodEstimate, getServingCount(quantity));
    formData.append("confirmedAnalysis", JSON.stringify(scaledAnalysis));
    createMutation.mutate({ formData, confirmedAnalysis: scaledAnalysis, reusableAnalysis: savedFoodEstimate });
    reset();
    setOpen(false);
    onClose?.();
  }, [selectedSavedFood, quantity, title, notes, eatenAt, servingDescription, savedFoodId, saveAsReusableFood, plateFiles, labelFiles, otherFiles, createMutation, onClose]);

  const selectSavedFood = useCallback((food: SavedFood) => {
    const savedFoodEstimate = estimateFromSavedFood(food);
    setSavedFoodId(food.id);
    setTitle(food.name);
    setServingDescription(food.servingDescription ?? "");
    setSavedFoodSearch("");
    setEstimate(savedFoodEstimate);
    setEstimateBaseServings(1);
    if (savedFoodEstimate) {
      setStep("confirm");
    }
  }, []);

  function buildFormData() {
    const formData = new FormData();
    formData.append("title", title);
    if (notes) formData.append("notes", notes);
    if (eatenAt) formData.append("eatenAt", new Date(eatenAt).toISOString());
    if (servingDescription) formData.append("servingDescription", servingDescription);
    if (quantity) formData.append("quantity", quantity);
    if (savedFoodId) formData.append("savedFoodId", savedFoodId);
    formData.append("saveAsReusableFood", String(saveAsReusableFood));
    plateFiles.forEach((f) => formData.append("plateImages", f));
    labelFiles.forEach((f) => formData.append("labelImages", f));
    otherFiles.forEach((f) => formData.append("otherImages", f));
    return formData;
  }

  function reset() {
    setTitle(initialMeal?.title ?? initialFood?.name ?? "");
    setNotes(initialMeal?.notes ?? "");
    setEatenAt(initialMeal ? toDateTimeLocalInput(initialMeal.eatenAt) : "");
    setServingDescription(initialMeal?.servingDescription ?? initialFood?.servingDescription ?? "");
    const initialQuantity = valueToInput(initialMeal?.quantity ?? 1);
    setQuantity(initialQuantity);
    setSavedFoodId(initialMeal?.savedFood?.id ?? initialFood?.id ?? "");
    setSavedFoodSearch("");
    setSaveAsReusableFood(false);
    setPlateFiles([]);
    setLabelFiles([]);
    setOtherFiles([]);
    setEstimate(initialEstimate);
    setEstimateBaseServings(getServingCount(initialQuantity));
    setStep(initialEstimate ? "confirm" : "input");
  }

  const hasPhotoInput = plateFiles.length > 0 || labelFiles.length > 0 || otherFiles.length > 0;
  const hasReusableFoodInput = Boolean(savedFoodId);
  const hasServingDetailsInput = Boolean(servingDescription.trim());
  const hasInputs = hasPhotoInput || hasReusableFoodInput || hasServingDetailsInput;
  const canEstimate = title.trim() && hasInputs;
  const canSaveSavedFood = !isEdit && selectedSavedFood?.calories !== null && Boolean(title.trim());
  const displayedEstimate = estimate ? scaleNutritionEstimate(estimate, getServingCount(quantity) / estimateBaseServings) : null;

  const errors = [estimateMutation.error, createMutation.error, updateMutation.error].filter(Boolean);

  const handleClose = () => {
    setOpen(false);
    if (!open) return;
    reset();
    onClose?.();
  };

  const closeAndReset = () => {
    reset();
    setOpen(false);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else setOpen(o); }}>
      <DialogTrigger asChild>
        {trigger || <Button>Log Food</Button>}
      </DialogTrigger>
      <DialogContent className="top-[calc(env(safe-area-inset-top)+1rem)] max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] max-w-2xl translate-y-0 overflow-y-auto sm:top-[50%] sm:max-h-[90vh] sm:translate-y-[-50%]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Food" : step === "input" ? "Log Food" : step === "estimate" ? "Estimating..." : "Review & Save"}
          </DialogTitle>
        </DialogHeader>

        {errors.length > 0 && (
          <Alert variant="destructive">
            {errors[0] instanceof Error ? errors[0].message : String(errors[0])}
          </Alert>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={step === "input" ? "text-primary font-semibold" : (step === "confirm" || step === "estimate" ? "text-success" : "")}>Input</span>
          <ChevronRight className="h-3 w-3" />
          <span className={step === "confirm" ? "text-primary font-semibold" : ""}>Review</span>
        </div>

        {step === "input" && (
          <div className="grid gap-5">
            {/* Saved foods */}
            {savedFoodOptions.length > 0 && (
              <div className="grid gap-2">
                <Label>Saved foods</Label>
                <div className="rounded-md border bg-background">
                  <div className="flex items-center gap-2 border-b px-3 py-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={savedFoodSearch}
                      onChange={(e) => setSavedFoodSearch(e.target.value)}
                      placeholder="Search reusable foods"
                      className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
                    />
                    {savedFoodId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSavedFoodId("");
                          setSavedFoodSearch("");
                          setEstimate(null);
                          setEstimateBaseServings(1);
                        }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1">
                    {loadingSavedFoods ? (
                      <div className="space-y-2 py-1">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : filteredSavedFoods.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-muted-foreground">No saved foods match.</p>
                    ) : (
                      filteredSavedFoods.map((food: SavedFood) => (
                        <button
                          key={food.id}
                          type="button"
                          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${
                            savedFoodId === food.id ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""
                          }`}
                          onClick={() => selectSavedFood(food)}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{food.name}</span>
                            <span className="block truncate text-xs opacity-80">
                              {[food.brand, food.servingDescription].filter(Boolean).join(" · ") || "Reusable food"}
                            </span>
                          </span>
                          {food.calories !== null && <span className="ml-3 shrink-0 text-xs opacity-80">{Math.round(food.calories)} cal</span>}
                        </button>
                      ))
                    )}
                  </div>
                </div>
                {selectedSavedFood && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {selectedSavedFood.name}
                    {selectedSavedFood.servingDescription ? ` · ${selectedSavedFood.servingDescription}` : ""}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Search for a reusable food or add photos/details below for a new estimate.
                </p>
              </div>
            )}

            {savedFoodOptions.length === 0 && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                No saved foods yet. Add a photo or serving details to estimate a new meal.
              </div>
            )}
            {/* Title & basic info */}
            <div className="grid gap-2">
              <Label>What did you eat?</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Grilled chicken salad" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Date & Time</Label>
                <Input type="datetime-local" value={eatenAt} onChange={(e) => setEatenAt(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Servings</Label>
                <NumericInput mode="decimal" value={quantity} onValueChange={setQuantity} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Serving Details</Label>
              <Input value={servingDescription} onChange={(e) => setServingDescription(e.target.value)} placeholder="e.g. 1 bowl, 2 slices" />
            </div>

            <Separator />

            {/* Photos - collapsible section */}
            <div className="grid gap-3">
              <Label>Photos (optional)</Label>
              <div className="grid gap-2">
                <PhotoPicker label="Plate photos" files={plateFiles} onFiles={setPlateFiles} icon={Camera} />
                <PhotoPicker label="Nutrition label" files={labelFiles} onFiles={setLabelFiles} icon={FileText} />
                <PhotoPicker label="Other photos" files={otherFiles} onFiles={setOtherFiles} icon={Image} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="saveAsReusable" checked={saveAsReusableFood} onCheckedChange={(v) => setSaveAsReusableFood(v === true)} />
              <Label htmlFor="saveAsReusable" className="text-sm font-normal">Save as reusable food for next time</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeAndReset}>Cancel</Button>
              {canSaveSavedFood && (
                <Button type="button" onClick={handleSaveSavedFood} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Save meal"}
                </Button>
              )}
              <Button onClick={handleEstimate} disabled={!canEstimate || estimateMutation.isPending}>
                {estimateMutation.isPending ? <><Sparkles className="h-4 w-4 mr-1 animate-spin" /> Estimating...</> : <><Sparkles className="h-4 w-4 mr-1" /> Estimate Nutrition</>}
              </Button>
            </div>
            {!hasInputs && (
              <p className="text-right text-xs text-muted-foreground">
                Choose a saved food, attach a photo, or add serving details before estimating.
              </p>
            )}
          </div>
        )}

        {step === "confirm" && displayedEstimate && (
          <div className="grid gap-5">
            {/* Editable fields */}
            <div className="grid gap-2">
              <Label>What did you eat?</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Date & Time</Label>
                <Input type="datetime-local" value={eatenAt} onChange={(e) => setEatenAt(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Servings</Label>
                <NumericInput mode="decimal" value={quantity} onValueChange={setQuantity} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Serving Details</Label>
              <Input value={servingDescription} onChange={(e) => setServingDescription(e.target.value)} placeholder="e.g. 1 bowl" />
            </div>

            <Separator />

            {/* Nutrition estimate */}
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold">Estimated Nutrition</span>
                  <Badge variant={displayedEstimate.status === "COMPLETED" ? "success" : "warning"}>
                    {displayedEstimate.status === "COMPLETED" ? "Complete" : displayedEstimate.status === "PENDING" ? "Pending" : displayedEstimate.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-secondary/50 rounded-lg">
                    <p className="text-lg font-bold">{displayedEstimate.estimatedCalories}</p>
                    <p className="text-xs text-muted-foreground">Calories</p>
                  </div>
                  <div className="text-center p-3 bg-secondary/50 rounded-lg">
                    <p className="text-lg font-bold">{displayedEstimate.proteinGrams}g</p>
                    <p className="text-xs text-muted-foreground">Protein</p>
                  </div>
                  <div className="text-center p-3 bg-secondary/50 rounded-lg">
                    <p className="text-lg font-bold">{displayedEstimate.carbsGrams}g</p>
                    <p className="text-xs text-muted-foreground">Carbs</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="text-center p-3 bg-secondary/50 rounded-lg">
                    <p className="text-lg font-bold">{displayedEstimate.fatGrams}g</p>
                    <p className="text-xs text-muted-foreground">Fat</p>
                  </div>
                  <div className="text-center p-3 bg-secondary/50 rounded-lg">
                    <p className="text-lg font-bold">{displayedEstimate.fiberGrams}g</p>
                    <p className="text-xs text-muted-foreground">Fiber</p>
                  </div>
                  <div className="text-center p-3 bg-secondary/50 rounded-lg">
                    <p className="text-lg font-bold">{displayedEstimate.sugarGrams}g</p>
                    <p className="text-xs text-muted-foreground">Sugar</p>
                  </div>
                </div>
                {displayedEstimate.summary && <p className="text-sm text-muted-foreground mt-3">{displayedEstimate.summary}</p>}
                {displayedEstimate.foodBreakdown.length > 0 && (
                  <div className="mt-3 grid gap-1">
                    <p className="text-xs font-semibold text-muted-foreground">Breakdown</p>
                    {displayedEstimate.foodBreakdown.map((item, i) => (
                      <div key={i} className="text-xs text-muted-foreground flex justify-between">
                        <span>{item.label}</span>
                        <span>{item.calories} cal</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep("input")}>{isEdit ? "Edit details" : "Back"}</Button>
              <Button type="button" variant="outline" onClick={closeAndReset}>Cancel</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                {isEdit ? (updateMutation.isPending ? "Updating..." : "Update") : (createMutation.isPending ? "Saving..." : "Save")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PhotoPicker({ label, files, onFiles, inputRef, icon: Icon }: {
  label: string;
  files: File[];
  onFiles: (files: File[]) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  icon: React.ElementType;
}) {
  const id = useId();
  const libraryInputId = `${id}-library`;
  const cameraInputId = `${id}-camera`;
  const addFiles = (incoming: FileList | null) => {
    if (!incoming?.length) return;
    onFiles([...files, ...Array.from(incoming)]);
  };
  const removeFile = (indexToRemove: number) => {
    onFiles(files.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="rounded-md border bg-background p-3">
      <input
        id={libraryInputId}
        type="file"
        multiple
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          addFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      <input
        id={cameraInputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          addFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
          {files.length > 0 && <Badge variant="secondary">{files.length}</Badge>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Label htmlFor={cameraInputId} className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-muted">
            Camera
          </Label>
          <Label htmlFor={libraryInputId} className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-muted">
            Library
          </Label>
        </div>
      </div>
      {files.length > 0 && (
        <div className="mt-3 grid gap-1">
          {files.map((file, index) => (
            <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1 text-xs">
              <span className="truncate">{file.name}</span>
              <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5" onClick={() => removeFile(index)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function estimateFromMeal(meal: Meal | undefined): NutritionEstimate | null {
  if (!meal || meal.estimatedCalories === null) {
    return null;
  }

  return {
    status: meal.analysisStatus,
    model: meal.aiModel ?? "saved-meal",
    summary: meal.analysisSummary ?? "",
    confidenceScore: meal.confidenceScore ?? 1,
    estimatedCalories: meal.estimatedCalories,
    proteinGrams: meal.proteinGrams ?? 0,
    carbsGrams: meal.carbsGrams ?? 0,
    fatGrams: meal.fatGrams ?? 0,
    fiberGrams: meal.fiberGrams ?? 0,
    sugarGrams: meal.sugarGrams ?? 0,
    sodiumMg: meal.sodiumMg ?? 0,
    micronutrients: meal.micronutrients ?? [],
    vitamins: meal.vitamins ?? [],
    assumptions: meal.assumptions ?? [],
    foodBreakdown: meal.foodBreakdown ?? [
      {
        label: meal.title,
        quantityDescription: meal.servingDescription ?? "1 serving",
        calories: meal.estimatedCalories,
        proteinGrams: meal.proteinGrams ?? 0,
        carbsGrams: meal.carbsGrams ?? 0,
        fatGrams: meal.fatGrams ?? 0
      }
    ],
    rawAnalysis: {}
  };
}

function estimateFromSavedFood(food: SavedFood): NutritionEstimate | null {
  if (food.calories === null) {
    return null;
  }

  const servingDescription = food.servingDescription ?? "1 serving";
  return {
    status: "COMPLETED",
    model: "saved-food",
    summary: food.notes ?? `Stored nutrition for ${servingDescription}.`,
    confidenceScore: 1,
    estimatedCalories: food.calories,
    proteinGrams: food.proteinGrams ?? 0,
    carbsGrams: food.carbsGrams ?? 0,
    fatGrams: food.fatGrams ?? 0,
    fiberGrams: food.fiberGrams ?? 0,
    sugarGrams: food.sugarGrams ?? 0,
    sodiumMg: food.sodiumMg ?? 0,
    micronutrients: [],
    vitamins: [],
    assumptions: ["Used stored reusable food nutrition."],
    foodBreakdown: [
      {
        label: food.name,
        quantityDescription: servingDescription,
        calories: food.calories,
        proteinGrams: food.proteinGrams ?? 0,
        carbsGrams: food.carbsGrams ?? 0,
        fatGrams: food.fatGrams ?? 0
      }
    ],
    rawAnalysis: {}
  };
}
