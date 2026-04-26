const MET_TABLE: Record<string, Record<string, number>> = {
  WALKING: { slow: 3.0, moderate: 3.5 },
  RUNNING: { jog: 6.0, moderate: 9.8, fast: 10.5, sprint: 11.5 },
  CYCLING: { slow: 4.0, moderate: 6.0, fast: 8.0, sprint: 10.0 },
  SWIMMING: { casual: 6.0, moderate: 8.0, vigorous: 10.0 },
  WEIGHTLIFTING: { moderate: 3.5, vigorous: 6.0 },
  CALISTHENICS: { moderate: 3.5, vigorous: 6.0 },
  HIIT: { default: 8.0 }
};

const LIFT_FACTORS: Record<string, number> = {
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

const EXERCISE_CATEGORIES: Record<string, string[]> = {
  RUNNING: ["Running", "Jogging", "Sprinting", "Trail Running"],
  WALKING: ["Walking", "Power Walking", "Hiking"],
  CYCLING: ["Cycling", "Spin Class", "Mountain Biking"],
  SWIMMING: ["Freestyle", "Backstroke", "Butterfly", "Breaststroke", "Swimming"],
  WEIGHTLIFTING: [
    "Bench Press", "Squat", "Deadlift", "Overhead Press", "Barbell Row",
    "Pull-ups", "Dumbbell Curl", "Tricep Extension", "Lateral Raise",
    "Leg Press", "Leg Curl", "Leg Extension", "Calf Raise", "Hip Thrust",
    "Incline Bench Press"
  ],
  CALISTHENICS: [
    "Push-ups", "Pull-ups", "Dips", "Bodyweight Squats", "Plank",
    "Burpees", "Mountain Climbers", "Lunges", "Pike Push-ups", "Box Jumps"
  ],
  HIIT: ["HIIT", "Tabata", "Circuit Training"]
};

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

interface ExerciseCalorieInput {
  name: string;
  kind: "LIFT" | "CARDIO";
  category: string;
  sets?: Array<{ reps: number; weightLbs: number }>;
  distance?: number;
  durationSeconds?: number;
}

function calculateCardioCalories(exercise: ExerciseCalorieInput, weightKg: number): number {
  const durationHours = (exercise.durationSeconds ?? 0) / 3600;
  if (durationHours <= 0) return 0;

  const met = resolveMet(exercise.category, exercise.distance, exercise.durationSeconds);
  return Math.round(met * weightKg * durationHours);
}

function calculateStrengthCalories(exercise: ExerciseCalorieInput, weightKg: number): number {
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

export function calculateExerciseCalories(exercise: ExerciseCalorieInput, weightKg: number): number {
  switch (exercise.category) {
    case "RUNNING":
    case "WALKING":
    case "CYCLING":
    case "SWIMMING":
      return calculateCardioCalories(exercise, weightKg);
    case "WEIGHTLIFTING":
    case "CALISTHENICS":
    case "HIIT":
      return calculateStrengthCalories(exercise, weightKg);
    default:
      return 0;
  }
}

export function computeSessionCalories(
  exercises: ExerciseCalorieInput[],
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

export { EXERCISE_CATEGORIES, MET_TABLE, LIFT_FACTORS };
