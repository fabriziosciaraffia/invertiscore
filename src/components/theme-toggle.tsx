"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(document.documentElement.getAttribute("data-theme") === "light");
  }, []);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("franco-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("franco-theme", "dark");
    }
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
