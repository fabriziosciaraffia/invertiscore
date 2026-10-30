import { NextResponse } from "next/server";
import { tasaElegidaDe } from "@/lib/deptos/estandar";
import { waitUntil } from "@vercel/functions";
import { getUFValue } from "@/lib/uf";
import { readVeredicto } from "@/lib/results-helpers";
import { sendAnalysisReadyEmail } from "@/lib/email";
import { nombreReal } from "@/lib/welcome";
import { captureApiError } from "@/lib/observabilidad";
import { desdeBodyStr } from "@/lib/plausibilidad";
import { redondearPiePct } from "@/lib/analysis/pie-input-data";
import { reverseGeocode } from "@/lib/services/geocoding";
import { estadoSaldo, leerSaldo } from "@/lib/casa-saldo";
import {
  buildShortTermAnalysisRow, createSupabaseServer, ensureCreditCharged, guardPlausibilidad, markPremiumAndClaimPrepaid, prefetchMercadoStr,
} from "@/lib/api-helpers/analisis-pipeline";
import { createAnonPipelineClient } from "@/lib/api-helpers/anon-cap";
import { guardarPerfil, perfilDesdeStr } from "@/lib/lo-que-sigue/perfil";
import { leerConfigGuia } from "@/lib/guia/guia-servidor";
import { antiguedadDelAviso, fichaDelAviso, leerAvisoGuia } from "@/lib/guia/analizar-servidor";
import { chequearPublicacion } from "@/lib/guia/publicacion";
import { almacenPublicacion, bajarFicha } from "@/lib/guia/ficha-servidor";
import { itemsVigentes, seleccionPorToken } from "@/lib/guia/semanal-servidor";
import { celdaDormitorios, cuerpoStrDeAviso, evaluarStrCon, leerOrigenStr, origenSinteticoStr, reevaluadorConMedicion, zonasDeComuna } from "@/lib/guia/semanal-str-servidor";
import { analizarStrDeSemanal, parecidosQueSobreviven, porQueNoDa, type ComparacionStr } from "@/lib/guia/semanal-str";
import type { EstadoSaldo } from "@/lib/casa-saldo";
import type { AirbnbEstimateResponse } from "@/lib/airbnb/types";
import { EVENTOS_META, idAnalizarEste } from "@/lib/meta/ids";
import { conEspejo, contextoDeRequest, emitirEventoMeta } from "@/lib/meta/servidor";
import type { EventoEspejo } from "@/lib/meta/espejo";
import { capturarAnalisisCreado } from "@/lib/medicion-activacion";
import { capturarServidor } from "@/lib/posthog-servidor";
import { esPiePopup, esPlazoPopup } from "@/lib/explorar/explorar";
import { eventoExplorarAnaliza } from "@/lib/explorar/servidor";

