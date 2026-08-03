// ─── Unidades de obra nueva vía GraphQL ──────────────────────────────────────
//
// La fila que el GetProps entrega para un proyecto de obra nueva es del PROYECTO:
// precio "desde", superficie y dormitorios mínimos del rango. Detrás de la ficha
// hay un GraphQL público que expone el detalle real: cada unidad en venta con su
// precio y superficie exactos. Este módulo lo consulta y expande las unidades a
// filas de `scraped_properties`, para que getComunaMedianaVentaUF las vea sin
// tocar el motor.
//
// Sondeado en vivo (231/231 proyectos, 0 errores): el endpoint no exige JWT
// (a diferencia del GetProps) pero SÍ headers de navegador — sin User-Agent y
// Origin devuelve 403. Latencia 7-9s por query del lado del server, tolera
// paralelo sin rate-limit (concurrencia 8 → ~1,3s efectivo por ficha).

import type { ScrapedProperty } from "./toctoc";

const GRAPHQL_ENDPOINT = "https://www.toctoc.com/new/nuevo/public/query";

const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "es-CL,es;q=0.9",
  Origin: "https://www.toctoc.com",
  Referer: "https://www.toctoc.com/propiedades/compranuevo/",
};

// Query extraída del bundle de la ficha (app.js). `id_usuario: 0` = anónimo.
// `plantas[].propiedades[]` son las unidades individuales; `fechaEntrega` se
// reporta (no se persiste: scraped_properties no tiene columna — ver el route).
const queryPropiedad = (idProyecto: number) => `query propiedad {
  propiedad(id_propiedad: ${idProyecto}, id_usuario: 0) {
    idPropiedad
    fechaEntrega
    plantas {
      nombre dormitorios banos precioDesde superficieUtil
      propiedades {
        nombre numeroPropiedad numeroPiso dormitorios banos
        precio metrosUtiles metrosTotales estaPublicado
      }
    }
  }
}`;

/** Proyecto a consultar: la fila-proyecto ya persistida aporta la identidad
 *  (id de la URL compranuevo) y los datos que el GraphQL no trae confiable
 *  (comuna, coordenadas). */
export interface ProyectoBase {
  idProyecto: number;
  url: string;
  comuna: string;
  lat: number | null;
  lng: number | null;
  direccion: string | null;
}

export interface UnidadesProyecto {
  idProyecto: number;
  url: string;
  fechaEntrega: string | null;
  unidades: ScrapedProperty[];
  /** Unidades que la fuente trae pero no pasan el filtro (no publicadas, sin
   *  precio, superficie fuera de rango). Reportadas, no escritas. */
  descartadas: number;
  error?: string;
}

type UnidadRaw = {
  nombre?: string | null;
  numeroPropiedad?: string | null;
  numeroPiso?: number | null;
  dormitorios?: number | null;
  banos?: number | null;
  precio?: number | null;
  metrosUtiles?: number | null;
  metrosTotales?: number | null;
  estaPublicado?: boolean | null;
};

/**
 * Consulta las unidades de UN proyecto. Nunca lanza: los errores vuelven en el
 * campo `error` para que el route los cuente sin abortar el lote.
 */
export async function fetchUnidadesProyecto(base: ProyectoBase): Promise<UnidadesProyecto> {
  const vacio = (error: string): UnidadesProyecto =>
    ({ idProyecto: base.idProyecto, url: base.url, fechaEntrega: null, unidades: [], descartadas: 0, error });
  try {
    const r = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ query: queryPropiedad(base.idProyecto) }),
    });
    if (!r.ok) return vacio(`http ${r.status}`);
    const d = await r.json() as {
      data?: { propiedad?: { fechaEntrega?: string | null; plantas?: Array<{ propiedades?: UnidadRaw[] | null }> | null } | null };
      errors?: unknown[];
    };
    if (d.errors?.length) return vacio(`graphql: ${JSON.stringify(d.errors).slice(0, 120)}`);
    const p = d.data?.propiedad;
    if (!p) return vacio("propiedad null");

    const unidades: ScrapedProperty[] = [];
    let descartadas = 0;
    const vistos = new Set<string>();
    for (const planta of p.plantas ?? []) {
      for (const u of planta.propiedades ?? []) {
        const precio = Number(u.precio);
        // Útil primero; total como fallback (mismo criterio que el resto del scraper).
        const sup = Number(u.metrosUtiles) > 0 ? Number(u.metrosUtiles) : Number(u.metrosTotales);
        // Solo publicadas y con tripleta sana. 15-500 m² = mismo rango de cordura
        // del parser del mapa.
        if (u.estaPublicado !== true || !(precio > 0) || !(sup > 15 && sup < 500)) {
          descartadas++;
          continue;
        }
        // sourceId estable por unidad: url#numeroUnidad. Si la fuente repite el
        // identificador dentro del proyecto, se sufija para no perder unidades
        // en silencio en el dedup del upsert.
        let etiqueta = String(u.numeroPropiedad ?? u.nombre ?? `u${unidades.length}`).trim() || `u${unidades.length}`;
        while (vistos.has(etiqueta)) etiqueta = `${etiqueta}~`;
        vistos.add(etiqueta);
        unidades.push({
          source: "toctoc",
          sourceId: `${base.url}#${etiqueta}`,
          type: "venta",
          comuna: base.comuna,
          direccion: base.direccion ?? undefined,
          lat: base.lat ?? undefined,
          lng: base.lng ?? undefined,
          // El GraphQL entrega UF (verificado); el umbral 50.000 cubre el caso de
          // que algún proyecto venga en CLP — misma heurística del parser del mapa.
          precio,
          moneda: precio > 50000 ? "CLP" : "UF",
          superficieM2: sup,
          dormitorios: Number(u.dormitorios) >= 0 ? Number(u.dormitorios) : undefined,
          banos: Number(u.banos) > 0 ? Number(u.banos) : undefined,
          piso: Number(u.numeroPiso) > 0 ? Number(u.numeroPiso) : undefined,
          url: base.url,
          condicion: "nuevo",
        });
      }
    }
    return { idProyecto: base.idProyecto, url: base.url, fechaEntrega: p.fechaEntrega ?? null, unidades, descartadas };
  } catch (e) {
    return vacio(String(e).slice(0, 120));
  }
}

