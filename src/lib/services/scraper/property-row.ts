// Mapeo ScrapedProperty -> fila de `scraped_properties`. Compartido por el pase
// general (/api/data/scrape-properties) y el de obra nueva
// (/api/data/scrape-nuevos), para que las dos rutas escriban EXACTAMENTE el mismo
// shape. Vivía inline en el route general; se extrajo al abrir la segunda ruta.

import type { ScrapedProperty } from "./toctoc";

export function propertyToRow(prop: ScrapedProperty) {
  return {
    source: prop.source,
    source_id: prop.sourceId,
    type: prop.type,
    comuna: prop.comuna,
    direccion: prop.direccion || null,
    lat: prop.lat || null,
    lng: prop.lng || null,
    precio: prop.precio,
    moneda: prop.moneda,
    superficie_m2: prop.superficieM2 || null,
    dormitorios: prop.dormitorios || null,
    banos: prop.banos || null,
    gastos_comunes: prop.gastosComunes || null,
    estacionamientos: prop.estacionamientos || null,
    bodegas: prop.bodegas || null,
    piso: prop.piso || null,
    // NOTA: la fuente NO expone antigüedad. El campo queda mapeado (0 de 47.338
    // filas lo tienen) porque el parser nunca lo puebla: ni el GetProps del mapa
    // ni el listado gw-lista-seo traen el dato. Lo que parecía antigüedad en el
    // array del mapa —posición [14]— es la fecha de PUBLICACIÓN del aviso:
    // filtrando por avisos de <=7 días, el 100% de esos valores cae en el año en
    // curso. Poblarlo exigiría abrir la ficha de cada aviso (1 request por
    // propiedad × ~26k) — decisión aparte, no un efecto colateral del scraper.
    antiguedad: prop.antiguedad || null,
    url: prop.url || null,
    condicion: prop.condicion || "usado",
    is_active: true,
    scraped_at: new Date().toISOString(),
    geocode_attempted: false,
  };
}

// ─── Upsert que NO pisa lat/lng (ni direccion) con null ──────────────────────
//
// Regla dura del goal backfill: un upsert nunca reemplaza una coordenada
// existente con NULL. PostgREST no expresa COALESCE en el ON CONFLICT, pero su
// `resolution=merge-duplicates` solo actualiza las columnas PRESENTES en el
// payload — así que la forma de "excluir la columna del UPDATE" es no mandarla.
// Como un bulk upsert exige que todas las filas tengan las mismas claves, las
// filas se agrupan por forma (conjunto de claves) y cada grupo va en su propio
// upsert. Medido en la tabla antes de esta regla: 4.618 filas con `location`
// vivo pero lat/lng NULL, pisadas por la vía del listado cuando aún no leía
// coordenadas.

export type FilaScraped = ReturnType<typeof propertyToRow>;

/** Quita lat/lng/direccion cuando vienen null, para que el upsert no los toque. */
export function filaSinPisarCoords(row: FilaScraped): Partial<FilaScraped> {
  const out: Partial<FilaScraped> = { ...row };
  if (out.lat == null || out.lng == null) {
    delete out.lat;
    delete out.lng;
  }
  if (out.direccion == null) delete out.direccion;
  return out;
}

/** Tamaño de lote por upsert (mismo criterio que scrape-unidades-nuevas). */
export const LOTE_UPSERT = 500;

/**
 * Upsert por lotes, agrupando por forma de fila. Devuelve cuántas filas entraron
 * y los errores (uno por lote fallido); nunca lanza.
 */
export async function upsertSinPisarCoords(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: Partial<FilaScraped>[],
): Promise<{ escritas: number; errores: string[] }> {
  const porForma = new Map<string, Partial<FilaScraped>[]>();
  for (const r of rows) {
    const forma = Object.keys(r).sort().join(",");
    const lista = porForma.get(forma) ?? [];
    lista.push(r);
    porForma.set(forma, lista);
  }
  let escritas = 0;
  const errores: string[] = [];
  for (const grupo of Array.from(porForma.values())) {
    for (let i = 0; i < grupo.length; i += LOTE_UPSERT) {
      const chunk = grupo.slice(i, i + LOTE_UPSERT);
      const { error } = await supabase
        .from("scraped_properties")
        .upsert(chunk, { onConflict: "source,source_id" });
      if (error) errores.push(`upsert (${chunk.length} filas): ${error.message}`);
      else escritas += chunk.length;
    }
  }
  return { escritas, errores };
}
