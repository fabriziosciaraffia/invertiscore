import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { validarCambiosPerfil } from "@/lib/perfil-busqueda";
import { ORIGEN_SIN_OFERTA } from "@/lib/casa/sin-oferta";
import { capturarServidor } from "@/lib/posthog-servidor";
import { waitUntil } from "@vercel/functions";
import { emitirIntencionCompra, emitirRegistroAlCrear } from "@/lib/meta/registro";
import { conEspejo, contextoDeRequest } from "@/lib/meta/servidor";
import { huellaDeRequest } from "@/lib/regalo-alta-servidor";
import { cookieInvitacionDeCabeceras, referidoAlContestarCuando } from "@/lib/referido-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/perfil-busqueda (02-oct-2026): lo que la persona edita en «Tu perfil de búsqueda» del
// dashboard. Solo con sesión y solo sobre su propia fila (`perfil_busqueda`, service role). Cada campo
// es opcional; `null` vuelve a lo inferido de sus informes.
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const v = validarCambiosPerfil(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const admin = createServiceClient();
  const { error } = await admin.from("perfil_busqueda").upsert({ user_id: user.id, ...v.cambios, actualizado_at: new Date().toISOString() }, { onConflict: "user_id" });
  reportarFalloQuery(error, { ruta: "api/perfil-busqueda", operacion: "guardar", userId: user.id });
  if (error) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  // EL AJUSTE EN UN TOQUE DEL DASHBOARD (26-oct-2026, lib/casa/sin-oferta.ts): como `semanal_ajuste` del correo vacío, se
  // mide cuál de las dos salidas se tocó.
  if (body.origen === ORIGEN_SIN_OFERTA) {
    const ajuste = "pie_pct" in v.cambios ? "pie" : "comunas" in v.cambios ? "comuna" : "otro";
    waitUntil(capturarServidor({ event: "casa_ajuste", distinctId: user.id, properties: { origen: "sin_oferta", ajuste } }).then(() => undefined).catch(() => undefined));
  }
  // Contestó «¿Cuándo piensas comprar?» con sesión (src/lib/meta/registro.ts, 22-oct-2026): IntencionCompra con la
  // respuesta; y CompleteRegistration si la cuenta nació sin él (idempotente).
  const cuando = (v.cambios as { horizonte_compra?: string | null }).horizonte_compra;
  // EL PREMIO DEL REFERIDO (16-oct-2026, la puerta C): con sesión —validó el código— y el «cuándo» contestado, quien lo
  // invitó recibe su análisis (referido-servidor.ts). Después de responder: no demora la pantalla.
  if (cuando) waitUntil(referidoAlContestarCuando(admin, { userId: user.id, creadaAt: user.created_at, cookie: cookieInvitacionDeCabeceras(request.headers), huella: huellaDeRequest(request) }).then(() => undefined));
  if (cuando) {
    const ctx = contextoDeRequest(request);
    const reg = await emitirRegistroAlCrear(admin, user, ctx, { origen: "cuando" });
    const ic = await emitirIntencionCompra(admin, user, cuando, ctx);
    if (reg) waitUntil(reg.envio);
    if (ic) waitUntil(ic.envio);
    return conEspejo(NextResponse.json({ ok: true }), [reg?.espejo, ic?.espejo], request);
  }
  return NextResponse.json({ ok: true });
}
