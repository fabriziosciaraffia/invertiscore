// ─────────────────────────────────────────────────────────────────────────────
// EL RECÁLCULO DEL POP-UP (23-oct-2026, mockup D2 de `4-ticket-y-popups.html`): al cambiar el pie o el plazo en «¿Analizar
// este depto?», el veredicto se recalcula al tiro en el servidor (POST /api/deptos/recalcular, la misma sonda con que la
// selección evaluó el depto) y el pop-up lo muestra antes de dejar analizar. Sin respuesta (red, 4xx), null: el pop-up
// no deja cobrar sin el veredicto recalculado. Lo llaman la primera selección y la selección del dashboard.
// ─────────────────────────────────────────────────────────────────────────────
import type { Combinacion } from "./seleccion";

export interface Recalculo {
  veredicto: string | null;
  score: number | null;
  flujo: number | null;
}

export async function recalcularDepto(p: { token: string; avisoId: string; origenId: string | null; combo: Combinacion }): Promise<Recalculo | null> {
  try {
    const res = await fetch("/api/deptos/recalcular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ semanal: p.token, avisoId: p.avisoId, origenId: p.origenId, piePct: p.combo.piePct, plazoAnios: p.combo.plazoAnios }),
    });
    if (!res.ok) return null;
    const d = (await res.json().catch(() => null)) as Partial<Recalculo> | null;
    if (!d || typeof d !== "object") return null;
    return {
      veredicto: typeof d.veredicto === "string" ? d.veredicto : null,
      score: typeof d.score === "number" ? d.score : null,
      flujo: typeof d.flujo === "number" ? d.flujo : null,
    };
  } catch {
    return null;
  }
}
