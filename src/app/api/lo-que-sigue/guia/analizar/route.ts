import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { runAnalysis } from "@/lib/analysis";
import { METHODOLOGY_VERSION_ACTUAL } from "@/lib/modelo-costos";
import { getUFValue } from "@/lib/uf";
import { readVeredicto } from "@/lib/results-helpers";
import { sendAnalysisReadyEmail } from "@/lib/email";
import { resolveDisplayName } from "@/lib/welcome";
import { captureApiError } from "@/lib/observabilidad";
import { desdeBodyLtr } from "@/lib/plausibilidad";
import { redondearPiePct } from "@/lib/analysis/pie-input-data";
import {
  createSupabaseServer, ensureCreditCharged, filaAnalisisLtr, guardPlausibilidad, markPremiumAndClaimPrepaid, prefetchMedianaComunaVenta,
} from "@/lib/api-helpers/analisis-pipeline";
import { createAnonPipelineClient } from "@/lib/api-helpers/anon-cap";
import { guardarPerfil, perfilDesdeLtr } from "@/lib/lo-que-sigue/perfil";
import { leerConfigGuia, leerOrigenGuia } from "@/lib/guia/guia-servidor";
import { antiguedadDelAviso, cuerpoDelAviso, fichaDelAviso, leerAvisoGuia } from "@/lib/guia/analizar-servidor";
import { analizarAvisoDeGuia } from "@/lib/guia/analizar-una-vez";
import { chequearPublicacion } from "@/lib/guia/publicacion";
import { almacenPublicacion, bajarFicha } from "@/lib/guia/ficha-servidor";
import { combinacionesGuia } from "@/lib/guia/seleccion";
import { combinacionSemanal } from "@/lib/guia/semanal-servidor";

