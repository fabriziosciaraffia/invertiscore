"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { currentTheme, setTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(currentTheme() === "light");
  }, []);

  function toggle() {
    const next: Theme = isLight ? "dark" : "light";
    setIsLight(next === "light");
    setTheme(next); // fuente única: atributo en <html> + persistencia
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      className="flex items-center justify-center w-8 h-8 rounded-full transition-colors bg-[var(--franco-card)] text-[var(--franco-text-secondary)] hover:text-[var(--franco-text)] hover:bg-[var(--franco-elevated)]"
    >
      {isLight ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}
