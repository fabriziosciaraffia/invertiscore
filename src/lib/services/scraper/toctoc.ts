import { ProxyAgent } from "undici";

// Helper: dispatcher de proxy si PROXY_URL está seteada, sino undefined (fetch directo)
const proxyDispatcher = process.env.PROXY_URL ? new ProxyAgent(process.env.PROXY_URL) : undefined;

export interface ScrapedProperty {
  source: string;
  sourceId: string;
  type: "arriendo" | "venta";
  comuna: string;
  direccion?: string;
  lat?: number;
  lng?: number;
  precio: number;
  moneda: "CLP" | "UF";
  superficieM2?: number;
  dormitorios?: number;
  banos?: number;
  gastosComunes?: number;
  estacionamientos?: number;
  bodegas?: number;
  piso?: number;
  antiguedad?: string;
  url?: string;
  condicion?: string;
}

export interface ScraperResult {
  source: string;
  properties: ScrapedProperty[];
  errors: string[];
  scrapedAt: Date;
}

const COMUNAS_SANTIAGO = [
  "santiago", "providencia", "las-condes", "nunoa", "la-florida",
  "vitacura", "lo-barnechea", "san-miguel", "macul", "penalolen",
  "la-reina", "estacion-central", "independencia", "recoleta",
  "maipu", "puente-alto", "san-joaquin", "quinta-normal", "conchali",
  "la-cisterna", "huechuraba", "pudahuel", "cerrillos", "quilicura", "renca",
];

// ─── Comuna IDs for gw-lista-seo API ───
const COMUNA_IDS: Record<string, { id: number; label: string }> = {
  "santiago":         { id: 339, label: "Santiago" },
  "providencia":      { id: 337, label: "Providencia" },
  "las-condes":       { id: 313, label: "Las Condes" },
  "nunoa":            { id: 340, label: "Ñuñoa" },
  "la-florida":       { id: 316, label: "La Florida" },
  "vitacura":         { id: 312, label: "Vitacura" },
  "lo-barnechea":     { id: 311, label: "Lo Barnechea" },
  "san-miguel":       { id: 335, label: "San Miguel" },
  "macul":            { id: 342, label: "Macul" },
  "penalolen":        { id: 315, label: "Peñalolén" },
  "la-reina":         { id: 314, label: "La Reina" },
  "estacion-central": { id: 338, label: "Estación Central" },
  "independencia":    { id: 324, label: "Independencia" },
  "recoleta":         { id: 325, label: "Recoleta" },
  "maipu":            { id: 320, label: "Maipú" },
  "san-joaquin":      { id: 341, label: "San Joaquín" },
  "quinta-normal":    { id: 336, label: "Quinta Normal" },
  "conchali":         { id: 326, label: "Conchalí" },
  "puente-alto":      { id: 295, label: "Puente Alto" },
  "la-cisterna":      { id: 330, label: "La Cisterna" },
  "huechuraba":       { id: 327, label: "Huechuraba" },
  "pudahuel":         { id: 317, label: "Pudahuel" },
  "cerrillos":        { id: 321, label: "Cerrillos" },
  "quilicura":        { id: 323, label: "Quilicura" },
  "renca":            { id: 322, label: "Renca" },
};

export const BATCH_SIZE = 1; // Reducido para diagnóstico de timeout (era 2)
export const TOTAL_BATCHES = Math.ceil(COMUNAS_SANTIAGO.length / BATCH_SIZE);

export function getComunasBatch(batch: number): string[] {
  const startIndex = (batch * BATCH_SIZE) % COMUNAS_SANTIAGO.length;
  return COMUNAS_SANTIAGO.slice(startIndex, startIndex + BATCH_SIZE);
}

/** Todas las comunas cubiertas, sin rotación por batch. La usa el pase de obra
 *  nueva, que cabe entero en una corrida (ver ESTADO_OBRA_NUEVA). */
