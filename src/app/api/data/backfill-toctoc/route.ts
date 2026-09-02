import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchMapPaginado,
  ESTADO_USADO,
  ESTADO_TODO,
  GETPROPS_MAX_POR_PAGINA,
  type ScrapedProperty,
} from "@/lib/services/scraper/toctoc";
import { propertyToRow, filaSinPisarCoords, upsertSinPisarCoords, type FilaUpsert } from "@/lib/services/scraper/property-row";
import {
  CONFIG_KEY_CHECKPOINT,
  OPERACIONES,
  parsearOperacion,
  parsearCheckpoint,
  planificar,
  estadoVacio,
  paseCompleto,
  aplicarFiltrosUniverso,
  aplicarFiltrosDesactivacion,
  debeDesactivar,
  type CheckpointBackfill,
  type OperacionBackfill,
  type Tramo,
} from "@/lib/services/scraper/backfill-plan";
import { PAGINA_POSTGREST } from "@/lib/comuna-stats";
import { respuestaCron } from "@/lib/cron-resultado";
import { captureApiError } from "@/lib/observabilidad";

// ─── Backfill y refresco del universo TocToc (venta usada + arriendo) ────────
//
// POR QUÉ EXISTE. El pase diario (/api/data/scrape-properties) pide UNA página
// de 510 filas por comuna y rota una comuna por día: Las Condes veía 432 de sus
// 4.615 ventas usadas y nada desactivaba lo que la fuente bajaba. Medido el
// 02-sep-2026: de 24.645 arriendos activos solo 5.381 seguían publicados. Esta
// ruta recorre el universo ENTERO por paginación del GetProps —un solo viewport
// del Gran Santiago, 600 por página, 44 + 16 páginas, ~21 MB— y marca cada fila
// con el id del pase para que el refresco (Fase C) desactive lo que no vio.
//
// REGLAS DURAS (audit 02-sep-2026):
//  · Nunca toca la ficha HTML: bloquea la IP a los ~36 GETs. Todo sale del
//    listado, coordenadas incluidas.
//  · El upsert no pisa lat/lng existentes con null (upsertSinPisarCoords).
//  · Obra nueva no se toca: venta va con estado=2 (usado); scrape-nuevos y
//    unidades siguen con su cadencia.
//
// PARÁMETROS (GET, Bearer CRON_SECRET):
//  · operacion=venta|arriendo|ambas (default ambas — el cron no lleva query).
//  · desde=<página>: reanuda el pase del checkpoint desde esa página (una sola
//    operación). reanudar=1: reanuda cada operación desde su última página + 1.
//  · dry=1: recorre y cuenta lo que escribiría, sin checkpoint ni upsert.
//    NO se capa: reporta el conteo real.
//  · forzarDesactivacion=1: salta SOLO la salvaguarda de proporción de la
//    desactivación (Fase C). No salta pase completo, ambas operaciones, cero
//    errores ni universo no vacío. Queda anotado en el log y en el checkpoint.
//
// CHECKPOINT en `config` (CONFIG_KEY_CHECKPOINT), actualizado tras cada página
// upserteada. Un corte por tiempo (PRESUPUESTO_MS) o por upsert fallido deja el
// punto exacto; la respuesta trae el comando para seguir.

// Vercel Pro: 800 s. El pase completo tarda 2-3 min; el tope es red de
// seguridad, no presupuesto. Ver PRESUPUESTO_MS.
export const maxDuration = 800;

/** Corte voluntario antes del maxDuration: deja checkpoint y responde. */
const PRESUPUESTO_MS = 700_000;
/** Pausa entre páginas (cortesía con la fuente; medido sin bloqueo a 1 s). */
const PAUSA_MS = 1000;

const ESTADO_POR_OPERACION: Record<OperacionBackfill, number> = {
  venta: ESTADO_USADO,
  arriendo: ESTADO_TODO,
};

const RUTA = "GET /api/data/backfill-toctoc";

