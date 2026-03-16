const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Limpia el título de una publicación para extraer la dirección más geocodificable.
 * "Departamento, HOLANDA 1280" → "HOLANDA 1280, Las Condes"
 * "SE ARRIENDA AMPLIO DEPTO HOLANDA 3D" → "HOLANDA, Las Condes"
 * "Departamento en arriendo de 3 dorm. en Providencia" → null
 */
export function cleanAddressFromTitle(titulo: string, comuna: string): string | null {
  if (!titulo) return null;

  let clean = titulo;

  // Quitar prefijos comunes
  const prefixes = [
    /^departamento\s*,?\s*/i,
    /^depto\.?\s*,?\s*/i,
    /^dpto\.?\s*,?\s*/i,
    /^casa\s*,?\s*/i,
    /^\(adm\)\s*/i,
    /^se\s+arrienda\s*/i,
    /^se\s+vende\s*/i,
    /^arriendo\s*/i,
    /^venta\s*/i,
    /^amplio\s*(y\s+)?(acogedor\s+)?/i,
    /^exclusivo\s*,?\s*/i,
    /^hermoso\s*,?\s*/i,
    /^lindo\s*,?\s*/i,
    /^precioso\s*,?\s*/i,
    /^nuevo\s*,?\s*/i,
    /^c[ée]ntrico\s*/i,
    /^luminoso\s*/i,
    /^espectacular\s*/i,
    /^impecable\s*/i,
    /^moderno\s*/i,
  ];

  for (const prefix of prefixes) {
    clean = clean.replace(prefix, "");
  }

  // Quitar sufijos de características
  const suffixes = [
    /\d+\s*d(orm)?\.?\s*\d*\s*b(a[ñn]o)?\.?.*$/i,
    /\d+\s*dormitorio.*$/i,
    /\d+\s*hab(itacion)?.*$/i,
    /\d+\s*m[2²].*$/i,
    /\d+\s*estac(ionamiento)?.*$/i,
    /\+\s*bodega.*$/i,
    /\+\s*estac.*$/i,
    /mas\s+servicios.*$/i,
    /escritorio.*$/i,
    /amoblado.*$/i,
  ];

  for (const suffix of suffixes) {
    clean = clean.replace(suffix, "");
  }

  // Quitar paréntesis
  clean = clean.replace(/\([^)]*\)/g, "");

  // Quitar guiones al inicio/final
  clean = clean.replace(/^[\s\-–—]+|[\s\-–—]+$/g, "").trim();

  // Si lo que queda es muy corto o es solo la comuna, no sirve
  if (clean.length < 5) return null;
  if (clean.toLowerCase() === comuna.toLowerCase()) return null;
  if (clean.toLowerCase().includes("en " + comuna.toLowerCase()) && clean.length < 30) return null;

  // Quitar "en Providencia", "en Las Condes" del final
  clean = clean.replace(/\s+en\s+\w+(\s+\w+)?$/i, "").trim();

  if (clean.length < 3) return null;

  // Si tiene al menos un número o "Metro", es geocodificable
  if (/\d/.test(clean) || /metro/i.test(clean)) {
    return `${clean}, ${comuna}`;
  }

  // Nombre de calle sin número — aún geocodificable con contexto
  if (clean.length > 3) {
    return `${clean}, ${comuna}`;
  }

  return null;
}

interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export async function geocodeAddress(
  direccion: string,
  comuna: string
): Promise<GeocodingResult | null> {
  // Try Google Maps first, fallback to Nominatim
  if (GOOGLE_MAPS_API_KEY) {
    return geocodeWithGoogle(direccion, comuna);
  }
  return geocodeWithNominatim(direccion, comuna);
}

async function geocodeWithGoogle(
  direccion: string,
  comuna: string
): Promise<GeocodingResult | null> {
  const query = `${direccion}, ${comuna}, Santiago, Chile`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&region=cl`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results.length > 0) {
      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
      };
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
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=cl&limit=1`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Franco-refranco.ai" },
    });
    const data = await response.json();

    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        formattedAddress: data[0].display_name,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function geocodePendingProperties(batchSize: number = 50) {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: pending } = await supabase
    .from("scraped_properties")
    .select("id, direccion, comuna")
    .eq("geocoded", false)
    .eq("geocode_attempted", false)
    .eq("is_active", true)
    .not("direccion", "is", null)
    .limit(batchSize);

  if (!pending || pending.length === 0) return { geocoded: 0, total: 0, skipped: 0 };

  let geocoded = 0;
  let skipped = 0;
  for (const prop of pending) {
    // Limpiar título para obtener dirección geocodificable
    const cleanAddress = cleanAddressFromTitle(prop.direccion, prop.comuna);

    if (!cleanAddress) {
      // No tiene dirección geocodificable
      await supabase
        .from("scraped_properties")
        .update({ geocode_attempted: true })
        .eq("id", prop.id);
      skipped++;
      continue;
    }

    const result = await geocodeAddress(cleanAddress, prop.comuna);

    if (result) {
      await supabase
        .from("scraped_properties")
        .update({
          lat: result.lat,
          lng: result.lng,
          geocode_attempted: true,
        })
        .eq("id", prop.id);
      geocoded++;
    } else {
      // Geocoding failed — mark as attempted so we don't retry
      await supabase
        .from("scraped_properties")
        .update({ geocode_attempted: true })
        .eq("id", prop.id);
      skipped++;
    }

    // Rate limiting: conservative 5 req/sec for Google, 1 req/sec for Nominatim
    const delay = GOOGLE_MAPS_API_KEY ? 200 : 1100;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return { geocoded, total: pending.length, skipped };
}
