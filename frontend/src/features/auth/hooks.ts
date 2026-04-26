import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, setAuthToken } from "@/api";
import { useShellStore } from "@/stores/shellStore";
import { useRouter } from "@tanstack/react-router";
import type { SessionData } from "@/types";

export function useSessionQuery() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const session = await apiFetch<SessionData>("/auth/session");
      setAuthToken(session.token);
      return session;
    },
    staleTime: 5 * 60_000,
    retry: false
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const setSession = useShellStore.getState().setSession;
  const setGlobalNotice = useShellStore.getState().setGlobalNotice;

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const session = await apiFetch<SessionData>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials)
      });
      return session;
    },
    onSuccess: (session) => {
      setAuthToken(session.token);
      setSession(session);
      queryClient.setQueryData(["session"], session);
      setGlobalNotice("Signed in.");
    }
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const setSession = useShellStore.getState().setSession;
  const setGlobalNotice = useShellStore.getState().setGlobalNotice;
  const clearGlobalState = useShellStore.getState().clearGlobalState;

  return useMutation({
    mutationFn: () => apiFetch<void>("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      setAuthToken(null);
      setSession(null);
      queryClient.clear();
      clearGlobalState();
      setGlobalNotice("Signed out.");
      router.navigate({ to: "/login" });
    }
  });
}
