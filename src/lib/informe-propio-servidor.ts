// ─────────────────────────────────────────────────────────────────────────────
// EL RESUMEN DE LOS INFORMES DE LA PERSONA (05-nov-2026, informe-propio.ts): veredicto y puntaje GUARDADOS al crearlo
// (`results.veredicto` y la columna `score`, los mismos que dice la portada y el correo) y su fecha. Lo usan las tarjetas de
// los ya analizados en Explorar, la selección y la primera selección. Solo los informes de esa persona.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import type { ResumenInforme } from "@/lib/informe-propio";

/** informe → resumen. De a 100 ids (la lista va en la URL). */
export async function resumenesDeInformes(admin: SupabaseClient, userId: string, informeIds: ReadonlyArray<string | null | undefined>): Promise<Record<string, ResumenInforme>> {
  const ids = Array.from(new Set(informeIds.filter((x): x is string => !!x)));
  const out: Record<string, ResumenInforme> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await admin
      .from("analisis")
      .select("id, score, veredicto:results->>veredicto, created_at")
      .eq("user_id", userId)
      .in("id", ids.slice(i, i + 100));
    reportarFalloQuery(error, { ruta: "lib/informe-propio-servidor", operacion: "resumenes", userId });
    for (const r of (data ?? []) as Array<{ id: string; score: number | null; veredicto: string | null; created_at: string }>) {
      out[r.id] = { veredicto: r.veredicto ?? null, score: typeof r.score === "number" ? r.score : r.score != null ? Number(r.score) : null, fecha: r.created_at };
    }
  }
  return out;
}
