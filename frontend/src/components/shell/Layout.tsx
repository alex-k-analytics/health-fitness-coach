import { Outlet } from "@tanstack/react-router";
import { DashboardHeader } from "./DashboardHeader";

export function ShellLayout() {
  return (
    <main className="app-shell min-h-screen">
      <DashboardHeader />
      <Outlet />
    </main>
  );
}
