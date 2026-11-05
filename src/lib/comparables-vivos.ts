// ─────────────────────────────────────────────────────────────────────────────
// LA CIFRA DE COMPARABLES, EN VIVO (05-nov-2026, auditoría de promesas parte 3): «+40.000» salía de una constante medida a
// mano el 25-sep-2026 (stats.ts › COMPARABLES_MEDIDOS = 41.976) y el 05-nov la base tenía 39.950. Ahora se cuenta en la base
// —los avisos activos con precio y superficie, de venta y de arriendo, la misma población de las medianas— y se guarda una
// hora (unstable_cache). Si la consulta falla, la constante. La leen la landing, sus metadatos, el FAQ, la metodología, el
// dashboard vacío y los metadatos del sitio. Lo fija el tier CIFRA-COMPARABLES.
// ─────────────────────────────────────────────────────────────────────────────
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { COMPARABLES_MEDIDOS, cifraComparables, pisoComparables, textoComparables } from "@/lib/stats";
import { reportarFalloQuery } from "@/lib/observabilidad";

/** Cada cuánto se vuelve a contar (segundos). */
export const REVALIDAR_COMPARABLES_S = 3600;

/** El conteo de la base: activos, con precio y superficie (stats.ts). */
export async function contarComparables(): Promise<number | null> {
  const { count, error } = await createServiceClient().from("scraped_properties").select("id", { count: "exact", head: true })
    .eq("is_active", true).gt("precio", 0).gt("superficie_m2", 0);
  reportarFalloQuery(error, { ruta: "lib/comparables-vivos", operacion: "contar" });
  return error || count == null ? null : count;
}

const contadoUnaHora = unstable_cache(async () => (await contarComparables()) ?? COMPARABLES_MEDIDOS, ["comparables-vivos"], { revalidate: REVALIDAR_COMPARABLES_S });

export interface ComparablesVivos {
  n: number;
  piso: number;
  /** «+39.000» */
  cifra: string;
  /** «más de 39.000» */
  texto: string;
}

export async function comparablesVivos(): Promise<ComparablesVivos> {
  let n = COMPARABLES_MEDIDOS;
  try { n = await contadoUnaHora(); } catch { /* respaldo */ }
  return { n, piso: pisoComparables(n), cifra: cifraComparables(n), texto: textoComparables(n) };
}
