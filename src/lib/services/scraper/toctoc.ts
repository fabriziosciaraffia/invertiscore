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
  // puente-alto: ID no confirmado, se usa fallback __NEXT_DATA__
};

export const BATCH_SIZE = 1; // Reducido para diagnóstico de timeout (era 2)
export const TOTAL_BATCHES = Math.ceil(COMUNAS_SANTIAGO.length / BATCH_SIZE);

export function getComunasBatch(batch: number): string[] {
  const startIndex = (batch * BATCH_SIZE) % COMUNAS_SANTIAGO.length;
  return COMUNAS_SANTIAGO.slice(startIndex, startIndex + BATCH_SIZE);
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
};

async function getTocTocSession(): Promise<string> {
  const response = await fetch(
    "https://www.toctoc.com/resultados/mapa/arriendo/departamento/metropolitana/santiago/",
    { headers: { ...HEADERS, Accept: "text/html" } }
  );
  const cookies = (response.headers.getSetCookie?.() || []).map(c => c.split(";")[0]).join("; ");
  return cookies;
}

async function fetchMapProperties(
  comunaSlug: string,
  operacion: number,
  viewport: string,
  cookies: string
): Promise<unknown[] | null> {
  const body = {
    region: "metropolitana", comuna: comunaSlug, barrio: "", poi: "",
    tipoVista: "mapa", operacion, idPoligono: null, moneda: 2,
    precioDesde: 0, precioHasta: 0, dormitoriosDesde: 0, dormitoriosHasta: 0,
    banosDesde: 0, banosHasta: 0, tipoPropiedad: "departamento", estado: 0,
    disponibilidadEntrega: "", numeroDeDiasTocToc: 0,
    superficieDesdeUtil: 0, superficieHastaUtil: 0,
    superficieDesdeConstruida: 0, superficieHastaConstruida: 0,
    superficieDesdeTerraza: 0, superficieHastaTerraza: 0,
    superficieDesdeTerreno: 0, superficieHastaTerreno: 0,
    ordenarPor: 0, pagina: 1, paginaInterna: 1, zoom: 12, idZonaHomogenea: 0,
    busqueda: "", viewport, atributos: [], publicador: 0, temporalidad: 0,
    limite: 510, cargaBanner: false, primeraCarga: false, santander: false,
  };

  const typeSlug = operacion === 2 ? "arriendo" : "venta";
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
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await response.json() as any;
  return data?.resultados?.Propiedades || null;
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
    const dormitorios = arr[4] as number;
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

    // TODO[Fase5-audit]: remover este log tras validar empíricamente el contrato
    // TocToc con 5-10 propiedades reales. Ver auditoría 2026-04-30.
    // [TEMP-AUDIT-SUPERFICIE] Validación heurística Path B — remover tras confirmar
    console.log("[TocToc-map-audit]", {
      pos_27: arr[27],
      pos_28: arr[28],
      pos_33: arr[33],
      pos_34: arr[34],
      idProperty: arr[1],
    });

    // Surface: search positions 27-28, 33-34
    let superficieM2: number | undefined;
    for (const pos of [27, 28, 33, 34]) {
      const val = parseFloat(String(arr[pos]));
      if (val > 15 && val < 500) { superficieM2 = val; break; }
    }

    // URL: last elements often contain strings
    let url: string | undefined;
    for (let i = arr.length - 1; i >= arr.length - 8; i--) {
      if (typeof arr[i] === "string" && (arr[i] as string).startsWith("http")) {
        url = arr[i] as string; break;
      }
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
    };
  } catch {
    return null;
  }
}

export async function scrapeTocTocMap(
  type: "arriendo" | "venta" = "arriendo",
  comunas?: string[]
): Promise<ScraperResult> {
  const properties: ScrapedProperty[] = [];
  const errors: string[] = [];
  const operacion = type === "arriendo" ? 2 : 1;
  const targetComunas = comunas || Object.keys(COMUNA_VIEWPORTS);

  let cookies = "";
  try {
    cookies = await getTocTocSession();
  } catch (e) {
    errors.push(`Map session error: ${e}`);
    return { source: "toctoc-map", properties, errors, scrapedAt: new Date() };
  }

  for (const comunaSlug of targetComunas) {
    try {
      const viewport = COMUNA_VIEWPORTS[comunaSlug];
      if (!viewport) { errors.push(`No viewport for ${comunaSlug}`); continue; }

      const propArrays = await fetchMapProperties(comunaSlug, operacion, viewport, cookies);
      if (!propArrays || propArrays.length === 0) {
        errors.push(`Map API: no data for ${comunaSlug}`);
        continue;
      }

      for (const propArr of propArrays) {
        const prop = parseMapProperty(propArr as unknown[], comunaSlug, type);
        if (prop) properties.push(prop);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      errors.push(`Map ${comunaSlug}: ${error}`);
    }
  }

  return { source: "toctoc-map", properties, errors, scrapedAt: new Date() };
}

// ─── Coordinate extraction from detail pages ───

export async function fetchCoordinates(url: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(url, { headers: HEADERS });
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

    // TODO[Fase5-audit]: remover este log tras validar empíricamente el contrato
    // TocToc con 5-10 propiedades reales. Ver auditoría 2026-04-30.
    // [TEMP-AUDIT-SUPERFICIE] Validación contrato TocToc — remover tras confirmar
    console.log("[TocToc-superficie-audit]", {
      titulo: item.titulo?.substring(0, 60),
      superficie_array: item.superficie,
      longitud: Array.isArray(item.superficie) ? item.superficie.length : null,
      pos_0: item.superficie?.[0],
      pos_1: item.superficie?.[1],
      url: item.urlFicha,
    });

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
      { headers: HEADERS }
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

        const response = await fetch(apiUrl, {
          headers: {
            "User-Agent": HEADERS["User-Agent"],
            "Accept": "application/json",
            "Accept-Language": "es-CL,es;q=0.9",
            "Referer": `https://www.toctoc.com/${type}/departamento/metropolitana/${comunaSlug}`,
            "Cookie": cookies,
          },
        });

        if (!response.ok) {
          errors.push(`API ${comunaSlug} p${page}: ${response.status}`);
          break;
        }

        const data = await response.json() as { total: number; results: unknown[] };

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

        const response = await fetch(url, { headers: HEADERS });

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
