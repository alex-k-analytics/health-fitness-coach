import { createFileRoute } from "@tanstack/react-router";
import { MealsPage } from "@/features/meals/MealsPage";

export const Route = createFileRoute("/_auth/meals")({
  component: MealsPage
});
