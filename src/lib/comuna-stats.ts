// ─── Comuna market stats from scraped_properties ──────────────────────────
// Lógica de mediana de precio/m² de VENTA en UF, compartida entre el drawer
// zone-insight y la generación de análisis IA. Misma fuente (scraped_properties),
// misma query, mismo umbral (>= 20 ventas válidas).

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Mediana de precio/m² de VENTA (en UF) para la comuna, calculada desde
 * scraped_properties. Ventana ±20% de superficie; filtro de dormitorios solo
 * si se entrega un valor. Requiere >= 20 ventas válidas (precio>0 y
 * superficie_m2>0); de lo contrario devuelve null.
 */
export async function getComunaMedianaVentaUF(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  comuna: string,
  superficie: number,
  dormitorios: number | null,
  ufValue: number
): Promise<number | null> {
  const supMinV = superficie * 0.8;
  const supMaxV = superficie * 1.2;

  let ventaQ = supabase
    .from("scraped_properties")
    .select("precio, moneda, superficie_m2, dormitorios")
    .eq("comuna", comuna)
    .eq("type", "venta")
    .eq("is_active", true)
    .gte("superficie_m2", supMinV)
    .lte("superficie_m2", supMaxV)
    .limit(2000);
  if (dormitorios !== null) ventaQ = ventaQ.eq("dormitorios", dormitorios);
  const { data: ventas } = await ventaQ;

  if (!Array.isArray(ventas) || ventas.length < 20) return null;

  const m2sUF: number[] = [];
  for (const r of ventas) {
    const sup = Number(r.superficie_m2);
    const precio = Number(r.precio);
    if (!sup || sup <= 0 || !precio || precio <= 0 || Number.isNaN(sup) || Number.isNaN(precio)) continue;
    const precioUF = r.moneda === "UF" ? precio : precio / (ufValue || 1);
    m2sUF.push(precioUF / sup);
  }
  if (m2sUF.length < 20) return null;
  return Math.round(median(m2sUF) * 100) / 100;
}
