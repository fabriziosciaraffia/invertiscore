import {
  precisionDeResultadoGoogle,
  precisionDeResultadoNominatim,
  type PrecisionUbicacion,
} from "@/lib/geocoding-precision";

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  /** "numero" = calle y número · "calle" = solo la calle (el punto es aproximado). */
  precision: PrecisionUbicacion;
}

/**
 * Geocodifica una dirección de una comuna. Devuelve null si lo que encontró NO es una calle:
 * antes se tomaba `results[0]` sin mirar qué era, y un texto como «asdf» volvía como el
 * centroide de la comuna (ver `geocoding-precision.ts`).
 */
export async function geocodeAddress(
  direccion: string,
  comuna: string
): Promise<GeocodingResult | null> {
  // La key se lee en cada llamada y no al cargar el módulo: así el tier WIZARD-DATOS puede
  // ejercitar los dos caminos.
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key) {
    return geocodeWithGoogle(direccion, comuna, key);
  }
  return geocodeWithNominatim(direccion, comuna);
}

async function geocodeWithGoogle(
  direccion: string,
  comuna: string,
  key: string
): Promise<GeocodingResult | null> {
  const query = `${direccion}, ${comuna}, Santiago, Chile`;
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
          formattedAddress: result.formatted_address,
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

async function geocodeWithNominatim(
  direccion: string,
  comuna: string
): Promise<GeocodingResult | null> {
  const query = `${direccion}, ${comuna}, Santiago, Chile`;
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
        formattedAddress: r.display_name,
        precision,
      };
    }
    return null;
  } catch {
    return null;
  }
}
