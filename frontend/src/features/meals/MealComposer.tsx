import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  const handleEstimate = useCallback(async () => {
    const formData = buildFormData();
    estimateMutation.mutate(formData, {
      onSuccess: (result) => {
        setEstimate(result.analysis);
        setEstimateBaseServings(getServingCount(quantity));
      }
    });
  }, [title, notes, eatenAt, servingDescription, quantity, savedFoodId, saveAsReusableFood, plateFiles, labelFiles, otherFiles]);

  const handleSave = useCallback(async () => {
    if (!estimate) return;
    const formData = buildFormData();
    const servingMultiplier = getServingCount(quantity) / estimateBaseServings;
    const scaledAnalysis = scaleNutritionEstimate(estimate, servingMultiplier);

    if (isEdit) {
      formData.append("confirmedAnalysis", JSON.stringify(scaledAnalysis));
      updateMutation.mutate({ mealId: initialMeal!.id, body: { confirmedAnalysis: scaledAnalysis, title, notes: notes || null, eatenAt: eatenAt ? new Date(eatenAt).toISOString() : undefined, servingDescription: servingDescription || null, quantity: getServingCount(quantity) } });
      reset();
      setOpen(false);
      onClose?.();
    } else {
      formData.append("confirmedAnalysis", JSON.stringify(scaledAnalysis));
      formData.append("reusableAnalysis", JSON.stringify(estimate));
      createMutation.mutate({ formData, confirmedAnalysis: scaledAnalysis, reusableAnalysis: estimate });
      reset();
      setOpen(false);
      onClose?.();
    }
  }, [estimate, quantity, estimateBaseServings, isEdit, initialMeal, title, notes, eatenAt, servingDescription]);

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
  }

  const hasInputs = plateFiles.length > 0 || labelFiles.length > 0 || otherFiles.length > 0 || savedFoodId || quantity;
  const canEstimate = title.trim() && hasInputs;
  const displayedEstimate = estimate ? scaleNutritionEstimate(estimate, getServingCount(quantity) / estimateBaseServings) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) onClose?.(); }}>
      <DialogTrigger asChild>
        {trigger || <Button>Log Food</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${initialMeal?.title}` : isFromSavedFood ? `Log ${initialFood?.name}` : "Log Food"}</DialogTitle>
        </DialogHeader>

        {estimateMutation.error && <div className="text-destructive text-sm">{estimateMutation.error instanceof Error ? estimateMutation.error.message : "Error"}</div>}
        {createMutation.error && <div className="text-destructive text-sm">{createMutation.error instanceof Error ? createMutation.error.message : "Error"}</div>}
        {updateMutation.error && <div className="text-destructive text-sm">{updateMutation.error instanceof Error ? updateMutation.error.message : "Error"}</div>}

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Grilled chicken salad" />
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Eaten at</Label>
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

          <div className="grid gap-2">
            <Label>Saved foods</Label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {(savedFoods?.foods ?? []).map((food: SavedFood) => (
                <Button key={food.id} variant={savedFoodId === food.id ? "default" : "outline"} size="sm" onClick={() => { setSavedFoodId(food.id); setTitle(food.name); setServingDescription(food.servingDescription ?? ""); }}>
                  {food.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Plate photos</Label>
            <div className="flex gap-2">
              <Input ref={plateRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => setPlateFiles(Array.from(e.target.files ?? []))} />
              <Button variant="outline" onClick={() => plateRef.current?.click()}>Choose</Button>
              <span className="text-sm text-muted-foreground">{plateFiles.length > 0 ? `${plateFiles.length} selected` : "No files"}</span>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Label photos</Label>
            <div className="flex gap-2">
              <Input ref={labelRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => setLabelFiles(Array.from(e.target.files ?? []))} />
              <Button variant="outline" onClick={() => labelRef.current?.click()}>Choose</Button>
              <span className="text-sm text-muted-foreground">{labelFiles.length > 0 ? `${labelFiles.length} selected` : "No files"}</span>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Other photos</Label>
            <div className="flex gap-2">
              <Input ref={otherRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => setOtherFiles(Array.from(e.target.files ?? []))} />
              <Button variant="outline" onClick={() => otherRef.current?.click()}>Choose</Button>
              <span className="text-sm text-muted-foreground">{otherFiles.length > 0 ? `${otherFiles.length} selected` : "No files"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="saveAsReusable" checked={saveAsReusableFood} onChange={(e) => setSaveAsReusableFood(e.target.checked)} />
            <Label htmlFor="saveAsReusable" className="text-sm font-normal">Save as reusable food</Label>
          </div>

          {displayedEstimate && (
            <Card>
              <CardContent className="pt-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Estimated nutrition</span>
                    <Badge variant={displayedEstimate.status === "COMPLETED" ? "default" : "warning"}>{displayedEstimate.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Calories:</span> <strong>{displayedEstimate.estimatedCalories}</strong></div>
                    <div><span className="text-muted-foreground">Protein:</span> <strong>{displayedEstimate.proteinGrams}g</strong></div>
                    <div><span className="text-muted-foreground">Carbs:</span> <strong>{displayedEstimate.carbsGrams}g</strong></div>
                    <div><span className="text-muted-foreground">Fat:</span> <strong>{displayedEstimate.fatGrams}g</strong></div>
                    <div><span className="text-muted-foreground">Fiber:</span> <strong>{displayedEstimate.fiberGrams}g</strong></div>
                    <div><span className="text-muted-foreground">Sugar:</span> <strong>{displayedEstimate.sugarGrams}g</strong></div>
                  </div>
                  {displayedEstimate.summary && <p className="text-sm text-muted-foreground">{displayedEstimate.summary}</p>}
                  {displayedEstimate.foodBreakdown.length > 0 && (
                    <div className="grid gap-2">
                      <p className="text-sm font-medium">Food breakdown</p>
                      {displayedEstimate.foodBreakdown.map((item, i) => (
                        <div key={i} className="text-xs text-muted-foreground">{item.label}: {item.calories} cal</div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); onClose?.(); }}>Cancel</Button>
            {!estimate && <Button onClick={handleEstimate} disabled={!canEstimate || estimateMutation.isPending}>{estimateMutation.isPending ? "Estimating..." : "Estimate"}</Button>}
            {estimate && <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>{isEdit ? (updateMutation.isPending ? "Updating..." : "Update") : (createMutation.isPending ? "Saving..." : "Save")}</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
