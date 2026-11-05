// ─────────────────────────────────────────────────────────────────────────────
// EL RESUMEN DE LOS INFORMES DE LA PERSONA (05-nov-2026, informe-propio.ts): el veredicto GUARDADO al crearlo (el que dice la
// portada y el correo), el puntaje DE LA PORTADA y su fecha. Lo usan las tarjetas de los ya analizados en Explorar, la
// selección y la primera selección. Solo los informes de esa persona.
// EL PUNTAJE DE LA PORTADA (05-nov-2026, auditoría de promesas parte 3): en renta larga el informe recalcula al abrir
// (lib/analysis/resultados-del-informe.ts); la columna `score` es la del motor del día en que se creó y en los informes de
// septiembre difiere en 1 o 2 puntos (medido: 21 de 37; desde octubre, 0 de 113). La tarjeta usa el mismo recálculo.
// En renta corta queda la columna.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportarFalloQuery } from "@/lib/observabilidad";
import type { ResumenInforme } from "@/lib/informe-propio";
import { getUFValue } from "@/lib/uf";
import { puntajeDelInforme, type FilaInforme } from "@/lib/analysis/resultados-del-informe";

type FilaResumen = FilaInforme & { score: number | null; veredicto: string | null; tipo_analisis: string | null };

/** informe → resumen. De a 100 ids (la lista va en la URL). */
export async function resumenesDeInformes(admin: SupabaseClient, userId: string, informeIds: ReadonlyArray<string | null | undefined>): Promise<Record<string, ResumenInforme>> {
  const ids = Array.from(new Set(informeIds.filter((x): x is string => !!x)));
  const out: Record<string, ResumenInforme> = {};
  if (ids.length === 0) return out;
  const filas: FilaResumen[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await admin
      .from("analisis")
      .select("id, score, veredicto:results->>veredicto, created_at, tipo_analisis, results, input_data, mediana_comuna_snapshot, capref_comuna_snapshot")
      .eq("user_id", userId)
      .in("id", ids.slice(i, i + 100));
    reportarFalloQuery(error, { ruta: "lib/informe-propio-servidor", operacion: "resumenes", userId });
    filas.push(...((data ?? []) as unknown as FilaResumen[]));
  }
  const uf = filas.some((f) => f.tipo_analisis === "long-term") ? await getUFValue() : 0;
  const columna = (f: FilaResumen) => (typeof f.score === "number" ? f.score : f.score != null ? Number(f.score) : null);
  // De a cuatro: cada recálculo cuesta ~136 ms.
  for (let i = 0; i < filas.length; i += 4) {
    await Promise.all(filas.slice(i, i + 4).map(async (f) => {
      let score = columna(f);
      if (f.tipo_analisis === "long-term") {
        try { score = (await puntajeDelInforme(admin, f, uf)) ?? score; } catch { /* sin recálculo, la columna */ }
      }
      out[f.id] = { veredicto: f.veredicto ?? null, score, fecha: f.created_at };
    }));
  }
  return out;
}
