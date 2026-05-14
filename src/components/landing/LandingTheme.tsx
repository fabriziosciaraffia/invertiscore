"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

type ThemeCtx = {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
};

const STORAGE_KEY = "franco-landing-theme";

const Ctx = createContext<ThemeCtx | null>(null);

export function LandingThemeProvider({ children }: { children: React.ReactNode }) {
  // Default dark. Lee localStorage en mount (evita FOUC con script inline en layout).
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY)) as Theme | null;
    if (saved === "light" || saved === "dark") setThemeState(saved);
  }, []);

  // Aplica el atributo al wrapper (también lo mantiene sincronizado).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.querySelector<HTMLElement>("[data-franco-root]");
    if (root) root.setAttribute("data-franco-theme", theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ theme, toggle, setTheme }}>{children}</Ctx.Provider>;
}

export function useLandingTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fallback no-op (SSR / fuera del provider). Mantiene dark.
    return { theme: "dark", toggle: () => {}, setTheme: () => {} };
  }
  return ctx;
}
