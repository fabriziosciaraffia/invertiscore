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

const COMUNAS_SANTIAGO = [
  "santiago", "providencia", "las-condes", "nunoa", "la-florida",
  "vitacura", "lo-barnechea", "san-miguel", "macul", "penalolen",
  "la-reina", "estacion-central", "independencia", "recoleta",
  "maipu", "puente-alto", "san-joaquin", "quinta-normal", "conchali",
];

export async function scrapeTocToc(type: "arriendo" | "venta" = "arriendo") {
  const properties: ScrapedProperty[] = [];
  const errors: string[] = [];

  for (const comuna of COMUNAS_SANTIAGO) {
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

  // ESTRATEGIA 1: JSON-LD (Schema.org)
  const jsonLdRegex = /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (["Apartment", "Residence", "Product", "RealEstateListing"].includes(item["@type"])) {
          const prop = extractFromJsonLD(item, comuna, type);
          if (prop) properties.push(prop);
        }
        if (item["@type"] === "ItemList" && item.itemListElement) {
          for (const listItem of item.itemListElement) {
            const innerItem = listItem.item || listItem;
            const prop = extractFromJsonLD(innerItem, comuna, type);
            if (prop) properties.push(prop);
          }
        }
      }
    } catch {
      // JSON parse error, skip
    }
  }

  // ESTRATEGIA 2: Regex fallback
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

  return properties;
}

function extractFromJsonLD(item: Record<string, unknown>, comuna: string, type: string): ScrapedProperty | null {
  try {
    const offers = item.offers as Record<string, unknown> | undefined;
    const precio = offers?.price || item.price;
    if (!precio) return null;

    let lat: number | undefined;
    let lng: number | undefined;

    const geo = item.geo as Record<string, unknown> | undefined;
    const location = item.location as Record<string, unknown> | undefined;
    const contentLocation = item.contentLocation as Record<string, unknown> | undefined;

    if (geo) {
      lat = parseFloat(String(geo.latitude));
      lng = parseFloat(String(geo.longitude));
    } else if (location?.geo) {
      const locGeo = location.geo as Record<string, unknown>;
      lat = parseFloat(String(locGeo.latitude));
      lng = parseFloat(String(locGeo.longitude));
    } else if (contentLocation?.geo) {
      const clGeo = contentLocation.geo as Record<string, unknown>;
      lat = parseFloat(String(clGeo.latitude));
      lng = parseFloat(String(clGeo.longitude));
    }

    let direccion: string | undefined;
    const address = item.address as string | Record<string, unknown> | undefined;
    if (address) {
      direccion = typeof address === "string"
        ? address
        : (address.streetAddress as string) || (address.name as string);
    } else if (location?.address) {
      const locAddr = location.address as string | Record<string, unknown>;
      direccion = typeof locAddr === "string"
        ? locAddr
        : (locAddr.streetAddress as string);
    }

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
