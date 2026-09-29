import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { captureApiWarning } from "@/lib/observabilidad";
import { cerrarCron } from "@/lib/cron-resultado";
import { latirCron } from "@/lib/cron-heartbeat";
import { PAGINA_POSTGREST } from "@/lib/comuna-stats";
import { evaluarAviso } from "@/lib/avisos/evaluar-aviso";
import { avisosEvaluables, avisosPendientes, VENTANA_VISTOS_DIAS, type EvaluacionGuardada, type FilaAviso } from "@/lib/avisos/depurar";

// ─────────────────────────────────────────────────────────────────────────────
// Los avisos evaluados con el motor (30-sep-2026): cada semana, los avisos de venta vistos en los
// últimos 7 días pasan por la MISMA entrada del wizard (evaluar-aviso.ts) con el perfil estándar —pie
// 20% y 30%, 30 años, tasa de mercado— y quedan en `avisos_evaluados` con sus sugerencias (fuente y
// muestra) y su resultado. Es la base de «Por dónde seguir buscando» (los tres
// parecidos): una guía de búsqueda, NO el portafolio de Franco, que es otra cosa y no se mezcla.
//
// PUNTO DE CONTROL: la tabla misma. Cada corrida toma los pendientes (sin evaluación o con precio
// cambiado: la carga inicial la hizo scripts/cargar-avisos-evaluados.ts), evalúa hasta cortar por
// presupuesto y escribe fila por fila; la siguiente sigue donde quedó. Corre cada hora los martes (la tanda nueva de
// la fuente entra los lunes): 24 corridas de ~11 minutos, holgadas para una pasada completa.
// SOLO escribe en avisos_evaluados. `?dry=1` evalúa un puñado y no escribe nada.
// ─────────────────────────────────────────────────────────────────────────────

export const maxDuration = 800;
const RUTA = "GET /api/cron/evaluar-avisos";
/** Corte voluntario antes del maxDuration: responde con lo hecho y deja el resto para la próxima. */
const PRESUPUESTO_MS = 660_000;
const CONCURRENCIA = 4;
const TOPE_DRY = 6;

function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function paginar<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; ; off += PAGINA_POSTGREST) {
    const { data, error } = await consulta(off, off + PAGINA_POSTGREST - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGINA_POSTGREST) break;
  }
  return out;
}

async function leerConfig(sb: SupabaseClient): Promise<{ uf: number; tasa: number }> {
  const { data } = await sb.from("config").select("key, value").in("key", ["uf_value", "tasa_hipotecaria"]);
  const m = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, Number(r.value)]));
  const uf = m.get("uf_value"), tasa = m.get("tasa_hipotecaria");
  if (!(uf && uf > 0) || !(tasa && tasa > 0)) throw new Error("config sin uf_value o tasa_hipotecaria");
  return { uf, tasa };
}

export async function GET(request: Request) {
  const t0 = Date.now();
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dry = new URL(request.url).searchParams.get("dry") === "1";

  const sb = createAdminClient();
  if (!dry) await latirCron(sb, "evaluar-avisos");

  let cfg: { uf: number; tasa: number };
  let pendientes: ReturnType<typeof avisosEvaluables>;
  try {
    cfg = await leerConfig(sb);
    const desde = new Date(Date.now() - VENTANA_VISTOS_DIAS * 864e5).toISOString();
    const filas = await paginar<FilaAviso>((a, b) =>
      sb.from("scraped_properties")
        .select("id, comuna, lat, lng, precio, moneda, superficie_m2, dormitorios, banos, condicion, direccion, fecha_entrega, scraped_at")
        .eq("type", "venta").eq("is_active", true).gte("scraped_at", desde)
        .order("id", { ascending: true }).range(a, b),
    );
    const guardadas = await paginar<EvaluacionGuardada>((a, b) =>
      sb.from("avisos_evaluados").select("aviso_id, precio_uf, evaluado_at, motor_version").order("aviso_id", { ascending: true }).range(a, b),
    );
    pendientes = avisosPendientes(avisosEvaluables(filas, cfg.uf), guardadas);
  } catch (e) {
    captureApiWarning(e, { ruta: RUTA, operacion: "leer" });
    return cerrarCron(sb, "evaluar-avisos", { procesados: 0, exitosos: 0, fallidos: 1 }, { error: `leer: ${String(e).slice(0, 200)}` }, { registrar: !dry });
  }

  const cola = dry ? pendientes.slice(0, TOPE_DRY) : pendientes;
  let i = 0, exitosos = 0, fallidos = 0, sinArriendo = 0;
  const muestraDry: unknown[] = [];
  await Promise.all(Array.from({ length: CONCURRENCIA }, async () => {
    while (i < cola.length && Date.now() - t0 < PRESUPUESTO_MS) {
      const a = cola[i++];
      try {
        // Arriendo de radio, sin segmento de precio: medido el 29-sep-2026 sobre 1.538 avisos, el segmento
        // no desinfla los bloques baratos (bajo UF 30/m² lo usan 5 de 190; la mediana no se mueve) y sube
        // los arriendos sospechosos de 861 a 1.280. Queda en arriendo-segmentado.ts, apagado.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { sug, ...fila } = await evaluarAviso(sb, a, cfg, { segmentar: false });
        if (!fila.arriendo) sinArriendo++;
        if (dry) { muestraDry.push(fila); exitosos++; continue; }
        const { error } = await sb.from("avisos_evaluados").upsert(fila, { onConflict: "aviso_id" });
        if (error) { fallidos++; captureApiWarning(error, { ruta: RUTA, operacion: "upsert" }); } else exitosos++;
      } catch (e) {
        fallidos++;
        captureApiWarning(e, { ruta: RUTA, operacion: "evaluar" });
      }
    }
  }));

  return cerrarCron(sb, "evaluar-avisos",
    { procesados: exitosos + fallidos, exitosos, fallidos },
    { dry, pendientes: pendientes.length, restantes: Math.max(0, cola.length - (exitosos + fallidos)), sinArriendo, ms: Date.now() - t0, ...(dry ? { muestra: muestraDry } : {}) }, { registrar: !dry });
}
