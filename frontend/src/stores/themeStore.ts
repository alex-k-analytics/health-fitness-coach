import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ColorMode = "light" | "dark" | "system";

interface ThemeStore {
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
  _rehydrated: boolean;
  setRehydrated: () => void;
}

function getSystemColorMode(): "light" | "dark" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      colorMode: "system",
      _rehydrated: false,
      setRehydrated: () => set({ _rehydrated: true }),
      setColorMode: (mode) => set({ colorMode: mode }),
      toggleColorMode: () => {
        const modes: ColorMode[] = ["system", "light", "dark"];
        const current = get().colorMode;
        const nextIndex = (modes.indexOf(current) + 1) % modes.length;
        set({ colorMode: modes[nextIndex] });
      },
    }),
    {
      name: "hc-theme",
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.colorMode);
          state.setRehydrated();
        }
      },
    }
  )
);

export function applyTheme(mode: ColorMode = "system") {
  const root = document.documentElement;
  const actualMode = mode === "system" ? getSystemColorMode() : mode;

  if (actualMode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (useThemeStore.getState().colorMode === "system") {
      applyTheme("system");
    }
  });

  useThemeStore.subscribe((state) => {
    if (state._rehydrated) {
      applyTheme(state.colorMode);
    }
  });
}
