// ─────────────────────────────────────────────────────────────────────────────
// GET /api/landing/mapa-puntos — TODAS las coordenadas de avisos activos, para
// el mapa de la landing (canvas). ISR 24 h.
//
// Payload binario propio, sin depender de la compresión del transporte:
//   "FMP1" · uint32 n · luego n pares (dy, dx) en varint zigzag, con los puntos
//   cuantizados a uint16 dentro de la caja del mapa (paso ≈ 0,7 m) y ordenados
//   por (y, x), así los deltas son chicos: ~2 bytes por punto → ~100 KB para
//   44.000 avisos (el goal pide < 400 KB). El decodificador vive en
//   `src/components/landing-v14/mapa-puntos-codec.ts`, compartido con este
//   archivo para que codificar y decodificar no se desalineen.
//
// Lee `scraped_properties` paginada de a 1.000 (PostgREST capa la respuesta):
// 45 requests una vez al día, cuando revalida. Sin coordenadas o fuera de la
// caja, el aviso no entra; no se inventa nada.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/service";
import { captureApiWarning } from "@/lib/observabilidad";
import { codificarPuntos, CAJA_MAPA } from "@/components/landing-v14/mapa-puntos-codec";

export const revalidate = 86400;

export async function GET() {
  const sb = createServiceClient();
  const puntos: [number, number][] = [];
  try {
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await sb
        .from("scraped_properties")
        .select("lat, lng")
        .eq("is_active", true)
        .not("lat", "is", null)
        .order("id")
        .range(desde, desde + 999);
      if (error) throw error;
      for (const f of data ?? []) {
        const lat = Number(f.lat), lng = Number(f.lng);
        if (lat >= CAJA_MAPA.S && lat <= CAJA_MAPA.N && lng >= CAJA_MAPA.W && lng <= CAJA_MAPA.E) puntos.push([lat, lng]);
      }
      if (!data || data.length < 1000) break;
    }
  } catch (e) {
    captureApiWarning(e, { ruta: "GET /api/landing/mapa-puntos", operacion: "leer_puntos" });
    // Sin datos el mapa muestra calles, etiquetas y pin, sin puntos. Nunca 500.
    if (puntos.length === 0) {
      return new Response(cuerpo(codificarPuntos([])), { headers: cabeceras(0) });
    }
  }
  return new Response(cuerpo(codificarPuntos(puntos)), { headers: cabeceras(puntos.length) });
}

/** Un Uint8Array sobre ArrayBufferLike no tipa como BodyInit en TS 5.7+; el Blob sí. */
function cuerpo(bytes: Uint8Array<ArrayBuffer>): Blob {
  return new Blob([bytes], { type: "application/octet-stream" });
}

function cabeceras(n: number): HeadersInit {
  return {
    "content-type": "application/octet-stream",
    "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    "x-puntos": String(n),
  };
}
