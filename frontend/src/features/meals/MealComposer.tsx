import type * as React from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, FileText, Image, ChevronRight, Sparkles, Search, X } from "lucide-react";
import {
  useMealEstimateMutation,
  useCreateMealMutation,
  useUpdateMealMutation,
  useSavedFoodsQuery
} from "@/features/meals/hooks";
import type {
  Meal,
  NutritionEstimate,
  NutritionOverrides,
  SavedFood
} from "@/types";
import {
  getServingCount,
  scaleNutritionEstimate,
  toDateTimeLocalInput,
  valueToInput
} from "@/lib/mealUtils";

interface MealComposerProps {
  trigger?: React.ReactNode;
  initialMeal?: Meal;
  initialFood?: SavedFood;
  onClose?: () => void;
}

type MealComposerStep = "input" | "estimate" | "confirm";

type NutritionOverrideDrafts = Record<keyof NutritionOverrides, string>;

const NUTRITION_OVERRIDE_FIELDS: Array<{
  key: keyof NutritionOverrides;
  label: string;
  unit: string;
  mode: "integer" | "decimal";
}> = [
  { key: "estimatedCalories", label: "Calories", unit: "cal", mode: "integer" },
  { key: "proteinGrams", label: "Protein", unit: "g", mode: "decimal" },
  { key: "carbsGrams", label: "Carbs", unit: "g", mode: "decimal" },
  { key: "fatGrams", label: "Fat", unit: "g", mode: "decimal" },
  { key: "fiberGrams", label: "Fiber", unit: "g", mode: "decimal" },
  { key: "sugarGrams", label: "Sugar", unit: "g", mode: "decimal" }
];

const EMPTY_OVERRIDE_DRAFTS: NutritionOverrideDrafts = {
  estimatedCalories: "",
  proteinGrams: "",
  carbsGrams: "",
  fatGrams: "",
  fiberGrams: "",
  sugarGrams: ""
};

