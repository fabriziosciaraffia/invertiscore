// ─── Comuna market stats from scraped_properties ──────────────────────────
// Lógica de mediana de precio/m² de VENTA en UF, compartida entre el drawer
// zone-insight y la generación de análisis IA. Misma fuente (scraped_properties),
// misma query, mismo umbral (>= 15 ventas válidas).
//
// SEGMENTACIÓN POR UNIVERSO (fix nuevos-vs-usados). Hasta este fix la query NO
// filtraba `condicion`: un depto NUEVO se comparaba contra el mercado de USADOS
// de la comuna. En Santiago eso daba mediana UF 48,96 (192 usados) para un sujeto
// a UF 77,1/m² → "+57% sobre la comuna" → BUSCAR OTRA con el hallazgo en 01.
// Contra los 34 nuevos comparables (mediana UF 91,2) el mismo depto está −15%.
// El sesgo era sistemático y proporcional a la penetración de obra nueva:
// Quinta Normal +107%, Santiago +89%, Recoleta +66%, Macul +48%, Las Condes +24%.
// Ahora la mediana se calcula SIEMPRE dentro del universo del sujeto, y si ese
// universo no junta muestra, se declara no confiable — nunca se cae al otro.

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
import { reportarFalloQuery } from "@/lib/observabilidad";

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

// ─── Universo de comparación (nuevo | usado) ──────────────────────────────

/** Universo de mercado contra el que se compara el sujeto. Espejo de la columna
 *  `condicion` de scraped_properties (proxy derivado de la URL de TocToc:
 *  `.../compranuevo/...` → "nuevo", cualquier otra → "usado"). */
export type CondicionMercado = "nuevo" | "usado";

/**
 * Corte de universo del SUJETO. Dos señales, en este orden:
 *
 *  1. `esNuevo` — respuesta explícita del wizard v4 (`tipoPropiedad === "nuevo"`).
 *     Cuando está, manda.
 *  2. `antiguedad <= 1` — fallback para payloads sin `esNuevo` (v3, análisis
 *     históricos, fixtures del golden). El corte en 1 año NO es arbitrario: es
 *     exactamente el bucket más fino que ofrece el wizard ("0-2 años" →
 *     `antiguedadToNumber` = 1); cualquier otra respuesta cae en 4+.
 *
 * OJO — esto NO contradice la regla del subsidio (analysis.ts:483: "NUNCA derivar
 * de antiguedad===0"). Aquélla es una pregunta LEGAL (Ley 21.748 exige primera
 * venta, y un usado recién estrenado daría falso positivo legal). Ésta es una
 * pregunta de MERCADO: ¿en qué universo de precios transa este depto? Un usado de
 * 1 año transa contra obra nueva, no contra parque de 30 años. Distinta pregunta,
 * distinto corte.
 */
export function resolverCondicionMercado(
  input: { esNuevo?: boolean | null; antiguedad?: number | null } | null | undefined,
): CondicionMercado {
  if (input?.esNuevo === true) return "nuevo";
  // OJO con el null: `Number(null)` es 0, así que un `antiguedad: null` (columna
  // nullable, input_data incompleto) pasaba el corte <=1 y se leía como NUEVO.
  // Ausencia de dato NO es "recién construido" — cae al default.
  const raw = input?.antiguedad;
  if (raw == null) return "usado";
  const antiguedad = Number(raw);
  if (Number.isFinite(antiguedad) && antiguedad <= 1) return "nuevo";
  return "usado";
}

/**
 * Escalera de frescura POR UNIVERSO. Antes era una sola escalera (90d, y 180d
 * solo si la muestra TOTAL traía <15 filas) — y como el stock usado es abundante
 * en las comunas más analizadas, el peldaño de rescate nunca se activaba y el
 * stock nuevo quedaba estructuralmente fuera. Ahora el filtro de universo entra
 * ANTES, así que la escalera mide la muestra que de verdad importa.
 *
 * `usado` conserva 90→180 (byte-idéntico al comportamiento previo para sujetos
 * usados). `nuevo` suma un peldaño de 365 días porque su cadencia de scrape es
 * distinta: el inventario usado se refresca todos los meses, el de obra nueva
 * llega en lotes (en Santiago, los 34 comparables se scrapearon todos el 24-mar
 * y no se volvieron a tocar). Una muestra usada que no junta 15 en 180 días es
 * genuinamente delgada; una nueva que no lo hace es, casi siempre, un artefacto
 * de cadencia. Además el precio de lista de un proyecto se sostiene por trimestres,
 * así que ensanchar la ventana ahí cuesta menos precisión.
 *
 * Ver goal de scraper (pendiente): por qué los ~964 avisos `nuevo` no se refrescan
 * al ritmo de los usados.
 */
