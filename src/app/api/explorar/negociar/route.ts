import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureApiError } from "@/lib/observabilidad";
import { nocheExplorar } from "@/lib/explorar/portal-cache";
import { PIES_NEGOCIAR } from "@/lib/explorar/capa-negociar";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/explorar/negociar?p=20|30[&s=sello] (02-nov-2026, capa-negociar.ts): la capa «Si negocias el precio» CON CUENTA: todo Gran
// Santiago, los que dan Ajustar con ese pie a 30 años y llegan a Comprar con el descuento que guardó la noche, con sus cifras.
// Desde el 03-nov-2026, de la noche del sello que trae el pedido (portal-cache.ts › nocheExplorar): la misma que contó la
// página, aunque entretanto haya otra. Sin cuenta, /api/explorar/abierto/negociar (sin cifras).
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  const pie = Number(sp.get("p"));
  if (!(PIES_NEGOCIAR as readonly number[]).includes(pie)) return NextResponse.json({ error: "pie" }, { status: 400 });
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
