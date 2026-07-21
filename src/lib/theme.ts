// Fuente única de verdad del tema (Fase 1 · infraestructura).
// ─────────────────────────────────────────────────────────────
// Persistencia: localStorage["franco-theme"] con valores "light" | "dark".
// Atributo aplicado: data-theme="light" en <html>. La AUSENCIA del atributo
// = dark (default histórico intacto — no se cambia en esta fase).
//
// El script pre-paint en layout.tsx replica el READ + la migración de la key
// legacy de la landing INLINE (no puede importar este módulo). Si cambia la
// lógica de lectura/migración, mantener ambos en sync.

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "franco-theme";
const LEGACY_LANDING_KEY = "franco-landing-theme";

/** Lee el tema persistido, migrando una vez desde la key legacy de la landing. */
export function readStoredTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    if (t === "light" || t === "dark") return t;
    const legacy = localStorage.getItem(LEGACY_LANDING_KEY);
    if (legacy === "light" || legacy === "dark") {
      localStorage.setItem(THEME_STORAGE_KEY, legacy);
      return legacy;
    }
  } catch {
    /* private mode / quota — cae al default */
  }
  return "dark";
}

/** Tema activo según el atributo en <html> (ya aplicado pre-paint). */
export function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

/** Aplica el atributo en <html>. Ausencia de atributo = dark (default intacto). */
export function applyThemeAttribute(theme: Theme): void {
  if (typeof document === "undefined") return;
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

/** Persiste la elección en la fuente única. */
export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

/** Cambia y persiste el tema en un solo lugar (atributo + storage). */
export function setTheme(theme: Theme): void {
  applyThemeAttribute(theme);
  persistTheme(theme);
}
