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
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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

  // ESTRATEGIA 1: Extraer datos base del JSON-LD
  const jsonLdRegex = /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let match;
  const baseProperties: Map<string, Partial<ScrapedProperty>> = new Map();

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);

      // TocToc SearchResultsPage con about anidado: about puede ser [[{...}]]
      if (data["@type"] === "SearchResultsPage" && data.about) {
        const items = Array.isArray(data.about)
          ? data.about.flat(2)
          : [data.about];

        for (const item of items) {
          if (!item || !item["@type"]) continue;
          if (["Apartment", "House", "Residence", "SingleFamilyResidence"].includes(item["@type"])) {
            const id = item["@id"] || item.url || `toctoc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

            baseProperties.set(id, {
              source: "toctoc",
              sourceId: id,
              type: type as "arriendo" | "venta",
              comuna,
              direccion: extractAddress(item),
              lat: extractLat(item),
              lng: extractLng(item),
              dormitorios: item.numberOfBedrooms ? parseInt(item.numberOfBedrooms) : undefined,
              banos: item.numberOfBathroomsTotal ? parseInt(item.numberOfBathroomsTotal) : undefined,
              url: item.url ? (item.url.startsWith("http") ? item.url : `https://www.toctoc.com${item.url}`) : undefined,
            });
          }
        }
      }

      // ItemList format
      if (data["@type"] === "ItemList" && data.itemListElement) {
        for (const listItem of data.itemListElement) {
          const innerItem = listItem.item || listItem;
          const prop = extractFromJsonLD(innerItem, comuna, type);
          if (prop) properties.push(prop);
        }
      }

      // Direct property types with price (old behavior)
      if (["Apartment", "Residence", "Product", "RealEstateListing"].includes(data["@type"])) {
        const prop = extractFromJsonLD(data, comuna, type);
        if (prop) properties.push(prop);
      }

      // Array of items
      if (Array.isArray(data)) {
        for (const item of data.flat(2)) {
          if (item && ["Apartment", "House", "Residence", "SingleFamilyResidence"].includes(item["@type"])) {
            const id = item["@id"] || item.url || `toctoc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            baseProperties.set(id, {
              source: "toctoc",
              sourceId: id,
              type: type as "arriendo" | "venta",
              comuna,
              dormitorios: item.numberOfBedrooms ? parseInt(item.numberOfBedrooms) : undefined,
              banos: item.numberOfBathroomsTotal ? parseInt(item.numberOfBathroomsTotal) : undefined,
              url: item.url,
            });
          }
        }
      }
    } catch {
      // JSON parse error, skip
    }
  }

  // Si ya extrajimos propiedades completas (con precio) del JSON-LD, retornar
  if (properties.length > 0) return properties;

  // ESTRATEGIA 2: Extraer precios y superficie del HTML y asociar con JSON-LD
  // Buscar bloques con link a propiedad + precio + superficie
  const propertyBlockPattern = /href="(\/propiedades\/[^"]*)"[\s\S]*?(?:\$\s*([\d.]+(?:\.\d{3})*)|UF\s*([\d.,]+))[\s\S]*?(\d+)\s*m²/gi;
  let blockMatch;

  while ((blockMatch = propertyBlockPattern.exec(html)) !== null) {
    const url = `https://www.toctoc.com${blockMatch[1]}`;
    const precioCLP = blockMatch[2] ? parseInt(blockMatch[2].replace(/\./g, "")) : null;
    const precioUF = blockMatch[3] ? parseFloat(blockMatch[3].replace(/\./g, "").replace(",", ".")) : null;
    const superficie = parseInt(blockMatch[4]);

    const precio = precioCLP || precioUF || 0;
    if (precio === 0) continue;

    // Buscar datos base del JSON-LD para esta propiedad
    let existingBase: Partial<ScrapedProperty> | undefined;
    const urlSlug = blockMatch[1].split("/").pop() || "____";
    const entries = Array.from(baseProperties.entries());
    for (const [id, base] of entries) {
      if (base.url && base.url.includes(urlSlug)) {
        existingBase = base;
        baseProperties.delete(id);
        break;
      }
    }

    properties.push({
      source: "toctoc",
      sourceId: existingBase?.sourceId || url,
      type: type as "arriendo" | "venta",
      comuna,
      direccion: existingBase?.direccion,
      lat: existingBase?.lat,
      lng: existingBase?.lng,
      precio,
      moneda: precioCLP ? "CLP" : "UF",
      superficieM2: superficie,
      dormitorios: existingBase?.dormitorios,
      banos: existingBase?.banos,
      url,
    });
  }

  // ESTRATEGIA 3: Regex fallback genérico (departamento links)
  if (properties.length === 0) {
    const cardPattern = /href="(\/[^"]*departamento[^"]*)"[\s\S]*?(?:UF\s*([\d.,]+)|\$\s*([\d.,]+))[\s\S]*?(\d+)\s*m²[\s\S]*?(\d+)\s*dorm/gi;
    let cardMatch;

    while ((cardMatch = cardPattern.exec(html)) !== null) {
      const precioUF = cardMatch[2] ? parseFloat(cardMatch[2].replace(/\./g, "").replace(",", ".")) : null;
      const precioCLP = cardMatch[3] ? parseFloat(cardMatch[3].replace(/\./g, "").replace(",", ".")) : null;

      properties.push({
        source: "toctoc",
        sourceId: `toctoc-${cardMatch[1]}`,
        type: type as "arriendo" | "venta",
        comuna,
        precio: precioCLP || (precioUF ? precioUF : 0),
        moneda: precioCLP ? "CLP" : "UF",
        superficieM2: parseInt(cardMatch[4]),
        dormitorios: parseInt(cardMatch[5]),
        url: `https://www.toctoc.com${cardMatch[1]}`,
      });
    }
  }

  // ESTRATEGIA 4: Si tenemos datos del JSON-LD pero no pudimos asociar precios,
  // extraer precios y superficies sueltos del HTML y asociar por orden
  if (properties.length === 0 && baseProperties.size > 0) {
    const allPrices: Array<{ value: number; moneda: "CLP" | "UF" }> = [];

    const clpPriceRegex = /\$\s*([\d.]+(?:\.\d{3})+)/g;
    let priceMatch;
    while ((priceMatch = clpPriceRegex.exec(html)) !== null) {
      const val = parseInt(priceMatch[1].replace(/\./g, ""));
      if (val > 50000 && val < 10000000) {
        allPrices.push({ value: val, moneda: "CLP" });
      }
    }

    const ufPriceRegex = /UF\s*([\d.,]+)/gi;
    if (allPrices.length === 0) {
      while ((priceMatch = ufPriceRegex.exec(html)) !== null) {
        const val = parseFloat(priceMatch[1].replace(/\./g, "").replace(",", "."));
        if (val > 1 && val < 50000) {
          allPrices.push({ value: val, moneda: "UF" });
        }
      }
    }

    const surfacePattern = /(\d+)\s*m²/gi;
    const allSurfaces: number[] = [];
    let surfMatch;
    while ((surfMatch = surfacePattern.exec(html)) !== null) {
      const val = parseInt(surfMatch[1]);
      if (val > 15 && val < 500) {
        allSurfaces.push(val);
      }
    }

    let i = 0;
    for (const [id, base] of Array.from(baseProperties.entries())) {
      if (i < allPrices.length) {
        properties.push({
          source: "toctoc",
          sourceId: base.sourceId || id,
          type: type as "arriendo" | "venta",
          comuna,
          direccion: base.direccion,
          lat: base.lat,
          lng: base.lng,
          precio: allPrices[i].value,
          moneda: allPrices[i].moneda,
          superficieM2: i < allSurfaces.length ? allSurfaces[i] : undefined,
          dormitorios: base.dormitorios,
          banos: base.banos,
          url: base.url,
        });
        i++;
      }
    }
  }

  return properties;
}

function extractAddress(item: Record<string, unknown>): string | undefined {
  const address = item.address as string | Record<string, unknown> | undefined;
  if (!address) return undefined;
  if (typeof address === "string") return address;
  return (address.streetAddress as string) || (address.name as string) ||
    [address.addressLocality, address.addressRegion].filter(Boolean).join(", ");
}

function extractLat(item: Record<string, unknown>): number | undefined {
  const geo = item.geo as Record<string, unknown> | undefined;
  const location = item.location as Record<string, unknown> | undefined;
  const contentLocation = item.contentLocation as Record<string, unknown> | undefined;
  const lat = geo?.latitude ||
    (location?.geo as Record<string, unknown> | undefined)?.latitude ||
    (contentLocation?.geo as Record<string, unknown> | undefined)?.latitude;
  return lat ? parseFloat(String(lat)) : undefined;
}

function extractLng(item: Record<string, unknown>): number | undefined {
  const geo = item.geo as Record<string, unknown> | undefined;
  const location = item.location as Record<string, unknown> | undefined;
  const contentLocation = item.contentLocation as Record<string, unknown> | undefined;
  const lng = geo?.longitude ||
    (location?.geo as Record<string, unknown> | undefined)?.longitude ||
    (contentLocation?.geo as Record<string, unknown> | undefined)?.longitude;
  return lng ? parseFloat(String(lng)) : undefined;
}

function extractFromJsonLD(item: Record<string, unknown>, comuna: string, type: string): ScrapedProperty | null {
  try {
    const offers = item.offers as Record<string, unknown> | undefined;
    const precio = offers?.price || item.price;
    if (!precio) return null;

    const lat = extractLat(item);
    const lng = extractLng(item);
    const direccion = extractAddress(item);

    let gastosComunes: number | undefined;
    const additionalProperty = item.additionalProperty as Array<Record<string, unknown>> | undefined;
    if (additionalProperty) {
      const ggccProp = additionalProperty.find(
        (p) => String(p.name || "").toLowerCase().includes("gasto") || String(p.name || "").toLowerCase().includes("comun")
      );
      if (ggccProp) gastosComunes = parseFloat(String(ggccProp.value));
    }

    const priceCurrency = String(offers?.priceCurrency || item.priceCurrency || "CLP");

    return {
      source: "toctoc",
      sourceId: String(item["@id"] || item.url || `toctoc-${Date.now()}-${Math.random().toString(36).slice(2)}`),
      type: type as "arriendo" | "venta",
      comuna,
      direccion,
      lat: lat && !isNaN(lat) ? lat : undefined,
      lng: lng && !isNaN(lng) ? lng : undefined,
      precio: parseFloat(String(precio).replace(/\./g, "").replace(",", ".")),
      moneda: priceCurrency === "CLF" ? "UF" : "CLP",
      superficieM2: (item.floorSize as Record<string, unknown>)?.value
        ? parseFloat(String((item.floorSize as Record<string, unknown>).value))
        : undefined,
      dormitorios: item.numberOfRooms ? parseInt(String(item.numberOfRooms)) : undefined,
      banos: item.numberOfBathroomsTotal ? parseInt(String(item.numberOfBathroomsTotal)) : undefined,
      gastosComunes,
      url: item.url
        ? (String(item.url).startsWith("http") ? String(item.url) : `https://www.toctoc.com${item.url}`)
        : undefined,
    };
  } catch {
    return null;
  }
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