// ─────────────────────────────────────────────────────────────────────────────
// «Analizar este» (30-sep-2026): el informe de un aviso de la guía, sin wizard, con un crédito del
// pack. Solo con sesión y solo sobre la guía del propio informe. El crédito se descuenta UNA vez por
// persona y aviso (analizar-una-vez.ts). Antes, la ficha se chequea de nuevo con los resguardos de
// CLAUDE.md (publicacion.ts): si el aviso se despublicó, no se cobra y la guía lo reemplaza (410).
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;
const RUTA = "POST /api/lo-que-sigue/guia/analizar";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });

  const b = (await request.json().catch(() => ({}))) as { origenId?: string; avisoId?: string; piePct?: number; plazoAnios?: number; semanal?: string };
  if (!b.origenId || !UUID.test(b.origenId) || !b.avisoId || !UUID.test(b.avisoId)) return NextResponse.json({ error: "datos" }, { status: 400 });

  const admin = createAnonPipelineClient();
  try {
    const o = await leerOrigenGuia(admin, b.origenId);
    if (!o || o.userId !== user.id) return NextResponse.json({ error: "origen" }, { status: 403 });
    // La combinación tiene que ser una de las que la guía puede mostrar (la suya o una ajustada); desde el
    // correo semanal, la de esa selección, que tiene que ser de esta persona, de este origen y con este aviso.
    const combo = typeof b.semanal === "string"
      ? await combinacionSemanal(admin, b.semanal, user.id, o.analysisId, b.avisoId)
      : combinacionesGuia({ piePct: o.piePct, plazoAnios: o.plazoAnios, razonSinPie: o.razonSinPie })
        .find((c) => c.piePct === b.piePct && c.plazoAnios === b.plazoAnios);
    if (!combo) return NextResponse.json({ error: "combinacion" }, { status: 400 });
    // La red: la ficha se chequea de nuevo ANTES de cualquier cobro (publicacion.ts). La misma lectura trae el año.
    let anioLeido: number | null = null;
    let plausibleFallo: Response | null = null;
    const r = await analizarAvisoDeGuia({
      async chequear() {
        const ficha = await fichaDelAviso(admin, b.avisoId!);
        if (!ficha) return "sin-chequeo";
        const c = await chequearPublicacion(ficha, "clic", almacenPublicacion(admin), bajarFicha, { forzar: true });
        anioLeido = c.lectura?.leida ? c.lectura.anio : null;
        return c.estado;
      },
      async alDespublicar() {
        // La guía guardada se arma de nuevo, sin este aviso.
        await admin.from("guias_calculadas").delete().eq("analysis_id", o.analysisId);
      },
      async preparar() {
        const aviso = await leerAvisoGuia(admin, b.avisoId!, o);
        if (!aviso) return { ok: false, status: 404, error: "aviso" };
        const [cfg, ufValue] = await Promise.all([leerConfigGuia(admin), getUFValue()]);
        const antiguedad = await antiguedadDelAviso(admin, aviso, anioLeido);
        const body = await cuerpoDelAviso(aviso, o, combo, antiguedad, { uf: ufValue, tasa: cfg.tasa });
        if (!body) return { ok: false, status: 422, error: "sin-arriendo" };
        if (Number.isFinite(body.piePct)) body.piePct = redondearPiePct(body.piePct);
        body.methodologyVersion = METHODOLOGY_VERSION_ACTUAL;
        const plausible = guardPlausibilidad(desdeBodyLtr(body, ufValue), { userId: user.id, ruta: RUTA });
        if (!plausible.ok) { plausibleFallo = plausible.response; return { ok: false, status: 422, error: "plausibilidad" }; }

        const clave = { user_id: user.id, aviso_id: aviso.avisoId };
        return { ok: true, piezas: {
          async reclamar() {
            const { error } = await admin.from("guia_analisis").insert({ ...clave, origen_analysis_id: o.analysisId, pie_pct: combo.piePct, plazo: combo.plazoAnios });
            if (!error) return { nueva: true };
            if (error.code !== "23505") throw new Error(`reclamar: ${error.message}`);
            const { data } = await admin.from("guia_analisis").select("analysis_id, cobrado_at, charge_mode, reclamado_at").match(clave).maybeSingle();
            return {
              nueva: false,
              analysisId: (data?.analysis_id as string | null) ?? null,
              cobrado: !!data?.cobrado_at,
              chargeMode: (data?.charge_mode as string | null) ?? null,
              reclamadoHaceMs: data?.reclamado_at ? Date.now() - new Date(data.reclamado_at as string).getTime() : 0,
            };
          },
          async retomar() {
            const { data } = await admin.from("guia_analisis").select("reclamado_at").match(clave).maybeSingle();
            if (!data) return false;
            const { data: ganada } = await admin.from("guia_analisis").update({ reclamado_at: new Date().toISOString() })
              .match({ ...clave, reclamado_at: data.reclamado_at }).is("analysis_id", null).select("user_id");
            return (ganada?.length ?? 0) === 1;
          },
          async cobrar() {
            const c = await ensureCreditCharged({ user });
            return c.ok ? { ok: true, mode: c.mode } : { ok: false, status: c.response.status, error: "sin-creditos" };
          },
          async marcarCobrado(mode) {
            await admin.from("guia_analisis").update({ cobrado_at: new Date().toISOString(), charge_mode: mode }).match(clave);
          },
          async crear(mode) {
            const medianaComuna = await prefetchMedianaComunaVenta(admin, body, ufValue);
            const result = runAnalysis(body, ufValue, medianaComuna);
            const { data, error } = await admin.from("analisis").insert({
              ...filaAnalisisLtr({
                body,
                result,
                medianaComuna,
                userId: user.id,
                creatorName: user.user_metadata?.nombre || user.user_metadata?.full_name || null,
                chargeMode: mode,
              }),
            }).select("id").single();
            if (error || !data) throw new Error(`insert: ${error?.message ?? "sin fila"}`);
            const id = data.id as string;
            await markPremiumAndClaimPrepaid({ dbClient: admin, analysisId: id, prepaidNeedClaim: false });
            try {
              await guardarPerfil(admin, perfilDesdeLtr(body, readVeredicto(result) ?? null, { analysisId: id, userId: user.id, anonClaimTokenHash: null }));
            } catch (e) {
              console.error("[guia/analizar] perfil de inversión:", e);
            }
            if (user.email) {
              const email = user.email;
              waitUntil(sendAnalysisReadyEmail(
                email, resolveDisplayName(user.user_metadata, email), body.nombre || `${body.comuna} - ${body.superficie}m²`,
                result.score, readVeredicto(result) || "AJUSTA SUPUESTOS", id, undefined, { userId: user.id },
              ).catch((e) => console.error("[guia/analizar] correo listo:", e)));
            }
            return { id };
          },
          async marcarCreado(id) {
            await admin.from("guia_analisis").update({ analysis_id: id, creado_at: new Date().toISOString() }).match(clave);
          },
          async soltar() {
            await admin.from("guia_analisis").delete().match(clave).is("analysis_id", null);
          },
        } };
      },
    });

    if (r.estado === "despublicado") return NextResponse.json({ error: "despublicado" }, { status: 410 });
    if (r.estado === "sin-preparar") return plausibleFallo ?? NextResponse.json({ error: r.error }, { status: r.status });
    if (r.estado === "sin-cobro") return NextResponse.json({ error: r.error }, { status: r.status });
    if (r.estado === "en-curso") return NextResponse.json({ error: "en-curso" }, { status: 409 });
    return NextResponse.json({ id: r.id, estado: r.estado });
  } catch (e) {
    captureApiError(e, { ruta: RUTA, operacion: "analizar-aviso", userId: user.id, extra: { avisoId: b.avisoId } });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
