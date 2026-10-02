import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchUnidadesProyecto,
  desactivarProyectosConUnidades,
  fallidosTolerados,
  estimarPrecioUnidadUF,
  etiquetaDeUnidad,
  idProyectoDeUrl,
  marcaFueraDeLaFicha,
  marcaVistaUnidades,
  planDisponibilidad,
  PREFIJO_VISTA_UNIDADES,
  TOLERANCIA_FALLA_PROYECTOS,
  type FilaUnidad,
  type ProyectoBase,
} from "@/lib/services/scraper/toctoc-unidades";
import { PAGINA_POSTGREST } from "@/lib/comuna-stats";
import { latirCron } from "@/lib/cron-heartbeat";
import { cerrarCron, CORRIDA_FALLIDA } from "@/lib/cron-resultado";

// ─── Unidades de obra nueva (detalle por tipología), con cadencia propia ─────
//
// DESDE EL 02-OCT-2026: LOS DISPONIBLES, SIN PRECIO. La fuente retiró el GraphQL que traía cada unidad
// con su precio. La ficha nueva (api-ficha, ver toctoc-unidades.ts) da los deptos disponibles —número,
// dormitorios, baños, piso, m²— y el rango del proyecto, pero no el precio por unidad. Este pase ahora
// CRUZA: la unidad que sigue disponible queda vista (seen_pass_id = «unidades@<instante>»), la que dejó
// de aparecer se marca vendida (sale de avisos_evaluados y de la guía por cerrar_bajas, y queda en
// bajas_avisos para medir cuánto dura un aviso). No escribe precios ni unidades nuevas: los precios
// reales del 29-sep al 01-oct siguen como están hasta que se decida de dónde sale el precio.
// `?dry=1` cruza y responde sin escribir nada.
//
// LO QUE HACÍA ANTES (03-ago al 01-oct-2026), y por qué existe:
// POR QUÉ EXISTE. La fila que scrape-nuevos persiste por proyecto es el RANGO:
// precio "desde", superficie y dormitorios mínimos. Con eso, 34 de 78 análisis
// con sujeto nuevo no juntaban muestra (la mediana exige >= 15 comparables en
// ±20% de superficie) y los que sí, comparaban contra la unidad de entrada de
// cada proyecto. El GraphQL público de la ficha expone CADA unidad en venta con
// precio y superficie exactos; este pase las expande a filas de
// scraped_properties (source_id = url#unidad) para que getComunaMedianaVentaUF
// las vea sin tocar el motor. Medido en el diagnóstico: cobertura 44/78 → ~72/78.
//
// ROTACIÓN POR TERCIOS (antes séptimos). El sondeo real midió 1,32s efectivos
// por ficha a concurrencia 8 (231 fichas en 306s). Con el techo de Hobby (300s)
// un tercio de los proyectos (~172 fichas ≈ 240s) ocupaba el 80% del techo y la
// varianza de 7-9s de la fuente botaba fichas; por eso se partió en séptimos
// (~74 fichas ≈ 100s, 33%). Con el techo de Pro (800s) la misma regla —no
// pasar del tercio del techo, para absorber la varianza— admite 522 / 3 ≈ 174
// fichas ≈ 230s (29%). Cada proyecto se refresca cada 3 días en vez de cada 7,
// y sigue sobrando para precios de lista que se mueven por trimestre. La
// partición es por id de proyecto (id % CICLO_DIAS), no por índice: estable
// aunque la lista crezca o se reordene. Si los proyectos superan ~600, volver a
// subir el ciclo antes que acercarse al techo.

// Techo del plan Pro con Fluid Compute. Era el único límite real de Hobby:
// 300s botaban un tercio de las fichas del batch cuando la fuente se ponía
// lenta. Mismo valor que backfill-toctoc.
export const maxDuration = 800;

