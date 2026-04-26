import type { NutritionEstimate } from "@/types";

export function getServingCount(quantity: string): number {
  const trimmed = quantity.trim();
  if (!trimmed) return 1;
  const parsed = Number(trimmed);
  return parsed > 0 ? parsed : 1;
}

export function scaleNutritionEstimate(
  estimate: NutritionEstimate,
  multiplier: number
): NutritionEstimate {
  const scale = (value: number) => Math.round(value * multiplier * 10) / 10;

  return {
    ...estimate,
    estimatedCalories: Math.round(estimate.estimatedCalories * multiplier),
    proteinGrams: scale(estimate.proteinGrams),
    carbsGrams: scale(estimate.carbsGrams),
    fatGrams: scale(estimate.fatGrams),
    fiberGrams: scale(estimate.fiberGrams),
    sugarGrams: scale(estimate.sugarGrams),
    sodiumMg: Math.round(estimate.sodiumMg * multiplier),
    micronutrients: estimate.micronutrients.map((item) => ({
      ...item,
      amount: scale(item.amount)
    })),
    vitamins: estimate.vitamins.map((item) => ({
      ...item,
      amount: scale(item.amount)
    })),
    foodBreakdown: estimate.foodBreakdown.map((item) => ({
      ...item,
      calories: Math.round(item.calories * multiplier),
      proteinGrams: scale(item.proteinGrams),
      carbsGrams: scale(item.carbsGrams),
      fatGrams: scale(item.fatGrams)
    }))
  };
}

export const KG_PER_LB = 0.45359237;

export const kgToLbs = (value: number) => value / KG_PER_LB;
export const lbsToKg = (value: number) => value * KG_PER_LB;

export function formatWeightValue(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : kgToLbs(value).toFixed(1);
}

export function formatWeight(value: number | null | undefined): string {
  const formatted = formatWeightValue(value);
  return formatted ? `${formatted} lb` : "No weight";
}

export function toOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toNullableNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function valueToInput(value: number | string | null | undefined): string {
  return (value ?? "").toString();
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export function formatShortDay(value: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(value));
}

export function toDateTimeLocalInput(value: string): string {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

export function getProgressPercent(current: number, goal?: number | null): number {
  if (!goal || goal <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / goal) * 100)));
}

export function formatMacroValue(value: number | null | undefined): string {
  return value === null || value === undefined ? "0g" : `${Math.round(value)}g`;
}

export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m} min`;
}
