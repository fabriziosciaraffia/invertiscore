// ─────────────────────────────────────────────────────────────────────────────
// LA EDAD REAL EN LA EVALUACIÓN DE CADA NOCHE (05-nov-2026, decisión de Fabrizio). Hasta hoy la noche evaluaba a todo usado
// con 25 años supuestos (evaluar-aviso.ts › ANTIGUEDAD_SUPUESTA), aunque el año del edificio ya se conociera por una ficha
// leída —la del aviso o la de otro aviso del mismo edificio—, mientras el informe de ese mismo depto usaba la edad real: la
// tarjeta y el informe podían diferir solo por eso. Ahora la noche le pone a cada usado la edad conocida con la MISMA regla del
// informe (guia/edad-edificio.ts › edadConocida): el año de su ficha (`fichas_leidas`), si no el del edificio
// (`anios_edificio`), si no null (25 supuestos). Y la fila evaluada con otra edad de la que hoy se conoce vuelve a la cola
// (depurar.ts › avisosPendientes), así un año recién leído llega a la noche siguiente sin recargar nada.
// Medido el 05-nov-2026 antes de aplicarlo: 264 edificios con año, 614 usados activos en ellos; «convienen» (pie 20 %, 30
// años) pasa de 6.640 a 6.651 (+11, +0,17 %; 409 de 548 edificios tienen menos de 25 años). Lo fija el tier EDAD-NOCHE.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { claveEdificio } from "@/lib/guia/ficha-anio";
import { edadConocida } from "@/lib/guia/edad-edificio";
import type { AvisoParaEvaluar } from "./evaluar-aviso";

/** Lo que se sabe de los años: el de la ficha de cada aviso y el de cada edificio. */
export interface EdadesConocidas {
  /** aviso → año que dijo su ficha (la última lectura con año). */
  propias: Map<string, number>;
  /** edificio (claveEdificio) → su año y el aviso cuya ficha lo dio. */
  edificios: Map<string, { anio: number; avisoId: string | null }>;
}

export const SIN_EDADES: EdadesConocidas = { propias: new Map(), edificios: new Map() };

/** La edad conocida de un aviso (años), o null. La obra nueva no lleva edad de usado. */
export function edadDeAviso(a: Pick<AvisoParaEvaluar, "id" | "comuna" | "lat" | "lng" | "condicion">, e: EdadesConocidas, ahora: Date = new Date()): number | null {
  if (a.condicion === "nuevo") return null;
  return edadConocida({ avisoId: a.id, anioPropio: e.propias.get(a.id) ?? null, edificio: e.edificios.get(claveEdificio(a)) ?? null }, ahora)?.anios ?? null;
}

/** Los evaluables con la edad conocida de cada usado (los demás, igual: null = 25 supuestos). */
export function conEdadConocida<T extends AvisoParaEvaluar>(evaluables: T[], e: EdadesConocidas, ahora: Date = new Date()): T[] {
  return evaluables.map((a) => {
    const anios = edadDeAviso(a, e, ahora);
    return anios == null ? a : { ...a, antiguedadAnios: anios };
  });
}

/**
 * ¿La fila guardada se evaluó con otra edad de la que hoy se conoce? Con año conocido, la fila tiene que decir «ficha» con esos
 * años; sin año, no puede decir «ficha». La obra nueva no entra. Sin la columna leída (`undefined`), no se compara.
 */
export function edadDistinta(a: Pick<AvisoParaEvaluar, "condicion" | "antiguedadAnios">, g: { antiguedad_anios?: number | string | null; antiguedad_origen?: string | null }): boolean {
  if (a.condicion === "nuevo" || g.antiguedad_origen === undefined) return false;
  if (a.antiguedadAnios != null) return g.antiguedad_origen !== "ficha" || Number(g.antiguedad_anios) !== a.antiguedadAnios;
  return g.antiguedad_origen === "ficha";
}

const PAGINA = 1000;

/** Las dos tablas, completas (son chicas: cientos de filas; paginadas igual por el tope de 1.000 de PostgREST). */
export async function leerEdadesConocidas(sb: SupabaseClient): Promise<EdadesConocidas> {
  const propias = new Map<string, number>();
  for (let off = 0; ; off += PAGINA) {
    const { data, error } = await sb.from("fichas_leidas").select("aviso_id, anio").not("anio", "is", null).order("aviso_id").range(off, off + PAGINA - 1);
    if (error) throw new Error(`fichas_leidas: ${error.message}`);
    for (const r of (data ?? []) as Array<{ aviso_id: string; anio: number }>) propias.set(r.aviso_id, Number(r.anio));
    if (!data || data.length < PAGINA) break;
  }
  const edificios = new Map<string, { anio: number; avisoId: string | null }>();
  for (let off = 0; ; off += PAGINA) {
    const { data, error } = await sb.from("anios_edificio").select("edificio, anio, aviso_id").order("edificio").range(off, off + PAGINA - 1);
    if (error) throw new Error(`anios_edificio: ${error.message}`);
    for (const r of (data ?? []) as Array<{ edificio: string; anio: number; aviso_id: string | null }>) edificios.set(r.edificio, { anio: Number(r.anio), avisoId: r.aviso_id ?? null });
    if (!data || data.length < PAGINA) break;
  }
  return { propias, edificios };
}
