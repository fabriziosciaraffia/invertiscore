import { NextResponse } from "next/server";
import { tasaElegidaDe } from "@/lib/deptos/estandar";
import { waitUntil } from "@vercel/functions";
import { runAnalysis, sondaConPatch } from "@/lib/analysis";
import { METHODOLOGY_VERSION_ACTUAL } from "@/lib/modelo-costos";
import { getUFValue } from "@/lib/uf";
import { readVeredicto } from "@/lib/results-helpers";
import { sendAnalysisReadyEmail } from "@/lib/email";
import { referidoTrasAnalisis } from "@/lib/referido-servidor";
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
import { antiguedadDelAviso, cuerpoDelAviso, fichaDelAviso, leerAvisoGuia, lecturaAnioDe, type LecturaAnio } from "@/lib/guia/analizar-servidor";
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
import { esTopeNegociar, precioNegociadoValido } from "@/lib/explorar/capa-negociar";
import { verificarNegociado } from "@/lib/avisos/negociar";
import { devolverCobro } from "@/lib/access";
import { EVENTO_DETALLE_ABIERTO, MODO_INVIERTE, verGratisInvierte } from "@/lib/invierte-v2/detalles";
import { chequearPublicacionInvierte, detallesPreparados } from "@/lib/invierte-v2/carril-servidor";
import { avisadoDelCambio, cambioDeVeredicto, type MarcaCambio, type Mostrado, type VeredictoHoy } from "@/lib/guia/cobro-mostrado";
import { sugerenciasDeAviso } from "@/lib/avisos/evaluar-aviso";
import { avisoDeCandidato } from "@/lib/guia/guia-servidor";
import { reevaluarYGuardarFila } from "@/lib/avisos/fila-evaluada";
import { mostradoDeGuia, mostradoDePantalla, mostradoDelCorreo } from "@/lib/guia/mostrado-servidor";
import { devolverCobroPorCambio } from "@/lib/guia/cobro-mostrado-servidor";

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
// AL PRECIO NEGOCIADO (02-nov-2026, la capa «Si negocias» de Explorar: «Analizar a UF 2.950»): solo desde Explorar, con el tope
// elegido (5 % o 10 %). El precio tiene que estar entre el publicado menos el tope y el publicado; el informe se hace a ese precio
// (todo lo que deriva del precio, como en el re-análisis) y queda marcado con los dos precios (`origenAviso.precioNegociado`),
// que la portada dice. `analisis_creado` lleva la marca. El crédito, el de siempre: una vez por persona y aviso.
// LO MOSTRADO CONTRA HOY (23-nov-2026, decisión de Fabrizio, cobro-mostrado.ts): con el cuerpo de hoy ya armado y antes de reclamar
// o cobrar, se corre el motor. Si su veredicto es otro que el que la persona vio (reconstruido acá: el ítem del correo por su token,
// o la sonda de la pantalla con la misma combinación), la ruta responde normal (200) con `estado: "cambio"`, sin cobrar ni mandar a pagar; con
// `aceptoCambio: true` sigue, cobra y el informe queda marcado (`origenAviso.cambioAvisado`). Si igual se crea distinto sin aviso, el
// crédito vuelve solo (`origenAviso.cobroDevuelto`, `devuelto: true` en la respuesta). El precio negociado tiene su propia verificación.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 60;
const RUTA = "POST /api/lo-que-sigue/guia/analizar";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sin-sesion" }, { status: 401 });

  const b = (await request.json().catch(() => ({}))) as { origenId?: string | null; avisoId?: string; piePct?: number; plazoAnios?: number; tasaPct?: unknown; semanal?: string; explorar?: boolean; respaldo?: boolean; precioNegociadoUF?: unknown; topeNegociar?: unknown; invierte?: boolean; origenInvierte?: string; aceptoCambio?: boolean };
  // LA TASA ELEGIDA (30-oct-2026): la del pop-up (null = la de hoy); una que no es de la lista no se acepta.
  if (b.tasaPct != null && tasaElegidaDe(b.tasaPct) == null) return NextResponse.json({ error: "tasa" }, { status: 400 });
  const sinOrigen = typeof b.semanal === "string" && b.origenId == null;
  const desdeExplorar = b.explorar === true && b.origenId == null && typeof b.semanal !== "string";
  const desdeRespaldo = b.respaldo === true && !desdeExplorar && b.origenId == null && typeof b.semanal !== "string";
  if ((!sinOrigen && !desdeExplorar && !desdeRespaldo && (!b.origenId || !UUID.test(b.origenId))) || !b.avisoId || !UUID.test(b.avisoId)) return NextResponse.json({ error: "datos" }, { status: 400 });
  // El precio negociado: solo desde Explorar, en UF enteras y con un tope de la lista; el piso se mide contra el aviso, abajo.
  const negociadoUF = b.precioNegociadoUF == null ? null : Number(b.precioNegociadoUF);
  if (negociadoUF != null && (!desdeExplorar || !Number.isInteger(negociadoUF) || negociadoUF <= 0 || !esTopeNegociar(b.topeNegociar))) return NextResponse.json({ error: "precio-negociado" }, { status: 400 });

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
    // LO MOSTRADO DESDE UN CORREO (23-nov-2026): con la combinación del correo, el ítem tal como salió (por el token). Con otra
    // combinación elegida en el pop-up, lo mostrado es la sonda de la pantalla (abajo, en `preparar`).
    const desdeCorreo = typeof b.semanal === "string" && !elegida && negociadoUF == null;
    const mostradoCorreo: Mostrado | null = desdeCorreo ? await mostradoDelCorreo(admin, b.semanal!, user.id, b.avisoId).catch(() => null) : null;
    // El piso del precio negociado, ANTES del evento de Meta y de leer la ficha (dos GETs del tope por hora): un precio fuera del
    // tope no gasta nada. `preparar` lo vuelve a mirar con el aviso que usa.
    if (negociadoUF != null) {
      const avisoNeg = await leerAvisoGuia(admin, b.avisoId, origen);
      if (!avisoNeg) return NextResponse.json({ error: "aviso" }, { status: 404 });
      if (!precioNegociadoValido(negociadoUF, avisoNeg.precioUF, Number(b.topeNegociar))) return NextResponse.json({ error: "precio-negociado" }, { status: 400 });
    }
    const desdeSemanal = typeof b.semanal === "string" || desdeRespaldo;
    const desde: "semanal" | "guia" | "explorar" = desdeExplorar ? "explorar" : desdeSemanal ? "semanal" : "guia";
    // INVIERTE CON FRANCO (etapa 2, 18-nov-2026): quien firmó la orden ve los detalles de un usado del mapa sin gastar un
    // crédito (charge_mode 'invierte'), y mientras el modo sea lista ese pedido no manda eventos a Meta.
    const gratisInvierte = desdeExplorar ? await verGratisInvierte(admin, user, b.avisoId) : false;
    // EL CARRIL DE INVIERTE (entrega 2, 18-nov-2026, aprobado por Fabrizio): desde el flujo nuevo (`invierte: true`), lo ya
    // preparado se abre directo —sin leer la ficha ni preparar de nuevo— y lo que no, lee la ficha por el carril propio
    // (carril.ts: su tope, su bitácora, su memoria de 24 horas y su fusible), no por el tope de 30 por hora del mapa.
    const modoInvierte = gratisInvierte && b.invierte === true;
    if (modoInvierte) {
      const ya = await detallesPreparados(admin, user.id, b.avisoId);
      if (ya) return salir(NextResponse.json({ id: ya, estado: "ya-creado", veredicto: null, score: null }));
    }
    const ae = gratisInvierte ? null : await emitirEventoMeta(admin, {
      evento: EVENTOS_META.analizarEste,
      eventId: idAnalizarEste(b.avisoId, desdeExplorar ? "explorar" : desdeRespaldo ? "respaldo" : desdeSemanal ? b.semanal! : origen.analysisId!),
      userId: user.id,
      email: user.email ?? null,
      datos: { aviso_id: b.avisoId, desde, modalidad: "ltr" },
      contexto: contextoDeRequest(request),
      origen: "analizar-este",
    });
    if (ae) {
      espejoAE = ae.espejo;
      waitUntil(ae.envio);
    }
    // La red: la ficha se chequea de nuevo ANTES de cualquier cobro (publicacion.ts). La misma lectura trae el año.
    let lecturaAnio: LecturaAnio = { leida: false, anio: null };
    let plausibleFallo: Response | null = null;
    // El precio negociado verificado con los datos de hoy (02-nov-2026): la respuesta si se movió o ya no llega, y la mediana
    // con que se verificó, que es la que usa el informe.
    let negociadoFallo: Response | null = null;
    let medianaDeHoy: Awaited<ReturnType<typeof prefetchMedianaComunaVenta>> | null = null;
    // El veredicto y el puntaje del informe (03-nov-2026, lib/guia/informe-en-camino.ts): el pop-up los compara con los de la
    // tarjeta y, si el veredicto es otro, lo dice antes de abrirlo.
    let delInforme: { veredicto: string | null; score: number | null } | null = null;
    // EN PARALELO CON LA FICHA (23-nov-2026, Fabrizio: «el aviso tarda 6,4 s»): los comparables del aviso y la UF no dependen de
    // la lectura de la ficha (las sugerencias miran comuna, m², dormitorios, precio y punto, no la edad), así que arrancan ya y
    // `preparar` las espera. Antes iban en serie después de la ficha. Con precio negociado, el cuerpo es a otro precio: sin adelantar.
    const ufTemprana = getUFValue().catch(() => null);
    const sugTemprana = negociadoUF == null
      ? leerAvisoGuia(admin, b.avisoId, origen).then((a) => (a ? sugerenciasDeAviso(avisoDeCandidato(a, null)) : null)).catch(() => null)
      : Promise.resolve(null);
    // El flujo de hoy, para que la tarjeta del mapa muestre el número de hoy cuando cambió (23-nov-2026).
    let flujoHoy: number | null = null;
    const r = await analizarAvisoDeGuia({
      async chequear() {
        if (modoInvierte) {
          const c = await chequearPublicacionInvierte(admin, { avisoId: b.avisoId!, userId: user.id, origen: b.origenInvierte === "elegir" ? "elegir" : "abrir" });
          lecturaAnio = lecturaAnioDe(c.lectura);
          return c.estado;
        }
        const ficha = await fichaDelAviso(admin, b.avisoId!);
        if (!ficha) return "sin-chequeo";
        const c = await chequearPublicacion(ficha, "clic", almacenPublicacion(admin), bajarFicha, { forzar: true });
        lecturaAnio = lecturaAnioDe(c.lectura);
        return c.estado;
      },
      async alDespublicar() {
        // La guía guardada se arma de nuevo, sin este aviso (sin origen no hay guía guardada).
        if (origen.analysisId) await admin.from("guias_calculadas").delete().eq("analysis_id", origen.analysisId);
      },
      async preparar() {
        const aviso = await leerAvisoGuia(admin, b.avisoId!, origen);
        if (!aviso) return { ok: false, status: 404, error: "aviso" };
        // El precio negociado, entre el publicado menos el tope elegido y el publicado (02-nov-2026).
        const publicadoUF = Math.round(aviso.precioUF);
        if (negociadoUF != null && !precioNegociadoValido(negociadoUF, aviso.precioUF, Number(b.topeNegociar))) return { ok: false, status: 400, error: "precio-negociado" };
        const precioNegociado = negociadoUF != null ? { publicadoUF, negociadoUF, descuentoPct: Math.round((1 - negociadoUF / publicadoUF) * 1000) / 10 } : null;
        const [cfg, ufValue] = await Promise.all([leerConfigGuia(admin), ufTemprana.then((u) => u ?? getUFValue())]);
        const sugLeidas = precioNegociado ? null : await sugTemprana;
        const antiguedad = await antiguedadDelAviso(admin, aviso, lecturaAnio);
        // LA TASA (30-oct-2026): la elegida en el pop-up o la de la selección; sin ella, la del motor —también desde el semanal
        // con un informe de origen (decisión de Fabrizio: no la del último informe)—. La guía sigue con la de su informe.
        const tasaElegida = "tasaPct" in b ? tasaElegidaDe(b.tasaPct) : (combinacion.tasaPct ?? null);
        const conTasa: OrigenGuia = { ...origen, tasa: tasaElegida ?? (desde === "guia" ? origen.tasa : cfg.tasa) };
        const body = await cuerpoDelAviso(precioNegociado ? { ...aviso, precioUF: precioNegociado.negociadoUF } : aviso, conTasa, combinacion, antiguedad, { uf: ufValue, tasa: cfg.tasa }, sugLeidas ?? undefined);
        // De dónde salió (14-oct-2026): el dashboard lo dice en lugar de «SIN DIRECCIÓN». Y la tasa elegida: la portada la dice.
        if (body?.origenAviso) body.origenAviso.desde = desde;
        if (body?.origenAviso && tasaElegida != null) { body.origenAviso.tasaElegida = tasaElegida; body.origenAviso.tasaMercado = cfg.tasa; }
        if (body?.origenAviso && precioNegociado) body.origenAviso.precioNegociado = precioNegociado;
        if (!body) return { ok: false, status: 422, error: "sin-arriendo" };
        if (Number.isFinite(body.piePct)) body.piePct = redondearPiePct(body.piePct);
        body.methodologyVersion = METHODOLOGY_VERSION_ACTUAL;
        const plausible = guardPlausibilidad(desdeBodyLtr(body, ufValue), { userId: user.id, ruta: RUTA });
        if (!plausible.ok) { plausibleFallo = plausible.response; return { ok: false, status: 422, error: "plausibilidad" }; }
        // EL PRECIO NEGOCIADO, CON LOS DATOS DE HOY (02-nov-2026, decisión de Fabrizio): la noche lo dejó en el piso de Comprar con
        // sus comparables; antes de reclamar y de cobrar, el informe a ese precio tiene que dar Comprar. Si no, el precio de hoy
        // vuelve al pop-up (412, sin cobrar) o la ruta dice que ya no llega dentro del tope.
        if (precioNegociado && negociadoUF != null) {
          const mediana = await prefetchMedianaComunaVenta(admin, body, ufValue);
          medianaDeHoy = mediana;
          const asOf = new Date();
          const informeEn = async (precioUF: number) => {
            const c = precioUF === negociadoUF ? body : await cuerpoDelAviso({ ...aviso, precioUF }, conTasa, combinacion, antiguedad, { uf: ufValue, tasa: cfg.tasa });
            if (!c) return { veredicto: null, score: null, flujo: null };
            if (c !== body) { if (Number.isFinite(c.piePct)) c.piePct = redondearPiePct(c.piePct); c.methodologyVersion = METHODOLOGY_VERSION_ACTUAL; }
            const r = runAnalysis(c, ufValue, mediana);
            return { veredicto: readVeredicto(r) ?? null, score: r.score ?? null, flujo: r.metrics?.flujoNetoMensual ?? null };
          };
          const tope = Number(b.topeNegociar);
          const v = await verificarNegociado({ publicadoUF: aviso.precioUF, negociadoUF, tope, comprarEn: (precioUF) => sondaConPatch(body, ufValue, mediana, asOf, { precio: precioUF }).veredicto === "COMPRAR", informeEn });
          if (v.estado === "movido" && precioNegociadoValido(v.negociado.p, aviso.precioUF, tope)) {
            negociadoFallo = NextResponse.json({ error: "precio-movido", negociado: v.negociado }, { status: 412 });
            return { ok: false, status: 412, error: "precio-movido" };
          }
          if (v.estado !== "sigue") {
            negociadoFallo = NextResponse.json({ error: "no-llega", tope }, { status: 412 });
            return { ok: false, status: 412, error: "no-llega" };
          }
        }

        // LO MOSTRADO CONTRA HOY (23-nov-2026, cobro-mostrado.ts): el veredicto de hoy sale del MISMO cuerpo y la MISMA mediana con
        // que `crear` hará el informe; lo mostrado, del correo o de la sonda de la pantalla con esta combinación y esta tasa.
        let cotejo: { mostrado: Mostrado | null; hoy: VeredictoHoy | null; aceptoCambio: boolean } | null = null;
        if (negociadoUF == null) {
          // Desde la guía, la guía guardada que la persona tiene en pantalla (puede tener hasta 12 horas); sin ella, la sonda.
          const mostradoGuia = !desdeCorreo && desde === "guia" && origen.analysisId
            ? await mostradoDeGuia(admin, origen.analysisId, aviso.avisoId, combinacion).catch(() => null)
            : null;
          const mostrado = desdeCorreo
            ? mostradoCorreo
            : mostradoGuia ?? mostradoDePantalla(aviso, { piePct: combinacion.piePct, plazoAnios: combinacion.plazoAnios, tasa: tasaElegida ?? (desde === "guia" ? origen.tasa : null) }, { uf: ufValue, tasa: cfg.tasa });
          if (mostrado) {
            medianaDeHoy = medianaDeHoy ?? await prefetchMedianaComunaVenta(admin, body, ufValue);
            const r0 = runAnalysis(body, ufValue, medianaDeHoy);
            const hoy: VeredictoHoy = { veredicto: readVeredicto(r0) ?? null, score: typeof r0.score === "number" ? r0.score : null };
            flujoHoy = typeof r0.metrics?.flujoNetoMensual === "number" ? Math.round(r0.metrics.flujoNetoMensual) : null;
            cotejo = { mostrado, hoy, aceptoCambio: b.aceptoCambio === true || modoInvierte };
            // LA FILA GUARDADA SE ACTUALIZA EN ESE MOMENTO (23-nov-2026, decisión de Fabrizio): si lo de hoy es otro veredicto que lo
            // mostrado, se reevalúa el aviso con la función de la noche y se guarda, para que el mapa y los correos dejen de mostrar el
            // número viejo a todos. En segundo plano: no demora la respuesta.
            if (cambioDeVeredicto(mostrado, hoy.veredicto)) {
              waitUntil(reevaluarYGuardarFila(admin, avisoDeCandidato(aviso), cfg, sugLeidas ? { sug: sugLeidas } : {})
                .then((x) => { if (!x.ok) captureApiError(new Error(`no se actualizó la fila: ${x.error}`), { ruta: RUTA, operacion: "actualizar-fila-por-cambio", userId: user.id, extra: { avisoId: aviso.avisoId } }); })
                .catch((e) => captureApiError(e, { ruta: RUTA, operacion: "actualizar-fila-por-cambio", userId: user.id, extra: { avisoId: aviso.avisoId } })));
            }
            // Siguió tras el aviso: el informe lo guarda (se cobra normal).
            if (avisadoDelCambio(cotejo) && body.origenAviso) body.origenAviso.cambioAvisado = { mostrado: { veredicto: mostrado.veredicto, score: mostrado.score, at: mostrado.at, fuente: mostrado.fuente }, hoy };
          }
        }

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
            if (gratisInvierte) return { ok: true, mode: MODO_INVIERTE, devolucion: { tipo: "nada" } };
            const c = await ensureCreditCharged({ user });
            return c.ok ? { ok: true, mode: c.mode, devolucion: c.devolucion } : { ok: false, status: c.response.status, error: "sin-creditos" };
          },
          async marcarCobrado(mode) {
            await admin.from("guia_analisis").update({ cobrado_at: new Date().toISOString(), charge_mode: mode }).match(clave);
          },
          async crear(mode) {
            const medianaComuna = medianaDeHoy ?? await prefetchMedianaComunaVenta(admin, body, ufValue);
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
            delInforme = { veredicto: readVeredicto(result) ?? null, score: result.score ?? null };
            waitUntil(capturarAnalisisCreado({ userId: user.id, analysisId: id, modalidad: "ltr", via: desde, cobro: mode, precioNegociado }));
            if (mode === MODO_INVIERTE) waitUntil(capturarServidor({ event: EVENTO_DETALLE_ABIERTO, distinctId: user.id, correo: user.email ?? null, properties: { analysis_id: id, aviso_id: aviso.avisoId } }).catch(() => false));
            // EL PREMIO DEL REFERIDO (05-nov-2026): el primer análisis del invitado le da uno a quien invitó.
            waitUntil(referidoTrasAnalisis(user.id));
            if (desdeExplorar) {
              waitUntil(capturarServidor(eventoExplorarAnaliza({ userId: user.id, analysisId: id, avisoId: aviso.avisoId, comuna: aviso.comuna, precioUF: aviso.precioUF, m2: aviso.m2, piePct: combinacion.piePct, plazoAnios: combinacion.plazoAnios })).catch(() => false));
            }
            await markPremiumAndClaimPrepaid({ dbClient: admin, analysisId: id, prepaidNeedClaim: false });
            try {
              await guardarPerfil(admin, perfilDesdeLtr(body, readVeredicto(result) ?? null, { analysisId: id, userId: user.id, anonClaimTokenHash: null }));
            } catch (e) {
              console.error("[guia/analizar] perfil de inversión:", e);
            }
            const veredictoInforme = readVeredicto(result) ?? null;
            if (user.email) {
              const email = user.email;
              waitUntil(sendAnalysisReadyEmail(
                email, nombreReal(user.user_metadata) ?? "", body.nombre || `${body.comuna} - ${body.superficie}m²`,
                result.score, readVeredicto(result) || "AJUSTA SUPUESTOS", id, undefined, { userId: user.id },
              ).catch((e) => console.error("[guia/analizar] correo listo:", e)));
            }
            return { id, veredicto: veredictoInforme };
          },
          async marcarCreado(id) {
            await admin.from("guia_analisis").update({ analysis_id: id, creado_at: new Date().toISOString() }).match(clave);
          },
          // La creación falló (04-nov-2026): el crédito vuelve, a su lote si se sabe (access.ts › devolverCobro).
          async devolver(d) {
            await devolverCobro(user.id, d);
          },
          async soltar() {
            await admin.from("guia_analisis").delete().match(clave).is("analysis_id", null);
          },
          // LO MOSTRADO CONTRA HOY (23-nov-2026, cobro-mostrado.ts): el cotejo que el orquestador mira antes de cobrar.
          cotejo,
          // EL RESPALDO (23-nov-2026): el informe salió distinto a lo mostrado sin aviso → crédito nuevo `devolucion_cobro`, la marca
          // en el informe (la portada la dice) y la fila del admin.
          async devolverPorCambio(id: string, _d, marca: MarcaCambio) {
            const grantId = await devolverCobroPorCambio(admin, { userId: user.id, userEmail: user.email ?? null, analysisId: id, avisoId: aviso.avisoId, marca, desde });
            if (!grantId) { captureApiError(new Error("No se pudo devolver el cobro por cambio de veredicto"), { ruta: RUTA, operacion: "devolver-por-cambio", userId: user.id, extra: { analysisId: id } }); return false; }
            if (body.origenAviso) body.origenAviso.cobroDevuelto = { ...marca, grantId, at: new Date().toISOString() };
            const { error } = await admin.from("analisis").update({ input_data: body }).eq("id", id);
            if (error) captureApiError(error, { ruta: RUTA, operacion: "marcar-cobro-devuelto", userId: user.id, extra: { analysisId: id, grantId } });
            return true;
          },
        } };
      },
    });

    if (r.estado === "despublicado") return salir(NextResponse.json({ error: "despublicado" }, { status: 410 }));
    if (r.estado === "sin-preparar") return salir(plausibleFallo ?? negociadoFallo ?? NextResponse.json({ error: r.error }, { status: r.status }));
    if (r.estado === "sin-cobro") return salir(NextResponse.json({ error: r.error }, { status: r.status }));
    if (r.estado === "en-curso") return salir(NextResponse.json({ error: "en-curso" }, { status: 409 }));
    // CAMBIÓ DESDE QUE SE MOSTRÓ (23-nov-2026): no se reclamó ni se cobró; el pop-up pregunta si lo analiza igual. Respuesta normal
    // (200) con su estado, no un error (Fabrizio: un 412 dejaba un error en la consola del navegador).
    if (r.estado === "cambio") return salir(NextResponse.json({ estado: "cambio", mostrado: { veredicto: r.mostrado.veredicto, score: r.mostrado.score }, ahora: { ...r.hoy, flujo: flujoHoy } }));
    // No salió y el crédito volvió (04-nov-2026): el pop-up dice que falló, sin cobro.
    if (r.estado === "fallo") {
      captureApiError(r.error, { ruta: RUTA, operacion: "analizar-aviso-crear", userId: user.id, tags: { credito: "devuelto" } });
      return salir(NextResponse.json({ error: "interno" }, { status: 500 }));
    }
    // Ya estaba creado (otro clic, otra pestaña): su veredicto se lee de la fila.
    if (!delInforme) {
      const { data: fila } = await admin.from("analisis").select("results").eq("id", r.id).maybeSingle();
      const res = (fila?.results ?? null) as Parameters<typeof readVeredicto>[0] | null;
      delInforme = res ? { veredicto: readVeredicto(res) ?? null, score: (res as { score?: number | null }).score ?? null } : null;
    }
    return salir(NextResponse.json({ id: r.id, estado: r.estado, veredicto: delInforme?.veredicto ?? null, score: delInforme?.score ?? null, devuelto: r.estado === "creado" && r.devuelto === true }));
  } catch (e) {
    captureApiError(e, { ruta: RUTA, operacion: "analizar-aviso", userId: user.id, extra: { avisoId: b.avisoId } });
    return salir(NextResponse.json({ error: "interno" }, { status: 500 }));
  }
}
