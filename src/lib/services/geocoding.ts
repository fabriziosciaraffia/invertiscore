const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

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
    .eq("is_active", true)
    .not("direccion", "is", null)
    .limit(batchSize);

  if (!pending || pending.length === 0) return { geocoded: 0, total: 0 };

  let geocoded = 0;
  for (const prop of pending) {
    const result = await geocodeAddress(prop.direccion, prop.comuna);

    if (result) {
      await supabase
        .from("scraped_properties")
        .update({
          lat: result.lat,
          lng: result.lng,
          direccion: result.formattedAddress,
        })
        .eq("id", prop.id);

      geocoded++;
    }

    // Rate limiting: conservative 5 req/sec for Google, 1 req/sec for Nominatim
    const delay = GOOGLE_MAPS_API_KEY ? 200 : 1100;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return { geocoded, total: pending.length };
}
