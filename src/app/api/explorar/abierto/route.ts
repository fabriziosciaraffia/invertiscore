import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { claveUniverso } from "@/lib/explorar/portal";
import { PIE_ABIERTO, PLAZO_ABIERTO, sinCifras } from "@/lib/explorar/abierto";
import { respuestaUniverso, universoCalculado, type RespuestaUniverso } from "@/lib/explorar/portal-servidor";
import { universoDeLaNocheCacheado } from "@/lib/explorar/portal-cache";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/explorar/abierto?m=ltr|str[&c=Ñuñoa] (29-oct-2026, la puerta E): el universo del mapa SIN CUENTA. Siempre con pie
// 20 % y 25 años (decisión de Fabrizio: sin cuenta, pie y plazo piden registro); la modalidad sí se elige.
//   · SIN CIFRAS: el flujo y el arriendo no viajan (abierto.ts › sinCifras). De ellos salen el flujo, el cap rate y la
//     cuota, que sin cuenta se ven borrosos con un relleno fijo.
//   · Arriendo tradicional: todo Gran Santiago, de la misma caché de diez minutos que con cuenta.
//   · Renta corta: de a una comuna (el navegador las pide de a una), calculada y guardada 24 horas como con cuenta.
// Es lo mismo para todos: la respuesta se guarda en el CDN diez minutos. Por eso es OTRA RUTA y no /api/explorar sin sesión:
// la de la cuenta trae las cifras y es privada.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COMUNAS_OK = new Set<string>(COMUNAS_DISPONIBLES as readonly string[]);
const CACHE = "public, max-age=300, s-maxage=600, stale-while-revalidate=600";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const modalidad = sp.get("m") === "str" ? "str" : "ltr";
  const q = { modalidad, pie: PIE_ABIERTO, plazo: PLAZO_ABIERTO } as const;
  try {
    if (modalidad === "ltr") {
      const u = await universoDeLaNocheCacheado(PIE_ABIERTO, PLAZO_ABIERTO);
      const r: RespuestaUniverso = { clave: claveUniverso(q), comunas: [], universo: sinCifras(u), calculados: 0, ms: 0 };
      return NextResponse.json(r, { headers: { "Cache-Control": CACHE } });
    }
    const comuna = (sp.get("c") ?? "").trim();
    if (!COMUNAS_OK.has(comuna)) return NextResponse.json({ error: "comunas" }, { status: 400 });
    const cuenta = { calculados: 0, ms: 0 };
    const pines = await universoCalculado(createServiceClient(), { ...q, comunas: [comuna] }, new Date(), cuenta);
    const r = respuestaUniverso(pines, { ...q, comunas: [comuna] }, cuenta);
    return NextResponse.json({ ...r, universo: sinCifras(r.universo) }, { headers: { "Cache-Control": CACHE } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/explorar/abierto", operacion: "universo", extra: { modalidad } });
    return NextResponse.json({ error: "interno" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
