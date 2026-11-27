import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { huellaDeRequest } from "@/lib/regalo-alta-servidor";
import { accesoAsesoriaDe } from "@/lib/asesoria/acceso-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/asesoria/interes-nuevos (27-nov-2026, ajuste de Fabrizio): «Avísame» de los deptos nuevos, tocado en el perfil (con
// cuenta). Solo lo guarda en inv_perfiles (interes_nuevos y su fecha): no se manda ningún correo todavía. Sin cuenta, el «Avísame»
// queda en el estado de la asesoría y viaja al crear el perfil. Sin la asesoría habilitada, 404.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const acceso = await accesoAsesoriaDe({ dispositivoHash: huellaDeRequest(request).dispositivo, userId: user.id });
  if (!acceso.habilitada) return NextResponse.json({ error: "no-existe" }, { status: 404 });
  try {
    const { data, error } = await createServiceClient().from("inv_perfiles")
      .update({ interes_nuevos: true, interes_nuevos_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", user.id).select("user_id");
    if (error) throw new Error(`inv_perfiles: ${error.message}`);
    if (!data?.length) return NextResponse.json({ error: "sin-perfil" }, { status: 409 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    captureApiError(e, { ruta: "POST /api/asesoria/interes-nuevos", operacion: "interes-nuevos", userId: user.id });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