class CorteTiempo extends Error {}
class FalloUpsert extends Error {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = ReturnType<typeof createClient<any>>;

function getSupabase(): AnySupabase {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function leerCheckpoint(sb: AnySupabase): Promise<CheckpointBackfill | null> {
  const { data, error } = await sb.from("config").select("value").eq("key", CONFIG_KEY_CHECKPOINT).maybeSingle();
  if (error) throw new Error(`leer checkpoint: ${error.message}`);
  return parsearCheckpoint((data as { value?: string } | null)?.value);
}

async function guardarCheckpoint(sb: AnySupabase, cp: CheckpointBackfill): Promise<void> {
  cp.actualizadoEn = new Date().toISOString();
  const { error } = await sb
    .from("config")
    .upsert({ key: CONFIG_KEY_CHECKPOINT, value: JSON.stringify(cp), updated_at: cp.actualizadoEn }, { onConflict: "key" });
  if (error) throw new Error(`guardar checkpoint: ${error.message}`);
}

/** Filas de una página listas para el upsert: precio > 0, dedup por clave, pase marcado, sin pisar coords. */
function filasDePagina(props: ScrapedProperty[], pase: string | null): FilaUpsert[] {
  const byKey = new Map<string, FilaUpsert>();
  for (const p of props) {
    if (!(p.precio > 0)) continue;
    const r: FilaUpsert = propertyToRow(p);
    if (pase) r.seen_pass_id = pase;
    byKey.set(`${r.source}|${r.source_id}`, r);
  }
  return Array.from(byKey.values()).map((r) => filaSinPisarCoords(r));
}

interface DetalleTramo {
  operacion: OperacionBackfill;
  desdePagina: number;
  total: number | null;
  paginas: number;
  crudas: number;
  parseadas: number;
  escritas: number;
  nuevas: number;
  completa: boolean;
  ms: number;
}

function detalleVacio(t: Tramo): DetalleTramo {
  return { operacion: t.operacion, desdePagina: t.desdePagina, total: null, paginas: 0, crudas: 0, parseadas: 0, escritas: 0, nuevas: 0, completa: false, ms: 0 };
}

// ─── Desactivación (Fase C) ──────────────────────────────────────────────────

/** Activas del universo que el pase mantiene (toctoc, usado + arriendo). */
async function contarActivas(sb: AnySupabase): Promise<number> {
  const { count, error } = await aplicarFiltrosUniverso(
    sb.from("scraped_properties").select("id", { count: "exact", head: true }),
  );
  if (error) throw new Error(`contar activas: ${error.message}`);
  return count ?? 0;
}

/**
 * Cuántas activas NO están en el conjunto que el pase vio. Pagina por id (el
 * tope de PostgREST es PAGINA_POSTGREST filas por respuesta). Lo usa el dry-run,
 * que no tiene pase con qué comparar en la tabla.
 */
async function contarNoVistas(sb: AnySupabase, vistas: Set<string>, tipos: OperacionBackfill[]): Promise<{ activas: number; noVistas: number }> {
  let activas = 0;
  let noVistas = 0;
  for (let off = 0; ; off += PAGINA_POSTGREST) {
    const { data, error } = await aplicarFiltrosUniverso(sb.from("scraped_properties").select("source_id,type"))
      .in("type", tipos)
      .order("id", { ascending: true })
      .range(off, off + PAGINA_POSTGREST - 1);
    if (error) throw new Error(`leer activas: ${error.message}`);
    const rows = (data ?? []) as Array<{ source_id: string; type: string }>;
    for (const r of rows) {
      activas++;
      if (!vistas.has(`toctoc|${r.source_id}`)) noVistas++;
    }
    if (rows.length < PAGINA_POSTGREST) break;
  }
  return { activas, noVistas };
}

/**
 * Desactiva lo que el pase completo no vio. Solo la llama un pase COMPLETO
 * (dos operaciones, cero errores) y una sola vez por pase; además exige que el
 * pase haya escrito una fracción plausible de las activas (debeDesactivar).
 * Devuelve el conteo o el motivo por el que no se hizo.
 */
async function desactivarNoVistas(sb: AnySupabase, pase: string): Promise<{ filas: number } | { omitida: string }> {
  const { count, error } = await aplicarFiltrosDesactivacion(
    sb.from("scraped_properties").update({ is_active: false }, { count: "exact" }),
    pase,
  );
  if (error) return { omitida: `update falló: ${error.message}` };
  return { filas: count ?? 0 };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret) {
    console.error("[backfill-toctoc] CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";
  const operaciones = parsearOperacion(url.searchParams.get("operacion"));
  if (!operaciones) return NextResponse.json({ error: "operacion debe ser venta, arriendo o ambas" }, { status: 400 });
  const desdeRaw = url.searchParams.get("desde");
  const desde = desdeRaw === null ? null : Number(desdeRaw);
  if (desde !== null && (!Number.isInteger(desde) || desde < 1)) {
    return NextResponse.json({ error: "desde debe ser un entero >= 1" }, { status: 400 });
  }
  const reanudar = url.searchParams.get("reanudar") === "1";
  const forzarDesactivacion = url.searchParams.get("forzarDesactivacion") === "1";

  const t0 = Date.now();
  // Margen de 60 s por el reloj de Postgres vs el de la función: una fila creada
  // en ese minuto por el scrape diario contaría como nueva; irrelevante.
  const inicioIso = new Date(t0 - 60_000).toISOString();
  const sb = getSupabase();

  // ── DRY RUN: recorre y cuenta, sin checkpoint, sin seen_pass_id, sin upsert ──
  if (dry) {
    if (desde !== null && operaciones.length !== 1) {
      return NextResponse.json({ error: "desde= exige una sola operacion" }, { status: 400 });
    }
    const tramos: Tramo[] = operaciones.map((operacion) => ({ operacion, desdePagina: desde ?? 1 }));
    const detalles: DetalleTramo[] = [];
    const unicas = new Set<string>();
    const porComuna: Record<string, number> = {};
    const errores: string[] = [];
    for (const tramo of tramos) {
      const d = detalleVacio(tramo);
      detalles.push(d);
      const tTramo = Date.now();
      const res = await fetchMapPaginado({
        type: tramo.operacion,
        estado: ESTADO_POR_OPERACION[tramo.operacion],
        desdePagina: tramo.desdePagina,
        pausaMs: PAUSA_MS,
        onPagina: (p) => {
          const filas = filasDePagina(p.properties, null);
          d.paginas++;
          d.crudas += p.crudas;
          d.parseadas += p.properties.length;
          d.escritas += filas.length;
          d.total = p.total;
          d.completa = p.pagina * GETPROPS_MAX_POR_PAGINA >= p.total;
          for (const f of filas) {
            unicas.add(`${f.source}|${f.source_id}`);
            const c = String(f.comuna);
            porComuna[c] = (porComuna[c] ?? 0) + 1;
          }
          if (Date.now() - t0 > PRESUPUESTO_MS) throw new CorteTiempo(`presupuesto agotado en ${tramo.operacion} p${p.pagina}`);
        },
      }).catch((e: unknown) => {
        errores.push(String(e instanceof Error ? e.message : e));
        return { total: d.total ?? 0, paginas: d.paginas, properties: [], errors: [] };
      });
      errores.push(...res.errors.map((e) => `${tramo.operacion}: ${e}`));
      d.ms = Date.now() - tTramo;
    }
    // Qué desactivaría un pase completo con exactamente esto: activas del
    // universo (de los tipos pedidos) que no aparecieron en el recorrido.
    let desactivacion: { activas: number; desactivaria: number; motivo: string } | { error: string };
    try {
      const todasCompletas = detalles.every((d) => d.completa) && errores.length === 0;
      const { activas, noVistas } = await contarNoVistas(sb, unicas, operaciones);
      const decision = debeDesactivar({ escritasPase: unicas.size, activasAntes: activas });
      desactivacion = {
        activas,
        desactivaria: todasCompletas && decision.ok ? noVistas : 0,
        motivo: !todasCompletas ? `recorrido incompleto o con errores: no desactivaría (habría ${noVistas} no vistas)` : decision.ok ? decision.motivo : `${decision.motivo}: no desactivaría (habría ${noVistas} no vistas)`,
      };
    } catch (e) {
      desactivacion = { error: String(e instanceof Error ? e.message : e) };
    }
    const resumen = {
      dry: true,
      escribiria: unicas.size,
      tramos: detalles,
      desactivacion,
      porComuna: Object.fromEntries(Object.entries(porComuna).sort((a, b) => b[1] - a[1])),
      errores,
      nota: "sin checkpoint, sin seen_pass_id, sin upsert, sin desactivar; los conteos no están capados",
      timing: { total_ms: Date.now() - t0 },
    };
    console.log(`[backfill-toctoc] dry ${JSON.stringify({ escribiria: resumen.escribiria, tramos: detalles, desactivacion, errores })}`);
    return NextResponse.json(resumen, { status: errores.length ? 207 : 200 });
  }

  // ── CORRIDA REAL ──
  let checkpoint: CheckpointBackfill | null;
  try {
    checkpoint = await leerCheckpoint(sb);
  } catch (e) {
    captureApiError(e, { ruta: RUTA, operacion: "leer-checkpoint" });
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
  // Activas del universo ANTES del primer upsert de esta invocación. Un pase
  // nuevo lo guarda como denominador de la salvaguarda; al reanudar se conserva
  // el del checkpoint (medirlo después inflaría el denominador con las filas
  // nuevas del propio pase).
  let activasAlInicio: number | null = null;
  try {
    activasAlInicio = await contarActivas(sb);
  } catch (e) {
    captureApiError(e, { ruta: RUTA, operacion: "contar-activas-inicio" });
  }
  const plan = planificar({ operaciones, desde, reanudar, checkpoint, ahora: new Date(), activasAlInicio });
  if ("error" in plan) return NextResponse.json({ error: plan.error }, { status: 400 });
  const cp = plan.checkpoint;

  const detalles: DetalleTramo[] = [];
  let cortado = false;
  let motivoCorte: string | null = null;

  try {
    // El pase queda registrado ANTES de la primera fila: si la función muere
    // después, el checkpoint ya dice qué pase está a medias.
    await guardarCheckpoint(sb, cp);

    for (const tramo of plan.tramos) {
      const est = cp.operaciones[tramo.operacion] ?? estadoVacio();
      cp.operaciones[tramo.operacion] = est;
      const d = detalleVacio(tramo);
      detalles.push(d);
      const tTramo = Date.now();

      const res = await fetchMapPaginado({
        type: tramo.operacion,
        estado: ESTADO_POR_OPERACION[tramo.operacion],
        desdePagina: tramo.desdePagina,
        pausaMs: PAUSA_MS,
        onPagina: async (p) => {
          const filas = filasDePagina(p.properties, plan.pase);
          const r = await upsertSinPisarCoords(sb, filas, { contarNuevasDesde: inicioIso });
          d.crudas += p.crudas;
          d.parseadas += p.properties.length;
          if (r.errores.length) {
            cp.errores.push(...r.errores.map((e) => `${tramo.operacion} p${p.pagina}: ${e}`));
            await guardarCheckpoint(sb, cp);
            throw new FalloUpsert(`${tramo.operacion} p${p.pagina}: ${r.errores[0]}`);
          }
          est.total = p.total;
          est.ultimaPagina = p.pagina;
          est.filas += r.escritas;
          est.nuevas += r.nuevas;
          est.completa = p.pagina * GETPROPS_MAX_POR_PAGINA >= p.total;
          est.terminadoEn = est.completa ? new Date().toISOString() : null;
          d.paginas++;
          d.escritas += r.escritas;
          d.nuevas += r.nuevas;
          d.total = p.total;
          d.completa = est.completa;
          await guardarCheckpoint(sb, cp);
          if (!est.completa && Date.now() - t0 > PRESUPUESTO_MS) {
            throw new CorteTiempo(`presupuesto de ${PRESUPUESTO_MS / 1000} s agotado en ${tramo.operacion} p${p.pagina}`);
          }
        },
      });
      d.ms = Date.now() - tTramo;

      if (res.errors.length) {
        cp.errores.push(...res.errors.map((e) => `${tramo.operacion}: ${e}`));
      }
      // Un universo vacío no es "todo desactivado": es la fuente fallando. Se
      // registra como error para que el pase NO cuente como completo (Fase C).
      if (res.paginas === 0 && res.errors.length === 0) {
        cp.errores.push(`${tramo.operacion}: universo vacío (total ${res.total})`);
      }
      if (cp.errores.length) await guardarCheckpoint(sb, cp);
    }
  } catch (e) {
    cortado = true;
    motivoCorte = e instanceof Error ? e.message : String(e);
    if (!(e instanceof CorteTiempo) && !(e instanceof FalloUpsert)) {
      cp.errores.push(`excepción: ${motivoCorte}`);
      captureApiError(e, { ruta: RUTA, operacion: "backfill", extra: { pase: plan.pase } });
      await guardarCheckpoint(sb, cp).catch(() => undefined);
    }
  }

  // ── Fase C: al cerrar un pase COMPLETO, desactivar lo que no vio ──
  // Solo si las dos operaciones terminaron sin errores (paseCompleto) y una
  // sola vez por pase (cp.desactivacion). Un pase parcial NUNCA desactiva.
  let desactivacion:
    | { filas: number; activasAntes: number | null; motivo: string; forzada: boolean }
    | { omitida: string }
    | null = null;
  if (!cortado && paseCompleto(cp) && !cp.desactivacion) {
    try {
      // Denominador: las activas AL INICIO del pase, no las de ahora.
      const activasAntes = cp.activasAlInicio ?? null;
      const escritasPase = OPERACIONES.reduce((a, op) => a + (cp.operaciones[op]?.filas ?? 0), 0);
      const decision = debeDesactivar({ escritasPase, activasAntes, forzar: forzarDesactivacion });
      if (!decision.ok) {
        // Salvaguarda: NO es un error del pase. El pase sigue completo y se
        // reintenta con ?reanudar=1 (más ?forzarDesactivacion=1 si corresponde).
        desactivacion = { omitida: decision.motivo };
        cp.desactivacionOmitida = decision.motivo;
        console.warn(`[backfill-toctoc] desactivación omitida (pase ${plan.pase}): ${decision.motivo}`);
      } else {
        const r = await desactivarNoVistas(sb, plan.pase);
        if ("omitida" in r) {
          desactivacion = r;
          cp.errores.push(`desactivación: ${r.omitida}`);
        } else {
          desactivacion = { filas: r.filas, activasAntes, motivo: decision.motivo, forzada: decision.forzada };
          cp.desactivacion = { en: new Date().toISOString(), pase: plan.pase, filas: r.filas, activasAntes, forzada: decision.forzada };
          cp.desactivacionOmitida = null;
          if (decision.forzada) console.warn(`[backfill-toctoc] desactivación FORZADA (pase ${plan.pase}): ${r.filas} filas · ${decision.motivo}`);
        }
      }
      await guardarCheckpoint(sb, cp);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      desactivacion = { omitida: msg };
      cp.errores.push(`desactivación: ${msg}`);
      captureApiError(e, { ruta: RUTA, operacion: "desactivar", extra: { pase: plan.pase } });
      await guardarCheckpoint(sb, cp).catch(() => undefined);
    }
  }

  const parseadas = detalles.reduce((a, d) => a + d.parseadas, 0);
  const escritas = detalles.reduce((a, d) => a + d.escritas, 0);
  const nuevas = detalles.reduce((a, d) => a + d.nuevas, 0);
  const pendiente = plan.tramos.find((t) => !cp.operaciones[t.operacion]?.completa)?.operacion ?? null;
  const resumen = {
    pase: plan.pase,
    motivo: plan.motivo,
    tramos: detalles,
    escritas,
    nuevas,
    actualizadas: escritas - nuevas,
    cortado,
    motivoCorte,
    paseCompleto: paseCompleto(cp) || !!cp.desactivacion,
    activasAlInicio: cp.activasAlInicio ?? null,
    desactivacion,
    desactivacionOmitida: cp.desactivacionOmitida ?? null,
    forzarDesactivacion,
    reanudarCon: cortado && pendiente ? `?operacion=${pendiente}&reanudar=1` : null,
    errores: cp.errores.slice(0, 20),
    timing: { total_ms: Date.now() - t0 },
  };
  console.log(`[backfill-toctoc] ${JSON.stringify({ ...resumen, checkpoint: cp })}`);

  return respuestaCron(
    { procesados: parseadas, exitosos: escritas, fallidos: Math.max(0, parseadas - escritas) + cp.errores.length },
    { ...resumen, checkpoint: cp },
  );
}
