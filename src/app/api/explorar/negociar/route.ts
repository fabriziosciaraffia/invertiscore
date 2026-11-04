import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { COMUNAS_DISPONIBLES } from "@/lib/comunas-disponibles";
import { PLAZO_POR_DEFECTO, tasaElegidaDe } from "@/lib/deptos/estandar";
import { PIES_EXPLORAR, PLAZOS_EXPLORAR } from "@/lib/explorar/explorar";
import { nocheExplorar } from "@/lib/explorar/portal-cache";
import { universoYCapaCalculados } from "@/lib/explorar/portal-servidor";
import { compactarNegociados, PIES_NEGOCIAR } from "@/lib/explorar/capa-negociar";
import { almacenDeConfig, esRecalculoEnEspera, TurnosRecalculo } from "@/lib/explorar/turnos-recalculo";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/explorar/negociar?p=20|30[&s=sello] (02-nov-2026, capa-negociar.ts): la capa «Si negocias el precio» CON CUENTA: todo Gran
// Santiago, los que dan Ajustar con ese pie a 30 años y llegan a Comprar con el descuento que guardó la noche, con sus cifras.
// Desde el 03-nov-2026, de la noche del sello que trae el pedido (portal-cache.ts › nocheExplorar): la misma que contó la
// página, aunque entretanto haya otra. Sin cuenta, /api/explorar/abierto/negociar (sin cifras).
// CON OTRO PLAZO O CON TASA ELEGIDA (04-nov-2026, `z`, `ta` y `c`): la capa que la noche no guarda —pie 20 % o 30 % a 25 años, cuyo
// universo sí sale de la noche— se calcula por comuna, como un universo calculado, y queda 24 horas en `combos`. Las demás
// combinaciones la traen en el mismo pedido de su universo (GET /api/explorar).
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
// Una comuna grande con una combinación nueva: la sonda de cada aviso y el descuento de cada Ajustar (medido el 04-nov-2026).
export const maxDuration = 60;
const COMUNAS_OK = new Set<string>(COMUNAS_DISPONIBLES as readonly string[]);

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  const pie = Number(sp.get("p"));
  const plazo = Number(sp.get("z") ?? PLAZO_POR_DEFECTO);
  const tasa = tasaElegidaDe(sp.get("ta"));
  if (sp.get("ta") != null && tasa == null) return NextResponse.json({ error: "tasa" }, { status: 400 });
  // La capa calculada, de a una comuna.
  if (plazo !== PLAZO_POR_DEFECTO || tasa != null || !(PIES_NEGOCIAR as readonly number[]).includes(pie)) {
    if (!(PIES_EXPLORAR as readonly number[]).includes(pie) || !(PLAZOS_EXPLORAR as readonly number[]).includes(plazo)) return NextResponse.json({ error: "combinacion" }, { status: 400 });
    const comunas = Array.from(new Set((sp.get("c") ?? "").split(",").map((x) => x.trim()).filter((c) => COMUNAS_OK.has(c))));
    if (comunas.length !== 1) return NextResponse.json({ error: "comunas" }, { status: 400 });
    try {
      const cuenta = { calculados: 0, ms: 0 };
      // El mismo tope y el mismo fusible que el universo calculado (turnos-recalculo.ts, 04-nov-2026).
      const admin = createServiceClient();
      const turnos = new TurnosRecalculo(almacenDeConfig(admin));
      const { negociados } = await universoYCapaCalculados(admin, { modalidad: "ltr", pie, plazo, tasa, comunas }, new Date(), cuenta, { conCapa: true, turnos, quien: user.id });
      return NextResponse.json({ pie, plazo, tasa, comunas, negociados: compactarNegociados(negociados), calculados: cuenta.calculados, ms: cuenta.ms }, { headers: { "Cache-Control": "private, max-age=300" } });
    } catch (e) {
      if (esRecalculoEnEspera(e)) return NextResponse.json({ error: e.motivo }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3" } });
      captureApiError(e, { ruta: "GET /api/explorar/negociar", operacion: "capa-calculada", userId: user.id, extra: { pie, plazo, tasa, comunas } });
      return NextResponse.json({ error: "interno" }, { status: 500 });
    }
  }
  try {
    const noche = await nocheExplorar(pie, 30, sp.get("s"));
    // La capa se leyó con el universo y falló dos veces: el navegador sigue sin ella (con este sello no hay otra).
    if (!noche.negociados) return NextResponse.json({ error: "capa" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ pie, negociados: noche.negociados, sello: noche.sello }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/explorar/negociar", operacion: "capa", userId: user.id });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
