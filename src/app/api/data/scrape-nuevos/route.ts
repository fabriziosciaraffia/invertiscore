import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  scrapeTocTocMap,
  getTodasLasComunas,
  ESTADO_OBRA_NUEVA,
} from "@/lib/services/scraper/toctoc";
import { latirCron } from "@/lib/cron-heartbeat";
import { propertyToRow } from "@/lib/services/scraper/property-row";
import { desactivarProyectosConUnidades } from "@/lib/services/scraper/toctoc-unidades";

// ─── Pase de OBRA NUEVA, con cadencia propia ─────────────────────────────────
//
// POR QUÉ EXISTE. El pase general (/api/data/scrape-properties) rota UNA comuna
// por corrida (BATCH_SIZE=1 sobre 25 comunas ⇒ cada comuna cada 25 días) y pide
// el GetProps con `estado: 0` (todo), cuya respuesta se capa en `limite` = 510
// filas sobre universos de miles. La obra nueva es ~1% del stock de venta, así
// que caía dentro de ese corte solo por azar: de ahí que los 964 avisos `nuevo`
// llegaran en lotes esporádicos (los 34 comparables de Santiago se scrapearon
// todos el 24-mar y no se volvieron a tocar) mientras el usado se refresca solo.
//
// Desde el fix de segmentación (ac83e94) la condición decide contra qué universo
// se compara el precio de un depto, así que un universo nuevo desactualizado deja
// análisis sin comparación: 41 de 78 sujetos nuevos no juntaban muestra.
//
// POR QUÉ ES BARATO. `estado: 1` es un filtro nativo de la fuente (verificado en
// vivo: devuelve 100% urls compranuevo). El universo por comuna es de 9 a 101
// filas — muy por debajo del techo de 510 —, así que NO necesita paginación y las
// 25 comunas caben en UNA corrida: 25 llamadas de ~230ms.
//
// POR QUÉ RUTA PROPIA Y NO `?mode=`. La documentación de Vercel Cron no respalda
// query strings en `path` (sus ejemplos usan rutas propias o el mismo path con
// distinto schedule). Un query string ignorado habría disparado el pase general
// dos veces al día, en silencio, y este pase no habría corrido nunca.

export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = ReturnType<typeof createClient<any>>;

function getSupabase(): AnySupabase {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Pausa de cortesía entre comunas (ms). Más corta que los 2s del pase general:
 *  la respuesta es ~20x más chica y el pase entero corre una sola vez al día. */
const PAUSA_MS = 800;

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

  const comunas = getTodasLasComunas();
  const supabase = getSupabase();
  // Latido ANTES del trabajo (doctrina cron-heartbeat): registra "corrió".
  await latirCron(supabase, "scrape-nuevos");
  const t0 = Date.now();

  // Solo `venta`: la obra nueva no existe en arriendo.
  const result = await scrapeTocTocMap("venta", comunas, ESTADO_OBRA_NUEVA, PAUSA_MS);
  const t1 = Date.now();

  // Guard de integridad. Este pase existe para traer obra nueva; si el filtro de
  // la fuente cambiara de semántica entrarían filas `usado` y contaminarían el
  // universo contra el que se comparan los deptos nuevos — justo el defecto que
  // este trabajo vino a cerrar. Se descartan y se reportan, no se escriben.
  const nuevas = result.properties.filter((p) => p.condicion === "nuevo");
  const descartadasNoNuevas = result.properties.length - nuevas.length;

  const validProps = nuevas.filter((p) => p.precio > 0);
  const skipped = nuevas.length - validProps.length;

  // Dedup por source+source_id (misma clave del upsert).
  const rowsByKey = new Map<string, ReturnType<typeof propertyToRow>>();
  for (const r of validProps.map(propertyToRow)) rowsByKey.set(`${r.source}|${r.source_id}`, r);
  const rows = Array.from(rowsByKey.values());

  const errors = [...result.errors];
  let inserted = 0;
  if (rows.length > 0) {
    const { error } = await supabase
      .from("scraped_properties")
      .upsert(rows, { onConflict: "source,source_id" });
    if (error) errors.push(`Bulk upsert error: ${error.message}`);
    else inserted = rows.length;
  }

  // Convivencia con el pase de unidades (scrape-unidades-nuevas): el upsert de
  // arriba acaba de RESUCITAR (is_active: true) las filas-proyecto, incluidas
  // las que ese pase había desactivado por tener unidades. Re-aplicar el
  // invariante acá (global e idempotente) evita que la mediana cuente el
  // proyecto dos veces durante el día. Ver toctoc-unidades.ts.
  const recon = await desactivarProyectosConUnidades(supabase);
  errors.push(...recon.errores);
  const t2 = Date.now();

  // Cobertura por comuna: sin esto, un viewport roto o una comuna que dejó de
  // responder se lee igual que "esa comuna no tiene proyectos en venta".
  const porComuna: Record<string, number> = {};
  for (const p of validProps) porComuna[p.comuna] = (porComuna[p.comuna] ?? 0) + 1;

  return NextResponse.json({
    success: true,
    modo: "obra-nueva",
    comunasRecorridas: comunas.length,
    comunasConResultados: Object.keys(porComuna).length,
    inserted,
    skipped,
    descartadasNoNuevas,
    basesDesactivadas: recon.desactivadas,
    totalScraped: result.properties.length,
    withCoords: validProps.filter((p) => p.lat && p.lng).length,
    porComuna,
    errors: errors.slice(0, 20),
    timing: { scrape_ms: t1 - t0, upsert_ms: t2 - t1, total_ms: t2 - t0 },
  });
}

// Vercel Cron dispara GET. Mismo handler, misma auth.
export const GET = POST;
