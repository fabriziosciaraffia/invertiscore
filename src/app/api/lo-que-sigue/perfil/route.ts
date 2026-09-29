import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { reportarFalloQuery } from "@/lib/observabilidad";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/lo-que-sigue/perfil (30-sep-2026): lo que la persona elige en «Estás dentro» —los chips
// editados (tipología, comuna, modalidad) y «¿Cuándo piensas comprar?»— queda en el perfil de ese
// análisis (`perfiles_inversion`, columnas `pref_*` y `horizonte_compra`). Con sesión y solo sobre
// un perfil propio: el claim ya lo ligó a la persona al entrar con el código.
// ─────────────────────────────────────────────────────────────────────────────

const HORIZONTES = new Set(["ya", "meses", "mirando"]);
const MODALIDADES = new Set(["ltr", "str"]);
const texto = (v: unknown, max = 60): string | null => (typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null);

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const analysisId = typeof body.analysisId === "string" && /^[0-9a-f-]{36}$/i.test(body.analysisId) ? body.analysisId : null;
  if (!analysisId) return NextResponse.json({ error: "Falta el informe" }, { status: 400 });

  const cambios: Record<string, string> = {};
  if (body.tipologia !== undefined) { const t = texto(body.tipologia, 12); if (!t) return NextResponse.json({ error: "Tipología inválida" }, { status: 400 }); cambios.pref_tipologia = t; }
  if (body.comuna !== undefined) { const c = texto(body.comuna); if (!c) return NextResponse.json({ error: "Comuna inválida" }, { status: 400 }); cambios.pref_comuna = c; }
  if (body.modalidad !== undefined) { if (!MODALIDADES.has(String(body.modalidad))) return NextResponse.json({ error: "Modalidad inválida" }, { status: 400 }); cambios.pref_modalidad = String(body.modalidad); }
  if (body.horizonte !== undefined) { if (!HORIZONTES.has(String(body.horizonte))) return NextResponse.json({ error: "Horizonte inválido" }, { status: 400 }); cambios.horizonte_compra = String(body.horizonte); }
  if (Object.keys(cambios).length === 0) return NextResponse.json({ error: "Nada que guardar" }, { status: 400 });

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("perfiles_inversion")
    .update({ ...cambios, pref_actualizado_at: new Date().toISOString() })
    .eq("analysis_id", analysisId)
    .eq("user_id", user.id)
    .select("analysis_id")
    .maybeSingle();
  reportarFalloQuery(error, { ruta: "api/lo-que-sigue/perfil", operacion: "guardar-preferencias", userId: user.id });
  if (error) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Ese perfil no es tuyo" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
