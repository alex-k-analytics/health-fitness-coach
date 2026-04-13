import { useEffect, useState } from "react";
import { Card } from "./components/Card";
import { apiFetch } from "./api";

interface Profile {
  name: string;
  dailyCalorieGoal: number;
  devices: string[];
}

interface WorkoutPlanItem {
  title: string;
  durationMinutes: number;
  intensity: string;
}

export function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<WorkoutPlanItem[]>([]);
  const [portionAdvice, setPortionAdvice] = useState<string>("");
  const [messageResult, setMessageResult] = useState<string>("");

  useEffect(() => {
    apiFetch<Profile>("/profile").then(setProfile).catch(console.error);
    apiFetch<{ plan: WorkoutPlanItem[] }>("/workouts/plan")
      .then((data) => setPlan(data.plan))
      .catch(console.error);
  }, []);

  async function handleFoodSubmit() {
    const result = await apiFetch<{ suggestedCalories: number; guidance: string }>(
      "/nutrition/portion-from-photo",
      {
        method: "POST",
        body: JSON.stringify({ calorieBalance: profile?.dailyCalorieGoal ?? 2000, mealLabel: "Lunch" })
      }
    );
    setPortionAdvice(`${result.suggestedCalories} kcal target. ${result.guidance}`);
  }

  async function handleReminder() {
    const result = await apiFetch<{ status: string }>("/integrations/sms/reminder", {
      method: "POST",
      body: JSON.stringify({ message: "Workout block starts in 30 minutes 💪" })
    });
    setMessageResult(`Reminder status: ${result.status}`);
  }

  return (
    <main className="app-shell">
      <header>
        <h1>Health & Fitness Coach</h1>
        <p className="subtitle">Mobile-first AI coach for workouts, nutrition, and reminders.</p>
      </header>

      <Card>
        <h2>Profile + equipment</h2>
        {profile ? (
          <>
            <p>{profile.name}</p>
            <p>Calorie goal: {profile.dailyCalorieGoal}</p>
            <p>Equipment: {profile.devices.join(", ")}</p>
          </>
        ) : (
          <p>Loading profile…</p>
        )}
      </Card>

      <Card>
        <h2>Workout suggestions</h2>
        <ul>
          {plan.map((item) => (
            <li key={item.title}>
              <strong>{item.title}</strong> • {item.durationMinutes} min • {item.intensity}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2>Food photo flow (stub)</h2>
        <p>Use mobile camera upload in phase 2. For now this tests the portion-guidance pipeline.</p>
        <button onClick={handleFoodSubmit}>Get Portion Advice</button>
        {portionAdvice && <p>{portionAdvice}</p>}
      </Card>

      <Card>
        <h2>Agent reminders</h2>
        <button onClick={handleReminder}>Text me a workout reminder</button>
        {messageResult && <p>{messageResult}</p>}
      </Card>
    </main>
  );
}
