// ─────────────────────────────────────────────────────────────────────────────
// El canal de una llegada según sus UTM (15-oct-2026, la medición de la campaña). Módulo propio desde el 20-oct-2026: lo
// usa también el middleware, que corre en Edge y no puede importar attribution.ts (trae `crypto` de Node). Puro.
// ─────────────────────────────────────────────────────────────────────────────

/** Pagado u orgánico según los UTM (las campañas de Meta llegan con `utm_medium=paid` y la fuente ig/fb/an/th). */
export function canalDeUtm(a: { utm_source?: string | null; utm_medium?: string | null }): "pagado" | "organico" {
  return a.utm_medium === "paid" || ["ig", "fb", "an", "th", "facebook", "instagram"].includes((a.utm_source ?? "").toLowerCase()) ? "pagado" : "organico";
}
