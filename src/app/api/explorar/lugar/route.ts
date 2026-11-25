import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { captureApiError } from "@/lib/observabilidad";
import { lugaresDeAvisos, MAX_LUGARES_POR_PEDIDO } from "@/lib/explorar/lugar-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/explorar/lugar { ids } (25-nov-2026): lo que la tarjeta del mapa dice debajo de la comuna para cada aviso —el metro a
// menos de 1 km, el barrio o sector, o la avenida principal— (lib/explorar/lugar.ts). Con y sin sesión, como la vista de la calle:
// solo decide sobre avisos que existen (hasta 40 por pedido) y lo que guarda es de todos.
// ─────────────────────────────────────────────────────────────────────────────
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, MAX_LUGARES_POR_PEDIDO) : [];
  if (ids.length === 0) return NextResponse.json({ error: "datos" }, { status: 400 });
  try {
    return NextResponse.json(await lugaresDeAvisos(createServiceClient(), ids));
  } catch (e) {
    captureApiError(e, { ruta: "POST /api/explorar/lugar", operacion: "lugar" });
    return NextResponse.json({});
  }
}
