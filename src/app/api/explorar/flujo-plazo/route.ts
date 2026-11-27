import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { flujosAPlazo, MAX_FLUJOS_POR_PEDIDO } from "@/lib/explorar/flujo-plazo-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/explorar/flujo-plazo { ids } (tercera vuelta de la asesoría, 27-nov-2026): el flujo de los deptos de la tarjeta al plazo
// del perfil de la cuenta. El plazo lo lee el servidor de SU perfil (lib/explorar/flujo-plazo-servidor.ts); el cuerpo solo trae ids.
// ─────────────────────────────────────────────────────────────────────────────
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, MAX_FLUJOS_POR_PEDIDO) : [];
  if (!ids.length) return NextResponse.json({ error: "datos" }, { status: 400 });
  try {
    const admin = createServiceClient();
    const { data } = await admin.from("inv_perfiles").select("plazo_anios").eq("user_id", user.id).maybeSingle();
    const plazo = data?.plazo_anios == null ? null : Number(data.plazo_anios);
    if (plazo == null || plazo >= 30) return NextResponse.json({ plazo: 30, flujos: {} });
    return NextResponse.json({ plazo, flujos: await flujosAPlazo(admin, ids, plazo) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    captureApiError(e, { ruta: "POST /api/explorar/flujo-plazo", operacion: "flujos", userId: user.id });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
