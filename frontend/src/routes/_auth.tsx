import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ShellLayout } from "@/components/shell/Layout";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ context }) => {
    if (!context.authenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: ShellLayout
});