export function getTodasLasComunas(): string[] {
  return [...COMUNAS_SANTIAGO];
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "es-CL,es;q=0.9",
};

// ─── Map API approach (best: up to 510 props with coords) ───

const COMUNA_VIEWPORTS: Record<string, string> = {
  "santiago":           "-33.48,-70.68,-33.42,-70.62",
  "providencia":        "-33.45,-70.63,-33.40,-70.59",
  "las-condes":         "-33.44,-70.62,-33.38,-70.55",
  "nunoa":              "-33.47,-70.62,-33.43,-70.57",
  "la-florida":         "-33.56,-70.61,-33.49,-70.54",
  "vitacura":           "-33.42,-70.61,-33.37,-70.55",
  "lo-barnechea":       "-33.42,-70.55,-33.34,-70.45",
  "san-miguel":         "-33.52,-70.66,-33.48,-70.63",
  "macul":              "-33.50,-70.62,-33.46,-70.58",
  "penalolen":          "-33.52,-70.58,-33.46,-70.52",
  "la-reina":           "-33.47,-70.57,-33.43,-70.52",
  "estacion-central":   "-33.48,-70.70,-33.44,-70.66",
  "independencia":      "-33.44,-70.67,-33.40,-70.64",
  "recoleta":           "-33.44,-70.66,-33.40,-70.62",
  "maipu":              "-33.53,-70.79,-33.46,-70.72",
  "puente-alto":        "-33.63,-70.62,-33.56,-70.54",
  "san-joaquin":        "-33.51,-70.65,-33.48,-70.62",
  "quinta-normal":      "-33.46,-70.71,-33.42,-70.67",
  "conchali":           "-33.41,-70.68,-33.37,-70.64",
  "la-cisterna":        "-33.55,-70.68,-33.51,-70.64",
  "huechuraba":         "-33.39,-70.66,-33.34,-70.60",
  "pudahuel":           "-33.48,-70.78,-33.42,-70.72",
  "cerrillos":          "-33.52,-70.73,-33.48,-70.69",
  "quilicura":          "-33.39,-70.75,-33.34,-70.69",
  "renca":              "-33.42,-70.74,-33.38,-70.68",
};

async function getTocTocSession(): Promise<{ cookies: string; token: string }> {
  const response = await fetch(
    "https://www.toctoc.com/resultados/mapa/compra/departamento/metropolitana/las-condes/",
    { headers: { ...HEADERS, Accept: "text/html" }, dispatcher: proxyDispatcher } as RequestInit & { dispatcher?: unknown }
  );
  const html = await response.text();
  // El endpoint GetProps exige x-access-token: un JWT embebido en el HTML del
  // mapa que lleva la IP del cliente en su payload (por eso debe emitirse por el
  // mismo proxy que hara el GetProps).
  const tokenMatch = html.match(/eyJhbGci[A-Za-z0-9._-]+/);
  const token = tokenMatch ? tokenMatch[0] : "";
  const cookies = (response.headers.getSetCookie?.() || []).map(c => c.split(";")[0]).join("; ");
  return { cookies, token };
}

/**
 * Filtro `estado` del GetProps de TocToc — verificado en vivo contra la API:
 *   0 = todo · 1 = obra NUEVA (100% urls compranuevo) · 2 = usada · 3 = vacío.
 * El campo siempre estuvo en el body, fijo en 0. Con 0 la respuesta se capa en
 * `limite` (510) sobre un universo de miles, y la obra nueva —que es ~1% del
 * stock— entra o no según el orden: por eso su ingesta llegaba en lotes
 * esporádicos en vez de continua. Pedirla por separado la hace determinista.
 */
export const ESTADO_TODO = 0;
export const ESTADO_OBRA_NUEVA = 1;
export const ESTADO_USADO = 2;

async function fetchMapProperties(
  comunaSlug: string,
  operacion: number,
  viewport: string,
  cookies: string,
  token: string,
  estado: number = ESTADO_TODO
): Promise<unknown[] | null> {
  const raw = await fetchMapRaw(comunaSlug, operacion, viewport, cookies, token, estado, 1, 510);
  return raw ? raw.propiedades : null;
}

