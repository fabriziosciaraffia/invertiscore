import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { decisionesDeCalle, MAX_POR_PEDIDO } from "@/lib/explorar/calle-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/explorar/calle { ids } (28-oct-2026): foto de la calle o mapa chico para cada aviso (la tarjeta del pin la pide
// para los cercanos, y así sabe si lleva la etiqueta «Vista de la calle»). La metadata de Street View es gratis y queda
// guardada 30 días (lib/explorar/calle.ts). Solo con sesión.
// ─────────────────────────────────────────────────────────────────────────────
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, MAX_POR_PEDIDO) : [];
  if (ids.length === 0) return NextResponse.json({ error: "datos" }, { status: 400 });
  try {
    return NextResponse.json(await decisionesDeCalle(createServiceClient(), ids));
  } catch (e) {
    captureApiError(e, { ruta: "POST /api/explorar/calle", operacion: "decidir", userId: user.id });
    return NextResponse.json({});
  }
}
