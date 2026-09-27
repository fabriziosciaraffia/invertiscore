import { NextResponse } from "next/server";
import { geocodeAddress, reverseGeocode } from "@/lib/services/geocoding";
import { COMUNAS } from "@/lib/comunas";
import { isComunaDisponible } from "@/lib/comunas-disponibles";

/**
 * Dos preguntas, un endpoint:
 *  · `?q=…[&comuna=…]` — dirección → coordenadas (el respaldo por texto del campo). La comuna es
 *    opcional: el campo del hero no la tiene.
 *  · `?lat=…&lng=…` — coordenadas → la dirección más cercana, con su comuna ya normalizada y si
 *    está cubierta. La usa la pantalla del mapa (26-sep-2026) para nombrar el punto que el usuario
 *    marcó, venga de «sin número», de la ubicación del teléfono o de marcarlo a mano.
 * Las dos devuelven nulos cuando lo que encuentran no es una calle (`geocoding-precision.ts`).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.has("lat") || searchParams.has("lng")) {
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }
    const r = await reverseGeocode(lat, lng);
    if (!r) return NextResponse.json({ direccion: null });
    const match = COMUNAS.find((c) => c.comuna.toLowerCase() === r.comunaRaw.toLowerCase());
    const comuna = match?.comuna || r.comunaRaw;
    return NextResponse.json({
      direccion: r.direccion,
      comuna,
      ciudad: match?.ciudad || "Santiago",
      cubierta: !!comuna && isComunaDisponible(comuna),
      precision: r.precision,
    });
  }

  const q = searchParams.get("q");
  if (!q) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  const result = await geocodeAddress(q, searchParams.get("comuna"));
  return NextResponse.json(result || { lat: null, lng: null });
}
