import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import { createSupabaseServer } from "@/lib/api-helpers/analisis-pipeline";
import { createAnonPipelineClient } from "@/lib/api-helpers/anon-cap";
import { readVeredicto } from "@/lib/results-helpers";
import { sendInteresAvisoInterno } from "@/lib/email";
import { resolveDisplayName } from "@/lib/welcome";
import { tipologiaDe } from "@/lib/lo-que-sigue/perfil";

// ─────────────────────────────────────────────────────────────────────────────
// «Quiero verlo» (30-sep-2026): en un informe que salió de un aviso de la guía, registra el interés
// —persona, perfil, aviso, veredicto— (tabla `interes_avisos`, uno por informe) y manda un correo a
// hola@ con todo para gestionarlo a mano. Un segundo toque no repite el correo.
// ─────────────────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const { analysisId } = (await request.json().catch(() => ({}))) as { analysisId?: string };
  if (!analysisId || !UUID.test(analysisId)) return NextResponse.json({ error: "datos" }, { status: 400 });

  const admin = createAnonPipelineClient();
  try {
    const { data: an } = await admin.from("analisis").select("id, user_id, score, results, input_data").eq("id", analysisId).maybeSingle();
    const input = (an?.input_data ?? {}) as Record<string, unknown> & { origenAviso?: { avisoId?: string; antiguedad?: string; origenAnalysisId?: string } };
    if (!an || an.user_id !== user.id || !input.origenAviso?.avisoId) return NextResponse.json({ error: "informe" }, { status: 403 });
    const avisoId = input.origenAviso.avisoId;
    const results = (an.results ?? {}) as { metrics?: { flujoNetoMensual?: number } };
    const veredicto = readVeredicto(results as never) ?? null;
    const score = typeof an.score === "number" ? Math.round(an.score) : null;
    const perfil = { piePct: Number(input.piePct) || null, plazo: Number(input.plazoCredito) || null, tasa: Number(input.tasaInteres) || null, amoblado: input.amoblado === true };

    const { error } = await admin.from("interes_avisos").insert({ analysis_id: analysisId, user_id: user.id, aviso_id: avisoId, veredicto, score, perfil });
    if (error) {
      if (error.code === "23505") return NextResponse.json({ ok: true, ya: true });
      throw new Error(`interes: ${error.message}`);
    }

    const { data: sp } = await admin.from("scraped_properties").select("url, comuna, superficie_m2, dormitorios, banos").eq("id", avisoId).order("id").limit(1);
    const f = sp?.[0];
    const antiguedad = input.origenAviso.antiguedad === "supuesta" ? "sin dato (se supusieron 25 años)"
      : input.origenAviso.antiguedad === "nuevo" ? "obra nueva" : `${Number(input.antiguedad) || "—"} años (ficha)`;
    const salio = await sendInteresAvisoInterno({
      persona: { nombre: resolveDisplayName(user.user_metadata, user.email ?? ""), email: user.email ?? "—", userId: user.id },
      perfil,
      aviso: {
        comuna: String(f?.comuna ?? input.comuna ?? ""),
        tipologia: tipologiaDe(f?.dormitorios ?? input.dormitorios, f?.banos ?? input.banos),
        m2: Number(f?.superficie_m2 ?? input.superficie) || null,
        precioUF: Number(input.precio) || null,
        antiguedad,
        url: (f?.url as string | null) ?? null,
        avisoId,
      },
      veredicto: { veredicto, score, flujo: typeof results.metrics?.flujoNetoMensual === "number" ? Math.round(results.metrics.flujoNetoMensual) : null },
      analysisId,
      origenAnalysisId: input.origenAviso.origenAnalysisId ?? null,
    });
    if (salio) await admin.from("interes_avisos").update({ correo_enviado_at: new Date().toISOString() }).eq("analysis_id", analysisId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    captureApiError(e, { ruta: "POST /api/lo-que-sigue/quiero-verlo", operacion: "interes", userId: user.id, extra: { analysisId } });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
