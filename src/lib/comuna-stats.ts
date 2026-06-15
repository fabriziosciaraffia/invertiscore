// ─── Comuna market stats from scraped_properties ──────────────────────────
// Lógica de mediana de precio/m² de VENTA en UF, compartida entre el drawer
// zone-insight y la generación de análisis IA. Misma fuente (scraped_properties),
// misma query, mismo umbral (>= 15 ventas válidas).

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Factor de correccion publicado->cierre para precios de VENTA de scraped_properties.
// Los precios son PUBLICADOS (TocToc), inflados ~5-10% sobre el cierre real en USADOS.
// Centro del rango chileno ~7% (factor 0.93); comunas premium de alta rotacion ~5% (0.95).
// TEMPORAL: reemplazar por datos de cierre reales (CBR/SII F2890) cuando esten disponibles.
// Los NUEVOS no llevan correccion (precio de proyecto es firme).
export const FACTOR_CIERRE_DEFAULT = 0.93;
export const FACTOR_CIERRE_POR_COMUNA: Record<string, number> = {
  "Las Condes": 0.95,
  "Providencia": 0.95,
  "Vitacura": 0.95,
  "Lo Barnechea": 0.95,
};
export function getFactorCierre(comuna: string): number {
  return FACTOR_CIERRE_POR_COMUNA[comuna] ?? FACTOR_CIERRE_DEFAULT;
}

// Alias de comuna (form/UI) -> forma canónica almacenada en scraped_properties.
// El form usa "Santiago Centro" pero la tabla guarda "Santiago"; un mismatch en
// .eq("comuna", ...) devuelve 0 filas. Extensible: agregar alias acá si aparecen.
const COMUNA_ALIASES: Record<string, string> = {
  "Santiago Centro": "Santiago",
};
export function normalizeComuna(comuna: string): string {
  return COMUNA_ALIASES[comuna] ?? comuna;
}

/**
 * Mediana de precio/m² de VENTA (en UF) para la comuna, calculada desde
 * scraped_properties. Ventana ±20% de superficie; filtro de dormitorios solo
 * si se entrega un valor. Requiere >= 15 ventas válidas (precio>0 y
 * superficie_m2>0). Devuelve { mediana, n } donde n es el número de ventas
 * válidas usadas; mediana es null (y n el conteo parcial) si no alcanza el umbral.
 */
export async function getComunaMedianaVentaUF(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  comuna: string,
  superficie: number,
  dormitorios: number | null,
  ufValue: number
): Promise<{ mediana: number | null; n: number }> {
  const comunaNorm = normalizeComuna(comuna);
  const supMinV = superficie * 0.8;
  const supMaxV = superficie * 1.2;

  // Ventana de frescura: descartar avisos no refrescados hace >N dias (el scraper solo
  // hace upsert, is_active queda true para siempre y sesga la mediana con precios añejos).
  async function fetchVentas(dias: number) {
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    let q = supabase
      .from("scraped_properties")
      .select("precio, moneda, superficie_m2, dormitorios, condicion")
      .eq("comuna", comunaNorm)
      .eq("type", "venta")
      .eq("is_active", true)
      .gte("scraped_at", desde)
      .gte("superficie_m2", supMinV)
      .lte("superficie_m2", supMaxV)
      .limit(2000);
    if (dormitorios !== null) q = q.eq("dormitorios", dormitorios);
    const { data } = await q;
    return Array.isArray(data) ? data : [];
  }

  let ventas = await fetchVentas(90);
  if (ventas.length < 15) ventas = await fetchVentas(180); // ventana adaptativa
  if (ventas.length < 15) return { mediana: null, n: ventas.length };

  const m2sUF: number[] = [];
  for (const r of ventas) {
    const sup = Number(r.superficie_m2);
    const precio = Number(r.precio);
    if (!sup || sup <= 0 || !precio || precio <= 0 || Number.isNaN(sup) || Number.isNaN(precio)) continue;
    // Correccion publicado->cierre: usados llevan factor (<1); nuevos 1.
    const factor = r.condicion === "usado" ? getFactorCierre(comunaNorm) : 1;
    const precioUF = (r.moneda === "UF" ? precio : precio / (ufValue || 1)) * factor;
    m2sUF.push(precioUF / sup);
  }
  if (m2sUF.length < 15) return { mediana: null, n: m2sUF.length };
  return { mediana: Math.round(median(m2sUF) * 100) / 100, n: m2sUF.length };
}