export function MealComposer({
  trigger,
  initialMeal,
  initialFood,
  onClose
}: MealComposerProps) {
  const initialSourceAnalysis = useMemo(
    () => sourceAnalysisFromMeal(initialMeal),
    [initialMeal]
  );
  const initialOverrideDrafts = useMemo(
    () => overrideDraftsFromMeal(initialMeal),
    [initialMeal]
  );
  const initialHasOverrides = hasOverrideDrafts(initialOverrideDrafts);
  const initialQuantity = valueToInput(initialMeal?.quantity ?? 1);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<MealComposerStep>(
    initialSourceAnalysis ? "confirm" : "input"
  );
  const [title, setTitle] = useState(initialMeal?.title ?? initialFood?.name ?? "");
  const [notes, setNotes] = useState(initialMeal?.notes ?? "");
  const [eatenAt, setEatenAt] = useState(
    initialMeal ? toDateTimeLocalInput(initialMeal.eatenAt) : ""
  );
  const [servingDescription, setServingDescription] = useState(
    initialMeal?.servingDescription ?? initialFood?.servingDescription ?? ""
  );
  const [quantity, setQuantity] = useState(initialQuantity);
  const [savedFoodId, setSavedFoodId] = useState(
    initialMeal?.savedFood?.id ?? initialFood?.id ?? ""
  );
  const [savedFoodSearch, setSavedFoodSearch] = useState("");
  const [saveAsReusableFood, setSaveAsReusableFood] = useState(false);
  const [plateFiles, setPlateFiles] = useState<File[]>([]);
  const [labelFiles, setLabelFiles] = useState<File[]>([]);
  const [otherFiles, setOtherFiles] = useState<File[]>([]);
  const [sourceAnalysis, setSourceAnalysis] = useState<NutritionEstimate | null>(
    initialSourceAnalysis
  );
  const [sourceAnalysisBaseServings, setSourceAnalysisBaseServings] = useState(
    getServingCount(initialQuantity)
  );
  const [overrideDrafts, setOverrideDrafts] = useState<NutritionOverrideDrafts>(
    initialOverrideDrafts
  );
  const [correctionsOpen, setCorrectionsOpen] = useState(initialHasOverrides);
  const [overrideScaleNotice, setOverrideScaleNotice] = useState<string | null>(null);
  const previousQuantityRef = useRef(getServingCount(initialQuantity));

  const estimateMutation = useMealEstimateMutation();
  const createMutation = useCreateMealMutation();
  const updateMutation = useUpdateMealMutation();
  const { data: savedFoods, isLoading: loadingSavedFoods } = useSavedFoodsQuery();

  const isEdit = !!initialMeal;
  const savedFoodOptions = savedFoods?.foods ?? [];
  const selectedSavedFood =
    savedFoodOptions.find((food) => food.id === savedFoodId) ?? initialFood ?? null;
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

  const displayedSourceAnalysis = sourceAnalysis
    ? scaleNutritionEstimate(
        sourceAnalysis,
        getServingCount(quantity) / sourceAnalysisBaseServings
      )
    : null;
  const nutritionOverrides = useMemo(
    () => parseNutritionOverrides(overrideDrafts),
    [overrideDrafts]
  );
  const hasActiveOverrides = hasNutritionOverrides(nutritionOverrides);
  const displayedFinalNutrition = displayedSourceAnalysis
    ? applyNutritionOverridesToEstimate(displayedSourceAnalysis, nutritionOverrides)
    : null;
  const changedOverrideKeys = getChangedOverrideKeys(nutritionOverrides);
  const macroCalories = displayedFinalNutrition
    ? displayedFinalNutrition.proteinGrams * 4 +
      displayedFinalNutrition.carbsGrams * 4 +
      displayedFinalNutrition.fatGrams * 9
    : 0;
  const calorieDelta = displayedFinalNutrition
    ? Math.abs(displayedFinalNutrition.estimatedCalories - macroCalories)
    : 0;
  const showMacroWarning = displayedFinalNutrition !== null && calorieDelta > 25;
  const canScaleEstimatedMacros =
    displayedSourceAnalysis !== null &&
    nutritionOverrides.estimatedCalories !== undefined &&
    nutritionOverrides.estimatedCalories >= 0 &&
    nutritionOverrides.proteinGrams === undefined &&
    nutritionOverrides.carbsGrams === undefined &&
    nutritionOverrides.fatGrams === undefined &&
    displayedSourceAnalysis.estimatedCalories > 0;
  const errors = [estimateMutation.error, createMutation.error, updateMutation.error].filter(
    Boolean
  );

  useEffect(() => {
    const currentServings = getServingCount(quantity);
    const previousServings = previousQuantityRef.current;

    if (currentServings === previousServings) {
      return;
    }

    if (
      open &&
      step === "confirm" &&
      hasOverrideDrafts(overrideDrafts) &&
      previousServings > 0
    ) {
      const ratio = currentServings / previousServings;
      setOverrideDrafts((current) => scaleNutritionOverrideDrafts(current, ratio));
      setOverrideScaleNotice("Corrected values scaled with servings.");
    }

    previousQuantityRef.current = currentServings;
  }, [open, overrideDrafts, quantity, step]);

  const resetCorrections = useCallback(
    (nextDrafts = EMPTY_OVERRIDE_DRAFTS) => {
      setOverrideDrafts(nextDrafts);
      setCorrectionsOpen(hasOverrideDrafts(nextDrafts));
      setOverrideScaleNotice(null);
    },
    []
  );

  const buildFormData = useCallback(() => {
    const formData = new FormData();
    formData.append("title", title);
    if (notes) formData.append("notes", notes);
    if (eatenAt) formData.append("eatenAt", new Date(eatenAt).toISOString());
    if (servingDescription) formData.append("servingDescription", servingDescription);
    if (quantity) formData.append("quantity", quantity);
    if (savedFoodId) formData.append("savedFoodId", savedFoodId);
    formData.append("saveAsReusableFood", String(saveAsReusableFood));
    plateFiles.forEach((file) => formData.append("plateImages", file));
    labelFiles.forEach((file) => formData.append("labelImages", file));
    otherFiles.forEach((file) => formData.append("otherImages", file));
    return formData;
  }, [
    eatenAt,
    labelFiles,
    notes,
    otherFiles,
    plateFiles,
    quantity,
    saveAsReusableFood,
    savedFoodId,
    servingDescription,
    title
  ]);

  const reset = useCallback(() => {
    const nextQuantity = valueToInput(initialMeal?.quantity ?? 1);
    setTitle(initialMeal?.title ?? initialFood?.name ?? "");
    setNotes(initialMeal?.notes ?? "");
    setEatenAt(initialMeal ? toDateTimeLocalInput(initialMeal.eatenAt) : "");
    setServingDescription(
      initialMeal?.servingDescription ?? initialFood?.servingDescription ?? ""
    );
    setQuantity(nextQuantity);
    setSavedFoodId(initialMeal?.savedFood?.id ?? initialFood?.id ?? "");
    setSavedFoodSearch("");
    setSaveAsReusableFood(false);
    setPlateFiles([]);
    setLabelFiles([]);
    setOtherFiles([]);
    setSourceAnalysis(initialSourceAnalysis);
    setSourceAnalysisBaseServings(getServingCount(nextQuantity));
    resetCorrections(initialOverrideDrafts);
    setStep(initialSourceAnalysis ? "confirm" : "input");
    previousQuantityRef.current = getServingCount(nextQuantity);
  }, [
    initialFood,
    initialMeal,
    initialOverrideDrafts,
    initialSourceAnalysis,
    resetCorrections
  ]);

  const closeAndReset = useCallback(() => {
    reset();
    setOpen(false);
    onClose?.();
  }, [onClose, reset]);

  const handleClose = useCallback(() => {
    setOpen(false);
    if (!open) return;
    reset();
    onClose?.();
  }, [onClose, open, reset]);

  const handleEstimate = useCallback(() => {
    const formData = buildFormData();
    setStep("estimate");
    estimateMutation.mutate(formData, {
      onSuccess: (result) => {
        setSourceAnalysis(result.analysis);
        setSourceAnalysisBaseServings(getServingCount(quantity));
        resetCorrections();
        setStep("confirm");
      },
      onError: () => {
        setStep("input");
      }
    });
  }, [buildFormData, estimateMutation, quantity, resetCorrections]);

  const handleSave = useCallback(() => {
    if (!displayedSourceAnalysis) return;

    const formData = buildFormData();
    formData.append("sourceAnalysis", JSON.stringify(displayedSourceAnalysis));
    formData.append("nutritionOverrides", JSON.stringify(nutritionOverrides));

    if (isEdit) {
      updateMutation.mutate(
        {
          mealId: initialMeal!.id,
          body: {
            title,
            notes: notes || null,
            eatenAt: eatenAt ? new Date(eatenAt).toISOString() : undefined,
            servingDescription: servingDescription || null,
            quantity: getServingCount(quantity),
            sourceAnalysis: displayedSourceAnalysis,
            nutritionOverrides
          }
        },
        {
          onSuccess: () => {
            closeAndReset();
          }
        }
      );
      return;
    }

    createMutation.mutate(formData, {
      onSuccess: () => {
        closeAndReset();
      }
    });
  }, [
    buildFormData,
    closeAndReset,
    createMutation,
    displayedSourceAnalysis,
    eatenAt,
    initialMeal,
    isEdit,
    notes,
    nutritionOverrides,
    quantity,
    servingDescription,
    title,
    updateMutation
  ]);

  const selectSavedFood = useCallback(
    (food: SavedFood) => {
      const savedFoodAnalysis = sourceAnalysisFromSavedFood(food);
      setSavedFoodId(food.id);
      setTitle(food.name);
      setServingDescription(food.servingDescription ?? "");
      setSavedFoodSearch("");
      setSourceAnalysis(savedFoodAnalysis);
      setSourceAnalysisBaseServings(1);
      resetCorrections();
      previousQuantityRef.current = getServingCount(quantity);
      if (savedFoodAnalysis) {
        setStep("confirm");
      }
    },
    [quantity, resetCorrections]
  );

  const clearSelectedSavedFood = useCallback(() => {
    setSavedFoodId("");
    setSavedFoodSearch("");
    setSourceAnalysis(null);
    setSourceAnalysisBaseServings(getServingCount(quantity));
    resetCorrections();
    setStep("input");
  }, [quantity, resetCorrections]);

  const handleScaleEstimatedMacros = useCallback(() => {
    if (!displayedSourceAnalysis || nutritionOverrides.estimatedCalories === undefined) {
      return;
    }

    const scale = nutritionOverrides.estimatedCalories / displayedSourceAnalysis.estimatedCalories;
    setOverrideDrafts((current) => ({
      ...current,
      proteinGrams: formatScaledOverrideValue(displayedSourceAnalysis.proteinGrams * scale),
      carbsGrams: formatScaledOverrideValue(displayedSourceAnalysis.carbsGrams * scale),
      fatGrams: formatScaledOverrideValue(displayedSourceAnalysis.fatGrams * scale)
    }));
    setCorrectionsOpen(true);
  }, [displayedSourceAnalysis, nutritionOverrides.estimatedCalories]);

  const hasPhotoInput =
    plateFiles.length > 0 || labelFiles.length > 0 || otherFiles.length > 0;
  const hasReusableFoodInput = Boolean(savedFoodId);
  const hasServingDetailsInput = Boolean(servingDescription.trim());
  const hasInputs = hasPhotoInput || hasReusableFoodInput || hasServingDetailsInput;
  const canEstimate = Boolean(title.trim()) && hasInputs;
  const breakdownTitle = hasActiveOverrides
    ? "Original estimate breakdown"
    : "Estimate breakdown";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
          return;
        }

        setOpen(true);
      }}
    >
      <DialogTrigger asChild>{trigger || <Button>Log Food</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? "Edit Food"
              : step === "input"
                ? "Log Food"
                : step === "estimate"
                  ? "Estimating..."
                  : "Review & Save"}
          </DialogTitle>
        </DialogHeader>

        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              {errors[0] instanceof Error ? errors[0].message : String(errors[0])}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={
              step === "input"
                ? "font-semibold text-primary"
                : step === "confirm" || step === "estimate"
                  ? "text-success"
                  : ""
            }
          >
            Input
          </span>
          <ChevronRight className="h-3 w-3" />
          <span className={step === "confirm" ? "font-semibold text-primary" : ""}>
            Review
          </span>
        </div>

        {step === "input" && (
          <div className="grid gap-5">
            {savedFoodOptions.length > 0 && (
              <div className="grid gap-2">
                <Label>Saved foods</Label>
                <div className="surface-panel">
                  <div className="flex items-center gap-2 border-b px-3 py-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={savedFoodSearch}
                      onChange={(event) => setSavedFoodSearch(event.target.value)}
                      placeholder="Search reusable foods"
                      className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
                    />
                    {savedFoodId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearSelectedSavedFood}
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
                      <p className="px-3 py-4 text-sm text-muted-foreground">
                        No saved foods match.
                      </p>
                    ) : (
                      filteredSavedFoods.map((food) => (
                        <button
                          key={food.id}
                          type="button"
                          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${
                            savedFoodId === food.id
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : ""
                          }`}
                          onClick={() => selectSavedFood(food)}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{food.name}</span>
                            <span className="block truncate text-xs opacity-80">
                              {[food.brand, food.servingDescription]
                                .filter(Boolean)
                                .join(" · ") || "Reusable food"}
                            </span>
                          </span>
                          {food.calories !== null && (
                            <span className="ml-3 shrink-0 text-xs opacity-80">
                              {Math.round(food.calories)} cal
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
                {selectedSavedFood && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {selectedSavedFood.name}
                    {selectedSavedFood.servingDescription
                      ? ` · ${selectedSavedFood.servingDescription}`
                      : ""}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Search for a reusable food or add photos/details below for a new estimate.
                </p>
              </div>
            )}

            {savedFoodOptions.length === 0 && (
              <div className="surface-muted px-3 py-2 text-sm text-muted-foreground">
                No saved foods yet. Add a photo or serving details to estimate a new meal.
              </div>
            )}

            <div className="grid gap-2">
              <Label>What did you eat?</Label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Grilled chicken salad"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={eatenAt}
                  onChange={(event) => setEatenAt(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Servings</Label>
                <NumericInput mode="decimal" value={quantity} onValueChange={setQuantity} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Serving Details</Label>
              <Input
                value={servingDescription}
                onChange={(event) => setServingDescription(event.target.value)}
                placeholder="e.g. 1 bowl, 2 slices"
              />
            </div>

            <Separator />

            <div className="grid gap-3">
              <Label>Photos (optional)</Label>
              <div className="grid gap-2">
                <PhotoPicker
                  label="Plate photos"
                  files={plateFiles}
                  onFiles={setPlateFiles}
                  icon={Camera}
                />
                <PhotoPicker
                  label="Nutrition label"
                  files={labelFiles}
                  onFiles={setLabelFiles}
                  icon={FileText}
                />
                <PhotoPicker
                  label="Other photos"
                  files={otherFiles}
                  onFiles={setOtherFiles}
                  icon={Image}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="saveAsReusable"
                checked={saveAsReusableFood}
                onCheckedChange={(value) => setSaveAsReusableFood(value === true)}
              />
              <Label htmlFor="saveAsReusable" className="text-sm font-normal">
                Save as reusable food for next time
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeAndReset}>
                Cancel
              </Button>
              <Button
                onClick={handleEstimate}
                disabled={!canEstimate || estimateMutation.isPending}
              >
                {estimateMutation.isPending ? (
                  <>
                    <Sparkles className="mr-1 h-4 w-4 animate-spin" />
                    Estimating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1 h-4 w-4" />
                    Estimate Nutrition
                  </>
                )}
              </Button>
            </div>
            {!hasInputs && (
              <p className="text-right text-xs text-muted-foreground">
                Choose a saved food, attach a photo, or add serving details before estimating.
              </p>
            )}
          </div>
        )}

        {step === "confirm" && displayedSourceAnalysis && displayedFinalNutrition && (
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label>What did you eat?</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={eatenAt}
                  onChange={(event) => setEatenAt(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Servings</Label>
                <NumericInput mode="decimal" value={quantity} onValueChange={setQuantity} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Serving Details</Label>
              <Input
                value={servingDescription}
                onChange={(event) => setServingDescription(event.target.value)}
                placeholder="e.g. 1 bowl"
              />
            </div>

            <Separator />

            <Card>
              <CardContent className="pt-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Nutrition to Save</span>
                    <Badge
                      variant={
                        displayedSourceAnalysis.status === "COMPLETED" ? "success" : "warning"
                      }
                    >
                      {displayedSourceAnalysis.status === "COMPLETED"
                        ? "Complete"
                        : displayedSourceAnalysis.status === "PENDING"
                          ? "Pending"
                          : displayedSourceAnalysis.status}
                    </Badge>
                    {hasActiveOverrides && <Badge variant="brand">Corrected</Badge>}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCorrectionsOpen((current) => !current)}
                  >
                    {correctionsOpen ? "Hide corrections" : "Correct numbers"}
                  </Button>
                </div>

                <NutritionSummaryGrid estimate={displayedFinalNutrition} />

                {displayedSourceAnalysis.summary && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {displayedSourceAnalysis.summary}
                  </p>
                )}

                {overrideScaleNotice && (
                  <p className="mt-3 text-xs font-medium text-brand">{overrideScaleNotice}</p>
                )}

                {showMacroWarning && (
                  <Alert variant="warning" className="mt-3">
                    <AlertDescription>
                      Calories and protein/carbs/fat differ by {Math.round(calorieDelta)} cal.
                      Save still uses your manual values.
                    </AlertDescription>
                  </Alert>
                )}

                {correctionsOpen && (
                  <div className="surface-muted mt-4 grid gap-3 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">Manual corrections</p>
                        <p className="text-xs text-muted-foreground">
                          Leave a field blank to keep the estimate.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {NUTRITION_OVERRIDE_FIELDS.map((field) => {
                        const estimatedValue = displayedSourceAnalysis[field.key];
                        const isManual = overrideDrafts[field.key].trim() !== "";

                        return (
                          <div
                            key={field.key}
                            className="surface-panel grid gap-2 p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <Label htmlFor={`override-${field.key}`}>{field.label}</Label>
                              <Badge variant={isManual ? "brand" : "secondary"}>
                                {isManual ? "Manual" : "Estimated"}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                              <NumericInput
                                id={`override-${field.key}`}
                                mode={field.mode}
                                allowEmpty
                                value={overrideDrafts[field.key]}
                                onValueChange={(value) => {
                                  setOverrideDrafts((current) => ({
                                    ...current,
                                    [field.key]: value
                                  }));
                                  setCorrectionsOpen(true);
                                  setOverrideScaleNotice(null);
                                }}
                                placeholder={String(estimatedValue)}
                              />
                              <span className="text-xs text-muted-foreground">
                                Est. {formatEstimateValue(estimatedValue, field.unit)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {canScaleEstimatedMacros && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="justify-self-start"
                        onClick={handleScaleEstimatedMacros}
                      >
                        Scale estimated macros to new calories
                      </Button>
                    )}
                  </div>
                )}

                {hasActiveOverrides && (
                  <div className="surface-muted mt-4 grid gap-2 p-3">
                    <p className="text-sm font-semibold">Estimated vs saved</p>
                    {changedOverrideKeys.map((key) => {
                      const field = NUTRITION_OVERRIDE_FIELDS.find((item) => item.key === key);
                      if (!field) return null;

                      return (
                        <div
                          key={field.key}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="font-medium">{field.label}</span>
                          <span className="text-muted-foreground">
                            {formatEstimateValue(displayedSourceAnalysis[field.key], field.unit)}
                          </span>
                          <span className="font-semibold">
                            {formatEstimateValue(displayedFinalNutrition[field.key], field.unit)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {displayedSourceAnalysis.foodBreakdown.length > 0 && (
                  <div className="mt-4 grid gap-1">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {breakdownTitle}
                    </p>
                    {displayedSourceAnalysis.foodBreakdown.map((item, index) => (
                      <div
                        key={`${item.label}-${index}`}
                        className="flex justify-between text-xs text-muted-foreground"
                      >
                        <span>{item.label}</span>
                        <span>{item.calories} cal</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep("input")}>
                {isEdit ? "Edit details" : "Back"}
              </Button>
              <Button type="button" variant="outline" onClick={closeAndReset}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {isEdit
                  ? updateMutation.isPending
                    ? "Updating..."
                    : "Update"
                  : createMutation.isPending
                    ? "Saving..."
                    : "Save"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NutritionSummaryGrid({ estimate }: { estimate: NutritionEstimate }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <NutritionValueCard label="Calories" value={estimate.estimatedCalories} />
        <NutritionValueCard label="Protein" value={estimate.proteinGrams} suffix="g" />
        <NutritionValueCard label="Carbs" value={estimate.carbsGrams} suffix="g" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <NutritionValueCard label="Fat" value={estimate.fatGrams} suffix="g" />
        <NutritionValueCard label="Fiber" value={estimate.fiberGrams} suffix="g" />
        <NutritionValueCard label="Sugar" value={estimate.sugarGrams} suffix="g" />
      </div>
    </>
  );
}

function NutritionValueCard({
  label,
  value,
  suffix = ""
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg bg-secondary/50 p-3 text-center">
      <p className="text-lg font-bold">
        {value}
        {suffix}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function PhotoPicker({
  label,
  files,
  onFiles,
  icon: Icon
}: {
  label: string;
  files: File[];
  onFiles: (files: File[]) => void;
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
    <div className="surface-panel p-3">
      <input
        id={libraryInputId}
        type="file"
        multiple
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          addFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <input
        id={cameraInputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          addFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
          {files.length > 0 && <Badge variant="secondary">{files.length}</Badge>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Label
            htmlFor={cameraInputId}
            className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Camera
          </Label>
          <Label
            htmlFor={libraryInputId}
            className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Library
          </Label>
        </div>
      </div>
      {files.length > 0 && (
        <div className="mt-3 grid gap-1">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.lastModified}`}
              className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1 text-xs"
            >
              <span className="truncate">{file.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5"
                onClick={() => removeFile(index)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function sourceAnalysisFromMeal(meal: Meal | undefined): NutritionEstimate | null {
  if (!meal || meal.estimatedCalories === null) {
    return null;
  }

  if (meal.sourceAnalysis) {
    return meal.sourceAnalysis;
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

function sourceAnalysisFromSavedFood(food: SavedFood): NutritionEstimate | null {
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

function overrideDraftsFromMeal(meal: Meal | undefined): NutritionOverrideDrafts {
  if (!meal?.nutritionOverrides) {
    return { ...EMPTY_OVERRIDE_DRAFTS };
  }

  return {
    estimatedCalories: valueToInput(meal.nutritionOverrides.estimatedCalories),
    proteinGrams: valueToInput(meal.nutritionOverrides.proteinGrams),
    carbsGrams: valueToInput(meal.nutritionOverrides.carbsGrams),
    fatGrams: valueToInput(meal.nutritionOverrides.fatGrams),
    fiberGrams: valueToInput(meal.nutritionOverrides.fiberGrams),
    sugarGrams: valueToInput(meal.nutritionOverrides.sugarGrams)
  };
}

function parseNutritionOverrides(drafts: NutritionOverrideDrafts): NutritionOverrides {
  return NUTRITION_OVERRIDE_FIELDS.reduce<NutritionOverrides>((accumulator, field) => {
    const raw = drafts[field.key].trim();
    if (!raw) {
      return accumulator;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return accumulator;
    }

    accumulator[field.key] = parsed;
    return accumulator;
  }, {});
}

function hasNutritionOverrides(overrides: NutritionOverrides): boolean {
  return NUTRITION_OVERRIDE_FIELDS.some((field) => overrides[field.key] !== undefined);
}

function hasOverrideDrafts(drafts: NutritionOverrideDrafts): boolean {
  return NUTRITION_OVERRIDE_FIELDS.some((field) => drafts[field.key].trim() !== "");
}

function applyNutritionOverridesToEstimate(
  sourceAnalysis: NutritionEstimate,
  nutritionOverrides: NutritionOverrides
): NutritionEstimate {
  return {
    ...sourceAnalysis,
    estimatedCalories:
      nutritionOverrides.estimatedCalories ?? sourceAnalysis.estimatedCalories,
    proteinGrams: nutritionOverrides.proteinGrams ?? sourceAnalysis.proteinGrams,
    carbsGrams: nutritionOverrides.carbsGrams ?? sourceAnalysis.carbsGrams,
    fatGrams: nutritionOverrides.fatGrams ?? sourceAnalysis.fatGrams,
    fiberGrams: nutritionOverrides.fiberGrams ?? sourceAnalysis.fiberGrams,
    sugarGrams: nutritionOverrides.sugarGrams ?? sourceAnalysis.sugarGrams
  };
}

function scaleNutritionOverrideDrafts(
  drafts: NutritionOverrideDrafts,
  ratio: number
): NutritionOverrideDrafts {
  return NUTRITION_OVERRIDE_FIELDS.reduce<NutritionOverrideDrafts>(
    (accumulator, field) => {
      const raw = drafts[field.key].trim();
      if (!raw) {
        accumulator[field.key] = "";
        return accumulator;
      }

      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        accumulator[field.key] = "";
        return accumulator;
      }

      accumulator[field.key] = formatScaledOverrideValue(parsed * ratio);
      return accumulator;
    },
    { ...EMPTY_OVERRIDE_DRAFTS }
  );
}

function formatScaledOverrideValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function getChangedOverrideKeys(
  overrides: NutritionOverrides
): Array<keyof NutritionOverrides> {
  return NUTRITION_OVERRIDE_FIELDS
    .map((field) => field.key)
    .filter((key) => overrides[key] !== undefined);
}

function formatEstimateValue(value: number, unit: string): string {
  return `${value}${unit ? ` ${unit}` : ""}`;
}
