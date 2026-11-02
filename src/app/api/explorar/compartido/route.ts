import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import { createServiceClient } from "@/lib/supabase/service";
import { fichaCompartida, fichaCompartidaCacheada } from "@/lib/explorar/compartir-servidor";
import { segunLaNoche } from "@/lib/explorar/negociado-hoy";
import { esAvisoId } from "@/lib/explorar/enlace-compartido";
import { esTopeNegociar } from "@/lib/explorar/capa-negociar";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/explorar/compartido?a=<aviso>[&m=str] (02-nov-2026, goal «Compartir un depto desde Explorar»): cómo está un aviso
// con el financiamiento por defecto (pie 20 %, 30 años, la tasa de hoy) —«comprar» con su puntaje, «no-da» o
// «despublicado»—, lo mismo que ve quien abre un enlace compartido y que dice la vista previa. La pide la tarjeta de quien
// mira con OTRO pie, plazo o tasa, apenas se abre, para que el texto que comparte diga el veredicto de por defecto y no el
// suyo (compartir.ts › textoCompartir). Es lo mismo para todos y no trae nada de la persona: diez minutos en el CDN.
// CON `n=<tope>` (03-nov-2026, un negociado de la capa «Si negocias»): si no da Comprar, «negociado» con su precio negociado y su
// descuento —los de la noche, como el texto de quien comparte con cuenta, que los saca del pin: sin la verificación de hoy,
// que lee comparables y haría esperar a la hoja del sistema (negociado-hoy.ts › segunLaNoche)—, o «no-llega» si su descuento
// no cabe en el tope. La pide también quien comparte SIN CUENTA un negociado (su precio no viajó al navegador): es el precio
// que dice la vista previa del enlace, que es pública.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const CACHE = "public, max-age=300, s-maxage=600, stale-while-revalidate=600";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const a = sp.get("a");
  if (!esAvisoId(a)) return NextResponse.json({ error: "aviso" }, { status: 400 });
  const modalidad = sp.get("m") === "str" ? "str" : "ltr";
  const tope = esTopeNegociar(sp.get("n")) ? Number(sp.get("n")) : null;
  try {
    const f = tope != null && modalidad === "ltr"
      ? await fichaCompartida(createServiceClient(), a, "ltr", { veredicto: true, tope, verificar: segunLaNoche })
      : await fichaCompartidaCacheada(a, modalidad);
    if (!f) return NextResponse.json({ error: "no-existe" }, { status: 404, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
    const neg = f.estado === "negociado" && f.neg ? { p: f.neg.p, d: f.neg.d } : null;
    return NextResponse.json({ estado: f.estado, score: f.score, neg }, { headers: { "Cache-Control": CACHE } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/explorar/compartido", operacion: "ficha", extra: { modalidad } });
    return NextResponse.json({ error: "interno" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
