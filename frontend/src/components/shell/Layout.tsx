import { Outlet } from "@tanstack/react-router";
import { DashboardHeader } from "./DashboardHeader";
import { BottomNav } from "./BottomNav";

export function ShellLayout() {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-gradient-subtle">
      <DashboardHeader />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