/**
 * Llamada cruda al GetProps con paginación. Medido en vivo (02-sep-2026):
 *  · `resultados.Total` trae el universo del viewport; `pagina` funciona y las
 *    páginas son disjuntas (Santiago, 3 páginas → 1.800 ids únicos, 0 repetidos).
 *  · `limite` se capa en GETPROPS_MAX_POR_PAGINA (600): pedir 5.000 devuelve 600.
 *  · Más allá del total devuelve 0 filas; el orden es estable entre llamadas.
 *  · El campo `comuna` del body NO filtra: filtra el viewport. La comuna real
 *    viene en cada fila ([7]).
 * Devuelve null si la fuente no responde 200.
 */
async function fetchMapRaw(
  comunaSlug: string,
  operacion: number,
  viewport: string,
  cookies: string,
  token: string,
  estado: number,
  pagina: number,
  limite: number
): Promise<{ propiedades: unknown[]; total: number } | null> {
  const body = {
    region: "metropolitana", comuna: comunaSlug, barrio: "", poi: "",
    tipoVista: "mapa", operacion, idPoligono: null, moneda: 2,
    precioDesde: 0, precioHasta: 0, dormitoriosDesde: 0, dormitoriosHasta: 0,
    banosDesde: 0, banosHasta: 0, tipoPropiedad: "departamento", estado,
    disponibilidadEntrega: "", numeroDeDiasTocToc: 0,
    superficieDesdeUtil: 0, superficieHastaUtil: 0,
    superficieDesdeConstruida: 0, superficieHastaConstruida: 0,
    superficieDesdeTerraza: 0, superficieHastaTerraza: 0,
    superficieDesdeTerreno: 0, superficieHastaTerreno: 0,
    ordenarPor: 0, pagina, paginaInterna: 1, zoom: 12, idZonaHomogenea: 0,
    busqueda: "", viewport, atributos: [], publicador: 0, temporalidad: 0,
    limite, cargaBanner: false, primeraCarga: false, santander: false,
  };

  const typeSlug = operacion === 2 ? "arrienda" : "compra";
  const response = await fetch("https://www.toctoc.com/api/mapa/GetProps", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": HEADERS["User-Agent"],
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "es-CL,es;q=0.9",
      Referer: `https://www.toctoc.com/resultados/mapa/${typeSlug}/departamento/metropolitana/${comunaSlug}/`,
      Origin: "https://www.toctoc.com",
      Cookie: cookies,
      "x-access-token": token,
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    },
    body: JSON.stringify(body),
    dispatcher: proxyDispatcher,
  } as RequestInit & { dispatcher?: unknown });

  if (!response.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await response.json() as any;
  const propiedades = data?.resultados?.Propiedades;
  if (!Array.isArray(propiedades)) return null;
  const total = Number(data?.resultados?.Total);
  return { propiedades, total: Number.isFinite(total) ? total : propiedades.length };
}

// ─── Universo completo por paginación del GetProps ───

/** Viewport que cubre el Gran Santiago entero. Con él, un solo recorrido
 *  paginado trae el universo de las 25 comunas del roster (medido 02-sep-2026:
 *  26.088 ventas usadas y 9.264 arriendos en 44 + 16 páginas), sin el solape
 *  ni el recorte de los viewports por comuna (Huechuraba, La Reina, Quilicura y
 *  Cerrillos pierden avisos con su caja propia). */
export const VIEWPORT_GRAN_SANTIAGO = "-33.70,-70.95,-33.25,-70.40";

/** Tope real por página del GetProps (pedir más devuelve exactamente esto). */
export const GETPROPS_MAX_POR_PAGINA = 600;

export interface PaginaMapa {
  pagina: number;
  /** Universo del viewport según la fuente. */
  total: number;
  /** Filas crudas que trajo la página (antes del parser). */
  crudas: number;
  properties: ScrapedProperty[];
}

