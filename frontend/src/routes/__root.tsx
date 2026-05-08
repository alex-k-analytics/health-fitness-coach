import { lazy, Suspense } from "react";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { apiFetch, setAuthToken } from "@/api";
import { useShellStore } from "@/stores/shellStore";
import { GlobalBanner } from "@/components/shared/GlobalBanner";
import { RootLoadingSkeleton } from "@/components/shell/RootLoadingSkeleton";
import type { SessionData } from "@/types";

interface RouterContext {
  authenticated: boolean;
}

const enableRouterDevtools = import.meta.env.VITE_ENABLE_ROUTER_DEVTOOLS === "true";
const RouterDevtools = enableRouterDevtools
  ? lazy(() =>
      import("@tanstack/router-devtools").then((module) => ({
        default: module.TanStackRouterDevtools
      }))
    )
  : null;

export const Route = createRootRouteWithContext<RouterContext>()({
  pendingComponent: RootLoadingSkeleton,
  beforeLoad: async () => {
    let authenticated = false;
    try {
      const session = await apiFetch<SessionData>("/auth/session");
      setAuthToken(session.token);
      authenticated = session.authenticated;
      useShellStore.getState().setSession(session);
    } catch {
      setAuthToken(null);
      useShellStore.getState().setSession({ authenticated: false });
    }
    return { authenticated };
  },
  component: RootComponent
});

function RootComponent() {
  return (
    <>
      <GlobalBanner />
      <Outlet />
      {RouterDevtools ? (
        <Suspense fallback={null}>
          <RouterDevtools position="bottom-right" />
        </Suspense>
      ) : null}
    </>
  );
}