// ─────────────────────────────────────────────────────────────────────────────
// «Analizar este» en un depto de la selección de RENTA CORTA (14-oct-2026, decisión de Fabrizio). El bloque de renta
// corta del semanal se estimó por zona, sin consultas; acá se mide fino, como en el wizard: la dirección del depto (sus
// coordenadas, por la misma geocodificación inversa que usa el wizard) y la consulta al proveedor, con el costo a cargo
// de Franco (contador «semanal»). Sin análisis disponibles NO se mide (ni se paga la consulta): el plan 10 y el plan 50
// con saldo cero llegan acá como «sin» (casa-saldo.ts, 14-oct-2026). Si la medición fina no da Comprar, NO SE COBRA y no
// hay informe: la respuesta es «no-da» con los parecidos que sobreviven —reevaluados con la tarifa y la ocupación recién
// medidas, sin volver a consultar— (semanal-str.ts › parecidosQueSobreviven). Si da Comprar, un crédito, una vez por
// persona y aviso (`semanal_str_analisis`), y el informe de renta corta. Cada comparación queda en
// `comparaciones_zona_str`. Solo con sesión y solo sobre la selección de esa persona.
// «AnalizarEste» (15-oct-2026): el evento propio de Meta sale apenas el pedido es válido, con el espejo para el pixel;
// `analisis_creado` en PostHog cuando el informe se crea.
// EL «NO DA» CON SALIDA (27-oct-2026, decisión de Fabrizio): la respuesta «no-da» trae además el enlace a la publicación
// (el de la ficha recién chequeada), por qué no da en una línea (semanal-str.ts › porQueNoDa) y el saldo con que se midió
// (para «Analizar igual · usa 1 de tus N»). Con `igual: true` —«Analizar igual» en el pop-up— la regla de cobro no corta:
// se cobra un crédito y se crea el informe aunque no dé Comprar. La medición repetida sale del caché del proveedor.
// DESDE EXPLORAR (28-oct-2026, Explorar como portal): con `explorar: true` y sin token, el depto viene del mapa en renta
// corta —«Estimado por zona; se mide al analizar»—, con el pie y el plazo de los filtros (de las listas del pop-up) y el
// origen sintético con la tasa de mercado. Todo lo demás es igual: la ficha se relee, se mide fino, no se cobra si no da
// (salvo «Analizar igual») y la comparación queda registrada sin selección. Sin parecidos: Explorar ya muestra los demás.
// El informe dice «Desde Explorar» (`origenAviso.desde`) y deja «explorar_analiza».
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;
const RUTA = "POST /api/semanal/analizar-str";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{20,80}$/i;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function POST(request: Request) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });

  const b = (await request.json().catch(() => ({}))) as { token?: string; avisoId?: string; igual?: unknown; explorar?: unknown; piePct?: unknown; plazoAnios?: unknown; tasaPct?: unknown };
  // LA TASA ELEGIDA (30-oct-2026): la de Filtros, si viene de Explorar (null = la de hoy).
  if (b.tasaPct != null && tasaElegidaDe(b.tasaPct) == null) return NextResponse.json({ error: "tasa" }, { status: 400 });
  const desdeExplorar = b.explorar === true && b.token == null;
  if ((!desdeExplorar && (!b.token || !TOKEN.test(b.token))) || !b.avisoId || !UUID.test(b.avisoId)) return NextResponse.json({ error: "datos" }, { status: 400 });
  if (desdeExplorar && (!esPiePopup(b.piePct) || !esPlazoPopup(b.plazoAnios))) return NextResponse.json({ error: "combinacion" }, { status: 400 });
  const avisoId = b.avisoId;

  const admin = createAnonPipelineClient();
  let espejoAE: EventoEspejo | null = null;
  const salir = (res: Response) => conEspejo(res, [espejoAE], request);
  try {
    // La selección tiene que ser de esta persona y el depto, de su bloque de renta corta. Desde Explorar no hay selección:
    // el mapa solo muestra los que dan Comprar por zona, y eso es lo que la persona vio.
    const sel = desdeExplorar ? null : await seleccionPorToken(admin, b.token!);
    // Sin informe de origen (16-oct-2026, la puerta B): la selección se armó con el origen sintético; se analiza igual.
    if (!desdeExplorar && (!sel || sel.user_id !== user.id || !sel.corto?.combinacion)) return NextResponse.json({ error: "seleccion" }, { status: 403 });
    const item = desdeExplorar ? { avisoId, veredicto: "COMPRAR", score: null as number | null } : sel!.corto!.items.find((i) => i.avisoId === avisoId);
    if (!item?.veredicto) return NextResponse.json({ error: "aviso" }, { status: 400 });
    const combo = desdeExplorar ? { piePct: Number(b.piePct), plazoAnios: Number(b.plazoAnios) } : sel!.corto!.combinacion!;
    const o = !desdeExplorar && sel!.corto!.origenId
      ? await leerOrigenStr(admin, sel!.corto!.origenId)
      : origenSinteticoStr(user.id, { ...combo, comunas: [], dormitorios: [] }, await leerConfigGuia(admin));
    if (!o || o.userId !== user.id) return NextResponse.json({ error: "origen" }, { status: 403 });
    const desde = desdeExplorar ? "explorar" : "semanal";
    const clave = { user_id: user.id, aviso_id: avisoId };
    const ae = await emitirEventoMeta(admin, {
      evento: EVENTOS_META.analizarEste,
      eventId: idAnalizarEste(avisoId, desdeExplorar ? "explorar" : b.token!),
      userId: user.id,
      email: user.email ?? null,
      datos: { aviso_id: avisoId, desde, modalidad: "str" },
      contexto: contextoDeRequest(request),
      origen: "analizar-este",
    });
    espejoAE = ae.espejo;
    waitUntil(ae.envio);

    let anioLeido: number | null = null;
    // La medición fina y la config con que se hizo: con ellas se reevalúan los parecidos si no da.
    let medida: { estimacion: Extract<AirbnbEstimateResponse, { success: true }>; cfg: { uf: number; tasa: number } } | null = null;
    let plausibleFallo: Response | null = null;
    // Para el pop-up «no da»: el enlace de la ficha que se chequeó y el saldo con que se midió.
    let publicacion: string | null = null;
    let saldoAlMedir: EstadoSaldo | null = null;
    const r = await analizarStrDeSemanal({
      igual: b.igual === true,
      async yaCreado() {
        const { data } = await admin.from("semanal_str_analisis").select("analysis_id").match(clave).maybeSingle();
        return (data?.analysis_id as string | null) ?? null;
      },
      async chequear() {
        // La red, como en renta larga: la ficha se chequea de nuevo antes de medir (y de cualquier cobro).
        const ficha = await fichaDelAviso(admin, avisoId);
        if (!ficha) return "sin-chequeo";
        const c = await chequearPublicacion(ficha, "clic", almacenPublicacion(admin), bajarFicha, { forzar: true });
        anioLeido = c.lectura?.leida ? c.lectura.anio : null;
        publicacion = ficha.url;
        return c.estado;
      },
      async alDespublicar() {
        // La página lo marca como caído y trae el siguiente (seleccionViva).
      },
      async preparar() {
        // Sin análisis disponibles no se mide: la consulta al proveedor se pagaría para nada.
        const saldo = estadoSaldo(await leerSaldo(admin, user.id));
        if (saldo.tipo === "sin") return { ok: false, status: 402, error: "sin-creditos" };
        saldoAlMedir = saldo;
        const aviso = await leerAvisoGuia(admin, avisoId, o);
        if (!aviso) return { ok: false, status: 404, error: "aviso" };
        const [cfg, ufValue] = await Promise.all([leerConfigGuia(admin), getUFValue()]);
        const antiguedad = await antiguedadDelAviso(admin, aviso, anioLeido);
        // La dirección, como en el wizard: el punto del aviso por la geocodificación inversa. Sin dirección no hay medición.
        const lugar = await reverseGeocode(aviso.lat, aviso.lng);
        if (!lugar?.direccion) return { ok: false, status: 422, error: "sin-direccion" };
        // La tasa (30-oct-2026): la elegida o la de la selección; sin ella, la del motor (no la del último informe).
        const tasaElegida = "tasaPct" in b ? tasaElegidaDe(b.tasaPct) : ((combo as { tasaPct?: number | null }).tasaPct ?? null);
        const body = cuerpoStrDeAviso(aviso, { ...o, tasa: tasaElegida ?? cfg.tasa }, combo, cfg, { antiguedadAnios: antiguedad.anios, direccion: lugar.direccion });
        if (!body) return { ok: false, status: 422, error: "sin-arriendo" };
        // De qué aviso salió (15-oct-2026): como en renta larga, el informe ofrece «Quiero verlo». Y la tasa elegida.
        body.origenAviso = { avisoId, antiguedad: antiguedad.origen, origenAnalysisId: o.analysisId ?? undefined, desde, ...(tasaElegida != null ? { tasaElegida, tasaMercado: cfg.tasa } : {}) };
        if (Number.isFinite(body.piePct)) body.piePct = redondearPiePct(body.piePct);
        const plausible = guardPlausibilidad(desdeBodyStr(body, ufValue), { userId: user.id, ruta: RUTA });
        if (!plausible.ok) { plausibleFallo = plausible.response; return { ok: false, status: 422, error: "plausibilidad" }; }
        const mercado = await prefetchMercadoStr(admin, {
          comuna: body.comuna ?? aviso.comuna, superficie: body.superficieUtil, dormitorios: body.dormitorios, esNuevo: body.tipoPropiedad === "nuevo", antiguedad: body.antiguedad,
        }, ufValue);
        // La zona recalculada con ESTE cuerpo (la comparación aísla lo que mide el proveedor) y la medición fina.
        const zona = (await zonasDeComuna(admin, aviso.comuna)).get(celdaDormitorios(aviso.dormitorios));
        const zonaEv = zona ? evaluarStrCon(body, zona.estimacion, { uf: ufValue }, mercado, new Date()) : null;
        const built = await buildShortTermAnalysisRow(body, ufValue, mercado, undefined, { origen: "semanal" });
        if (!built.ok) return { ok: false, status: built.response.status, error: "medicion" };
        medida = { estimacion: built.estimacion, cfg };
        const fila = built.row as Record<string, unknown> & { results: Record<string, unknown> };
        const res = fila.results as { veredicto?: string; francoScore?: { score?: number }; escenarios?: { base?: { adrReferencia?: number; ocupacionReferencia?: number } } };
        const base = res.escenarios?.base;
        const fino = {
          veredicto: res.veredicto ?? null,
          score: num(res.francoScore?.score) != null ? Math.round(res.francoScore!.score!) : null,
          adr: num(base?.adrReferencia) != null ? Math.round(base!.adrReferencia!) : null,
          ocupacion: num(base?.ocupacionReferencia) != null ? Math.round(base!.ocupacionReferencia! * 1000) / 1000 : null,
        };
        return {
          ok: true,
          m: {
            // Desde Explorar lo mostrado es la zona con este mismo cuerpo (el mapa dio Comprar por zona).
            mostrado: { veredicto: item.veredicto!, score: item.score ?? (desdeExplorar ? zonaEv?.score ?? null : null) },
            zona: zonaEv ? { veredicto: zonaEv.veredicto, score: zonaEv.score, adr: zonaEv.adr, ocupacion: zonaEv.ocupacion } : null,
            fino,
            piezas: {
              async reclamar() {
                const { error } = await admin.from("semanal_str_analisis").insert({ ...clave, origen_analysis_id: o.analysisId, pie_pct: combo.piePct, plazo: combo.plazoAnios });
                if (!error) return { nueva: true };
                if (error.code !== "23505") throw new Error(`reclamar: ${error.message}`);
                const { data } = await admin.from("semanal_str_analisis").select("analysis_id, cobrado_at, charge_mode, reclamado_at").match(clave).maybeSingle();
                return {
                  nueva: false,
                  analysisId: (data?.analysis_id as string | null) ?? null,
                  cobrado: !!data?.cobrado_at,
                  chargeMode: (data?.charge_mode as string | null) ?? null,
                  reclamadoHaceMs: data?.reclamado_at ? Date.now() - new Date(data.reclamado_at as string).getTime() : 0,
                };
              },
              async retomar() {
                const { data } = await admin.from("semanal_str_analisis").select("reclamado_at").match(clave).maybeSingle();
                if (!data) return false;
                const { data: ganada } = await admin.from("semanal_str_analisis").update({ reclamado_at: new Date().toISOString() })
                  .match({ ...clave, reclamado_at: data.reclamado_at }).is("analysis_id", null).select("user_id");
                return (ganada?.length ?? 0) === 1;
              },
              async cobrar() {
                const c = await ensureCreditCharged({ user });
                return c.ok ? { ok: true, mode: c.mode } : { ok: false, status: c.response.status, error: "sin-creditos" };
              },
              async marcarCobrado(mode) {
                await admin.from("semanal_str_analisis").update({ cobrado_at: new Date().toISOString(), charge_mode: mode }).match(clave);
              },
              async crear(mode) {
                const { data, error } = await admin.from("analisis").insert({
                  ...fila,
                  charge_mode: mode,
                  user_id: user.id,
                  creator_name: user.user_metadata?.nombre || user.user_metadata?.full_name || "Anónimo",
                  is_premium: false,
                }).select("id, nombre, score, results, resumen").single();
                if (error || !data) throw new Error(`insert: ${error?.message ?? "sin fila"}`);
                const id = data.id as string;
                waitUntil(capturarAnalisisCreado({ userId: user.id, analysisId: id, modalidad: "str", via: desde }));
                if (desdeExplorar) waitUntil(capturarServidor(eventoExplorarAnaliza({ userId: user.id, analysisId: id, avisoId, comuna: aviso.comuna, precioUF: aviso.precioUF, m2: aviso.m2, piePct: combo.piePct, plazoAnios: combo.plazoAnios })).then(() => undefined).catch(() => undefined));
                await markPremiumAndClaimPrepaid({ dbClient: admin, analysisId: id, prepaidNeedClaim: false });
                try {
                  await guardarPerfil(admin, perfilDesdeStr(body, (fila as { resumen?: string | null }).resumen ?? null, { analysisId: id, userId: user.id, anonClaimTokenHash: null }));
                } catch (e) {
                  console.error("[semanal/analizar-str] perfil de inversión:", e);
                }
                if (user.email) {
                  const titulo = (data.nombre as string | null) || `${body.comuna} - ${body.superficieUtil}m²`;
                  const veredicto = readVeredicto(data.results as never) ?? ((data.resumen as string | null) || "AJUSTA SUPUESTOS");
                  waitUntil(sendAnalysisReadyEmail(user.email, nombreReal(user.user_metadata) ?? "", titulo, Number(data.score) || 0, veredicto, id, undefined, { userId: user.id })
                    .catch((e) => console.error("[semanal/analizar-str] correo listo:", e)));
                }
                return { id };
              },
              async marcarCreado(id) {
                await admin.from("semanal_str_analisis").update({ analysis_id: id, creado_at: new Date().toISOString() }).match(clave);
              },
              async soltar() {
                await admin.from("semanal_str_analisis").delete().match(clave).is("analysis_id", null);
              },
            },
          },
        };
      },
      async registrar(c: ComparacionStr) {
        // Una por persona y aviso: la medición fina queda en caché y repetirla no es otra observación.
        const { error } = await admin.from("comparaciones_zona_str").upsert({
          ...clave, seleccion_id: sel?.id ?? null,
          zona_mostrado: c.mostrado, zona_score: c.mostradoScore,
          zona_veredicto: c.zona?.veredicto ?? null, zona_adr: c.zona?.adr ?? null, zona_ocupacion: c.zona?.ocupacion ?? null,
          fino_veredicto: c.fino.veredicto ?? "—", fino_score: c.fino.score, fino_adr: c.fino.adr, fino_ocupacion: c.fino.ocupacion,
          cambio: c.cambio, cobrado: c.cobrado, analysis_id: c.analysisId, medido_at: new Date().toISOString(),
        }, { onConflict: "user_id,aviso_id" });
        if (error) captureApiError(new Error(`comparación: ${error.message}`), { ruta: RUTA, operacion: "registrar-comparacion", userId: user.id });
      },
      async alternativas() {
        // Los siguientes de su selección, vigentes, sin los que ya se sabe que no dan, y solo los que SIGUEN dando
        // Comprar con la tarifa y la ocupación recién medidas (el mismo cuerpo que su estimación por zona, con la
        // medición fina en lugar de la zona; sin consultar al proveedor).
        if (!sel) return [];
        const [vigentes, { data: noDan }] = await Promise.all([
          itemsVigentes(admin, sel.corto!.items),
          admin.from("comparaciones_zona_str").select("aviso_id").eq("user_id", user.id).neq("fino_veredicto", "COMPRAR"),
        ]);
        const excluir = new Set((noDan ?? []).map((x) => x.aviso_id as string));
        if (!medida) return [];
        const sobreviven = await parecidosQueSobreviven(vigentes, avisoId, excluir, reevaluadorConMedicion(admin, o, combo, medida));
        return sobreviven.map((i) => i.avisoId);
      },
    });

    if (r.estado === "despublicado") return salir(NextResponse.json({ error: "despublicado" }, { status: 410 }));
    if (r.estado === "sin-preparar") return salir(plausibleFallo ?? NextResponse.json({ error: r.error }, { status: r.status }));
    if (r.estado === "sin-cobro") return salir(NextResponse.json({ error: r.error }, { status: r.status }));
    if (r.estado === "en-curso") return salir(NextResponse.json({ error: "en-curso" }, { status: 409 }));
    if (r.estado === "no-da") {
      return salir(NextResponse.json({ estado: "no-da", alternativas: r.alternativas, publicacion, porQue: porQueNoDa(r.zona, r.fino), saldo: saldoAlMedir }));
    }
    return salir(NextResponse.json({ id: r.id, estado: r.estado }));
  } catch (e) {
    captureApiError(e, { ruta: RUTA, operacion: "analizar-aviso-str", userId: user.id, extra: { avisoId } });
    return salir(NextResponse.json({ error: "interno" }, { status: 500 }));
  }
}