export interface ResultadoMapaPaginado {
  total: number;
  paginas: number;
  properties: ScrapedProperty[];
  errors: string[];
}

/**
 * Recorre el GetProps página a página hasta agotar `Total`. NO toca la ficha
 * HTML (bloquea la IP a los ~36 GETs); todo sale del listado, coordenadas
 * incluidas. `onPagina` permite persistir por página (checkpoint) sin retener
 * el universo entero en memoria; si se entrega, `properties` vuelve vacío.
 */
export async function fetchMapPaginado(opts: {
  type: "arriendo" | "venta";
  estado: number;
  viewport?: string;
  desdePagina?: number;
  maxPaginas?: number;
  pausaMs?: number;
  onPagina?: (p: PaginaMapa) => Promise<void> | void;
}): Promise<ResultadoMapaPaginado> {
  const viewport = opts.viewport ?? VIEWPORT_GRAN_SANTIAGO;
  const pausaMs = opts.pausaMs ?? 1000;
  const operacion = opts.type === "arriendo" ? 2 : 1;
  const errors: string[] = [];
  const properties: ScrapedProperty[] = [];

  let cookies = "";
  let token = "";
  try {
    const session = await getTocTocSession();
    cookies = session.cookies;
    token = session.token;
  } catch (e) {
    errors.push(`Map session error: ${e}`);
    return { total: 0, paginas: 0, properties, errors };
  }
  if (!token) errors.push("Map: token vacio");

  let total = 0;
  let paginas = 0;
  let pagina = Math.max(1, opts.desdePagina ?? 1);
  for (;;) {
    const raw = await fetchMapRaw("santiago", operacion, viewport, cookies, token, opts.estado, pagina, GETPROPS_MAX_POR_PAGINA);
    if (!raw) {
      errors.push(`Map p${pagina}: sin respuesta`);
      break;
    }
    total = raw.total;
    if (raw.propiedades.length === 0) break;

    const parsed: ScrapedProperty[] = [];
    for (const propArr of raw.propiedades) {
      const prop = parseMapProperty(propArr as unknown[], "santiago", opts.type);
      if (prop) parsed.push(prop);
    }
    paginas++;
    if (opts.onPagina) await opts.onPagina({ pagina, total, crudas: raw.propiedades.length, properties: parsed });
    else properties.push(...parsed);

    if (opts.maxPaginas && paginas >= opts.maxPaginas) break;
    if (pagina * GETPROPS_MAX_POR_PAGINA >= total) break;
    pagina++;
    if (pausaMs > 0) await new Promise((r) => setTimeout(r, pausaMs));
  }
  return { total, paginas, properties, errors };
}

