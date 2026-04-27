import { useEffect, useState } from "react";
import type * as React from "react";
import { Input } from "@/components/ui/input";

type NumericMode = "integer" | "decimal";

type NumericInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange" | "inputMode"> & {
  value: string;
  mode?: NumericMode;
  max?: number;
  allowEmpty?: boolean;
  onValueChange: (value: string) => void;
};

type NumericValueInputProps = Omit<NumericInputProps, "value" | "onValueChange" | "allowEmpty"> & {
  value: number | undefined;
  onValueChange: (value: number) => void;
};

export function NumericInput({
  value,
  mode = "integer",
  max,
  allowEmpty = false,
  onValueChange,
  onBlur,
  ...props
}: NumericInputProps) {
  return (
    <Input
      {...props}
      inputMode={mode === "decimal" ? "decimal" : "numeric"}
      value={value}
      onChange={(event) => onValueChange(cleanNumericDraft(event.target.value, { mode, max, allowEmpty }))}
      onBlur={(event) => {
        onValueChange(formatNumericInput(event.currentTarget.value, { mode, allowEmpty }));
        onBlur?.(event);
      }}
    />
  );
}

export function NumericValueInput({
  value,
  mode = "integer",
  max,
  onValueChange,
  onFocus,
  onBlur,
  ...props
}: NumericValueInputProps) {
  const [draft, setDraft] = useState(formatNumericValue(value, mode));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(formatNumericValue(value, mode));
    }
  }, [isFocused, mode, value]);

  return (
    <Input
      {...props}
      inputMode={mode === "decimal" ? "decimal" : "numeric"}
      value={draft}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const nextDraft = cleanNumericDraft(event.target.value, { mode, max, allowEmpty: false });
        setDraft(nextDraft);
        onValueChange(parseNumericInput(nextDraft));
      }}
      onBlur={(event) => {
        setIsFocused(false);
        const formatted = formatNumericInput(draft, { mode, allowEmpty: false });
        setDraft(formatted);
        onValueChange(parseNumericInput(formatted));
        onBlur?.(event);
      }}
    />
  );
}

function cleanNumericDraft(
  value: string,
  { mode, max, allowEmpty }: { mode: NumericMode; max?: number; allowEmpty: boolean }
): string {
  const normalized = mode === "decimal"
    ? cleanDecimalDraft(value)
    : cleanIntegerDraft(value);

  if (allowEmpty && normalized === "") return "";
  if (normalized === "") return "0";
  if (max === undefined || normalized.endsWith(".")) return normalized;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return allowEmpty ? "" : "0";
  return parsed > max ? String(max) : normalized;
}

function cleanIntegerDraft(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/^0+(?=\d)/, "");
}

function cleanDecimalDraft(value: string): string {
  const normalized = value.replace(/[^\d.]/g, "");
  const firstDecimal = normalized.indexOf(".");

  if (firstDecimal === -1) {
    return normalizeWholePart(normalized);
  }

  const whole = normalizeWholePart(normalized.slice(0, firstDecimal)) || "0";
  const decimal = normalized.slice(firstDecimal + 1).replace(/\./g, "");
  return `${whole}.${decimal}`;
}

function normalizeWholePart(value: string): string {
  return value.replace(/^0+(?=\d)/, "");
}

function formatNumericInput(
  value: string,
  { mode, allowEmpty }: { mode: NumericMode; allowEmpty: boolean }
): string {
  if (allowEmpty && value.trim() === "") return "";

  const cleaned = cleanNumericDraft(value, { mode, allowEmpty, max: undefined });
  if (allowEmpty && cleaned === "") return "";

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? String(parsed) : allowEmpty ? "" : "0";
}

function parseNumericInput(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumericValue(value: number | undefined, mode: NumericMode): string {
  if (value === undefined || !Number.isFinite(value)) return "0";
  if (mode === "integer") return String(Math.trunc(value));
  return String(value);
}
