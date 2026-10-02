import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchUnidadesProyecto,
  desactivarProyectosConUnidades,
  fallidosTolerados,
  idProyectoDeUrl,
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
/** Proyectos en vuelo a la vez. Cada uno son 2 GETs (proyecto + disponibles): 4 deja 8 en vuelo,
 *  lo mismo que el GraphQL viejo sondeado sin rate-limit. */
const CONCURRENCIA = 4;
/** Pausa de cortesía entre lotes de fichas (ms). */
const PAUSA_LOTE_MS = 250;


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
  for (let k = 0; k < resultados.length; k++) {
    if (!resultados[k].error) continue;
    const base = delBatch.find((p) => p.idProyecto === resultados[k].idProyecto);
    if (base) resultados[k] = await fetchUnidadesProyecto(base);
  }
  const t1 = Date.now();

  // ── 3. El cruce con las unidades que ya tenemos ──
  //
  // Todas las unidades de obra nueva (activas o no: una vendida que reaparece vuelve a estar
  // disponible), paginadas por id. Se agrupan por proyecto con el número final de la URL.
  const filasPorProyecto = new Map<number, Array<FilaUnidad & { comuna: string; created_at: string | null; scraped_at: string | null; seen_pass_id: string | null }>>();
  for (let off = 0; ; off += PAGINA_POSTGREST) {
    const { data, error } = await supabase
      .from("scraped_properties")
      .select("id, source_id, is_active, comuna, created_at, scraped_at, seen_pass_id")
      .eq("condicion", "nuevo")
      .like("source_id", "%#%")
      .order("id", { ascending: true })
      .range(off, off + PAGINA_POSTGREST - 1);
    if (error) return cerrarCron(supabase, "scrape-unidades-nuevas", CORRIDA_FALLIDA, { error: `select unidades: ${error.message}` }, { registrar: !dry });
    for (const f of (data ?? []) as Array<FilaUnidad & { comuna: string; created_at: string | null; scraped_at: string | null; seen_pass_id: string | null }>) {
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
  const marca = marcaVistaUnidades(new Date());
  const vendidasFilas: Array<{ id: string; comuna: string; created_at: string | null; scraped_at: string | null; seen_pass_id: string | null }> = [];
  const vistasPorProyecto: Array<{ ids: string[]; fechaEntrega: string | null }> = [];
  let nuevasSinPrecio = 0;
  let fueraDeLaFicha = 0;
  const sinCruce: number[] = [];
  const rangos: Record<string, string> = {};
  for (const r of conDisponibles) {
    const filas = filasPorProyecto.get(r.idProyecto) ?? [];
    const plan = planDisponibilidad(filas, r.disponibles);
    nuevasSinPrecio += plan.nuevas;
    fueraDeLaFicha += plan.fuera;
    if (plan.sinCruce) sinCruce.push(r.idProyecto);
    if (plan.vistas.length) vistasPorProyecto.push({ ids: plan.vistas, fechaEntrega: r.fechaEntrega });
    const vendidas = new Set(plan.vendidas);
    for (const f of filas) if (vendidas.has(f.id)) vendidasFilas.push(f);
    if (r.rango && Object.keys(rangos).length < 10) rangos[r.idProyecto] = `UF ${r.rango.desdeUF}–${r.rango.hastaUF}`;
  }
  const vistasTotal = vistasPorProyecto.reduce((a, v) => a + v.ids.length, 0);
  const disponiblesTotal = conDisponibles.reduce((a, r) => a + r.disponibles.length, 0);

  // ── 4. Escrituras: vistas, vendidas y sus bajas. Nunca precios ni filas nuevas. ──
  const errors: string[] = conError.slice(0, 10).map((r) => `proyecto ${r.idProyecto}: ${r.error}`);
  let escrituraFallo = false;
  let bajasCerradas: number | null = null;
  let bajasSinEvaluar = 0;
  if (!dry) {
    // La que sigue disponible: vista hoy (y activa, si había salido), con la entrega que publica la ficha.
    for (const v of vistasPorProyecto) {
      for (let i = 0; i < v.ids.length; i += 200) {
        const { error } = await supabase
          .from("scraped_properties")
          .update({ is_active: true, seen_pass_id: marca, ...(v.fechaEntrega ? { fecha_entrega: v.fechaEntrega } : {}) })
          .in("id", v.ids.slice(i, i + 200));
        if (error) { errors.push(`vistas: ${error.message}`); escrituraFallo = true; }
      }
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

  const detalle = {
    modo: "unidades-disponibles",
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
