import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = ReturnType<typeof createClient<any>>;

function getSupabase(): AnySupabase {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret) {
    console.error("CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  // Obtener propiedades sin geocodificar (batch de 30 para no hacer timeout)
  const { data: pending } = await supabase
    .from("scraped_properties")
    .select("id, url, comuna")
    .eq("geocoded", false)
    .eq("is_active", true)
    .not("url", "is", null)
    .limit(30);

  if (!pending || pending.length === 0) {
    return NextResponse.json({ success: true, geocoded: 0, message: "No pending properties" });
  }

  let geocoded = 0;
  let failed = 0;

  for (const prop of pending) {
    try {
      const response = await fetch(prop.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "es-CL,es;q=0.9",
        },
      });

      if (!response.ok) {
        failed++;
        continue;
      }

      const html = await response.text();
      let lat: number | null = null;
      let lng: number | null = null;

      // Estrategia 1: __NEXT_DATA__
      const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const pageProps = nextData?.props?.pageProps;

          // Ruta 1: PropertyState.detail
          const propertyState = pageProps?.initialReduxState?.PropertyState;
          if (propertyState?.detail?.latitud && propertyState?.detail?.longitud) {
            lat = parseFloat(propertyState.detail.latitud);
            lng = parseFloat(propertyState.detail.longitud);
          }

          // Ruta 2: pageProps.property
          if (!lat && pageProps?.property?.lat) {
            lat = parseFloat(pageProps.property.lat);
            lng = parseFloat(pageProps.property.lng || pageProps.property.lon);
          }

          // Ruta 3: búsqueda recursiva
          if (!lat) {
            const coords = findCoordinates(nextData);
            if (coords) {
              lat = coords.lat;
              lng = coords.lng;
            }
          }
        } catch {
          // JSON parse error
        }
      }

      // Estrategia 2: Meta tags / atributos con coordenadas
      if (!lat) {
        const latMatch = html.match(/(?:latitude|lat)"?\s*[:=]\s*"?(-?\d+\.\d+)/i);
        const lngMatch = html.match(/(?:longitude|lng|lon)"?\s*[:=]\s*"?(-?\d+\.\d+)/i);
        if (latMatch && lngMatch) {
          lat = parseFloat(latMatch[1]);
          lng = parseFloat(lngMatch[1]);
        }
      }

      // Estrategia 3: Google Maps embed URL
      if (!lat) {
        const mapsMatch = html.match(/maps.*?[@q=](-?\d+\.\d+),(-?\d+\.\d+)/);
        if (mapsMatch) {
          lat = parseFloat(mapsMatch[1]);
          lng = parseFloat(mapsMatch[2]);
        }
      }

      // Validar que las coordenadas son de Chile (lat entre -17 y -56, lng entre -66 y -76)
      if (lat && lng && lat < -17 && lat > -56 && lng < -66 && lng > -76) {
        await supabase
          .from("scraped_properties")
          .update({ lat, lng, geocoded: true })
          .eq("id", prop.id);
        geocoded++;
      } else {
        // Marcar como geocoded=true para no reintentar
        await supabase
          .from("scraped_properties")
          .update({ geocoded: true })
          .eq("id", prop.id);
        failed++;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    geocoded,
    failed,
    total: pending.length,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findCoordinates(obj: any, depth = 0): { lat: number; lng: number } | null {
  if (depth > 8 || !obj || typeof obj !== "object") return null;

  const latKeys = ["latitud", "latitude", "lat"];
  const lngKeys = ["longitud", "longitude", "lng", "lon"];

  for (const latKey of latKeys) {
    if (obj[latKey] !== undefined && obj[latKey] !== null && obj[latKey] !== "") {
      for (const lngKey of lngKeys) {
        if (obj[lngKey] !== undefined && obj[lngKey] !== null && obj[lngKey] !== "") {
          const lat = parseFloat(obj[latKey]);
          const lng = parseFloat(obj[lngKey]);
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            return { lat, lng };
          }
        }
      }
    }
  }

  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "object") {
      const result = findCoordinates(obj[key], depth + 1);
      if (result) return result;
    }
  }

  return null;
}
