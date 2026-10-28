import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { capturarServidor } from "@/lib/posthog-servidor";
import { EVENTOS_PORTAL } from "@/lib/explorar/portal";
import { alternarGuardado, eventoPortal } from "@/lib/explorar/portal-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/explorar/guardados { avisoId, guardar } (28-oct-2026): el corazón de la tarjeta y de la lista. Guarda o quita
// el aviso de la cuenta (`explorar_guardados`); el dashboard los muestra en la fila «Guardados», con «Comparar». Deja
// «explorar_guardar». Solo con sesión y solo sobre la cuenta propia.
// ─────────────────────────────────────────────────────────────────────────────
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { avisoId?: unknown; guardar?: unknown; desde?: unknown };
  if (typeof b.avisoId !== "string" || !UUID.test(b.avisoId) || typeof b.guardar !== "boolean") return NextResponse.json({ error: "datos" }, { status: 400 });
  const ok = await alternarGuardado(createServiceClient(), user.id, b.avisoId, b.guardar);
  if (!ok) return NextResponse.json({ error: "base" }, { status: 500 });
  const desde = b.desde === "lista" || b.desde === "dashboard" ? b.desde : "tarjeta";
  waitUntil(capturarServidor(eventoPortal(EVENTOS_PORTAL.guardar, user.id, { aviso_id: b.avisoId, guardar: b.guardar, desde })).then(() => undefined).catch(() => undefined));
  return NextResponse.json({ ok: true });
}
