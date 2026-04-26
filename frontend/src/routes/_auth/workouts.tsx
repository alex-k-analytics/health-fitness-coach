import { createFileRoute } from "@tanstack/react-router";
import { WorkoutsPage } from "@/features/workouts/WorkoutsPage";

export const Route = createFileRoute("/_auth/workouts")({
  component: WorkoutsPage
});
