import { create } from "zustand";
import type { SessionData } from "@/types";

interface ShellStore {
  session: SessionData | null;
  setSession: (session: SessionData | null) => void;
  globalError: string;
  globalNotice: string;
  setGlobalError: (error: string) => void;
  setGlobalNotice: (notice: string) => void;
  clearGlobalState: () => void;
  profileDrawerOpen: boolean;
  setProfileDrawerOpen: (open: boolean) => void;
}

export const useShellStore = create<ShellStore>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  globalError: "",
  globalNotice: "",
  setGlobalError: (globalError) => set({ globalError, globalNotice: "" }),
  setGlobalNotice: (globalNotice) => set({ globalNotice, globalError: "" }),
  clearGlobalState: () => set({ globalError: "", globalNotice: "" }),
  profileDrawerOpen: false,
  setProfileDrawerOpen: (profileDrawerOpen) => set({ profileDrawerOpen })
}));