function parseMapProperty(
  arr: unknown[],
  comunaSlug: string,
  type: "arriendo" | "venta"
): ScrapedProperty | null {
  if (!Array.isArray(arr) || arr.length < 30) return null;

  try {
    const idProperty = arr[1] as number;
    const lng = arr[2] as number;
    const lat = arr[3] as number;
    const banos = arr[5] as number;
    const comuna = (arr[7] as string) || formatComuna(comunaSlug);

    // Validate coordinates (Chile)
    if (!lat || !lng || lat > -17 || lat < -56 || lng > -66 || lng < -76) return null;

    // Price: search positions 22-24 for numeric values
    let precio = 0;
    let moneda: "CLP" | "UF" = "CLP";
    for (const pos of [22, 23, 24]) {
      const val = parseFloat(String(arr[pos]));
      if (val > 50000) { precio = val; moneda = "CLP"; break; }
      if (val > 0 && val < 50000 && precio === 0) { precio = val; moneda = "UF"; }
    }
    if (precio === 0) return null;

    // URL: last elements often contain strings
    let url: string | undefined;
    for (let i = arr.length - 1; i >= arr.length - 8; i--) {
      if (typeof arr[i] === "string" && (arr[i] as string).startsWith("http")) {
        url = arr[i] as string; break;
      }
    }

    // La URL distingue obra nueva: .../compranuevo/... -> "nuevo". Sin URL o sin
    // ese marcador -> "usado" (la mayoria del inventario).
    const esObraNueva = !!url && url.includes("compranuevo");

    // Dormitorios. La fila del GetProps trae [4]/[5] = baños (mín/máx) y
    // [8]/[9] = dormitorios (mín/máx). Hasta el 02-sep-2026 se leía [4], así que
    // todo lo que entró por el mapa quedó con dormitorios = baños: medido contra
    // el listado gw-lista-seo sobre 3.979 avisos usados, [8] acierta 3.977 y [4]
    // solo 2.343 (cuando dorms y baños coinciden); en la tabla, el 100% de las
    // filas vía mapa tenía dormitorios = banos. En obra nueva pasa lo mismo
    // ([8] = dormitorios mínimos, 239/239), pero ese universo se deja
    // byte-idéntico acá a propósito (regla del goal: scrape-nuevos intacto) y se
    // corrige en su propio goal.
    const dormitorios = (esObraNueva ? arr[4] : arr[8]) as number;

    // Superficie. En USADO la fila es de UNA unidad y las posiciones coinciden;
    // el orden [27,28,33,34,31,32] prioriza la útil y deja total/construida de
    // fallback para los avisos con útil en 0.0.
    //
    // En OBRA NUEVA la fila es del PROYECTO, no de una unidad: el precio de [22]
    // es el "desde" (verificado contra el "desde UF X" del listado) y [4] son los
    // dormitorios MÍNIMOS del rango, pero [27] NO es la superficie mínima —
    // mediana 14,6% sobre [33], hasta 137%. Dividir un precio "desde" por una
    // superficie que no es la del mínimo daba un UF/m² incoherente: medido sobre
    // 311 proyectos, el orden viejo subestimaba la mediana en 13,6%
    // (UF 92,9 vs 107,5). Para obra nueva se toma la tripleta del MISMO extremo
    // —precio desde + [33] superficie mínima + [4] dormitorios mínimos—, que
    // describe la unidad de entrada del proyecto y es verificable contra la ficha.
    // En usado el orden queda intacto (su sesgo medido es 2,7% y sus 25k filas no
    // se tocan).
    let superficieM2: number | undefined;
    const posiciones = esObraNueva ? [33, 27, 28, 34, 31, 32] : [27, 28, 33, 34, 31, 32];
    for (const pos of posiciones) {
      const val = parseFloat(String(arr[pos]));
      if (val > 15 && val < 500) { superficieM2 = val; break; }
    }

    const sourceId = url || `toctoc-map-${idProperty}`;

    return {
      source: "toctoc",
      sourceId,
      type,
      comuna,
      lat, lng,
      precio, moneda,
      superficieM2,
      dormitorios: dormitorios > 0 ? dormitorios : undefined,
      banos: banos > 0 ? banos : undefined,
      url,
      condicion: esObraNueva ? "nuevo" : "usado",
    };
  } catch {
    return null;
  }
}

/**
 * @param estado filtro de condición del GetProps (ver ESTADO_*). Default
 *   ESTADO_TODO = comportamiento previo, byte-idéntico. ESTADO_OBRA_NUEVA lo usa
 *   el pase de obra nueva del cron, que necesita cadencia propia.
 * @param pausaMs pausa entre comunas. El pase general usa 2s; el de obra nueva
 *   puede bajarla porque recorre las 25 comunas en una sola corrida y la
 *   respuesta es ~20x más chica (9-101 filas vs 510).
 */
