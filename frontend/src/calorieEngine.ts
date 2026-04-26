import type { WorkoutActivityType, WorkoutExercise, WorkoutSet } from "./types";

const MET_TABLE: Record<string, Record<string, number>> = {
  WALKING: { slow: 3.0, moderate: 3.5 },
  RUNNING: { jog: 6.0, moderate: 9.8, fast: 10.5, sprint: 11.5 },
  CYCLING: { slow: 4.0, moderate: 6.0, fast: 8.0, sprint: 10.0 },
  SWIMMING: { casual: 6.0, moderate: 8.0, vigorous: 10.0 },
  WEIGHTLIFTING: { moderate: 3.5, vigorous: 6.0 },
  CALISTHENICS: { moderate: 3.5, vigorous: 6.0 },
  HIIT: { default: 8.0 }
};

export const LIFT_FACTORS: Record<string, number> = {
  "Deadlift": 0.022,
  "Squat": 0.022,
  "Leg Press": 0.019,
  "Hip Thrust": 0.019,
  "Bench Press": 0.018,
  "Overhead Press": 0.018,
  "Barbell Row": 0.017,
  "Incline Bench Press": 0.017,
  "Pull-ups": 0.016,
  "Dips": 0.016,
  "Leg Curl": 0.013,
  "Bicep Curl": 0.012,
  "Leg Extension": 0.012,
  "Calf Raise": 0.011,
  "Tricep Extension": 0.011,
  "Lateral Raise": 0.010
};

const CARDIO_CATEGORIES = new Set(["RUNNING", "WALKING", "CYCLING", "SWIMMING"]);

function resolveMet(category: string, distance?: number, durationSeconds?: number): number {
  const table = MET_TABLE[category];
  if (!table) return 0;

  if (category === "HIIT") return table.default;
  if (category === "WEIGHTLIFTING") return table.moderate;
  if (category === "CALISTHENICS") return table.moderate;

  const speedKeys = Object.keys(table);
  if (speedKeys.length === 0) return 0;

  if (distance !== undefined && durationSeconds !== undefined && durationSeconds > 0) {
    const durationHours = durationSeconds / 3600;
    const speed = distance / durationHours;
    if (category === "RUNNING") {
      if (speed > 7) return table.sprint;
      if (speed > 6) return table.fast;
      if (speed > 5) return table.moderate;
      return table.jog;
    }
    if (category === "WALKING") {
      if (speed >= 3) return table.moderate;
      return table.slow;
    }
    if (category === "CYCLING") {
      if (speed > 14) return table.sprint;
      if (speed > 12) return table.fast;
      if (speed > 10) return table.moderate;
      return table.slow;
    }
    return table[speedKeys[1]] ?? table[speedKeys[0]];
  }

  return table[speedKeys[1]] ?? table[speedKeys[0]];
}

export function calculateCardioCalories(
  exercise: WorkoutExercise,
  weightKg: number
): number {
  const durationHours = (exercise.durationSeconds ?? 0) / 3600;
  if (durationHours <= 0) return 0;
  const met = resolveMet(exercise.category, exercise.distance, exercise.durationSeconds);
  return Math.round(met * weightKg * durationHours);
}

export function calculateStrengthCalories(
  exercise: WorkoutExercise,
  weightKg: number
): number {
  if (!exercise.sets?.length) {
    if (exercise.name.toLowerCase() === "plank" && exercise.durationSeconds) {
      const met = resolveMet("CALISTHENICS");
      const durationHours = exercise.durationSeconds / 3600;
      return Math.round(met * weightKg * durationHours);
    }
    return 0;
  }

  const factor = LIFT_FACTORS[exercise.name] ?? 0.015;
  const setCalories = exercise.sets.reduce(
    (total, set) => total + set.reps * set.weightLbs * factor,
    0
  );

  const restMinutes = (exercise.sets.length - 1) * 1.5;
  const restCalories = restMinutes * 0.5;

  return Math.round(setCalories + restCalories);
}

export function calculateExerciseCalories(
  exercise: WorkoutExercise,
  weightKg: number
): number {
  if (CARDIO_CATEGORIES.has(exercise.category)) {
    return calculateCardioCalories(exercise, weightKg);
  }
  return calculateStrengthCalories(exercise, weightKg);
}

export function computeSessionCalories(
  exercises: WorkoutExercise[],
  weightKg: number
): { total: number; byCategory: Record<string, number> } {
  const byCategory: Record<string, number> = {};
  let total = 0;

  for (const exercise of exercises) {
    const cals = calculateExerciseCalories(exercise, weightKg);
    total += cals;
    byCategory[exercise.category] = (byCategory[exercise.category] ?? 0) + cals;
  }

  return { total, byCategory };
}

export function levenshtein(a: string, b: string): number {
  const m: number[][] = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = b[i - 1] === a[j - 1]
        ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[b.length][a.length];
}

export function fuzzyMatch(query: string, candidates: string[], threshold = 2): string[] {
  const q = query.toLowerCase();
  const exact = candidates.filter((c) => c.toLowerCase() === q);
  if (exact.length) return exact;

  const substring = candidates.filter((c) => c.toLowerCase().includes(q));
  if (substring.length) return substring.slice(0, 6);

  const fuzzy = candidates
    .map((c) => ({ name: c, dist: levenshtein(q, c.toLowerCase()) }))
    .filter((c) => c.dist <= threshold + query.length * 0.3)
    .sort((a, b) => a.dist - b.dist)
    .map((c) => c.name);

  return fuzzy.slice(0, 6);
}
