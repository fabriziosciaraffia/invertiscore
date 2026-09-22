// Referencia STR contra STR — la resolución VIVA. Todo sale del caché (`airbnb_estimates`) y de
// los avisos de venta (`scraped_properties`): CERO llamadas a AirROI. La regla vive en
// strref-zona.ts; acá solo se consulta.
//
// Direcciones del estimador: filas del caché cuya dirección se resuelve a la comuna (regla de
// strref-zona.ts) o que coinciden con la dirección de un análisis STR persistido de la comuna;
// una por (dirección, dormitorios), la más reciente; el ingreso es adr p50 × occ p50 × 365 de
// esa misma respuesta (nunca los listings realizados). Venta: usado, 90 días, siempre la tipología
// del sujeto (en «comuna» se pooled-ean solo las estimaciones); mediana del precio total y del m².
// SOLO SERVIDOR: `airbnb_estimates` tiene RLS sin políticas (nadie la lee salvo el service role;
// get-estimate.ts hace lo mismo), así que las direcciones del estimador y las de los análisis STR
// de otros usuarios se leen con el cliente admin. Con el cliente de sesión la lectura devolvía
// CERO filas sin error y el snapshot nacía «sin referencia» (cazado el 21-sep al crear un STR
// real). La venta (`scraped_properties`, lectura pública) sigue por el cliente que llega.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PAGINA_POSTGREST, normalizeComuna, median } from "@/lib/comuna-stats";
import { reportarFalloQuery } from "@/lib/observabilidad";
import {
  CASCADA_STRREF,
  comunaDeDireccionAirroi,
  dormitoriosVentaProxy,
  evaluarPeldanoStrRef,
  strRefSinReferencia,
  type CeldaStrRef,
  type DireccionEstimada,
  type StrRefZonaSnapshot,
  type VentaTipologia,
} from "@/lib/strref-zona";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function clienteAdminCache(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  return createClient(url, key);
}

