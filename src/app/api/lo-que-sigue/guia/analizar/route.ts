import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { runAnalysis } from "@/lib/analysis";
import { METHODOLOGY_VERSION_ACTUAL } from "@/lib/modelo-costos";
import { getUFValue } from "@/lib/uf";
import { readVeredicto } from "@/lib/results-helpers";
import { sendAnalysisReadyEmail } from "@/lib/email";
import { nombreReal } from "@/lib/welcome";
import { captureApiError } from "@/lib/observabilidad";
import { desdeBodyLtr } from "@/lib/plausibilidad";
import { redondearPiePct } from "@/lib/analysis/pie-input-data";
import {
  createSupabaseServer, ensureCreditCharged, filaAnalisisLtr, guardPlausibilidad, markPremiumAndClaimPrepaid, prefetchMedianaComunaVenta,
} from "@/lib/api-helpers/analisis-pipeline";
import { createAnonPipelineClient } from "@/lib/api-helpers/anon-cap";
import { guardarPerfil, perfilDesdeLtr } from "@/lib/lo-que-sigue/perfil";
import { leerConfigGuia, leerOrigenGuia, origenSintetico, type OrigenGuia } from "@/lib/guia/guia-servidor";
import type { Combinacion } from "@/lib/guia/seleccion";
import { antiguedadDelAviso, cuerpoDelAviso, fichaDelAviso, leerAvisoGuia } from "@/lib/guia/analizar-servidor";
import { analizarAvisoDeGuia } from "@/lib/guia/analizar-una-vez";
import { chequearPublicacion } from "@/lib/guia/publicacion";
import { almacenPublicacion, bajarFicha } from "@/lib/guia/ficha-servidor";
import { combinacionesGuia } from "@/lib/guia/seleccion";
import { combinacionSemanal } from "@/lib/guia/semanal-servidor";
import { EVENTOS_META, idAnalizarEste } from "@/lib/meta/ids";
import { conEspejo, contextoDeRequest, emitirEventoMeta } from "@/lib/meta/servidor";
import type { EventoEspejo } from "@/lib/meta/espejo";
import { capturarAnalisisCreado } from "@/lib/medicion-activacion";
import { leerPerfilBusqueda } from "@/lib/perfil-busqueda-servidor";
import { capturarServidor } from "@/lib/posthog-servidor";
import { esPiePopup, esPlazoPopup } from "@/lib/explorar/explorar";
import { eventoExplorarAnaliza } from "@/lib/explorar/servidor";

