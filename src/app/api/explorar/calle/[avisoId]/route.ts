import { createServiceClient } from "@/lib/supabase/service";
import { francoMapStaticStyleParams } from "@/lib/map-styles";
import { imagenDeCalle } from "@/lib/explorar/calle-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/explorar/calle/<aviso> (28-oct-2026): la imagen de la tarjeta y de la lista. La foto de la calle de Street View
// (ese panorama, con la cámara hacia el aviso) si lo guardado lo permite; si no, el mapa estático chico con el pin en la
// cuadra. Se sirve desde Franco para que CADA IMAGEN QUEDE EN LA CACHÉ DEL CDN: se paga a Google una vez por aviso y no
// por cada persona que la ve. Sin sesión a propósito: sin cookies la respuesta se puede guardar, y lo que se sirve es la
// vista pública de una cuadra de un aviso que existe.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 30 días en el CDN (lo que Google deja guardar), 7 en el navegador. */
const CACHE = "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400";
/** El mapa por un rechazo de Google (nada guardado): cinco minutos, para que la foto aparezca apenas Google responda. */
const CACHE_SIN_DECIDIR = "public, max-age=300, s-maxage=300";

export async function GET(_req: Request, { params }: { params: { avisoId: string } }) {
  if (!UUID.test(params.avisoId)) return new Response(null, { status: 404 });
  const img = await imagenDeCalle(createServiceClient(), params.avisoId, francoMapStaticStyleParams("light")).catch(() => null);
  if (!img) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  const r = await fetch(img.url, { cache: "no-store", signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r || !r.ok || !(r.headers.get("content-type") ?? "").startsWith("image/")) return new Response(null, { status: 502, headers: { "Cache-Control": "no-store" } });
  return new Response(r.body, { status: 200, headers: { "Content-Type": r.headers.get("content-type") ?? "image/jpeg", "Cache-Control": img.guardada ? CACHE : CACHE_SIN_DECIDIR, "X-Calle": img.tipo } });
}