/** Id numérico de proyecto desde una URL compranuevo (el número final del path).
 *  Sirve igual para la fila-proyecto (url o url__max) y para una unidad. */
export function idProyectoDeUrl(url: string | null | undefined): number | null {
  const m = String(url ?? "").match(/compranuevo\/departamento\/[^/]+\/[^/]+\/(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * CONVIVENCIA fila-proyecto vs unidades: cuando un proyecto tiene unidades
 * FRESCAS, TODAS sus filas-proyecto se desactivan. Si conviven activas, la
 * mediana cuenta el proyecto dos veces (la fila-proyecto ES la unidad de
 * entrada, que además está entre las unidades) y la tipología más barata queda
 * sobre-representada — sesgo a la baja sistemático.
 *
 * POR ID DE PROYECTO, NO POR URL. Medido en la base: 463 de 515 proyectos
 * tienen MÁS DE UNA fila-proyecto con variantes de URL (misma ficha, distinto
 * source_id — p.ej. `.../{id}` y `.../{id}__max`). Una primera versión de este
 * invariante que casaba por URL exacta desactivó 47 de 85 bases y dejó el doble
 * conteo vivo en 80 proyectos. El emparejamiento correcto es por el número final
 * de la URL, que identifica el proyecto a través de todas sus variantes.
 *
 * GLOBAL E IDEMPOTENTE, sin candidatos: relee el estado completo del universo
 * nuevo (997 bases + unidades, 2-3 páginas de una columna) y re-aplica el
 * invariante entero. Así las DOS rutas que lo llaman no necesitan acordar qué
 * tocó cada una:
 *   · scrape-nuevos (diario) RESUCITA bases con su upsert (is_active: true) y
 *     las re-desactiva acá mismo.
 *   · scrape-unidades-nuevas (rotación semanal) lo llama tras insertar unidades.
 *
 * "Fresca" = scraped_at dentro de 365 días — la ventana MÁS ANCHA que usa la
 * mediana del universo nuevo (VENTANAS_DIAS). Ese corte hace el sistema
 * auto-sanador: si el pase de unidades muriera y sus filas envejecieran más allá
 * de toda ventana, la fila-proyecto resucita al día siguiente y el proyecto
 * vuelve a estar representado (grueso, pero presente).
 */
export async function desactivarProyectosConUnidades(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<{ desactivadas: number; errores: string[] }> {
  const errores: string[] = [];
  const desde = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  // Paginado explícito: PostgREST capa las respuestas, y este conjunto crece
  // con cada batch de unidades.
  async function paginar(filtro: (q: unknown) => unknown): Promise<Array<Record<string, unknown>>> {
    const out: Array<Record<string, unknown>> = [];
    for (let off = 0; ; off += 1000) {
      const q = filtro(
        supabase.from("scraped_properties").select("source_id,url,is_active").eq("condicion", "nuevo"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as any;
      const { data, error } = await q.range(off, off + 999);
      if (error) { errores.push(`select: ${error.message}`); break; }
      out.push(...((data ?? []) as Array<Record<string, unknown>>));
      if (!data || data.length < 1000) break;
    }
    return out;
  }

  // 1. Proyectos con unidades frescas (las unidades llevan '#' en el source_id).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unidades = await paginar((q) => (q as any).like("source_id", "%#%").gte("scraped_at", desde));
  const idsConUnidades = new Set<number>();
  for (const u of unidades) {
    const id = idProyectoDeUrl(String(u.url ?? u.source_id));
    if (id != null) idsConUnidades.add(id);
  }
  if (idsConUnidades.size === 0) return { desactivadas: 0, errores };

  // 2. Filas-proyecto ACTIVAS de esos proyectos — todas las variantes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bases = await paginar((q) => (q as any).not("source_id", "like", "%#%").eq("is_active", true));
  const objetivo: string[] = [];
  for (const b of bases) {
    const id = idProyectoDeUrl(String(b.url ?? b.source_id));
    if (id != null && idsConUnidades.has(id)) objetivo.push(String(b.source_id));
  }

  // 3. Desactivar por source_id exacto, en lotes.
  let desactivadas = 0;
  for (let i = 0; i < objetivo.length; i += 100) {
    const chunk = objetivo.slice(i, i + 100);
    const { data, error } = await supabase
      .from("scraped_properties")
      .update({ is_active: false })
      .eq("condicion", "nuevo")
      .in("source_id", chunk)
      .select("id");
    if (error) { errores.push(`update bases: ${error.message}`); continue; }
    desactivadas += ((data ?? []) as unknown[]).length;
  }
  return { desactivadas, errores };
}
