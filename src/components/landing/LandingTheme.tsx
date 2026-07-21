"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { currentTheme, setTheme as applyTheme, type Theme } from "@/lib/theme";

type ThemeCtx = {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

// Fase 1 · el provider de la landing dejó de tener estado/storage propio.
// Ahora es un adapter fino sobre la fuente única (src/lib/theme): el tema real
// lo aplica el script pre-paint (data-theme en <html>); acá solo lo reflejamos
// en React y escribimos siempre al mismo lugar. Mantiene la API useLandingTheme
// intacta para los consumers existentes (UnifiedNav).
export function LandingThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  // Lee el tema ya aplicado (evita FOUC — el atributo viene del pre-paint).
  useEffect(() => {
    setThemeState(currentTheme());
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t); // atributo en <html> + persistencia (fuente única)
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
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