export async function scrapeTocTocMap(
  type: "arriendo" | "venta" = "arriendo",
  comunas?: string[],
  estado: number = ESTADO_TODO,
  pausaMs: number = 2000
): Promise<ScraperResult> {
  const properties: ScrapedProperty[] = [];
  const errors: string[] = [];
  const operacion = type === "arriendo" ? 2 : 1;
  const targetComunas = comunas || Object.keys(COMUNA_VIEWPORTS);

  let cookies = "";
  let token = "";
  try {
    const session = await getTocTocSession();
    cookies = session.cookies;
    token = session.token;
  } catch (e) {
    errors.push(`Map session error: ${e}`);
    return { source: "toctoc-map", properties, errors, scrapedAt: new Date() };
  }
  if (!token) errors.push("Map: token vacio"); // diagnostico, seguimos igual

  for (const comunaSlug of targetComunas) {
    try {
      const viewport = COMUNA_VIEWPORTS[comunaSlug];
      if (!viewport) { errors.push(`No viewport for ${comunaSlug}`); continue; }

      const propArrays = await fetchMapProperties(comunaSlug, operacion, viewport, cookies, token, estado);
      if (!propArrays || propArrays.length === 0) {
        // Con ESTADO_OBRA_NUEVA el vacío es esperable (hay comunas sin proyectos
        // en venta); no es un error que valga la pena inundar el reporte.
        if (estado !== ESTADO_OBRA_NUEVA) errors.push(`Map API: no data for ${comunaSlug}`);
        continue;
      }

      for (const propArr of propArrays) {
        const prop = parseMapProperty(propArr as unknown[], comunaSlug, type);
        if (prop) properties.push(prop);
      }

      if (pausaMs > 0) await new Promise(resolve => setTimeout(resolve, pausaMs));
    } catch (error) {
      errors.push(`Map ${comunaSlug}: ${error}`);
    }
  }

  return { source: "toctoc-map", properties, errors, scrapedAt: new Date() };
}

// ─── Coordinate extraction from detail pages ───

export async function fetchCoordinates(url: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(url, { headers: HEADERS, dispatcher: proxyDispatcher } as RequestInit & { dispatcher?: unknown });
    if (!response.ok) return null;
    const html = await response.text();
    const match = html.match(/"coordenadas":\[(-?\d+\.?\d+),(-?\d+\.?\d+)\]/);
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat > -17 || lat < -56 || lng > -66 || lng < -76) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

// ─── Reusable property parser (shared by API and __NEXT_DATA__) ───

