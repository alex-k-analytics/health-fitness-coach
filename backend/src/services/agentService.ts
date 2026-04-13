import type { UserProfile, WorkoutPlanItem } from "../types.js";

export class AgentService {
  async generateWorkoutPlan(profile: UserProfile): Promise<WorkoutPlanItem[]> {
    const cardio = profile.devices.includes("bike") || profile.devices.includes("treadmill");

    return [
      {
        title: cardio ? "Zone 2 Cardio" : "Brisk Walk",
        durationMinutes: 30,
        intensity: "moderate",
        equipment: cardio ? ["bike"] : ["none"]
      },
      {
        title: "Strength Circuit",
        durationMinutes: 25,
        intensity: "moderate",
        equipment: profile.devices.includes("dumbbells") ? ["dumbbells"] : ["none"]
      }
    ];
  }

  async estimateFoodPortionFromPhoto(input: { calorieBalance: number; mealLabel?: string }) {
    const allowedCalories = Math.max(250, Math.min(900, input.calorieBalance * 0.4));

    return {
      mealLabel: input.mealLabel ?? "Meal",
      suggestedCalories: Math.round(allowedCalories),
      guidance:
        "Prioritize lean protein + fiber first. Reduce added fats/sugars if you are behind your calorie target."
    };
  }

  async generateDietBalanceRecommendation() {
    return {
      recommendation:
        "Increase vegetables, omega-3 fats, and protein distribution across meals. Keep added sugar under 10% of intake.",
      confidence: "medium"
    };
  }
}
