import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { capturarServidor } from "@/lib/posthog-servidor";
import { origenDeCabecera } from "@/lib/origen-campana";
import { EVENTOS_INV2, validarContacto } from "@/lib/invierte-v2/flujo";
import { guardarContacto, leerPersona, ordenVigenteDe } from "@/lib/invierte-v2/servidor";
import { esPie, esUrgencia } from "@/lib/invierte/invierte";
import { NO_EXISTE, contextoDe, personaConAcceso } from "@/lib/invierte-v2/rutas";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invierte-v2/contacto (etapa 1 de Invierte con Franco, 18-nov-2026): el paso 1 de 2 —cuándo compra, el pie, el
// WhatsApp y el permiso para escribirle (obligatorio)—. Guarda la persona en estado «contacto». Sin sesión o sin acceso: 404.
// Solo deptos usados. Mide `inv2_contacto` desde el servidor; ningún Lead a Meta.
// GET (18-nov-2026, la hoja de contacto): si ya firmó la versión vigente (la hoja lo manda a Partimos) y lo que ya había
// contestado. Sin sesión o sin acceso: 404.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const user = await personaConAcceso();
  if (!user) return NO_EXISTE();
  const admin = createServiceClient();
  const [orden, persona] = await Promise.all([ordenVigenteDe(admin, user.id), leerPersona(admin, user.id)]);
  const inicial = persona ? { urgencia: esUrgencia(persona.urgencia) ? persona.urgencia : null, pie: esPie(persona.pie) ? persona.pie : null, whatsapp: persona.whatsapp } : null;
  return NextResponse.json({ firmo: !!orden, inicial }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await personaConAcceso();
  if (!user) return NO_EXISTE();
  const v = validarContacto((await request.json().catch(() => null)) as Record<string, unknown> | null);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const origen = origenDeCabecera(request.headers.get("cookie"));
  const admin = createServiceClient();
  try {
    const r = await guardarContacto(admin, { id: user.id, email: user.email ?? null }, v.pedido, contextoDe(request), origen ? { sesion: { ...origen } } : null);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "depto" ? 404 : 500 });
    await capturarServidor({
      event: EVENTOS_INV2.contacto,
      distinctId: user.id,
      correo: user.email ?? null,
      properties: { aviso_id: v.pedido.avisoId, origen: v.pedido.origen, urgencia: v.pedido.urgencia, pie: v.pedido.pie, ya_firmo: r.firmo },
    }).catch(() => false);
    return NextResponse.json({ ok: true, firmo: r.firmo }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    captureApiError(e, { ruta: "/api/invierte-v2/contacto", operacion: "contacto", userId: user.id });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
