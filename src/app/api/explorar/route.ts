import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { PIES_EXPLORAR, PLAZOS_EXPLORAR } from "@/lib/explorar/explorar";
import { claveUniverso, universoDeLaNoche as esDeLaNoche } from "@/lib/explorar/portal";
import { respuestaUniverso, universoCalculado, type RespuestaUniverso } from "@/lib/explorar/portal-servidor";
import { universoDeLaNocheCacheado } from "@/lib/explorar/portal-cache";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/explorar?m=ltr&p=20&z=25[&c=Ñuñoa] (28-oct-2026, Explorar como portal): el universo del mapa para una modalidad,
// un pie y un plazo, compacto (portal.ts › UniversoCompacto). Los filtros de comuna, tipología, precio, flujo, fecha y zona
// se aplican en el navegador, al instante.
//   · Arriendo tradicional con un pie y un plazo de la noche: TODO Gran Santiago, de la caché de diez minutos (es el mismo
//     para todos). `c` no se mira.
//   · Cualquier otro pie o plazo, o renta corta: las comunas de `c` (el navegador las pide de a una, para ir mostrando),
//     calculadas en el momento y guardadas 24 horas.
// Solo con sesión. NO ESCRIBE NADA de la persona —explorar no toca el perfil ni gasta—; lo calculado queda en `combos`.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
// Una comuna grande en una combinación nueva (Santiago, ~6.000 avisos) se calculó en 9 s en producción (24-oct-2026).
export const maxDuration = 60;

const COMUNAS_OK = new Set<string>(COMUNAS_DISPONIBLES as readonly string[]);
/** Comunas por pedido en una combinación calculada (el navegador pide de a una). */
const MAX_COMUNAS_POR_PEDIDO = 3;

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  const modalidad = sp.get("m") === "str" ? "str" : "ltr";
  const pie = Number(sp.get("p") ?? 20), plazo = Number(sp.get("z") ?? 25);
  if (!(PIES_EXPLORAR as readonly number[]).includes(pie) || !(PLAZOS_EXPLORAR as readonly number[]).includes(plazo)) return NextResponse.json({ error: "combinacion" }, { status: 400 });
  const q = { modalidad, pie, plazo } as const;
  try {
    if (esDeLaNoche(q)) {
      const u = await universoDeLaNocheCacheado(pie, plazo);
      // La misma forma que lo calculado (RespuestaUniverso): el universo va en `universo`, con su propia tabla de comunas.
      const r: RespuestaUniverso = { clave: claveUniverso(q), comunas: [], universo: u, calculados: 0, ms: 0 };
      return NextResponse.json(r, { headers: { "Cache-Control": "private, max-age=300" } });
    }
    const comunas = Array.from(new Set((sp.get("c") ?? "").split(",").map((x) => x.trim()).filter((c) => COMUNAS_OK.has(c))));
    if (comunas.length === 0 || comunas.length > MAX_COMUNAS_POR_PEDIDO) return NextResponse.json({ error: "comunas" }, { status: 400 });
    const admin = createServiceClient();
    const cuenta = { calculados: 0, ms: 0 };
    const pines = await universoCalculado(admin, { ...q, comunas }, new Date(), cuenta);
    return NextResponse.json(respuestaUniverso(pines, { ...q, comunas }, cuenta), { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/explorar", operacion: "universo", userId: user.id, extra: { modalidad, pie, plazo } });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
