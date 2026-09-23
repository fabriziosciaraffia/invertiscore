// ============================================================================
// LA DEMANDA DE LA ZONA PARA LAS FILAS QUE NO LA GUARDARON (23-sep-2026) · solo servidor
// ============================================================================
// La factibilidad del score STR lee `results.ocupacionRealizadaComparables` (la ocupación
// realizada de los comparables de AirROI). Las filas creadas antes de que ese campo se guardara
// no lo traen —42 de 257 al 23-sep-2026—, pero sus comparables SÍ están en el caché
// `airbnb_estimates`. Decisión de Fabrizio: el recálculo los lee de ahí; NADA se escribe en la
// base. Este helper es el único lugar que lo hace, y TODA entrada que recalcula un STR pasa por
// él antes de `veredictoStrRecomputado` / `recomputeShortTermForLegacy`: si una entrada se lo
// saltara, esa fila tendría otro veredicto ahí (el tier `factibilidad-demanda` lo verifica).
//
// Lee con el cliente de SERVICIO: `airbnb_estimates` tiene RLS activo y cero políticas, así que
// el cliente del usuario devuelve cero filas SIN error (medido en `pg_policies`).
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { makeCacheKey } from "./get-estimate";
import { summarizeRealizedOccupancy } from "./process-comparables";
import type { RealizedOccupancy } from "./types";

type ConOcupacion = { airbnbRaw?: unknown; ocupacionRealizadaComparables?: RealizedOccupancy | null };

/** Escapa los comodines de `ilike` para buscar la dirección tal cual. */
const literal = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Devuelve los `results` persistidos con `ocupacionRealizadaComparables` completo: el guardado
 * si la fila lo trae; si no, el que sale de los comparables de su respuesta en el caché de
 * AirROI (por la clave del caché y, si no calza, por dirección y dormitorios). Si no hay nada,
 * los devuelve tal cual y la factibilidad cae a los atractores. Nunca escribe.
 */
export async function conOcupacionRealizadaDelCache<T extends ConOcupacion | null | undefined>(
  inputData: Record<string, unknown> | null | undefined,
  persistedResults: T,
): Promise<T> {
  if (!persistedResults || (persistedResults.ocupacionRealizadaComparables?.n ?? 0) > 0) return persistedResults;
  const raw = persistedResults.airbnbRaw as { address?: unknown; bedrooms?: unknown; baths?: unknown; guests?: unknown } | undefined;
  const address = typeof raw?.address === "string" ? raw.address : "";
  if (!address || typeof raw?.bedrooms !== "number") return persistedResults;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return persistedResults;
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
    const comuna = typeof inputData?.comuna === "string" ? inputData.comuna : "";
    const cacheKey = makeCacheKey(address, comuna, raw.bedrooms, Number(raw.baths) || 0, Number(raw.guests) || 0);
    let { data } = await sb.from("airbnb_estimates").select("raw_response").eq("cache_key", cacheKey).limit(1);
    if (!data?.length) {
      ({ data } = await sb.from("airbnb_estimates").select("raw_response").ilike("address", literal(address.trim())).eq("bedrooms", raw.bedrooms).order("created_at", { ascending: false }).limit(1));
    }
    const listings = (data?.[0] as { raw_response?: { comparable_listings?: unknown } } | undefined)?.raw_response?.comparable_listings;
    const resumen = summarizeRealizedOccupancy(listings);
    return resumen ? ({ ...persistedResults, ocupacionRealizadaComparables: resumen } as T) : persistedResults;
  } catch (e) {
    console.error("[conOcupacionRealizadaDelCache] no se pudo leer el caché de AirROI (la factibilidad cae a los atractores):", e);
    return persistedResults;
  }
}
