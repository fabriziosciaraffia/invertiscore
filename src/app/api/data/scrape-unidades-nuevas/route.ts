import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchUnidadesProyecto,
  desactivarProyectosConUnidades,
  estimarPrecioUnidadUF,
  etiquetaDeUnidad,
  idProyectoDeUrl,
  marcaFueraDeLaFicha,
  marcaVistaUnidades,
  planDisponibilidad,
  PREFIJO_VISTA_UNIDADES,
  TOLERANCIA_FALLA_PROYECTOS,
  type FilaUnidad,
} from "@/lib/services/scraper/toctoc-unidades";
import {
  completarAvance,
  conteoUnidades,
  guardarAvanceUnidades,
  leerAvanceUnidades,
  leerConPresupuesto,
  leerProyectosDelCiclo,
  marcarLeidos,
  ordenDeLectura,
  sinLeerHace,
  CORRIDAS_POR_DIA,
  MAX_DIAS_SIN_LEER,
  PRESUPUESTO_UNIDADES_MS,
  RESERVA_ESCRITURA_MS,
  TOPE_DURO_UNIDADES_MS,
  type ProgresoUnidades,
} from "@/lib/services/scraper/unidades-presupuesto";
import { conTope } from "@/lib/con-tope";
import { ACCION_PROXY_407, esSinRespuesta } from "@/lib/services/scraper/falla-red";
import { PAGINA_POSTGREST } from "@/lib/comuna-stats";
import { latirCron } from "@/lib/cron-heartbeat";
import { cerrarCron, CORRIDA_FALLIDA, type ConteoCron } from "@/lib/cron-resultado";

// ─── Unidades de obra nueva: los disponibles, cuatro veces al día, con presupuesto ─────
//
// DESDE EL 13-OCT-2026: PRESUPUESTO, CIERRE LIMPIO Y TECHO (ver unidades-presupuesto.ts). La corrida de ese día
// murió a los 800 s sin escribir nada: el portal dejó sin respuesta 235 de 334 pedidos, el reintento sin reloj
// se comió el techo y, como se escribía recién al final, se perdieron también los 31 proyectos leídos. Ahora la
// corrida dura como mucho 240 s (ninguna lectura empieza pasados los 210 s y el resto es para escribir), lee
// primero los proyectos que hace más tiempo que no se leen, guarda cuándo leyó cada uno y la siguiente sigue
// desde ahí; a los 280 s cierra pase lo que pase. Corre cuatro veces al día (vercel.json): caben 50 proyectos
// por corrida, 800 en cuatro días, y la corrida que encuentra uno con más de cuatro días sin leer cierra en rojo.
// Reemplaza la rotación por tercios (id % 3, un tercio por día), que no tenía reloj ni memoria de lo leído.
//
// DESDE EL 02-OCT-2026: LOS DISPONIBLES, SIN PRECIO. La fuente retiró el GraphQL que traía cada unidad
// con su precio. La ficha nueva (api-ficha, ver toctoc-unidades.ts) da los deptos disponibles —número,
// dormitorios, baños, piso, m²— y el rango del proyecto, pero no el precio por unidad. Este pase ahora
// CRUZA: la unidad que sigue disponible queda vista (seen_pass_id = «unidades@<instante>»), la que dejó
// de aparecer se marca vendida (sale de avisos_evaluados y de la guía por cerrar_bajas, y queda en
// bajas_avisos para medir cuánto dura un aviso). No escribe precios ni unidades nuevas: los precios
// reales del 29-sep al 01-oct siguen como están hasta que se decida de dónde sale el precio.
// `?dry=1` cruza y responde sin escribir nada (ni late, ni guarda dónde quedó).
//
// LO QUE HACÍA ANTES (03-ago al 01-oct-2026), y por qué existe:
// La fila que scrape-nuevos persiste por proyecto es el RANGO: precio "desde", superficie y dormitorios
// mínimos. Con eso, 34 de 78 análisis con sujeto nuevo no juntaban muestra (la mediana exige >= 15
// comparables en ±20% de superficie) y los que sí, comparaban contra la unidad de entrada de cada proyecto.
// El GraphQL público de la ficha exponía CADA unidad en venta con precio y superficie exactos; este pase las
// expandió a filas de scraped_properties (source_id = url#unidad) para que getComunaMedianaVentaUF las vea
// sin tocar el motor. Medido en el diagnóstico: cobertura 44/78 → ~72/78.