function parsePropertyFromResult(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: any,
  type: "arriendo" | "venta",
  comunaFallback: string
): ScrapedProperty | null {
  try {
    let precioCLP: number | null = null;
    let precioUF: number | null = null;

    if (item.precios && Array.isArray(item.precios)) {
      for (const p of item.precios) {
        if (p.prefix === "$" && p.value) {
          precioCLP = parseInt(String(p.value).replace(/\./g, "").replace(/,/g, ""));
        }
        if (p.prefix === "UF" && p.value) {
          precioUF = parseFloat(String(p.value).replace(/\./g, "").replace(",", "."));
        }
      }
    }

    const precio = precioCLP || (precioUF ? precioUF : 0);
    if (precio === 0) return null;

    let superficieM2: number | undefined;
    if (item.superficie && Array.isArray(item.superficie) && item.superficie[0]) {
      superficieM2 = parseInt(String(item.superficie[0]));
      if (isNaN(superficieM2) || superficieM2 <= 0) superficieM2 = undefined;
    }

    let dormitorios: number | undefined;
    if (item.dormitorios && Array.isArray(item.dormitorios) && item.dormitorios[0]) {
      dormitorios = parseInt(String(item.dormitorios[0]));
      if (isNaN(dormitorios)) dormitorios = undefined;
    }

    let banos: number | undefined;
    if (item.bannos && Array.isArray(item.bannos) && item.bannos[0]) {
      banos = parseInt(String(item.bannos[0]));
      if (isNaN(banos)) banos = undefined;
    }

    const direccion = item.titulo || undefined;
    const url = item.urlFicha || undefined;
    const sourceId = url || `toctoc-${comunaFallback}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Condición. Este parser NO la seteaba, así que todo lo que entraba por acá
    // caía al default "usado" de propertyToRow — incluida la obra nueva. El
    // listado la trae con nombre propio (`tipoOperacion: "Venta Nuevo"`), y la
    // urlFicha lleva el mismo marcador que usa el parser del mapa. Se leen las
    // dos: el campo nombrado manda, la URL respalda.
    const condicion =
      String(item.tipoOperacion ?? "").toLowerCase().includes("nuevo") ||
      String(url ?? "").includes("compranuevo")
        ? "nuevo"
        : "usado";

    return {
      source: "toctoc",
      sourceId,
      type,
      comuna: item.comuna || comunaFallback,
      direccion,
      precio,
      moneda: precioCLP ? "CLP" : "UF",
      superficieM2,
      dormitorios,
      banos,
      url,
      condicion,
    };
  } catch {
    return null;
  }
}

// ─── Paginated API scraper (gw-lista-seo) ───

export async function scrapeTocTocAPI(
  type: "arriendo" | "venta" = "arriendo",
  comunas?: string[],
  maxPagesPerComuna: number = 5
): Promise<ScraperResult> {
  const properties: ScrapedProperty[] = [];
  const errors: string[] = [];
  const targetComunas = comunas || Object.keys(COMUNA_IDS);

  // Paso 1: Obtener cookies de sesión
  let cookies = "";
  try {
    const sessionResponse = await fetch(
      "https://www.toctoc.com/arriendo/departamento/metropolitana/santiago",
      { headers: HEADERS, dispatcher: proxyDispatcher } as RequestInit & { dispatcher?: unknown }
    );
    const setCookies = sessionResponse.headers.getSetCookie?.() || [];
    cookies = setCookies.map(c => c.split(";")[0]).join("; ");
  } catch (e) {
    errors.push(`Session error: ${e}`);
    return { source: "toctoc-api", properties, errors, scrapedAt: new Date() };
  }

  // Paso 2: Para cada comuna, paginar
  for (const comunaSlug of targetComunas) {
    const comunaInfo = COMUNA_IDS[comunaSlug];
    if (!comunaInfo) {
      // Sin ID para esta comuna, skip (se usa fallback)
      continue;
    }

    const operacionFilter = type === "arriendo"
      ? { id: 2, value: [3] }
      : { id: 1, value: [1, 2] };

    const filtros = JSON.stringify([
      { id: "tipo-de-busqueda", type: "radio", values: [operacionFilter], mainFilter: true },
      { id: "tipo-de-propiedad", type: "check", values: [{ id: 2, value: [2] }], mainFilter: true },
      { id: "region", type: "select", values: [{ id: 13, value: [13] }] },
      { id: "comuna", type: "select", values: [{ id: comunaInfo.id, value: [comunaInfo.id] }] },
    ]);

    let page = 1;
    let totalPages = 1;

    while (page <= Math.min(totalPages, maxPagesPerComuna)) {
      try {
        const apiUrl = `https://www.toctoc.com/gw-lista-seo/propiedades?filtros=${encodeURIComponent(filtros)}&order=1&page=${page}`;

        const apiHeaders = {
          "User-Agent": HEADERS["User-Agent"],
          "accept": "*/*",
          "accept-language": "es-CL,es;q=0.9",
          "referer": `https://www.toctoc.com/${type}/departamento/metropolitana/${comunaSlug}`,
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "cors",
          "sec-fetch-dest": "empty",
          "Cookie": cookies,
        };

        // Retry ante 202 (warming para IP datacenter) o body vacío: hasta 3 intentos.
        let response!: Response;
        let rawText = "";
        for (let attempt = 1; attempt <= 3; attempt++) {
          response = await fetch(apiUrl, { headers: apiHeaders, dispatcher: proxyDispatcher } as RequestInit & { dispatcher?: unknown });
          rawText = await response.text();
          const needsRetry = response.status === 202 || rawText.trim() === "";
          if (!needsRetry) break;
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, attempt === 1 ? 800 : 1500));
          }
        }

        // Tras 3 intentos sigue 202/vacío: rendirse para esta comuna.
        if (response.status === 202 || rawText.trim() === "") {
          errors.push(`API ${comunaSlug} p${page}: 202/empty tras 3 intentos`);
          break;
        }

        if (!response.ok) {
          errors.push(`API ${comunaSlug} p${page}: ${response.status}`);
          break;
        }

        const data = JSON.parse(rawText) as { total: number; results: unknown[] };

        if (!data.results || data.results.length === 0) break;

        if (page === 1) {
          totalPages = Math.ceil(data.total / 20);
        }

        for (const item of data.results) {
          const parsed = parsePropertyFromResult(item, type, comunaInfo.label);
          if (parsed) properties.push(parsed);
        }

        page++;

        // Rate limiting entre páginas
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        errors.push(`API ${comunaSlug} p${page}: ${error}`);
        break;
      }
    }

    // Rate limiting entre comunas
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { source: "toctoc-api", properties, errors, scrapedAt: new Date() };
}