async function direccionesDeComuna(comuna: string): Promise<DireccionEstimada[]> {
  const supabase = clienteAdminCache();
  if (!supabase) {
    reportarFalloQuery({ message: "sin SUPABASE_SERVICE_ROLE_KEY: no se puede leer el caché de AirROI" }, { ruta: "lib/strref-zona-query", operacion: "cliente-admin", tags: { tabla: "airbnb_estimates" }, extra: { comuna } });
    return [];
  }
  // Direcciones de análisis STR persistidos en la comuna (la fila sí trae comuna): cubren las
  // direcciones cortas que no nombran la comuna.
  const conocidas = new Set<string>();
  for (let off = 0; ; off += PAGINA_POSTGREST) {
    const { data, error } = await supabase
      .from("analisis").select("input_data->direccion").eq("tipo_analisis", "short-term")
      .in("comuna", comuna === "Santiago" ? ["Santiago", "Santiago Centro"] : [comuna])
      .order("id").range(off, off + PAGINA_POSTGREST - 1);
    reportarFalloQuery(error, { ruta: "lib/strref-zona-query", operacion: "direcciones-analisis", tags: { tabla: "analisis" }, extra: { comuna, offset: off } });
    if (!Array.isArray(data) || data.length === 0) break;
    for (const r of data) { const d = (r as { direccion?: unknown }).direccion; if (typeof d === "string") conocidas.add(norm(d)); }
    if (data.length < PAGINA_POSTGREST) break;
  }
  // Candidatas del caché: la dirección nombra la comuna (o el alias), o es una conocida.
  type Fila = { address: string; bedrooms: number; created_at: string; percentiles: { occupancy?: { p50?: number }; average_daily_rate?: { p50?: number } } | null };
  const filas: Fila[] = [];
  const patrones = comuna === "Santiago" ? ["%Santiago%"] : [`%${comuna}%`];
  for (const patron of patrones) {
    for (let off = 0; ; off += PAGINA_POSTGREST) {
      const { data, error } = await supabase
        .from("airbnb_estimates").select("address, bedrooms, created_at, percentiles:raw_response->percentiles")
        .ilike("address", patron).order("id").range(off, off + PAGINA_POSTGREST - 1);
      reportarFalloQuery(error, { ruta: "lib/strref-zona-query", operacion: "estimaciones-comuna", tags: { tabla: "airbnb_estimates" }, extra: { comuna, offset: off } });
      if (!Array.isArray(data) || data.length === 0) break;
      filas.push(...(data as Fila[]));
      if (data.length < PAGINA_POSTGREST) break;
    }
  }
  if (conocidas.size > 0) {
    const lista = Array.from(conocidas);
    for (let i = 0; i < lista.length; i += 200) {
      const { data, error } = await supabase
        .from("airbnb_estimates").select("address, bedrooms, created_at, percentiles:raw_response->percentiles")
        .in("address", lista.slice(i, i + 200));
      reportarFalloQuery(error, { ruta: "lib/strref-zona-query", operacion: "estimaciones-direcciones", tags: { tabla: "airbnb_estimates" }, extra: { comuna, lote: i } });
      if (Array.isArray(data)) filas.push(...(data as Fila[]));
    }
  }
  // Una por (dirección, dormitorios), la más reciente; solo las que resuelven a ESTA comuna.
  const ultima = new Map<string, Fila>();
  for (const f of filas) {
    const c = conocidas.has(norm(f.address)) ? comuna : comunaDeDireccionAirroi(f.address);
    if (c !== comuna) continue;
    const k = `${norm(f.address)}#${f.bedrooms}`;
    const prev = ultima.get(k);
    if (!prev || f.created_at > prev.created_at) ultima.set(k, f);
  }
  const out: DireccionEstimada[] = [];
  for (const f of Array.from(ultima.values())) {
    const adr = f.percentiles?.average_daily_rate?.p50, occ = f.percentiles?.occupancy?.p50;
    if (typeof adr !== "number" || typeof occ !== "number" || !(adr > 0) || !(occ > 0) || occ > 1) continue;
    out.push({ comuna, dormitorios: Math.min(Math.max(Number(f.bedrooms) || 0, 0), 3), ingresoAnual: adr * occ * 365 });
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ventaDe(supabase: any, comuna: string, dormitorios: number | null, ufValue: number): Promise<VentaTipologia | null> {
  const desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const precios: number[] = [], m2s: number[] = [];
  for (let off = 0; ; off += PAGINA_POSTGREST) {
    let q = supabase
      .from("scraped_properties").select("precio, moneda, superficie_m2")
      .eq("comuna", comuna).eq("type", "venta").eq("is_active", true).gte("scraped_at", desde)
      .gt("precio", 0).gt("superficie_m2", 0).or("condicion.is.null,condicion.eq.usado")
      .order("id", { ascending: true }).range(off, off + PAGINA_POSTGREST - 1);
    if (dormitorios !== null) q = q.eq("dormitorios", dormitorios);
    const { data, error } = await q;
    reportarFalloQuery(error, { ruta: "lib/strref-zona-query", operacion: "venta-tipologia", tags: { tabla: "scraped_properties" }, extra: { comuna, dormitorios, offset: off } });
    if (!Array.isArray(data) || data.length === 0) break;
    for (const r of data as Array<{ precio: unknown; moneda: unknown; superficie_m2: unknown }>) {
      const p = Number(r.precio), s = Number(r.superficie_m2);
      if (!(p > 0) || !(s > 0)) continue;
      precios.push(r.moneda === "UF" ? p * ufValue : p); m2s.push(s);
    }
    if (data.length < PAGINA_POSTGREST) break;
  }
  if (precios.length === 0) return { n: 0, precioP50: 0, m2P50: 0 };
  return { n: precios.length, precioP50: median(precios), m2P50: median(m2s) };
}

/**
 * Resuelve la referencia STR de la zona para un sujeto, peldaño a peldaño; siempre devuelve un
 * snapshot con su `nivel`. Nunca lanza: un fallo de consulta cuenta como muestra vacía.
 */
export async function resolverStrRefZonaVivo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  input: { comuna: string; dormitorios?: number | null },
  ufValue: number,
): Promise<StrRefZonaSnapshot> {
  const comuna = normalizeComuna(input.comuna);
  const d = typeof input.dormitorios === "number" && Number.isFinite(input.dormitorios) ? Math.min(Math.max(input.dormitorios, 0), 3) : 1;
  const celda: CeldaStrRef = { comuna, dormitorios: d };
  const resolvedAt = new Date().toISOString();
  let direcciones: DireccionEstimada[] = [];
  try { direcciones = await direccionesDeComuna(comuna); } catch (e) { console.error("[resolverStrRefZonaVivo] direcciones:", e); }
  // La venta es SIEMPRE la de la tipología del sujeto (una sola consulta, los dos peldaños); en
  // «comuna» lo único que se pooled-ea son las estimaciones.
  let venta: VentaTipologia | null = null;
  try { venta = await ventaDe(supabase, comuna, dormitoriosVentaProxy(d), ufValue); } catch (e) { console.error("[resolverStrRefZonaVivo] venta:", e); }
  let nD = 0;
  const nV = venta?.n ?? 0;
  for (const nivel of CASCADA_STRREF) {
    const dirs = nivel === "celda" ? direcciones.filter((x) => x.dormitorios === d) : direcciones;
    nD = Math.max(nD, dirs.length);
    const r = evaluarPeldanoStrRef(nivel, dirs, venta, celda, resolvedAt);
    if (r) return r;
  }
  return strRefSinReferencia(celda, resolvedAt, { nDirecciones: nD, nVenta: nV });
}
