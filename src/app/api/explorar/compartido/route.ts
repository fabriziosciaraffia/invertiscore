import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import { fichaCompartidaCacheada } from "@/lib/explorar/compartir-servidor";
import { esAvisoId } from "@/lib/explorar/enlace-compartido";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/explorar/compartido?a=<aviso>[&m=str] (02-nov-2026, goal «Compartir un depto desde Explorar»): cómo está un aviso
// con el financiamiento por defecto (pie 20 %, 30 años, la tasa de hoy) —«comprar» con su puntaje, «no-da» o
// «despublicado»—, lo mismo que ve quien abre un enlace compartido y que dice la vista previa. La pide la tarjeta de quien
// mira con OTRO pie, plazo o tasa, apenas se abre, para que el texto que comparte diga el veredicto de por defecto y no el
// suyo (compartir.ts › textoCompartir). Es lo mismo para todos y no trae nada de la persona: diez minutos en el CDN.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const CACHE = "public, max-age=300, s-maxage=600, stale-while-revalidate=600";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const a = sp.get("a");
  if (!esAvisoId(a)) return NextResponse.json({ error: "aviso" }, { status: 400 });
  const modalidad = sp.get("m") === "str" ? "str" : "ltr";
  try {
    const f = await fichaCompartidaCacheada(a, modalidad);
    if (!f) return NextResponse.json({ error: "no-existe" }, { status: 404, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
    return NextResponse.json({ estado: f.estado, score: f.score }, { headers: { "Cache-Control": CACHE } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/explorar/compartido", operacion: "ficha", extra: { modalidad } });
    return NextResponse.json({ error: "interno" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
