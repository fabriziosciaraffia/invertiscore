import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { reportarFalloQuery } from "@/lib/observabilidad";
import { validarCambiosPerfil } from "@/lib/perfil-busqueda";
import { waitUntil } from "@vercel/functions";
import { emitirRegistroCompletado } from "@/lib/meta/registro";
import { conEspejo, contextoDeRequest } from "@/lib/meta/servidor";

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
  // CompleteRegistration (15-oct-2026): contestó «¿Cuándo piensas comprar?» con sesión (src/lib/meta/registro.ts).
  const cuando = (v.cambios as { horizonte_compra?: string | null }).horizonte_compra;
  if (cuando) {
    const reg = await emitirRegistroCompletado(admin, user, cuando, contextoDeRequest(request));
    if (reg) {
      waitUntil(reg.envio);
      return conEspejo(NextResponse.json({ ok: true }), [reg.espejo], request);
    }
  }
  return NextResponse.json({ ok: true });
}
