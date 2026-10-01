import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/observabilidad";
import { createSupabaseServer } from "@/lib/api-helpers/analisis-pipeline";
import { createAnonPipelineClient } from "@/lib/api-helpers/anon-cap";
import { readVeredicto } from "@/lib/results-helpers";
import { sendAvisoPedidoEmail } from "@/lib/email";
import { chequearPublicacion } from "@/lib/guia/publicacion";
import { almacenPublicacion, bajarFicha } from "@/lib/guia/ficha-servidor";
import { claveEdificio } from "@/lib/guia/ficha-anio";
import { mandarAvisoUnaVez } from "@/lib/guia/quiero-verlo";
import { nombreReal } from "@/lib/welcome";

// ─────────────────────────────────────────────────────────────────────────────
// «Quiero verlo» (30-sep-2026; automático desde el 01-oct-2026): en un informe que salió de un aviso
// de la guía, registra el interés —persona, perfil, aviso, veredicto— (tabla `interes_avisos`, uno
// por informe) y le manda a la persona el aviso a su correo, después de chequear que siga publicado
// (quiero-verlo.ts). Un aviso despublicado responde 410 y no manda nada. Nada sale a hola@.
// ─────────────────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUTA = "POST /api/lo-que-sigue/quiero-verlo";

export async function POST(request: Request) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });
  const { analysisId } = (await request.json().catch(() => ({}))) as { analysisId?: string };
  if (!analysisId || !UUID.test(analysisId)) return NextResponse.json({ error: "datos" }, { status: 400 });

  const admin = createAnonPipelineClient();
  try {
    const { data: an } = await admin.from("analisis").select("id, user_id, score, results, input_data").eq("id", analysisId).maybeSingle();
    const input = (an?.input_data ?? {}) as Record<string, unknown> & { origenAviso?: { avisoId?: string } };
    if (!an || an.user_id !== user.id || !input.origenAviso?.avisoId) return NextResponse.json({ error: "informe" }, { status: 403 });
    const avisoId = input.origenAviso.avisoId;
    const results = (an.results ?? {}) as { metrics?: { flujoNetoMensual?: number } };
    const veredicto = readVeredicto(results as never) ?? null;
    const score = typeof an.score === "number" ? Math.round(an.score) : null;
    const flujo = typeof results.metrics?.flujoNetoMensual === "number" ? Math.round(results.metrics.flujoNetoMensual) : null;
    const perfil = { piePct: Number(input.piePct) || null, plazo: Number(input.plazoCredito) || null, tasa: Number(input.tasaInteres) || null, amoblado: input.amoblado === true };

    // El interés se guarda siempre (uno por informe), salga o no el correo.
    const { error } = await admin.from("interes_avisos").insert({ analysis_id: analysisId, user_id: user.id, aviso_id: avisoId, veredicto, score, perfil });
    if (error && error.code !== "23505") throw new Error(`interes: ${error.message}`);

    const { data: sp } = await admin.from("scraped_properties").select("id, url, comuna, lat, lng").eq("id", avisoId).order("id").limit(1);
    const f = sp?.[0];
    const comuna = String(f?.comuna ?? input.comuna ?? "");
    const fila = { analysis_id: analysisId };

    const r = await mandarAvisoUnaVez({
      async yaEnviado() {
        const { data } = await admin.from("interes_avisos").select("correo_enviado_at").match(fila).maybeSingle();
        return !!data?.correo_enviado_at;
      },
      async chequear() {
        if (!f?.url || f.lat == null || f.lng == null) return "sin-chequeo";
        const c = await chequearPublicacion(
          { id: f.id as string, url: f.url as string, edificio: claveEdificio({ comuna, lat: Number(f.lat), lng: Number(f.lng) }) },
          "clic", almacenPublicacion(admin), bajarFicha,
        );
        return c.estado;
      },
      async marcarDespublicado() {
        await admin.from("interes_avisos").update({ aviso_despublicado_at: new Date().toISOString() }).match(fila);
      },
      async reclamar() {
        const { data } = await admin.from("interes_avisos").update({ correo_enviado_at: new Date().toISOString() })
          .match(fila).is("correo_enviado_at", null).select("analysis_id");
        return (data?.length ?? 0) === 1;
      },
      async enviar() {
        if (!user.email) return false;
        return sendAvisoPedidoEmail(user.email, {
          nombre: nombreReal(user.user_metadata),
          comuna,
          url: f!.url as string,
          veredicto,
          flujo,
        }, { userId: user.id });
      },
      async soltar() {
        await admin.from("interes_avisos").update({ correo_enviado_at: null }).match(fila);
      },
    });

    if (r === "despublicado") return NextResponse.json({ error: "despublicado" }, { status: 410 });
    if (r === "sin-chequeo") return NextResponse.json({ error: "sin-chequeo" }, { status: 503 });
    if (r === "fallo-envio") return NextResponse.json({ error: "correo" }, { status: 502 });
    return NextResponse.json({ ok: true, ya: r === "ya-enviado" });
  } catch (e) {
    captureApiError(e, { ruta: RUTA, operacion: "interes", userId: user.id, extra: { analysisId } });
    return NextResponse.json({ error: "interno" }, { status: 500 });
  }
}
