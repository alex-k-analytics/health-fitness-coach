import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { Camera, FileText, Image, ChevronRight, Sparkles } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"input" | "estimate" | "confirm">(initialMeal ? "confirm" : "input");
  const [title, setTitle] = useState(initialMeal?.title ?? initialFood?.name ?? "");
  const [notes, setNotes] = useState(initialMeal?.notes ?? "");
  const [eatenAt, setEatenAt] = useState(initialMeal ? toDateTimeLocalInput(initialMeal.eatenAt) : "");
  const [servingDescription, setServingDescription] = useState(initialMeal?.servingDescription ?? initialFood?.servingDescription ?? "");
  const [quantity, setQuantity] = useState(valueToInput(initialMeal?.quantity ?? 1));
  const [savedFoodId, setSavedFoodId] = useState(initialMeal?.savedFood?.id ?? initialFood?.id ?? "");
  const [saveAsReusableFood, setSaveAsReusableFood] = useState(false);
  const [plateFiles, setPlateFiles] = useState<File[]>([]);
  const [labelFiles, setLabelFiles] = useState<File[]>([]);
  const [otherFiles, setOtherFiles] = useState<File[]>([]);
  const [estimate, setEstimate] = useState<NutritionEstimate | null>(null);
  const [estimateBaseServings, setEstimateBaseServings] = useState(1);
  const plateRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const otherRef = useRef<HTMLInputElement>(null);

  const estimateMutation = useMealEstimateMutation();
  const createMutation = useCreateMealMutation();
  const updateMutation = useUpdateMealMutation();
  const { data: savedFoods } = useSavedFoodsQuery();

  const isEdit = !!initialMeal;
  const isFromSavedFood = !!initialFood && !initialMeal;

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
    setTitle("");
    setNotes("");
    setEatenAt("");
    setServingDescription("");
    setQuantity("1");
    setSavedFoodId("");
    setSaveAsReusableFood(false);
    setPlateFiles([]);
    setLabelFiles([]);
    setOtherFiles([]);
    setEstimate(null);
    setEstimateBaseServings(1);
    setStep("input");
  }

  const hasInputs = plateFiles.length > 0 || labelFiles.length > 0 || otherFiles.length > 0 || savedFoodId || quantity;
  const canEstimate = title.trim() && hasInputs;
  const displayedEstimate = estimate ? scaleNutritionEstimate(estimate, getServingCount(quantity) / estimateBaseServings) : null;

  const errors = [estimateMutation.error, createMutation.error, updateMutation.error].filter(Boolean);

  const handleClose = () => {
    setOpen(false);
    if (!open) return;
    reset();
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else setOpen(o); }}>
      <DialogTrigger asChild>
        {trigger || <Button>Log Food</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {step === "input" ? "Log Food" : step === "estimate" ? "Estimating..." : "Review & Save"}
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
            {/* Quick saved foods */}
            {(savedFoods?.foods ?? []).length > 0 && (
              <div className="grid gap-2">
                <Label>Saved foods</Label>
                <div className="flex flex-wrap gap-2">
                  {(savedFoods?.foods ?? []).slice(0, 6).map((food: SavedFood) => (
                    <Button
                      key={food.id}
                      variant={savedFoodId === food.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setSavedFoodId(food.id); setTitle(food.name); setServingDescription(food.servingDescription ?? ""); }}
                    >
                      {food.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Title & basic info */}
            <div className="grid gap-2">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Grilled chicken salad" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>When</Label>
                <Input type="datetime-local" value={eatenAt} onChange={(e) => setEatenAt(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Quantity</Label>
                <Input type="number" min="0.1" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Serving description</Label>
              <Input value={servingDescription} onChange={(e) => setServingDescription(e.target.value)} placeholder="e.g. 1 bowl, 2 slices" />
            </div>

            <Separator />

            {/* Photos - collapsible section */}
            <div className="grid gap-3">
              <Label>Photos (optional)</Label>
              <div className="grid gap-2">
                <PhotoPicker label="Plate photos" files={plateFiles} onFiles={setPlateFiles} inputRef={plateRef} icon={Camera} />
                <PhotoPicker label="Nutrition label" files={labelFiles} onFiles={setLabelFiles} inputRef={labelRef} icon={FileText} />
                <PhotoPicker label="Other photos" files={otherFiles} onFiles={setOtherFiles} inputRef={otherRef} icon={Image} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="saveAsReusable" checked={saveAsReusableFood} onCheckedChange={(v) => setSaveAsReusableFood(v === true)} />
              <Label htmlFor="saveAsReusable" className="text-sm font-normal">Save as reusable food</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleEstimate} disabled={!canEstimate || estimateMutation.isPending}>
                {estimateMutation.isPending ? <><Sparkles className="h-4 w-4 mr-1 animate-spin" /> Estimating...</> : <><Sparkles className="h-4 w-4 mr-1" /> Estimate Nutrition</>}
              </Button>
            </div>
          </div>
        )}

        {step === "confirm" && displayedEstimate && (
          <div className="grid gap-5">
            {/* Editable fields */}
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>When</Label>
                <Input type="datetime-local" value={eatenAt} onChange={(e) => setEatenAt(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Quantity</Label>
                <Input type="number" min="0.1" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Serving description</Label>
              <Input value={servingDescription} onChange={(e) => setServingDescription(e.target.value)} placeholder="e.g. 1 bowl" />
            </div>

            <Separator />

            {/* Nutrition estimate */}
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold">Estimated Nutrition</span>
                  <Badge variant={displayedEstimate.status === "COMPLETED" ? "success" : "warning"}>{displayedEstimate.status}</Badge>
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
              <Button variant="outline" onClick={() => setStep("input")}>Back</Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
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
  inputRef: React.RefObject<HTMLInputElement | null>;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input ref={inputRef as any} type="file" multiple accept="image/*" className="hidden" onChange={(e) => onFiles(Array.from(e.target.files ?? []))} />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="gap-2">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Button>
      {files.length > 0 && <span className="text-xs text-muted-foreground">{files.length} selected</span>}
    </div>
  );
}
