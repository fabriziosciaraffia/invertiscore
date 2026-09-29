import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { precargaDesdeInforme } from "@/lib/lo-que-sigue/precarga";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/lo-que-sigue/precarga?analysisId= (30-sep-2026): lo de la persona de un informe PROPIO
// —pie, tasa, plazo, modalidad— y su contexto —comuna, tipología—, como respuestas del wizard. Nada
// del depto viaja: `precargaDesdeInforme` solo arma las claves permitidas. Con sesión; sin ella, 401
// y el wizard pide el código y vuelve al mismo lugar.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const analysisId = new URL(request.url).searchParams.get("analysisId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(analysisId)) return NextResponse.json({ error: "Falta el informe" }, { status: 400 });
  const { data } = await supabase
    .from("analisis")
    .select("input_data, tipo_analisis, user_id")
    .eq("id", analysisId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Ese informe no es tuyo" }, { status: 404 });
  return NextResponse.json({ precarga: precargaDesdeInforme(data.input_data as Record<string, unknown>, data.tipo_analisis as "long-term" | "short-term") });
}
