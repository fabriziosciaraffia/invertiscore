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

export const BATCH_SIZE = 3;
export const TOTAL_BATCHES = Math.ceil(COMUNAS_SANTIAGO.length / BATCH_SIZE);

export function getComunasBatch(batch: number): string[] {
  const startIndex = (batch * BATCH_SIZE) % COMUNAS_SANTIAGO.length;
  return COMUNAS_SANTIAGO.slice(startIndex, startIndex + BATCH_SIZE);
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
      for (let page = 1; page <= 3; page++) {
        const url = `https://www.toctoc.com/${type}/departamento/metropolitana/${comuna}?pagina=${page}`;

        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "es-CL,es;q=0.9",
          },
        });

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

  return { source: "toctoc", properties, errors, scrapedAt: new Date() };
}

function parseTocTocHTML(html: string, comunaSlug: string, type: string): ScrapedProperty[] {
  const properties: ScrapedProperty[] = [];
  const comuna = formatComuna(comunaSlug);

  // Extraer __NEXT_DATA__ — TocToc es una app Next.js con todos los datos ahí
  const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!nextDataMatch) {
    return properties;
  }

  try {
    const nextData = JSON.parse(nextDataMatch[1]);
    const results = nextData?.props?.pageProps?.initialReduxState?.PropertyState?.results;

    if (!results || !Array.isArray(results)) {
      return properties;
    }

    for (const item of results) {
      try {
        // Extraer precio: preferir CLP, fallback UF
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

        // Superficie (primer valor = útil)
        let superficieM2: number | undefined;
        if (item.superficie && Array.isArray(item.superficie) && item.superficie[0]) {
          superficieM2 = parseInt(String(item.superficie[0]));
          if (isNaN(superficieM2) || superficieM2 <= 0) superficieM2 = undefined;
        }

        // Dormitorios
        let dormitorios: number | undefined;
        if (item.dormitorios && Array.isArray(item.dormitorios) && item.dormitorios[0]) {
          dormitorios = parseInt(String(item.dormitorios[0]));
          if (isNaN(dormitorios)) dormitorios = undefined;
        }

        // Baños (TocToc usa "bannos" con doble n)
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
