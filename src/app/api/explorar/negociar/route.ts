import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureApiError } from "@/lib/observabilidad";
import { negociablesCacheados } from "@/lib/explorar/portal-cache";
import { PIES_NEGOCIAR } from "@/lib/explorar/capa-negociar";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/explorar/negociar?p=20|30 (02-nov-2026, capa-negociar.ts): la capa «Si negocias el precio» CON CUENTA: todo Gran
// Santiago, los que dan Ajustar con ese pie a 30 años y llegan a Comprar con el descuento que guardó la noche, con sus cifras. De la
// caché de diez minutos (portal-cache.ts › negociablesCacheados). Sin cuenta, /api/explorar/abierto/negociar (sin cifras).
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const pie = Number(new URL(request.url).searchParams.get("p"));
  if (!(PIES_NEGOCIAR as readonly number[]).includes(pie)) return NextResponse.json({ error: "pie" }, { status: 400 });
  try {
    return NextResponse.json({ pie, negociados: await negociablesCacheados(pie) }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (e) {
    captureApiError(e, { ruta: "GET /api/explorar/negociar", operacion: "capa", userId: user.id });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
