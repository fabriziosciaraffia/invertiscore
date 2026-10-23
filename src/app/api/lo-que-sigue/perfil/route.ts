import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { firmaPagoValida } from "@/lib/lo-que-sigue/firma-pago";
import { pagoAbreElInforme } from "@/lib/lo-que-sigue/retorno-pago";
import { waitUntil } from "@vercel/functions";
import { emitirIntencionCompra, emitirRegistroAlCrear } from "@/lib/meta/registro";
import { conEspejo, contextoDeRequest } from "@/lib/meta/servidor";
import { huellaDeRequest } from "@/lib/regalo-alta-servidor";
import { cookieInvitacionDeCabeceras, referidoAlContestarCuando } from "@/lib/referido-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/lo-que-sigue/perfil (30-sep-2026): lo que la persona elige en «Estás dentro» —los chips
// editados (tipología, comuna, modalidad) y «¿Cuándo piensas comprar?»— queda en el perfil de ese
// análisis (`perfiles_inversion`, columnas `pref_*` y `horizonte_compra`). Con sesión y solo sobre
// un perfil propio: el claim ya lo ligó a la persona al entrar con el código.
//
// 02-oct-2026: el comprador del pack responde «¿Cuándo piensas comprar?» en la pantalla de la guía,
// muchas veces SIN sesión (pagó desde el ticket). Sin sesión entra con la firma del pago (`order` + `t`)
// de un pago PAGADO de ESE informe, y solo puede guardar el horizonte, sobre el perfil del dueño del pago.
// ─────────────────────────────────────────────────────────────────────────────

const HORIZONTES = new Set(["ya", "meses", "mirando"]);
const MODALIDADES = new Set(["ltr", "str"]);
const texto = (v: unknown, max = 60): string | null => (typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null);

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const analysisId = typeof body.analysisId === "string" && /^[0-9a-f-]{36}$/i.test(body.analysisId) ? body.analysisId : null;
  if (!analysisId) return NextResponse.json({ error: "Falta el informe" }, { status: 400 });

  const admin = createServiceClient();
  // Con sesión, su perfil. Sin sesión, solo con la firma del pago de ESE informe, y solo el horizonte.
  let duenoId: string | null = user?.id ?? null;
  if (!user) {
    const order = typeof body.order === "string" ? body.order : null;
    const firmaValida = firmaPagoValida(order, typeof body.t === "string" ? body.t : null);
    const soloHorizonte = Object.keys(body).every((k) => ["analysisId", "order", "t", "horizonte"].includes(k));
    if (!firmaValida || !order || !soloHorizonte) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
    const { data: pago } = await admin.from("payments").select("status, analysis_id, user_id").eq("commerce_order", order).maybeSingle();
    const p = (pago as { status: string; analysis_id: string | null; user_id: string | null } | null) ?? null;
    if (!pagoAbreElInforme({ firmaValida, pago: p, analysisId })) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
    duenoId = p!.user_id;
  }

  const cambios: Record<string, string> = {};
  if (body.tipologia !== undefined) { const t = texto(body.tipologia, 12); if (!t) return NextResponse.json({ error: "Tipología inválida" }, { status: 400 }); cambios.pref_tipologia = t; }
  if (body.comuna !== undefined) { const c = texto(body.comuna); if (!c) return NextResponse.json({ error: "Comuna inválida" }, { status: 400 }); cambios.pref_comuna = c; }
  if (body.modalidad !== undefined) { if (!MODALIDADES.has(String(body.modalidad))) return NextResponse.json({ error: "Modalidad inválida" }, { status: 400 }); cambios.pref_modalidad = String(body.modalidad); }
  if (body.horizonte !== undefined) { if (!HORIZONTES.has(String(body.horizonte))) return NextResponse.json({ error: "Horizonte inválido" }, { status: 400 }); cambios.horizonte_compra = String(body.horizonte); }
  if (Object.keys(cambios).length === 0) return NextResponse.json({ error: "Nada que guardar" }, { status: 400 });

  const { data, error } = await admin
    .from("perfiles_inversion")
    .update({ ...cambios, pref_actualizado_at: new Date().toISOString() })
    .eq("analysis_id", analysisId)
    .eq("user_id", duenoId!)
    .select("analysis_id")
    .maybeSingle();
  reportarFalloQuery(error, { ruta: "api/lo-que-sigue/perfil", operacion: "guardar-preferencias", userId: duenoId ?? undefined });
  if (error) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Ese perfil no es tuyo" }, { status: 404 });
  // Contestó «¿Cuándo piensas comprar?» con sesión —validó el código— (src/lib/meta/registro.ts, 22-oct-2026):
  // IntencionCompra con la respuesta; y CompleteRegistration si la cuenta nació sin él (idempotente). Sin sesión (la
  // firma del pago) no: esa cuenta no validó nada.
  if (user && cambios.horizonte_compra) {
    // EL PREMIO DEL REFERIDO (16-oct-2026, la puerta C): validó el código y contestó el «cuándo» (referido-servidor.ts).
    waitUntil(referidoAlContestarCuando(admin, { userId: user.id, creadaAt: user.created_at, cookie: cookieInvitacionDeCabeceras(request.headers), huella: huellaDeRequest(request) }).then(() => undefined));
    const ctx = contextoDeRequest(request);
    const reg = await emitirRegistroAlCrear(admin, user, ctx, { origen: "cuando" });
    const ic = await emitirIntencionCompra(admin, user, cambios.horizonte_compra, ctx);
    if (reg) waitUntil(reg.envio);
    if (ic) waitUntil(ic.envio);
    return conEspejo(NextResponse.json({ ok: true }), [reg?.espejo, ic?.espejo], request);
  }
  return NextResponse.json({ ok: true });
}
