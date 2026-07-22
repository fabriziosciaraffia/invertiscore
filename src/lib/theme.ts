// Fuente única de verdad del tema (Fase 1 · infraestructura).
// ─────────────────────────────────────────────────────────────
// Persistencia: localStorage["franco-theme"] con valores "light" | "dark".
// Atributo aplicado: data-theme="light" en <html>. Mecanismo CSS intacto: la
// AUSENCIA del atributo = dark.
//
// DEFAULT = LIGHT (cierre del capítulo Galería, decisión Fabrizio): quien NO
// tiene preferencia guardada resuelve a light — el pre-paint le aplica
// data-theme="light". Solo un 'dark' explícito guardado deja el atributo
// ausente. Quien ya eligió conserva su elección; el default no se persiste
// (cero migración forzada).
//
// El script pre-paint en layout.tsx replica el READ + la migración de la key
// legacy de la landing INLINE (no puede importar este módulo). Si cambia la
// lógica de lectura/migración/default, mantener ambos en sync.

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "franco-theme";
const LEGACY_LANDING_KEY = "franco-landing-theme";

/**
 * Lee el tema persistido, migrando una vez desde la key legacy de la landing.
 * Sin preferencia guardada (o localStorage no disponible) → "light" (default
 * del capítulo Galería). Mantener en sync con el pre-paint de layout.tsx.
 */
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
  return "light";
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

/**
 * Fuerza el repaint de los form controls nativos tras un cambio de tema EN VIVO.
 *
 * Bug Chromium: <input>/<select>/<textarea> NO re-resuelven `var(--franco-*)` en
 * su `background` cuando el custom property cambia en un ancestro sin recargar
 * (el `--franco-card` del control ya vale el nuevo color, pero el pintado queda
 * cacheado). Un <div> sí repinta; los controles nativos no → quedaban blancos
 * en dark (texto claro sobre blanco = ilegible). El `color-scheme` atado al tema
 * (globals.css) ayuda pero no es determinista.
 *
 * Toggle de `visibility` en <html> fuerza el repaint completo: es SÍNCRONO (el
 * navegador no pinta el estado oculto porque no cruza un frame boundary dentro
 * del task → imperceptible) y focus-safe (a diferencia de `display:none`,
 * `visibility` NO quita el foco ni resetea el caret). Solo corre en el path de
 * toggle en vivo; el pre-paint (layout.tsx) no lo necesita.
 */
function repaintFormControls(): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.style.visibility = "hidden";
  void el.offsetHeight; // fuerza el reflow entre las dos escrituras
  el.style.visibility = "";
}

/** Cambia y persiste el tema en un solo lugar (atributo + storage). */
export function setTheme(theme: Theme): void {
  applyThemeAttribute(theme);
  persistTheme(theme);
  repaintFormControls();
}
