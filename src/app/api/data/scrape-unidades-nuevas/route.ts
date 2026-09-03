import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchUnidadesProyecto,
  desactivarProyectosConUnidades,
  type ProyectoBase,
} from "@/lib/services/scraper/toctoc-unidades";
import { propertyToRow } from "@/lib/services/scraper/property-row";
import { PAGINA_POSTGREST } from "@/lib/comuna-stats";
import { latirCron } from "@/lib/cron-heartbeat";

// ─── Unidades de obra nueva (detalle por tipología), con cadencia propia ─────
//
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
/** Fichas GraphQL en vuelo a la vez. Sondeado sin rate-limit a 8. */
const CONCURRENCIA = 8;
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

  const supabase = getSupabase();
  // Latido ANTES del trabajo (doctrina cron-heartbeat): registra "corrió".
  await latirCron(supabase, "scrape-unidades-nuevas");
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
      return NextResponse.json({ error: `select proyectos: ${errBases.message}` }, { status: 500 });
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

  // ── 2. GraphQL por proyecto, concurrencia acotada ──
  const resultados = [];
  for (let i = 0; i < delBatch.length; i += CONCURRENCIA) {
    const lote = delBatch.slice(i, i + CONCURRENCIA);
    resultados.push(...await Promise.all(lote.map((p) => fetchUnidadesProyecto(p))));
    if (PAUSA_LOTE_MS > 0 && i + CONCURRENCIA < delBatch.length) {
      await new Promise((r) => setTimeout(r, PAUSA_LOTE_MS));
    }
  }
  const t1 = Date.now();

  // ── 3. Guard de integridad + upsert ──
  //
  // Un proyecto con error o con 0 unidades publicadas NO borra nada y NO
  // desactiva su fila-proyecto: la fila gruesa sigue representándolo hasta que
  // haya detalle mejor. Solo los proyectos que SÍ trajeron unidades entran al
  // upsert y a la desactivación.
  const conUnidades = resultados.filter((r) => !r.error && r.unidades.length > 0);
  const sinUnidades = resultados.filter((r) => !r.error && r.unidades.length === 0);
  const conError = resultados.filter((r) => r.error);
  const descartadas = resultados.reduce((a, r) => a + r.descartadas, 0);

  const rowsByKey = new Map<string, ReturnType<typeof propertyToRow>>();
  for (const r of conUnidades) {
    for (const row of r.unidades.map(propertyToRow)) {
      rowsByKey.set(`${row.source}|${row.source_id}`, row);
    }
  }
  const rows = Array.from(rowsByKey.values());

  const errors: string[] = conError.slice(0, 10).map((r) => `proyecto ${r.idProyecto}: ${r.error}`);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase
      .from("scraped_properties")
      .upsert(chunk, { onConflict: "source,source_id" });
    if (error) errors.push(`upsert unidades: ${error.message}`);
    else inserted += chunk.length;
  }
  const t2 = Date.now();

  // ── 4. Convivencia: desactivar las filas-proyecto que ya tienen detalle ──
  // (global e idempotente — cubre TODAS las variantes de URL de cada proyecto,
  // no solo la que este batch consultó; ver toctoc-unidades.ts)
  const recon = await desactivarProyectosConUnidades(supabase);
  errors.push(...recon.errores);
  const t3 = Date.now();

  // fechaEntrega: la fuente la entrega por proyecto ("Inmediata", "2° Trimestre
  // 2025"...) pero scraped_properties NO tiene dónde persistirla — se reporta el
  // histograma para dimensionar la migración (columna text `fecha_entrega`), que
  // es decisión aparte.
  const fechasEntrega: Record<string, number> = {};
  for (const r of conUnidades) {
    const k = (r.fechaEntrega ?? "").trim() || "(vacía)";
    fechasEntrega[k] = (fechasEntrega[k] ?? 0) + 1;
  }

  // Unidades por comuna: sin esto, un batch que deja una comuna en cero se lee
  // igual que "esa comuna no tiene proyectos con detalle".
  const porComuna: Record<string, number> = {};
  for (const r of conUnidades) {
    for (const u of r.unidades) porComuna[u.comuna] = (porComuna[u.comuna] ?? 0) + 1;
  }

  return NextResponse.json({
    success: true,
    modo: "unidades-obra-nueva",
    batch,
    cicloDias: CICLO_DIAS,
    proyectosEnCiclo: porId.size,
    proyectosDelBatch: delBatch.length,
    proyectosConUnidades: conUnidades.length,
    proyectosSinUnidades: sinUnidades.length,
    proyectosConError: conError.length,
    unidadesInsertadas: inserted,
    unidadesDescartadas: descartadas,
    basesDesactivadas: recon.desactivadas,
    porComuna,
    fechasEntrega,
    errors: errors.slice(0, 20),
    timing: { graphql_ms: t1 - t0, upsert_ms: t2 - t1, recon_ms: t3 - t2, total_ms: t3 - t0 },
  });
}

// Vercel Cron dispara GET. Mismo handler, misma auth.
export const GET = POST;
