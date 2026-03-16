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

export const BATCH_SIZE = 2;
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

// ─── Listing + detail page approach (fallback: coords from detail pages) ───

const DETAIL_BATCH_SIZE = 10;

async function fetchCoordinates(url: string): Promise<{ lat: number; lng: number } | null> {
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

async function enrichWithCoordinates(
  properties: ScrapedProperty[],
  errors: string[]
): Promise<void> {
  const toEnrich = properties.filter(p => !p.lat && p.url);

  for (let i = 0; i < toEnrich.length; i += DETAIL_BATCH_SIZE) {
    const batch = toEnrich.slice(i, i + DETAIL_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (prop) => {
        try {
          return await fetchCoordinates(prop.url!);
        } catch {
          return null;
        }
      })
    );

    for (let j = 0; j < batch.length; j++) {
      if (results[j]) {
        batch[j].lat = results[j]!.lat;
        batch[j].lng = results[j]!.lng;
      }
    }

    // Rate limit between batches
    if (i + DETAIL_BATCH_SIZE < toEnrich.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const enriched = properties.filter(p => p.lat).length;
  const total = properties.length;
  if (enriched < total) {
    errors.push(`Coords: ${enriched}/${total} enriched`);
  }
}

export async function scrapeTocToc(
  type: "arriendo" | "venta" = "arriendo",
  comunas?: string[]
): Promise<ScraperResult> {
  const properties: ScrapedProperty[] = [];
  const errors: string[] = [];
  const targetComunas = comunas || COMUNAS_SANTIAGO;

  for (const comuna of targetComunas) {
    try {
      for (let page = 1; page <= 15; page++) {
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

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      errors.push(`TocToc ${comuna}: ${error}`);
    }
  }

  // Enrich properties with coordinates from detail pages
  await enrichWithCoordinates(properties, errors);

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
        if (precio === 0) continue;

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
        const sourceId = url || `toctoc-${comuna}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        properties.push({
          source: "toctoc",
          sourceId,
          type: type as "arriendo" | "venta",
          comuna: item.comuna || comuna,
          direccion,
          precio,
          moneda: precioCLP ? "CLP" : "UF",
          superficieM2,
          dormitorios,
          banos,
          url,
        });
      } catch {
        continue;
      }
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
