// Telemetría de la landing v14 — nombres en un solo lugar (GOAL landing v14).
//
// Todos viajan con las UTM que `useUTMCapture` registró en la persona; además
// `landing_viewed` las adjunta explícitas desde la URL para que el dashboard no
// dependa del `register`. Excluir `utm_source=an` de cualquier dashboard.

export const EV = {
  viewed: "landing_viewed",
  section: "landing_section_viewed",
  ctaFocus: "landing_cta_focus",
  ejemplo: "landing_ejemplo_click",
  planes: "landing_planes_click",
  sinDireccion: "landing_sin_direccion",
} as const;

/** Dónde vive el campo de dirección. `metodologia` es el CTA del interior:
 *  mismo componente, otro origen para el wizard y la telemetría. */
export type UbicacionCampo = "hero" | "cierre" | "metodologia";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/** UTM presentes en la URL actual (vacío si no hay). Solo en el cliente. */
export function utmDeUrl(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = p.get(k);
    if (v) out[k] = v;
  }
  return out;
}