// ─────────────────────────────────────────────────────────────────────────────
// «Analizar este» (30-sep-2026): el informe de un aviso de la guía, sin wizard, con un crédito del
// pack. Solo con sesión y solo sobre la guía del propio informe. El crédito se descuenta UNA vez por
// persona y aviso (analizar-una-vez.ts). Antes, la ficha se chequea de nuevo con los resguardos de
// CLAUDE.md (publicacion.ts): si el aviso se despublicó, no se cobra y la guía lo reemplaza (410).
// «AnalizarEste» (15-oct-2026, medición para la campaña): el evento propio de Meta para públicos sale apenas el pedido
// es válido —la intención, aunque después no se cobre—, desde el servidor y con el espejo para el pixel en la cookie
// de la respuesta. Y `analisis_creado` en PostHog cuando el informe se crea.
// SIN INFORME DE ORIGEN (16-oct-2026, la puerta B): desde el semanal de una cuenta que nació en /deptos, la selección no
// tiene origen (`origenId` null); se valida por el token —de esta persona, sin origen y con este aviso— y se analiza con
// la combinación de la selección y la tasa de mercado (guia-servidor.ts › origenSintetico).
// DESDE EXPLORAR (23-oct-2026, `explorar: true`): cualquier aviso evaluado del mapa, con el pie y el plazo que la persona
// eligió en el pop-up (de las listas del pop-up), sobre el origen sintético con la tasa de mercado: lo mismo con que el
// mapa lo mostró. El crédito se descuenta igual, una vez por persona y aviso; `analisis_creado` va con via = explorar y
// «explorar_analiza» lleva el depto (el panel de activación cuenta cuántos análisis salen del mapa).
// DESDE EL RESPALDO (28-oct-2026, `respaldo: true`, decisión de Fabrizio: toda tarjeta de un depto en el dashboard tiene
// «Analizar este»): los de la noche que la primera selección muestra sin fila del día —la cuenta sin selección esta semana—
// no tienen token que los valide. Se analizan como un aviso evaluado, igual que desde Explorar (el pie y el plazo de las
// listas del pop-up, el origen sintético con la tasa de mercado, el crédito una vez por persona y aviso), pero cuentan como
// la selección (`desde` = «semanal»): es la tarjeta de «Tu selección» de la casa.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;
const RUTA = "POST /api/lo-que-sigue/guia/analizar";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });

  const b = (await request.json().catch(() => ({}))) as { origenId?: string | null; avisoId?: string; piePct?: number; plazoAnios?: number; semanal?: string; explorar?: boolean; respaldo?: boolean };
  const sinOrigen = typeof b.semanal === "string" && b.origenId == null;
  const desdeExplorar = b.explorar === true && b.origenId == null && typeof b.semanal !== "string";
  const desdeRespaldo = b.respaldo === true && !desdeExplorar && b.origenId == null && typeof b.semanal !== "string";
  if ((!sinOrigen && !desdeExplorar && !desdeRespaldo && (!b.origenId || !UUID.test(b.origenId))) || !b.avisoId || !UUID.test(b.avisoId)) return NextResponse.json({ error: "datos" }, { status: 400 });

  const admin = createAnonPipelineClient();
  let espejoAE: EventoEspejo | null = null;
  const salir = (res: Response) => conEspejo(res, [espejoAE], request);
  try {
    // Desde el semanal, el origen puede ser un informe de renta corta (13-oct-2026: quien solo analizó renta corta
    // recibe los deptos de renta larga de sus comunas); la selección se valida abajo contra ese origen.
    let o: OrigenGuia | null;
    let combo: Combinacion | null | undefined;
    // LA COMBINACIÓN ELEGIDA EN EL POP-UP (23-oct-2026, mockup D2): desde una selección, el pie y el plazo que la persona
    // cambió en «Cambiar» —de las listas del pop-up, ya con el veredicto recalculado a la vista— van en lugar de los de la
    // selección; sin ellos, los de la fila. La selección (el token) sigue validando el aviso.
    const elegida: Combinacion | null = typeof b.semanal === "string" && esPiePopup(b.piePct) && esPlazoPopup(b.plazoAnios) ? { piePct: Number(b.piePct), plazoAnios: Number(b.plazoAnios) } : null;
    if (desdeExplorar || desdeRespaldo) {
      // Explorar y el respaldo: el pie y el plazo del pop-up, de sus listas, y el origen sintético con la tasa de mercado.
      if (!esPiePopup(b.piePct) || !esPlazoPopup(b.plazoAnios)) return NextResponse.json({ error: "combinacion" }, { status: 400 });
      const pp = await leerPerfilBusqueda(admin, user.id);
      combo = { piePct: Number(b.piePct), plazoAnios: Number(b.plazoAnios) };
      o = origenSintetico(user.id, { piePct: combo.piePct, plazoAnios: combo.plazoAnios, comunas: pp.perfil.comunas, dormitorios: pp.perfil.dormitorios }, await leerConfigGuia(admin));
    } else if (sinOrigen) {
      // La selección es de esta persona, no tiene origen y trae este aviso; el origen, el sintético con su combinación.
      const deLaFila = await combinacionSemanal(admin, b.semanal!, user.id, null, b.avisoId);
      combo = deLaFila ? elegida ?? deLaFila : null;
      o = combo ? origenSintetico(user.id, { ...combo, comunas: [], dormitorios: [] }, await leerConfigGuia(admin)) : null;
    } else {
      o = await leerOrigenGuia(admin, b.origenId!, { rentaCorta: typeof b.semanal === "string" });
      if (!o || o.userId !== user.id) return NextResponse.json({ error: "origen" }, { status: 403 });
      // La combinación tiene que ser una de las que la guía puede mostrar (la suya o una ajustada); desde el
      // correo semanal, la de esa selección, que tiene que ser de esta persona, de este origen y con este aviso.
      if (typeof b.semanal === "string") {
        const deLaFila = await combinacionSemanal(admin, b.semanal, user.id, o.analysisId, b.avisoId);
        combo = deLaFila ? elegida ?? deLaFila : null;
      } else {
        combo = combinacionesGuia({ piePct: o.piePct, plazoAnios: o.plazoAnios, razonSinPie: o.razonSinPie })
          .find((c) => c.piePct === b.piePct && c.plazoAnios === b.plazoAnios);
      }
    }
    if (!combo || !o) return NextResponse.json({ error: "combinacion" }, { status: 400 });
    const origen: OrigenGuia = o;
    const combinacion: Combinacion = combo;
    const desdeSemanal = typeof b.semanal === "string" || desdeRespaldo;
    const desde: "semanal" | "guia" | "explorar" = desdeExplorar ? "explorar" : desdeSemanal ? "semanal" : "guia";
    const ae = await emitirEventoMeta(admin, {
      evento: EVENTOS_META.analizarEste,
      eventId: idAnalizarEste(b.avisoId, desdeExplorar ? "explorar" : desdeRespaldo ? "respaldo" : desdeSemanal ? b.semanal! : origen.analysisId!),
      userId: user.id,
      email: user.email ?? null,
      datos: { aviso_id: b.avisoId, desde, modalidad: "ltr" },
      contexto: contextoDeRequest(request),
      origen: "analizar-este",
    });
    espejoAE = ae.espejo;
    waitUntil(ae.envio);
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
        // La guía guardada se arma de nuevo, sin este aviso (sin origen no hay guía guardada).
        if (origen.analysisId) await admin.from("guias_calculadas").delete().eq("analysis_id", origen.analysisId);
      },
      async preparar() {
        const aviso = await leerAvisoGuia(admin, b.avisoId!, origen);
        if (!aviso) return { ok: false, status: 404, error: "aviso" };
        const [cfg, ufValue] = await Promise.all([leerConfigGuia(admin), getUFValue()]);
        const antiguedad = await antiguedadDelAviso(admin, aviso, anioLeido);
        const body = await cuerpoDelAviso(aviso, origen, combinacion, antiguedad, { uf: ufValue, tasa: cfg.tasa });
        // De dónde salió (14-oct-2026): el dashboard lo dice en lugar de «SIN DIRECCIÓN».
        if (body?.origenAviso) body.origenAviso.desde = desde;
        if (!body) return { ok: false, status: 422, error: "sin-arriendo" };
        if (Number.isFinite(body.piePct)) body.piePct = redondearPiePct(body.piePct);
        body.methodologyVersion = METHODOLOGY_VERSION_ACTUAL;
        const plausible = guardPlausibilidad(desdeBodyLtr(body, ufValue), { userId: user.id, ruta: RUTA });
        if (!plausible.ok) { plausibleFallo = plausible.response; return { ok: false, status: 422, error: "plausibilidad" }; }

        const clave = { user_id: user.id, aviso_id: aviso.avisoId };
        return { ok: true, piezas: {
          async reclamar() {
            const { error } = await admin.from("guia_analisis").insert({ ...clave, origen_analysis_id: origen.analysisId, pie_pct: combinacion.piePct, plazo: combinacion.plazoAnios });
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
            waitUntil(capturarAnalisisCreado({ userId: user.id, analysisId: id, modalidad: "ltr", via: desde }));
            if (desdeExplorar) {
              waitUntil(capturarServidor(eventoExplorarAnaliza({ userId: user.id, analysisId: id, avisoId: aviso.avisoId, comuna: aviso.comuna, precioUF: aviso.precioUF, m2: aviso.m2, piePct: combinacion.piePct, plazoAnios: combinacion.plazoAnios })).catch(() => false));
            }
            await markPremiumAndClaimPrepaid({ dbClient: admin, analysisId: id, prepaidNeedClaim: false });
            try {
              await guardarPerfil(admin, perfilDesdeLtr(body, readVeredicto(result) ?? null, { analysisId: id, userId: user.id, anonClaimTokenHash: null }));
            } catch (e) {
              console.error("[guia/analizar] perfil de inversión:", e);
            }
            if (user.email) {
              const email = user.email;
              waitUntil(sendAnalysisReadyEmail(
                email, nombreReal(user.user_metadata) ?? "", body.nombre || `${body.comuna} - ${body.superficie}m²`,
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

    if (r.estado === "despublicado") return salir(NextResponse.json({ error: "despublicado" }, { status: 410 }));
    if (r.estado === "sin-preparar") return salir(plausibleFallo ?? NextResponse.json({ error: r.error }, { status: r.status }));
    if (r.estado === "sin-cobro") return salir(NextResponse.json({ error: r.error }, { status: r.status }));
    if (r.estado === "en-curso") return salir(NextResponse.json({ error: "en-curso" }, { status: 409 }));
    return salir(NextResponse.json({ id: r.id, estado: r.estado }));
  } catch (e) {
    captureApiError(e, { ruta: RUTA, operacion: "analizar-aviso", userId: user.id, extra: { avisoId: b.avisoId } });
    return salir(NextResponse.json({ error: "interno" }, { status: 500 }));
  }
}