const VENTANAS_DIAS: Record<CondicionMercado, number[]> = {
  usado: [90, 180],
  nuevo: [90, 180, 365],
};

/** Muestra mínima de ventas válidas para publicar una mediana. */
export const MIN_VENTAS_MEDIANA = 15;

/** Tope de filas por respuesta de PostgREST en este proyecto (config del API,
 *  no del rol: `.limit(N)` con N > 1000 devuelve 1000 igual). Toda lectura que
 *  pueda superarlo pagina con `.range`. */
export const PAGINA_POSTGREST = 1000;

/**
 * Mediana YA RESUELTA tal como la recibe el motor síncrono (calcMetrics /
 * runAnalysis / calcDecisividades) y como viaja en el snapshot persistido.
 * `universo` es opcional acá —y solo acá— porque los snapshots grabados antes
 * de la segmentación no lo traen. `MedianaComunaVenta` (lo que devuelve la
 * query de hoy) siempre lo trae y es asignable a este tipo.
 */
export type MedianaComunaInyectada = {
  mediana: number | null;
  n: number;
  universo?: CondicionMercado;
};

/** Resultado de la mediana comunal, con el universo y la ventana que la produjeron. */
export interface MedianaComunaVenta {
  /** Mediana UF/m² del universo pedido. null si no alcanzó el umbral. */
  mediana: number | null;
  /** N de ventas válidas usadas (o el conteo parcial si no alcanzó). */
  n: number;
  /** Universo en el que se buscó — NUNCA se cae al otro. */
  universo: CondicionMercado;
  /** Ventana de frescura (días) que produjo la muestra. null si ninguna alcanzó. */
  ventanaDias: number | null;
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
 * Mediana de precio/m² de VENTA (en UF) para la comuna, DENTRO DEL UNIVERSO del
 * sujeto (nuevo | usado), calculada desde scraped_properties. Ventana ±20% de
 * superficie; filtro de dormitorios solo si se entrega un valor; escalera de
 * frescura por universo (ver VENTANAS_DIAS). Requiere >= MIN_VENTAS_MEDIANA
 * ventas válidas (precio>0 y superficie_m2>0).
 *
 * SIN FALLBACK CRUZADO: si el universo pedido no junta muestra, devuelve
 * mediana null (y n el conteo parcial). El caller lo traduce a
 * `confiable: false` y el hallazgo de sobreprecio NO se emite. Mejor sin
 * hallazgo que con uno construido sobre el mercado equivocado — mismo criterio
 * que la referencia de arriendo (arriendo-referencia.ts).
 */
export async function getComunaMedianaVentaUF(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  comuna: string,
  superficie: number,
  dormitorios: number | null,
  ufValue: number,
  condicion: CondicionMercado
): Promise<MedianaComunaVenta> {
  const comunaNorm = normalizeComuna(comuna);
  const supMinV = superficie * 0.8;
  const supMaxV = superficie * 1.2;

  // Ventana de frescura: descartar avisos no refrescados hace >N dias (el scraper solo
  // hace upsert, is_active queda true para siempre y sesga la mediana con precios añejos).
  //
  // PAGINADO, no `.limit(2000)`: PostgREST capa cada respuesta en PAGINA_POSTGREST
  // filas (verificado el 02-sep-2026: `.limit(2000)` sobre Santiago 1D usado 90 días
  // devolvía 1.000 de 1.230). Con el universo completo (backfill) Santiago 1D en
  // banda pasa a ~2.400 y 2D a ~1.850, y la mediana habría salido de las primeras
  // 1.000 filas en orden físico. `.order("id")` fija el orden entre páginas.
  async function fetchVentas(dias: number) {
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    const out: Array<Record<string, unknown>> = [];
    for (let off = 0; ; off += PAGINA_POSTGREST) {
      let q = supabase
        .from("scraped_properties")
        .select("precio, moneda, superficie_m2, dormitorios, condicion")
        .eq("comuna", comunaNorm)
        .eq("type", "venta")
        .eq("is_active", true)
        .gte("scraped_at", desde)
        .gte("superficie_m2", supMinV)
        .lte("superficie_m2", supMaxV)
        .order("id", { ascending: true })
        .range(off, off + PAGINA_POSTGREST - 1);
      // Universo. Para "usado" NO va un .eq pelado: en SQL `condicion <> 'x'` y las
      // comparaciones con NULL devuelven NULL, y un .eq("condicion","usado") deja fuera
      // las filas sin valor. El insert defaultea a "usado" (scrape-properties/route.ts),
      // así que las filas pre-columna pertenecen a ese universo — el .or las recupera.
      q = condicion === "nuevo"
        ? q.eq("condicion", "nuevo")
        : q.or("condicion.is.null,condicion.eq.usado");
    // Dormitorios: filtro EXACTO en usado, NINGUNO en obra nueva.
    //
    // No es una relajación para ganar cobertura — es que en obra nueva el campo
    // no dice lo que parece. Ahí la fila de la fuente es del PROYECTO, no de una
    // unidad, y `dormitorios` trae el MÍNIMO del rango que ofrece el proyecto:
    // uno que va de 1 a 2 dormitorios se registra como 1D. Por eso ~70% del stock
    // nuevo aparece como 1D, y un sujeto de 2D no encuentra contra qué medirse.
    // Filtrar por esa etiqueta es filtrar por la tipología de ENTRADA del
    // proyecto, no por la del depto.
    //
    // Quien sí discrimina bien la tipología en ese universo es la superficie
    // (±20%), que la fila reporta de verdad. Medido sobre los 25 sujetos nuevos
    // que hoy juntan muestra, sacar el filtro mueve la mediana |Δ| p50 0,2% ·
    // p75 0,7% · p90 1,9% · max 6,6%, con Δ mediano CON SIGNO de 0,0% (no
    // introduce sesgo direccional). A cambio, 19 sujetos que no tenían
    // comparación pasan a tenerla: 25 -> 44 de 78.
    //
    // En USADO el filtro se mantiene: ahí la fila es de una unidad y el dato de
    // dormitorios es real. Misma asimetría-por-universo que VENTANAS_DIAS, y por
    // el mismo tipo de razón: la fuente se comporta distinto en cada universo.
      if (dormitorios !== null && condicion === "usado") q = q.eq("dormitorios", dormitorios);
      const { data, error } = await q;
      // Esta query decide la mediana comunal de venta, que alimenta
      // valorMercadoFranco y los gates. Si falla, el array vacío la vuelve
      // indistinguible de "esta comuna no tiene avisos frescos" y la escalera de
      // frescura baja un peldaño buscando datos que quizá sí estaban.
      reportarFalloQuery(error, {
        ruta: "lib/comuna-stats",
        operacion: "query-ventas-comuna",
        tags: { tabla: "scraped_properties", universo: condicion },
        extra: { comuna: comunaNorm, dormitorios, dias, superficie, offset: off },
      });
      if (!Array.isArray(data) || data.length === 0) break;
      out.push(...data);
      if (data.length < PAGINA_POSTGREST) break;
    }
    return out;
  }

  // Escalera de frescura por universo: se sube un peldaño solo si el universo
  // pedido no junta muestra. Nunca se cambia de universo.
  const ventanas = VENTANAS_DIAS[condicion];
  let ventas: Array<Record<string, unknown>> = [];
  let ventanaUsada: number | null = null;
  for (const dias of ventanas) {
    ventas = await fetchVentas(dias);
    ventanaUsada = dias;
    if (ventas.length >= MIN_VENTAS_MEDIANA) break;
  }
  if (ventas.length < MIN_VENTAS_MEDIANA) {
    return { mediana: null, n: ventas.length, universo: condicion, ventanaDias: null };
  }

  const m2sUF: number[] = [];
  for (const r of ventas) {
    const sup = Number(r.superficie_m2);
    const precio = Number(r.precio);
    if (!sup || sup <= 0 || !precio || precio <= 0 || Number.isNaN(sup) || Number.isNaN(precio)) continue;
    // Correccion publicado->cierre: usados llevan factor (<1); nuevos 1. Sigue
    // siendo por fila (no por universo) a propósito: el factor es supuesto de
    // escritorio sin fuente medida y su revisión va en un goal aparte.
    const factor = r.condicion === "usado" ? getFactorCierre(comunaNorm) : 1;
    const precioUF = (r.moneda === "UF" ? precio : precio / (ufValue || 1)) * factor;
    m2sUF.push(precioUF / sup);
  }
  if (m2sUF.length < MIN_VENTAS_MEDIANA) {
    return { mediana: null, n: m2sUF.length, universo: condicion, ventanaDias: null };
  }
  return {
    mediana: Math.round(median(m2sUF) * 100) / 100,
    n: m2sUF.length,
    universo: condicion,
    ventanaDias: ventanaUsada,
  };
}
