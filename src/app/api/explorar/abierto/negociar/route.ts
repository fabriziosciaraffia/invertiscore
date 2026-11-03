import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import { nocheExplorar } from "@/lib/explorar/portal-cache";
import { sinCifrasNegociados } from "@/lib/explorar/capa-negociar";
import { PIE_ABIERTO, PLAZO_ABIERTO } from "@/lib/explorar/abierto";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/explorar/abierto/negociar[?s=sello] (02-nov-2026, capa-negociar.ts): la capa «Si negocias el precio» SIN CUENTA, con el pie
// por defecto. Existe, y sus cifras van borrosas como el resto: el flujo (al publicado y al negociado) y el arriendo no viajan. Es lo
// mismo para todos: la respuesta se guarda en el CDN diez minutos, como /api/explorar/abierto, por URL —cada sello, una entrada—.
// Desde el 03-nov-2026, de la noche del sello que trae el pedido (portal-cache.ts › nocheExplorar): la misma que contó la página.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
const CACHE = "public, max-age=300, s-maxage=600, stale-while-revalidate=600";

export async function GET(request: Request) {
  try {
    const noche = await nocheExplorar(PIE_ABIERTO, PLAZO_ABIERTO, new URL(request.url).searchParams.get("s"));
    // La capa se leyó con el universo y falló dos veces: el navegador sigue sin ella (con este sello no hay otra).
    if (!noche.negociados) return NextResponse.json({ error: "capa" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ pie: PIE_ABIERTO, negociados: sinCifrasNegociados(noche.negociados), sello: noche.sello }, { headers: { "Cache-Control": CACHE } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/explorar/abierto/negociar", operacion: "capa" });
    return NextResponse.json({ error: "interno" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
