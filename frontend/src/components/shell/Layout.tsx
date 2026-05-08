import { Outlet } from "@tanstack/react-router";
import { DashboardHeader } from "./DashboardHeader";
import { BottomNav } from "./BottomNav";

export function ShellLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-subtle">
      <DashboardHeader />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
