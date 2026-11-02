import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import { negociablesCacheados } from "@/lib/explorar/portal-cache";
import { sinCifrasNegociados } from "@/lib/explorar/capa-negociar";
import { PIE_ABIERTO } from "@/lib/explorar/abierto";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/explorar/abierto/negociar (02-nov-2026, capa-negociar.ts): la capa «Si negocias el precio» SIN CUENTA, con el pie por
// defecto. Existe, y sus cifras van borrosas como el resto: el flujo (al publicado y al negociado) y el arriendo no viajan. Es lo
// mismo para todos: la respuesta se guarda en el CDN diez minutos, como /api/explorar/abierto.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
const CACHE = "public, max-age=300, s-maxage=600, stale-while-revalidate=600";

export async function GET() {
  try {
    return NextResponse.json({ pie: PIE_ABIERTO, negociados: sinCifrasNegociados(await negociablesCacheados(PIE_ABIERTO)) }, { headers: { "Cache-Control": CACHE } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/explorar/abierto/negociar", operacion: "capa" });
    return NextResponse.json({ error: "interno" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