// ─── Listing page scraper (__NEXT_DATA__ fallback) ───

export async function scrapeTocToc(
  type: "arriendo" | "venta" = "arriendo",
  comunas?: string[]
): Promise<ScraperResult> {
  const properties: ScrapedProperty[] = [];
  const errors: string[] = [];
  const targetComunas = comunas || COMUNAS_SANTIAGO;

  for (const comuna of targetComunas) {
    try {
      for (let page = 1; page <= 1; page++) {
        const url = `https://www.toctoc.com/${type}/departamento/metropolitana/${comuna}?pagina=${page}`;

        const response = await fetch(url, { headers: HEADERS, dispatcher: proxyDispatcher } as RequestInit & { dispatcher?: unknown });

        if (!response.ok) {
          if (response.status === 404) break;
          errors.push(`TocToc ${comuna} p${page}: HTTP ${response.status}`);
          continue;
        }

        const html = await response.text();
        const parsed = parseTocTocHTML(html, comuna, type);

        if (parsed.length === 0) break;
        properties.push(...parsed);

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      errors.push(`TocToc ${comuna}: ${error}`);
    }
  }

  return { source: "toctoc", properties, errors, scrapedAt: new Date() };
}

function parseTocTocHTML(html: string, comunaSlug: string, type: string): ScrapedProperty[] {
  const properties: ScrapedProperty[] = [];
  const comuna = formatComuna(comunaSlug);

  const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!nextDataMatch) return properties;

  try {
    const nextData = JSON.parse(nextDataMatch[1]);
    const results = nextData?.props?.pageProps?.initialReduxState?.PropertyState?.results;
    if (!results || !Array.isArray(results)) return properties;

    for (const item of results) {
      const parsed = parsePropertyFromResult(item, type as "arriendo" | "venta", comuna);
      if (parsed) properties.push(parsed);
    }
  } catch {
    // __NEXT_DATA__ parse error
  }

  return properties;
}

function formatComuna(slug: string): string {
  const map: Record<string, string> = {
    "santiago": "Santiago",
    "providencia": "Providencia",
    "las-condes": "Las Condes",
    "nunoa": "Ñuñoa",
    "la-florida": "La Florida",
    "vitacura": "Vitacura",
    "lo-barnechea": "Lo Barnechea",
    "san-miguel": "San Miguel",
    "macul": "Macul",
    "penalolen": "Peñalolén",
    "la-reina": "La Reina",
    "estacion-central": "Estación Central",
    "independencia": "Independencia",
    "recoleta": "Recoleta",
    "maipu": "Maipú",
    "puente-alto": "Puente Alto",
    "san-joaquin": "San Joaquín",
    "quinta-normal": "Quinta Normal",
    "conchali": "Conchalí",
  };
  return map[slug] || slug;
}