/** El techo se mide contra esto: 300 s, como el prechequeo. Hasta el 13-oct-2026 eran 800 s sin reloj. */
export const maxDuration = 300;
const NOMBRE = "scrape-unidades-nuevas";

/** Proyectos en vuelo a la vez (2 GETs cada uno: proyecto + disponibles). Los ensayos del 02-oct por el
 *  proxy: con 4 en vuelo y 250 ms entre lotes, 403 en 57 de 137 proyectos; con 2 y 600 ms, en 18. Los
 *  mismos proyectos respondían 200 desde una IP sin proxy: la ficha nueva frena por ritmo. */
const CONCURRENCIA = 2;
/** Pausa de cortesía entre lotes de fichas (ms). */
const PAUSA_LOTE_MS = 1500;
/** Pausa antes de cada reintento: el reintento pegado al 403 vuelve a dar 403. Hasta dos por proyecto. */
const PAUSA_REINTENTO_MS = 4000;
const REINTENTOS = 2;


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = ReturnType<typeof createClient<any>>;

function getSupabase(): AnySupabase {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** El cierre también con techo: si la base no responde, se contesta igual antes del corte de 300 s. */
async function cerrarConTope(sb: AnySupabase, conteo: ConteoCron, extra: Record<string, unknown>, t0: number, opts: { registrar: boolean }) {
  const c = await conTope(cerrarCron(sb, NOMBRE, conteo, extra, opts), Math.max(1_000, t0 + 295_000 - Date.now()));
  return c.listo ? c.valor : NextResponse.json({ ...conteo, ...extra, cierreSinRegistrar: true }, { status: 500 });
}

export async function POST(request: Request) {
  const t0 = Date.now();
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret) {
    console.error("CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dry = new URL(request.url).searchParams.get("dry") === "1";

  const supabase = getSupabase();
  // Latido ANTES del trabajo (doctrina cron-heartbeat): registra "corrió". El ensayo no late.
  if (!dry) await latirCron(supabase, "scrape-unidades-nuevas");
  // Lo que se sabe MIENTRAS corre: si el techo la corta, el log dice hasta dónde llegó.
  const progreso: ProgresoUnidades = { intentados: 0, leidos: 0 };
  try {
    const corrida = await conTope(correr(supabase, dry, t0, progreso), t0 + TOPE_DURO_UNIDADES_MS - Date.now());
    if (!corrida.listo) {
      // EL TECHO: algo se colgó (cada pedido al portal tiene su tiempo máximo, así que es la base). No se guarda
      // dónde quedó: no se sabe si lo leído alcanzó a escribirse, y la siguiente vuelve a empezar por los mismos.
      // Es una corrida fallida: el panel lo ve y alerta.
      console.log(`[${NOMBRE}] techo ${JSON.stringify({ ms: Date.now() - t0, ...progreso, dry })}`);
      return cerrarConTope(supabase, CORRIDA_FALLIDA, { cortadoPorTecho: true, ...progreso, dry }, t0, { registrar: !dry });
    }
    return cerrarConTope(supabase, corrida.valor.conteo, corrida.valor.detalle, t0, { registrar: !dry });
  } catch (e) {
    return cerrarConTope(supabase, CORRIDA_FALLIDA, { error: e instanceof Error ? e.message : String(e), dry }, t0, { registrar: !dry });
  }
}

async function correr(supabase: AnySupabase, dry: boolean, t0: number, progreso: ProgresoUnidades): Promise<{ conteo: ConteoCron; detalle: Record<string, unknown> }> {
  // ── 1. Proyectos a leer y dónde quedó la corrida anterior ──
  const { proyectos, error: errProyectos } = await leerProyectosDelCiclo(supabase);
  if (errProyectos) return { conteo: CORRIDA_FALLIDA, detalle: { error: errProyectos, dry } };
  const anterior = await leerAvanceUnidades(supabase);
  if (!anterior.ok) return { conteo: CORRIDA_FALLIDA, detalle: { error: `dónde quedó: ${anterior.error}`, dry } };

  // ── 2. Las unidades que ya tenemos, para el cruce ──
  //
  // Todas las unidades de obra nueva (activas o no: una vendida que reaparece vuelve a estar
  // disponible), paginadas por id. Se agrupan por proyecto con el número final de la URL. Se leen antes que
  // el portal: su última marca de vista ordena a los proyectos que todavía no tienen avance.
  type FilaCruce = FilaUnidad & { comuna: string; created_at: string | null; scraped_at: string | null; seen_pass_id: string | null; superficie_m2: number | string | null };
  const filasPorProyecto = new Map<number, FilaCruce[]>();
  for (let off = 0; ; off += PAGINA_POSTGREST) {
    const { data, error } = await supabase
      .from("scraped_properties")
      .select("id, source_id, is_active, comuna, created_at, scraped_at, seen_pass_id, superficie_m2")
      .eq("condicion", "nuevo")
      .like("source_id", "%#%")
      .order("id", { ascending: true })
      .range(off, off + PAGINA_POSTGREST - 1);
    if (error) return { conteo: CORRIDA_FALLIDA, detalle: { error: `select unidades: ${error.message}`, dry } };
    for (const f of (data ?? []) as FilaCruce[]) {
      const id = idProyectoDeUrl(f.source_id);
      if (id == null) continue;
      if (!filasPorProyecto.has(id)) filasPorProyecto.set(id, []);
      filasPorProyecto.get(id)!.push(f);
    }
    if (!data || data.length < PAGINA_POSTGREST) break;
  }
  const ultimaMarca = new Map<number, string>();
  for (const [id, filas] of Array.from(filasPorProyecto)) {
    for (const f of filas) {
      if (!f.seen_pass_id?.startsWith(PREFIJO_VISTA_UNIDADES)) continue;
      const t = f.seen_pass_id.slice(PREFIJO_VISTA_UNIDADES.length);
      if (!ultimaMarca.has(id) || t > ultimaMarca.get(id)!) ultimaMarca.set(id, t);
    }
  }

  // ── 3. La ficha nueva por proyecto, los más atrasados primero, con reloj ──
  const avance = completarAvance(anterior.avance, proyectos.map((p) => p.idProyecto), ultimaMarca, new Date());
  const cola = ordenDeLectura(proyectos, avance);
  const tArranque = Date.now();
  const lectura = await leerConPresupuesto(cola, (p) => fetchUnidadesProyecto(p), {
    concurrencia: CONCURRENCIA, pausaLoteMs: PAUSA_LOTE_MS, pausaReintentoMs: PAUSA_REINTENTO_MS, reintentos: REINTENTOS,
  }, {
    ahora: () => Date.now(),
    dormir: (ms) => new Promise((r) => setTimeout(r, ms)),
    hastaMs: t0 + PRESUPUESTO_UNIDADES_MS - RESERVA_ESCRITURA_MS,
  }, progreso, (r) => esSinRespuesta(r.error));
  const resultados = lectura.resultados;
  const t1 = Date.now();

  // ── 4. El cruce con las unidades que ya tenemos ──
  const conDisponibles = resultados.filter((r) => !r.error && r.disponibles.length > 0);
  const sinDisponibles = resultados.filter((r) => !r.error && r.disponibles.length === 0);
  const conError = resultados.filter((r) => r.error);
  const ahoraCorrida = new Date();
  const marca = marcaVistaUnidades(ahoraCorrida);
  const vendidasFilas: Array<{ id: string; comuna: string; created_at: string | null; scraped_at: string | null; seen_pass_id: string | null }> = [];
  // Cada vista con su estimado (rango del proyecto × sus m²) y la entrega: una sola llamada por lote.
  const vistasFilas: Array<{ id: string; estimado_uf: number | null; fecha_entrega: string | null }> = [];
  const fueraIds: string[] = [];
  let nuevasSinPrecio = 0;
  let fueraDeLaFicha = 0;
  const sinCruce: number[] = [];
  const rangos: Record<string, string> = {};
  for (const r of conDisponibles) {
    const filas = filasPorProyecto.get(r.idProyecto) ?? [];
    const plan = planDisponibilidad(filas, r.disponibles);
    nuevasSinPrecio += plan.nuevas;
    fueraDeLaFicha += plan.fuera.length;
    if (plan.sinCruce) sinCruce.push(r.idProyecto);
    // Los extremos de m² salen de TODAS las unidades que conocemos del proyecto, no solo de las listadas:
    // el «desde/hasta» de la ficha cubre también las que no lista. Con solo las listadas el error del
    // estimado subía a p50 7,8% y p90 22% (5 proyectos, 205 unidades); con todas, 3,9% y 10,2%.
    const m2s = [...r.disponibles.map((d) => d.m2Utiles), ...filas.map((f) => Number(f.superficie_m2))].filter((m): m is number => m != null && m > 0);
    const m2Min = m2s.length ? Math.min(...m2s) : 0, m2Max = m2s.length ? Math.max(...m2s) : 0;
    const porNumero = new Map(r.disponibles.map((d) => [d.numero, d]));
    const vistasSet = new Set(plan.vistas);
    for (const f of filas) {
      if (!vistasSet.has(f.id)) continue;
      const d = porNumero.get(etiquetaDeUnidad(f.source_id));
      vistasFilas.push({ id: f.id, estimado_uf: estimarPrecioUnidadUF(r.rango, d?.m2Utiles ?? null, m2Min, m2Max), fecha_entrega: r.fechaEntrega });
    }
    fueraIds.push(...plan.fuera);
    const vendidas = new Set(plan.vendidas);
    for (const f of filas) if (vendidas.has(f.id)) vendidasFilas.push(f);
    if (r.rango && Object.keys(rangos).length < 10) rangos[r.idProyecto] = `UF ${r.rango.desdeUF}–${r.rango.hastaUF}`;
  }
  const vistasTotal = vistasFilas.length;
  const conEstimado = vistasFilas.filter((v) => v.estimado_uf != null).length;
  const disponiblesTotal = conDisponibles.reduce((a, r) => a + r.disponibles.length, 0);

  // ── 5. Escrituras: vistas, vendidas y sus bajas. Nunca precios ni filas nuevas. ──
  const errors: string[] = conError.slice(0, 10).map((r) => `proyecto ${r.idProyecto}: ${r.error}`);
  let escrituraFallo = false;
  let bajasCerradas: number | null = null;
  let bajasSinEvaluar = 0;
  let fueraSacadas = 0;
  if (!dry) {
    // La que sigue disponible: vista hoy (y activa, si había salido), con la entrega que publica la ficha
    // y su precio ESTIMADO en columnas propias (precio_estimado_uf/_at): `precio` sigue siendo el real.
    for (let i = 0; i < vistasFilas.length; i += 500) {
      const { error } = await supabase.rpc("marcar_unidades_vistas", { p_filas: vistasFilas.slice(i, i + 500), p_marca: marca });
      if (error) { errors.push(`vistas: ${error.message}`); escrituraFallo = true; }
    }
    // La que la ficha nueva nunca listó: queda en la base para la referencia de la zona, marcada, y sale
    // de avisos_evaluados (con eso, de la guía y del correo). La guía muestra solo lo disponible.
    for (let i = 0; i < fueraIds.length; i += 200) {
      const ids = fueraIds.slice(i, i + 200);
      const { error } = await supabase.from("scraped_properties").update({ seen_pass_id: marcaFueraDeLaFicha(ahoraCorrida) }).in("id", ids);
      if (error) { errors.push(`fuera: ${error.message}`); escrituraFallo = true; continue; }
      const { error: eFuera, count } = await supabase.from("avisos_evaluados").delete({ count: "exact" }).in("aviso_id", ids);
      if (eFuera) { errors.push(`fuera de la guía: ${eFuera.message}`); escrituraFallo = true; }
      else fueraSacadas += count ?? 0;
    }
    // La que dejó de aparecer: vendida.
    const idsVendidas = vendidasFilas.map((f) => f.id);
    for (let i = 0; i < idsVendidas.length; i += 200) {
      const { error } = await supabase.from("scraped_properties").update({ is_active: false }).in("id", idsVendidas.slice(i, i + 200));
      if (error) { errors.push(`vendidas: ${error.message}`); escrituraFallo = true; }
    }
    if (idsVendidas.length > 0) {
      // Primero cerrar_bajas(): la evaluada sale de avisos_evaluados (y con eso de la guía y del correo)
      // y queda en bajas_avisos con su veredicto. Después, las que nunca se evaluaron entran a
      // bajas_avisos sin veredicto, para medir cuánto dura un aviso (la escasez del 15-oct). En ese orden:
      // al revés, la fila sin veredicto ganaría y la evaluada perdería el suyo.
      const { data: n, error: eBajas } = await supabase.rpc("cerrar_bajas");
      if (eBajas) { errors.push(`bajas: ${eBajas.message}`); escrituraFallo = true; }
      else bajasCerradas = Number(n) || 0;
      const ahora = new Date().toISOString();
      const filasBaja = vendidasFilas.map((f) => ({
        aviso_id: f.id,
        comuna: f.comuna,
        condicion: "nuevo",
        visto_desde: f.created_at,
        visto_hasta: f.seen_pass_id?.startsWith(PREFIJO_VISTA_UNIDADES) ? f.seen_pass_id.slice(PREFIJO_VISTA_UNIDADES.length) : f.scraped_at,
        baja_at: ahora,
      }));
      for (let i = 0; i < filasBaja.length; i += 200) {
        const { error, count } = await supabase
          .from("bajas_avisos")
          .upsert(filasBaja.slice(i, i + 200), { onConflict: "aviso_id", ignoreDuplicates: true, count: "exact" });
        if (error) { errors.push(`bajas sin evaluar: ${error.message}`); escrituraFallo = true; }
        else bajasSinEvaluar += count ?? 0;
      }
    }
  }
  const t2 = Date.now();

  // ── 6. Convivencia: desactivar las filas-proyecto que ya tienen detalle ──
  // (global e idempotente; ver toctoc-unidades.ts). Las unidades no cambian acá, pero se re-aplica
  // igual: si el invariante se rompió por otro lado, este pase lo repara.
  const recon = dry ? { desactivadas: 0, errores: [] as string[] } : await desactivarProyectosConUnidades(supabase);
  errors.push(...recon.errores);
  const t3 = Date.now();

  // ── 7. Hasta dónde llegó: los leídos con todo escrito pasan a leídos ahora; la siguiente sigue por el resto ──
  // Con una escritura caída no se sabe cuáles quedaron: ninguno cuenta como leído y la siguiente los vuelve a leer.
  const ahora = new Date();
  const leidos = escrituraFallo ? [] : resultados.filter((r) => !r.error).map((r) => r.idProyecto);
  const avanceNuevo = marcarLeidos(avance, leidos, ahora);
  const { vencidos, horasMax } = sinLeerHace(avanceNuevo, ahora);
  const intentados = resultados.map((r) => r.idProyecto);
  const vueltaDias = Math.round((proyectos.length / Math.max(1, intentados.length) / CORRIDAS_POR_DIA) * 10) / 10;
  if (!dry) {
    const guardado = await guardarAvanceUnidades(supabase, avanceNuevo, {
      leidos: leidos.length, intentados: intentados.length, noAlcanzados: lectura.noAlcanzados, total: proyectos.length,
      vencidos: vencidos.length, horasMax, porTiempo: lectura.porTiempo, ms: Date.now() - t0,
    });
    if (!guardado) { errors.push("no se guardó dónde quedó: la siguiente corrida empezaría por los mismos"); escrituraFallo = true; }
  }

  const fechasEntrega: Record<string, number> = {};
  const porComuna: Record<string, number> = {};
  const comunaDe = new Map(proyectos.map((p) => [p.idProyecto, p.comuna]));
  for (const r of conDisponibles) {
    const k = (r.fechaEntrega ?? "").trim() || "(vacía)";
    fechasEntrega[k] = (fechasEntrega[k] ?? 0) + 1;
    const comuna = comunaDe.get(r.idProyecto) ?? "?";
    porComuna[comuna] = (porComuna[comuna] ?? 0) + r.disponibles.length;
  }

  // El motivo concreto de la alerta (cerrarCron › motivoDeFalla): «8 de 52 proyectos fallaron (5 con http 403 ·
  // 3 con más de 4 días sin leer)».
  const erroresPorTipo: Record<string, number> = {};
  for (const r of conError) erroresPorTipo[String(r.error)] = (erroresPorTipo[String(r.error)] ?? 0) + 1;
  if (vencidos.length) erroresPorTipo[`más de ${MAX_DIAS_SIN_LEER} días sin leer`] = vencidos.length;
  const timing = { arranque_ms: tArranque - t0, ficha_ms: t1 - tArranque, escritura_ms: t2 - t1, recon_ms: t3 - t2, total_ms: Date.now() - t0 };
  const detalle = {
    modo: "unidades-disponibles",
    unidad: "proyectos",
    erroresPorTipo,
    dry,
    fallidosAntesDelReintento: lectura.fallidosPrimera,
    reintentos: lectura.reintentos,
    toleranciaFalla: TOLERANCIA_FALLA_PROYECTOS,
    presupuestoMs: PRESUPUESTO_UNIDADES_MS,
    porTiempo: lectura.porTiempo,
    porCorte: lectura.porCorte,
    // El proxy rechazó la autenticación (19-oct-2026): necesita una persona, y la alerta sale en el acto.
    ...(conError.some((r) => /· proxy 407$/.test(String(r.error))) ? { accion: ACCION_PROXY_407 } : {}),
    proyectosEnCiclo: proyectos.length,
    proyectosIntentados: intentados.length,
    proyectosNoAlcanzados: lectura.noAlcanzados,
    proyectosConDisponibles: conDisponibles.length,
    proyectosSinDisponibles: sinDisponibles.length,
    proyectosConError: conError.length,
    proyectosVencidos: vencidos.slice(0, 20),
    horasSinLeerMax: horasMax,
    vueltaDias,
    proyectosSinCruce: sinCruce,
    disponibles: disponiblesTotal,
    unidadesVistas: vistasTotal,
    unidadesVendidas: vendidasFilas.length,
    nuevasSinPrecio,
    fueraDeLaFicha,
    fueraSacadasDeLaGuia: fueraSacadas,
    unidadesConEstimado: conEstimado,
    bajasCerradas,
    bajasSinEvaluar,
    basesDesactivadas: recon.desactivadas,
    rangos,
    porComuna,
    fechasEntrega,
    errors: errors.slice(0, 20),
    timing,
  };
  // El cierre, en los logs de la función: cuánto duró, cuántos leyó y cuántos quedaron, el paso más largo y el
  // más atrasado. Sin esta línea, la duración real solo se ve en la base (y una corrida que revienta no deja nada).
  console.log(`[${NOMBRE}] cierre ${JSON.stringify({
    ms: timing.total_ms, total: proyectos.length, intentados: intentados.length, leidos: leidos.length, conError: conError.length,
    noAlcanzados: lectura.noAlcanzados, reintentos: lectura.reintentos, msPasoMax: lectura.msPasoMax,
    msPorProyecto: Math.round(lectura.msLectura / Math.max(1, intentados.length)), porTiempo: lectura.porTiempo, porCorte: lectura.porCorte,
    vencidos: vencidos.length, horasSinLeerMax: horasMax, vueltaDias, erroresPorTipo, timing, dry,
  })}`);
  // El resultado, por proyecto (29-sep-2026). Un proyecto que falla es un fallido, una escritura que falla tumba
  // la corrida, una corrida con proyectos que no trae UN solo disponible también es falla (la fuente no respondió,
  // o cambió la dirección, como el 02-oct), y un proyecto con más de cuatro días sin leer es un fallido.
  const conteo = conteoUnidades({
    intentados,
    conError: conError.map((r) => r.idProyecto),
    conDisponibles: conDisponibles.length,
    escrituraFallo,
    reconFallo: recon.errores.length > 0,
    vencidos,
  });
  return { conteo, detalle: { success: conteo.fallidos === 0, ...detalle } };
}

// Vercel Cron dispara GET. Mismo handler, misma auth.
export const GET = POST;
