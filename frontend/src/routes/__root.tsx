import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { apiFetch, setAuthToken } from "@/api";
import { useShellStore } from "@/stores/shellStore";
import { GlobalBanner } from "@/components/shared/GlobalBanner";
import type { SessionData } from "@/types";

interface RouterContext {
  authenticated: boolean;
}

export const Route = createRootRouteWithContext<RouterContext>()({
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
      <TanStackRouterDevtools position="bottom-right" />
    </>
  );
}
