import { createFileRoute } from "@tanstack/react-router";
import { PlanningPage } from "@/features/planning/PlanningPage";

export const Route = createFileRoute("/_auth/planning")({
  component: PlanningPage
});
