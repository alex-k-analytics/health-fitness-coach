import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileQuery, useProfileMutation } from "@/features/settings/hooks";
import { toNullableNumber, valueToInput } from "@/lib/mealUtils";

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary" },
  { value: "lightly_active", label: "Lightly active" },
  { value: "moderately_active", label: "Moderately active" },
  { value: "very_active", label: "Very active" },
  { value: "extremely_active", label: "Extremely active" }
];

export function ProfileForm() {
  const { data: profile, isLoading } = useProfileQuery();
  const updateProfile = useProfileMutation();
  const [formData, setFormData] = useState({
    displayName: "",
    goalSummary: "",
    calorieGoal: "",
    proteinGoalGrams: "",
    carbGoalGrams: "",
    fatGoalGrams: "",
    heightCm: "",
    activityLevel: "",
    notes: ""
  });

  useEffect(() => {
    const p = profile?.profile;
    if (!p) return;

    setFormData({
      displayName: p.displayName,
      goalSummary: p.goalSummary ?? "",
      calorieGoal: valueToInput(p.calorieGoal),
      proteinGoalGrams: valueToInput(p.proteinGoalGrams),
      carbGoalGrams: valueToInput(p.carbGoalGrams),
      fatGoalGrams: valueToInput(p.fatGoalGrams),
      heightCm: valueToInput(p.heightCm),
      activityLevel: p.activityLevel ?? "",
      notes: p.notes ?? ""
    });
  }, [profile]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const p = profile?.profile;
  const isDirty =
    formData.displayName !== (p?.displayName ?? "") ||
    formData.goalSummary !== (p?.goalSummary ?? "") ||
    formData.calorieGoal !== valueToInput(p?.calorieGoal) ||
    formData.proteinGoalGrams !== valueToInput(p?.proteinGoalGrams) ||
    formData.carbGoalGrams !== valueToInput(p?.carbGoalGrams) ||
    formData.fatGoalGrams !== valueToInput(p?.fatGoalGrams) ||
    formData.heightCm !== valueToInput(p?.heightCm) ||
    formData.activityLevel !== (p?.activityLevel ?? "") ||
    formData.notes !== (p?.notes ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({
      displayName: formData.displayName || p?.displayName || "",
      goalSummary: formData.goalSummary || null,
      calorieGoal: toNullableNumber(formData.calorieGoal),
      proteinGoalGrams: toNullableNumber(formData.proteinGoalGrams),
      carbGoalGrams: toNullableNumber(formData.carbGoalGrams),
      fatGoalGrams: toNullableNumber(formData.fatGoalGrams),
      heightCm: toNullableNumber(formData.heightCm),
      activityLevel: formData.activityLevel || null,
      notes: formData.notes || null
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          value={formData.displayName}
          onChange={(e) => setFormData((prev) => ({ ...prev, displayName: e.target.value }))}
          placeholder="Your name"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="goalSummary">Goal</Label>
        <Input
          id="goalSummary"
          value={formData.goalSummary}
          onChange={(e) => setFormData((prev) => ({ ...prev, goalSummary: e.target.value }))}
          placeholder="e.g. Lose 10 lbs"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="calorieGoal">Calorie goal</Label>
          <NumericInput
            id="calorieGoal"
            value={formData.calorieGoal}
            allowEmpty
            onValueChange={(value) => setFormData((prev) => ({ ...prev, calorieGoal: value }))}
            placeholder="2000"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="heightCm">Height (cm)</Label>
          <NumericInput
            id="heightCm"
            mode="decimal"
            value={formData.heightCm}
            allowEmpty
            onValueChange={(value) => setFormData((prev) => ({ ...prev, heightCm: value }))}
            placeholder="175"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="activityLevel">Activity level</Label>
          <select
            id="activityLevel"
            value={formData.activityLevel}
            onChange={(e) => setFormData((prev) => ({ ...prev, activityLevel: e.target.value }))}
            className="flex h-9 w-full rounded-md bg-transparent px-3 py-1 text-sm"
          >
            <option value="">Select...</option>
            {ACTIVITY_LEVELS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="proteinGoal">Protein (g)</Label>
          <NumericInput
            id="proteinGoal"
            value={formData.proteinGoalGrams}
            allowEmpty
            onValueChange={(value) => setFormData((prev) => ({ ...prev, proteinGoalGrams: value }))}
            placeholder="150"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="carbGoal">Carbs (g)</Label>
          <NumericInput
            id="carbGoal"
            value={formData.carbGoalGrams}
            allowEmpty
            onValueChange={(value) => setFormData((prev) => ({ ...prev, carbGoalGrams: value }))}
            placeholder="200"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="fatGoal">Fat (g)</Label>
          <NumericInput
            id="fatGoal"
            value={formData.fatGoalGrams}
            allowEmpty
            onValueChange={(value) => setFormData((prev) => ({ ...prev, fatGoalGrams: value }))}
            placeholder="65"
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
          placeholder="Any additional notes..."
          rows={3}
        />
      </div>
      <Button type="submit" disabled={!isDirty || updateProfile.isPending}>
        {updateProfile.isPending ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
