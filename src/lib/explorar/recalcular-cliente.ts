// ─────────────────────────────────────────────────────────────────────────────
// EL RECÁLCULO DEL POP-UP DESDE EL NAVEGADOR (23-oct-2026, mockup D2): al cambiar el pie o el plazo en «¿Analizar este
// depto?», el veredicto se recalcula en el servidor (POST /api/explorar/recalcular: la sonda del motor sobre la evaluación
// de la noche, la misma del mapa) y el pop-up lo muestra antes de dejar analizar. Sin respuesta (red, 4xx), null: el pop-up
// no deja cobrar sin el veredicto recalculado. Lo usan la primera selección y la selección del dashboard; el mapa tiene el
// suyo en explorar-cliente.tsx.
// ─────────────────────────────────────────────────────────────────────────────
import type { Recalculo } from "./explorar";

export async function recalcularAviso(avisoId: string, combo: { piePct: number; plazoAnios: number; tasaPct?: number | null }): Promise<Recalculo | null> {
  try {
    const res = await fetch("/api/explorar/recalcular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // La tasa elegida (30-oct-2026); null = la de hoy.
      body: JSON.stringify({ avisoId, piePct: combo.piePct, plazoAnios: combo.plazoAnios, tasaPct: combo.tasaPct ?? null }),
    });
    if (!res.ok) return null;
    const d = (await res.json().catch(() => null)) as Partial<Recalculo> | null;
    if (!d || typeof d !== "object" || typeof d.veredicto !== "string") return null;
    return { veredicto: d.veredicto, score: typeof d.score === "number" ? d.score : null, flujo: typeof d.flujo === "number" ? d.flujo : null, cuota: typeof d.cuota === "number" ? d.cuota : null } as Recalculo;
  } catch {
    return null;
  }
}