/** Días del ciclo de rotación (ver nota de arriba). */
const CICLO_DIAS = 3;
/** Proyectos en vuelo a la vez (2 GETs cada uno: proyecto + disponibles). Los ensayos del 02-oct por el
 *  proxy: con 4 en vuelo y 250 ms entre lotes, 403 en 57 de 137 proyectos; con 2 y 600 ms, en 18. Los
 *  mismos proyectos respondían 200 desde una IP sin proxy: la ficha nueva frena por ritmo. Cada proyecto
 *  tarda ~4 s por el proxy: con 2 en vuelo y 1,5 s entre lotes el tercio va en ~6 min; uno a la vez
 *  rozaría el techo de 800 s con los reintentos. */
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

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret) {
    console.error("CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const batch = url.searchParams.has("batch")
    ? parseInt(url.searchParams.get("batch")!) % CICLO_DIAS
    : new Date().getDate() % CICLO_DIAS;

  const dry = url.searchParams.get("dry") === "1";

  const supabase = getSupabase();
  // Latido ANTES del trabajo (doctrina cron-heartbeat): registra "corrió". El ensayo no late.
  if (!dry) await latirCron(supabase, "scrape-unidades-nuevas");
  const t0 = Date.now();

  // ── 1. Proyectos a consultar: las filas-proyecto ya persistidas ──
  //
  // SIN filtrar is_active: este mismo pase las desactiva cuando tienen unidades,
  // y si las filtrara, un proyecto dejaría de refrescarse justo después de su
  // primera pasada. El corte de frescura (30d) descarta proyectos que
  // scrape-nuevos —que corre diario— ya no ve publicados.
  const desde30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  // Paginado con .range: PostgREST capa cada respuesta en PAGINA_POSTGREST filas
  // sin avisar, así que un `.limit(2000)` devolvía como máximo 1.000. Hoy las
  // filas-proyecto de 30 días son ~470 (1.006 contando variantes históricas de
  // URL), bajo el tope, pero la regla del repo es paginar toda lectura de
  // scraped_properties que pueda crecer: la próxima vez que supere 1.000, los
  // proyectos que queden fuera no entrarían a ningún batch y nada lo diría.
  const basesRaw: Array<Record<string, unknown>> = [];
  for (let off = 0; ; off += PAGINA_POSTGREST) {
    const { data, error: errBases } = await supabase
      .from("scraped_properties")
      .select("source_id, url, comuna, lat, lng, direccion, scraped_at")
      .eq("type", "venta")
      .eq("condicion", "nuevo")
      .not("source_id", "like", "%#%")
      .gte("scraped_at", desde30d)
      .order("id", { ascending: true })
      .range(off, off + PAGINA_POSTGREST - 1);
    if (errBases) {
      return cerrarCron(supabase, "scrape-unidades-nuevas", CORRIDA_FALLIDA, { error: `select proyectos: ${errBases.message}` });
    }
    if (!data || data.length === 0) break;
    basesRaw.push(...(data as Array<Record<string, unknown>>));
    if (data.length < PAGINA_POSTGREST) break;
  }

  // Dedup por id de proyecto (el número final de la URL compranuevo): un mismo
  // proyecto puede tener variantes de URL históricas; gana la fila más fresca.
  const porId = new Map<number, ProyectoBase & { scrapedAt: string }>();
  for (const r of basesRaw) {
    const m = String(r.url ?? "").match(/compranuevo\/departamento\/[^/]+\/[^/]+\/(\d+)/);
    if (!m) continue;
    const id = Number(m[1]);
    const prev = porId.get(id);
    if (prev && prev.scrapedAt >= String(r.scraped_at)) continue;
    porId.set(id, {
      idProyecto: id,
      url: String(r.url),
      comuna: String(r.comuna),
      lat: typeof r.lat === "number" ? r.lat : null,
      lng: typeof r.lng === "number" ? r.lng : null,
      direccion: r.direccion ? String(r.direccion) : null,
      scrapedAt: String(r.scraped_at),
    });
  }
  const delBatch = Array.from(porId.values()).filter((p) => p.idProyecto % CICLO_DIAS === batch);

  // ── 2. La ficha nueva por proyecto (proyecto + disponibles), concurrencia acotada ──
  const resultados: Awaited<ReturnType<typeof fetchUnidadesProyecto>>[] = [];
  for (let i = 0; i < delBatch.length; i += CONCURRENCIA) {
    const lote = delBatch.slice(i, i + CONCURRENCIA);
    resultados.push(...await Promise.all(lote.map((p) => fetchUnidadesProyecto(p))));
    if (PAUSA_LOTE_MS > 0 && i + CONCURRENCIA < delBatch.length) {
      await new Promise((r) => setTimeout(r, PAUSA_LOTE_MS));
    }
  }
  // Un reintento, uno por uno, para los que fallaron (el proxy suelta algún `fetch failed`).
  const fallidosPrimera = resultados.filter((r) => r.error).length;
  for (let intento = 0; intento < REINTENTOS; intento++) for (let k = 0; k < resultados.length; k++) {
    if (!resultados[k].error) continue;
    const base = delBatch.find((p) => p.idProyecto === resultados[k].idProyecto);
    if (!base) continue;
    await new Promise((r) => setTimeout(r, PAUSA_REINTENTO_MS));
    resultados[k] = await fetchUnidadesProyecto(base);
  }
  const t1 = Date.now();

  // ── 3. El cruce con las unidades que ya tenemos ──
  //
  // Todas las unidades de obra nueva (activas o no: una vendida que reaparece vuelve a estar
  // disponible), paginadas por id. Se agrupan por proyecto con el número final de la URL.
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
    if (error) return cerrarCron(supabase, "scrape-unidades-nuevas", CORRIDA_FALLIDA, { error: `select unidades: ${error.message}` }, { registrar: !dry });
    for (const f of (data ?? []) as FilaCruce[]) {
      const id = idProyectoDeUrl(f.source_id);
      if (id == null) continue;
      if (!filasPorProyecto.has(id)) filasPorProyecto.set(id, []);
      filasPorProyecto.get(id)!.push(f);
    }
    if (!data || data.length < PAGINA_POSTGREST) break;
  }

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

  // ── 4. Escrituras: vistas, vendidas y sus bajas. Nunca precios ni filas nuevas. ──
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

  // ── 5. Convivencia: desactivar las filas-proyecto que ya tienen detalle ──
  // (global e idempotente; ver toctoc-unidades.ts). Las unidades no cambian acá, pero se re-aplica
  // igual: si el invariante se rompió por otro lado, este pase lo repara.
  const recon = dry ? { desactivadas: 0, errores: [] as string[] } : await desactivarProyectosConUnidades(supabase);
  errors.push(...recon.errores);
  const t3 = Date.now();

  const fechasEntrega: Record<string, number> = {};
  const porComuna: Record<string, number> = {};
  for (const r of conDisponibles) {
    const k = (r.fechaEntrega ?? "").trim() || "(vacía)";
    fechasEntrega[k] = (fechasEntrega[k] ?? 0) + 1;
    const comuna = delBatch.find((p) => p.idProyecto === r.idProyecto)?.comuna ?? "?";
    porComuna[comuna] = (porComuna[comuna] ?? 0) + r.disponibles.length;
  }

  // El motivo concreto de la alerta (cerrarCron › motivoDeFalla): «137 de 137 proyectos con http 403».
  const erroresPorTipo: Record<string, number> = {};
  for (const r of conError) erroresPorTipo[String(r.error)] = (erroresPorTipo[String(r.error)] ?? 0) + 1;
  const detalle = {
    modo: "unidades-disponibles",
    unidad: "proyectos",
    erroresPorTipo,
    dry,
    fallidosAntesDelReintento: fallidosPrimera,
    toleranciaFalla: TOLERANCIA_FALLA_PROYECTOS,
    batch,
    cicloDias: CICLO_DIAS,
    proyectosEnCiclo: porId.size,
    proyectosDelBatch: delBatch.length,
    proyectosConDisponibles: conDisponibles.length,
    proyectosSinDisponibles: sinDisponibles.length,
    proyectosConError: conError.length,
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
    timing: { ficha_ms: t1 - t0, escritura_ms: t2 - t1, recon_ms: t3 - t2, total_ms: t3 - t0 },
  };
  // El resultado, por proyecto (29-sep-2026). Un proyecto que falla es un fallido, una escritura que
  // falla tumba la corrida, y un batch con proyectos que no trae UN solo disponible también es falla:
  // la fuente no respondió (o cambió la dirección, como el 02-oct).
  const sinNinguna = delBatch.length > 0 && conDisponibles.length === 0;
  const conteo = escrituraFallo || sinNinguna
    ? { procesados: delBatch.length, exitosos: 0, fallidos: delBatch.length }
    : { procesados: delBatch.length, exitosos: conDisponibles.length + sinDisponibles.length, fallidos: fallidosTolerados(conError.length, delBatch.length) + (recon.errores.length ? 1 : 0) };
  // El ensayo responde igual, sin dejar resultado ni alerta.
  return cerrarCron(supabase, "scrape-unidades-nuevas", conteo, { success: !escrituraFallo && !sinNinguna, ...detalle }, { registrar: !dry });
}

// Vercel Cron dispara GET. Mismo handler, misma auth.
export const GET = POST;
