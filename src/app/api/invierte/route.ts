import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createSupabaseServer } from "@/lib/api-helpers/analisis-pipeline";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { sendInscripcionInvierteInterna } from "@/lib/email";
import { nombreReal } from "@/lib/welcome";
import { capturarServidor } from "@/lib/posthog-servidor";
import { EVENTOS_META, idInvierte } from "@/lib/meta/ids";
import { conEspejo, contextoDeRequest, emitirEventoMeta, esCuentaDePrueba } from "@/lib/meta/servidor";
import type { EventoEspejo } from "@/lib/meta/espejo";
import { EVENTOS_INVIERTE, validarInscripcion } from "@/lib/invierte/invierte";
import { inscribir, inscritosDe } from "@/lib/invierte/invierte-servidor";
import { origenDeCabecera } from "@/lib/origen-campana";

// ─────────────────────────────────────────────────────────────────────────────
// /api/invierte (11-nov-2026, goal «Pronto: Invierte con Franco»).
//   GET  → los avisos en que la persona ya está inscrita (la etiqueta de la tarjeta). Sin sesión, ninguno.
//   POST → inscribe (o actualiza) una inscripción por persona y depto: sin sesión 401 (sin cuenta, la hoja pasa antes por el
//          registro); sin depto o con datos que no valen, 400; un aviso sin condición (ni usado ni nuevo), 422; si el correo a hola@ no sale, 502
//          (la hoja ofrece reintentar y no confirma). Bien: `invierte_inscripcion` a PostHog y el Lead a Meta con el espejo.
// ─────────────────────────────────────────────────────────────────────────────

const RUTA = "/api/invierte";

export async function GET() {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ avisos: [] });
  return NextResponse.json({ avisos: await inscritosDe(createServiceClient(), user.id) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const v = validarInscripcion(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  // El origen de la campaña, el mismo dato de la cuenta: la cookie de la primera visita (12-nov-2026, lib/origen-campana.ts).
  const origen = origenDeCabecera(request.headers.get("cookie"));
  const utm = origen ? ({ ...origen } as Record<string, unknown>) : null;

  const admin = createServiceClient();
  let espejo: EventoEspejo | null = null;
  try {
    const r = await inscribir(admin, { id: user.id, email: user.email ?? null, nombre: nombreReal(user.user_metadata) }, v.pedido, utm, {
      enviarCorreo: sendInscripcionInvierteInterna,
      esPrueba: (id, email) => esCuentaDePrueba(admin, id, email),
    });
    if (!r.ok) {
      const status = r.error === "depto" ? 400 : r.error === "condicion" ? 422 : r.error === "correo" ? 502 : 500;
      if (r.error === "guardar" || r.error === "correo") captureApiError(new Error(`invierte: ${r.error}`), { ruta: RUTA, operacion: "inscribir", userId: user.id, extra: { avisoId: v.pedido.avisoId } });
      return NextResponse.json({ error: r.error }, { status });
    }
    // La medición, después de que Franco la recibió.
    await capturarServidor({
      event: EVENTOS_INVIERTE.inscripcion,
      distinctId: user.id,
      correo: user.email ?? null,
      properties: { aviso_id: r.depto.avisoId, origen: v.pedido.origen, urgencia: v.pedido.urgencia, pie: v.pedido.pie, repetida: r.repetida, veredicto: r.depto.veredicto, score: r.depto.score, analysis_id: r.depto.analysisId ?? null },
    }).catch(() => false);
    const lead = await emitirEventoMeta(admin, {
      evento: EVENTOS_META.lead,
      eventId: idInvierte(user.id, r.depto.avisoId),
      userId: user.id,
      email: user.email ?? null,
      datos: { origen: "invierte", aviso_id: r.depto.avisoId, urgencia: v.pedido.urgencia },
      contexto: contextoDeRequest(request),
      origen: "lead:invierte",
    });
    espejo = lead.espejo;
    waitUntil(lead.envio);
    return conEspejo(NextResponse.json({ ok: true, repetida: r.repetida, avisoId: r.depto.avisoId }), [espejo], request);
  } catch (e) {
    captureApiError(e, { ruta: RUTA, operacion: "inscribir", userId: user.id, extra: { avisoId: v.pedido.avisoId } });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
