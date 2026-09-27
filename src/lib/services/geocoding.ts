import {
  comunaDeComponentes,
  precisionDeResultadoGoogle,
  precisionDeResultadoNominatim,
  type PrecisionUbicacion,
  sinCodigoPostal,
} from "@/lib/geocoding-precision";

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  /** "numero" = calle y número · "calle" = solo la calle (el punto es aproximado). */
  precision: PrecisionUbicacion;
}

export interface ReverseGeocodingResult {
  /** La dirección más cercana al punto, canónica. */
  direccion: string;
  /** Comuna cruda, sin normalizar contra el listado (eso lo hace quien llama). */
  comunaRaw: string;
  precision: PrecisionUbicacion;
}

/**
 * Geocodifica una dirección (de una comuna, si se sabe). Devuelve null si lo que encontró NO es
 * una calle: antes se tomaba `results[0]` sin mirar qué era, y un texto como «asdf» volvía como el
 * centroide de la comuna (ver `geocoding-precision.ts`).
 *
 * La comuna es opcional desde el 26-sep-2026: el campo del hero no la tiene (la dirección la
 * deduce), y exigirla dejaba al respaldo por texto de la landing en un 400.
 */
export async function geocodeAddress(
  direccion: string,
  comuna?: string | null
): Promise<GeocodingResult | null> {
  // La key se lee en cada llamada y no al cargar el módulo: así el tier WIZARD-DATOS puede
  // ejercitar los dos caminos.
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const query = [direccion, comuna, "Santiago, Chile"].filter((x) => x && String(x).trim()).join(", ");
  if (key) {
    return geocodeWithGoogle(query, key);
  }
  return geocodeWithNominatim(query);
}

/**
 * Coordenadas → la dirección más cercana (geocodificación inversa). La usa la pantalla del mapa
 * para nombrar el punto que el usuario marcó y deducir su comuna. Null si cerca del punto no hay
 * una calle que nombrar.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodingResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key) return reverseWithGoogle(lat, lng, key);
  return reverseWithNominatim(lat, lng);
}

async function geocodeWithGoogle(query: string, key: string): Promise<GeocodingResult | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${key}&region=cl`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results.length > 0) {
      // El primer resultado que SEA una calle; uno de área (comuna, región) no cuenta.
      for (const result of data.results) {
        const precision = precisionDeResultadoGoogle(result);
        if (!precision) continue;
        return {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          formattedAddress: sinCodigoPostal(result.formatted_address),
          precision,
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Google geocoding error:", error);
    return null;
  }
}

async function geocodeWithNominatim(query: string): Promise<GeocodingResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(query)}&countrycodes=cl&limit=5`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Franco-refranco.ai" },
    });
    const data = await response.json();

    for (const r of Array.isArray(data) ? data : []) {
      const precision = precisionDeResultadoNominatim(r);
      if (!precision) continue;
      return {
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        formattedAddress: sinCodigoPostal(r.display_name),
        precision,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function reverseWithGoogle(lat: number, lng: number, key: string): Promise<ReverseGeocodingResult | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}&language=es&result_type=street_address|premise|route`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.status !== "OK" || !Array.isArray(data.results)) return null;
    for (const result of data.results) {
      const precision = precisionDeResultadoGoogle(result);
      if (!precision) continue;
      return { direccion: sinCodigoPostal(result.formatted_address), comunaRaw: comunaDeComponentes(result.address_components), precision };
    }
    return null;
  } catch (error) {
    console.error("Google reverse geocoding error:", error);
    return null;
  }
}

async function reverseWithNominatim(lat: number, lng: number): Promise<ReverseGeocodingResult | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lng}`;
  try {
    const response = await fetch(url, { headers: { "User-Agent": "Franco-refranco.ai" } });
    const r = await response.json();
    const precision = precisionDeResultadoNominatim(r);
    if (!precision) return null;
    const ad = (r?.address ?? {}) as Record<string, string>;
    return {
      direccion: sinCodigoPostal(r.display_name),
      comunaRaw: ad.city || ad.town || ad.municipality || ad.suburb || "",
      precision,
    };
  } catch {
    return null;
  }
}
