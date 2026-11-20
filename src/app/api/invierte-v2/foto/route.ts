import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { MAX_BYTES_FOTO, pedidoFoto, respuestaFotoValida } from "@/lib/invierte-v2/fotos";
import { sinEnlaceAlPortal } from "@/lib/invierte-v2/portal-servidor";
import { NO_EXISTE, personaConSesion } from "@/lib/invierte-v2/rutas";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invierte-v2/foto?aviso=<uuid>&i=<n> (entrega 3 de las láminas del 19-nov-2026): una foto de la publicación, pasada por
// Franco. Solo para quien firmó la orden (sin sesión o sin orden, 404): las fotos son de Invierte con Franco. La dirección de la
// fuente nunca llega al navegador. Sin la foto (no se leyó, la fuente no responde, no es una imagen o es demasiado pesada), 404:
// la tarjeta la saca y queda sin foto, sin hueco.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";

/** Una foto que la fuente ya borró (404 allá) o que no es imagen: un GIF transparente de 1 px, no un 404 (20-nov-2026). La tarjeta la
 *  reconoce por su tamaño y la salta, y la consola del navegador no se llena de errores por fotos que la publicación todavía nombra.
 *  Sin sesión, sin orden o con un pedido malo sigue siendo 404. */
const GIF_VACIO = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
const ROTA = () => new NextResponse(GIF_VACIO, { headers: { "Content-Type": "image/gif", "Cache-Control": "private, max-age=3600", "X-Foto": "rota" } });
export const maxDuration = 20;

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const p = pedidoFoto(q.get("aviso"), q.get("i"));
  if (!p) return NO_EXISTE();
  const user = await personaConSesion();
  if (!user) return NO_EXISTE();
  const admin = createServiceClient();
  // «Tiene una orden firmada» es la misma regla que la del portal (portal-servidor.ts).
  if (!(await sinEnlaceAlPortal(admin, user.id))) return NO_EXISTE();
  const { data } = await admin.from("publicacion_detalle").select("fotos").eq("aviso_id", p.avisoId).maybeSingle();
  const url = ((data?.fotos as string[] | null) ?? [])[p.i];
  if (!url || !/^https:\/\//.test(url)) return ROTA();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: "follow" });
    const tipo = r.headers.get("content-type");
    const largo = r.headers.get("content-length") ? Number(r.headers.get("content-length")) : null;
    if (!r.ok || !respuestaFotoValida(tipo, largo)) return ROTA();
    const cuerpo = await r.arrayBuffer();
    if (cuerpo.byteLength > MAX_BYTES_FOTO) return ROTA();
    return new NextResponse(cuerpo, { headers: { "Content-Type": tipo!, "Cache-Control": "private, max-age=86400" } });
  } catch {
    return ROTA();
  }
}
