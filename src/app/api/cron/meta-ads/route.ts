import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureApiError, captureApiWarning } from "@/lib/observabilidad";
import { guardarMetrica } from "@/lib/metrics-daily";
import {
  FUENTE_META_ADS,
  METRICA_CLICKS_1D,
  METRICA_IMPRESSIONS_1D,
  METRICA_REACH_1D,
  METRICA_SPEND_1D,
} from "@/lib/meta-ads";
import { latirCron } from "@/lib/cron-heartbeat";

/**
 * Cron · Gasto diario de Meta Ads → metrics_daily.
 *
 * Mismo contrato que sentry-metrics: consulta una API externa, escribe una fila
 * por día y por métrica, y ante cualquier problema NO escribe. Un día sin fila se
 * lee como "sin dato"; escribir un cero diría que no gastamos, que es otra cosa.
 *
 * QUÉ SE TRAE: gasto, impresiones, clics y alcance. NADA de conversiones — ver la
 * cabecera de src/lib/meta-ads.ts para el motivo (la atribución modelada de Meta
 * nunca va a cuadrar con auth.users, y dos cifras que no cuadran contaminan la
 * credibilidad del panel entero).
 *
 * POR QUÉ EL DÍA ANTERIOR Y NO EL DÍA EN CURSO: Meta consolida el gasto con
 * retraso. Los insights del día en curso se mueven durante horas (y siguen
 * ajustándose por tráfico inválido incluso después), así que pedirlos daría una
 * fila que hoy dice una cosa y mañana otra — y como la PK es (fecha, fuente,
 * metrica), la corrida siguiente la pisaría en silencio. Pidiendo AYER, cerrado,
 * cada fila se escribe una sola vez con el número definitivo.
 *
 * ZONA HORARIA: el `time_range` se expresa en la zona de la CUENTA publicitaria,
 * no en UTC. El día se calcula en UTC y se anota en `meta.zona_nota` para que
 * nadie lea la fila como un corte a medianoche de Santiago. La diferencia importa
 * solo en los bordes; el agregado de 30 días es el mismo.
 *
 * Auth: Vercel Cron dispara GET con `Authorization: Bearer ${CRON_SECRET}`.
 */

/** Versión de la Graph API. Explícita: sin versión, Meta usa la más vieja soportada. */
const GRAPH_VERSION = "v21.0";
const GRAPH_API = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Códigos de error de Meta que significan "el token ya no sirve".
 *
 *   190 → token inválido, expirado o revocado (el caso esperado: el actual caduca
 *         alrededor del 10-oct-2026).
 *   102 → sesión caducada.
 *   463 → token expirado explícitamente.
 *   467 → token inválido por cambio de credenciales.
 *
 * Se distinguen del resto de fallos porque piden una acción humana concreta —
 * regenerar el token— y no se arreglan solos con el reintento de mañana.
 */
const CODIGOS_TOKEN_MUERTO = new Set([190, 102, 463, 467]);

const RUTA = "GET /api/cron/meta-ads";

function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** Error de token: se separa del resto para poder reportarlo con instrucciones. */
class TokenMetaMuerto extends Error {}

interface RespuestaGraph {
  data?: Array<Record<string, unknown>>;
  error?: { message?: string; code?: number; type?: string; error_subcode?: number };
}

async function graphFetch(url: string): Promise<RespuestaGraph> {
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as RespuestaGraph;

  if (json?.error) {
    const { code, message, type } = json.error;
    if (typeof code === "number" && CODIGOS_TOKEN_MUERTO.has(code)) {
      throw new TokenMetaMuerto(`Meta rechazó el token (code ${code}): ${message ?? type ?? "sin detalle"}`);
    }
    throw new Error(`Meta ${res.status} (code ${code ?? "?"}): ${String(message ?? "").slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`Meta respondió ${res.status} sin cuerpo de error`);
  }
  return json;
}

/** Los insights llegan como strings ("1234.56"). Lo no numérico se descarta. */
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Día anterior en UTC, YYYY-MM-DD. */
function ayerUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    console.error("[cron/meta-ads] CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Latido antes del trabajo: registra "corrió", no "terminó bien" — el camino de
  // config incompleta sale sin escribir ninguna métrica (ver cron-heartbeat.ts).
  await latirCron(createAdminClient(), "meta-ads");

  const token = process.env.META_ADS_TOKEN;
  const cuenta = process.env.META_AD_ACCOUNT_ID;

  // Falta configuración: no es un cron roto, y devolver 500 lo pintaría en rojo
  // todas las noches. Se avisa una vez y se sale sin escribir.
  if (!token || !cuenta) {
    const faltan = [!token && "META_ADS_TOKEN", !cuenta && "META_AD_ACCOUNT_ID"].filter(Boolean);
    console.warn("[cron/meta-ads] sin configurar:", faltan.join(", "));
    captureApiWarning(new Error(`Faltan variables de Meta Ads: ${faltan.join(", ")}`), {
      ruta: RUTA,
      operacion: "config-meta-incompleta",
    });
    return NextResponse.json({ ok: false, skipped: "config-incompleta", faltan });
  }

  const fecha = ayerUTC();

  try {
    // 1) Nivel cuenta: es la ÚNICA cifra correcta de `reach`. El alcance son
    //    personas únicas y no es aditivo — sumar el reach de cada campaña cuenta
    //    dos veces a quien vio dos campañas, y da un número inflado que además
    //    puede superar la población alcanzable.
    const paramsCuenta = new URLSearchParams({
      fields: "spend,impressions,clicks,reach,account_currency",
      time_range: JSON.stringify({ since: fecha, until: fecha }),
      level: "account",
      access_token: token,
    });
    const cuentaRes = await graphFetch(`${GRAPH_API}/${cuenta}/insights?${paramsCuenta}`);
    const fila = cuentaRes.data?.[0];

    // Sin `data` no hubo actividad ese día (Meta omite los días sin entrega).
    // Eso SÍ es un cero legítimo y medido: la cuenta existe, respondió, y no
    // gastó. Distinto de "no pudimos preguntar", que sale por el catch.
    const spend = fila ? (num(fila.spend) ?? 0) : 0;
    const impressions = fila ? (num(fila.impressions) ?? 0) : 0;
    const clicks = fila ? (num(fila.clicks) ?? 0) : 0;
    const reach = fila ? (num(fila.reach) ?? 0) : 0;
    const moneda = typeof fila?.account_currency === "string" ? fila.account_currency : null;

    // 2) Desglose por campaña, para el jsonb. Va en su propio try: es contexto,
    //    no la medición. Si falla, las cuatro métricas se guardan igual — perder
    //    el detalle no puede costar el dato.
    let campanas: Array<{ id: unknown; nombre: unknown; spend: number | null }> | null = null;
    try {
      const paramsCampana = new URLSearchParams({
        fields: "campaign_id,campaign_name,spend,impressions,clicks",
        time_range: JSON.stringify({ since: fecha, until: fecha }),
        level: "campaign",
        access_token: token,
      });
      const campRes = await graphFetch(`${GRAPH_API}/${cuenta}/insights?${paramsCampana}`);
      campanas = (campRes.data ?? []).map((c) => ({
        id: c.campaign_id,
        nombre: c.campaign_name,
        spend: num(c.spend),
      }));
    } catch (e) {
      // Un token muerto ya habría reventado en la llamada 1; acá solo se pierde
      // el desglose.
      console.warn("[cron/meta-ads] desglose por campaña no disponible:", e);
    }

    const metaJson = {
      fecha_solicitada: fecha,
      nivel: "account",
      graph_version: GRAPH_VERSION,
      moneda,
      zona_nota: "time_range va en la zona horaria de la cuenta publicitaria, no en UTC",
      sin_entrega: !fila,
      ...(campanas ? { campanas } : {}),
    };

    const db = createAdminClient();
    // Las cuatro métricas comparten el mismo jsonb: el contexto (moneda, campañas,
    // si hubo entrega) es de la corrida, no de una métrica en particular.
    const escrituras = await Promise.all([
      guardarMetrica(db, { fecha, fuente: FUENTE_META_ADS, metrica: METRICA_SPEND_1D, valor: spend, meta: metaJson }),
      guardarMetrica(db, { fecha, fuente: FUENTE_META_ADS, metrica: METRICA_IMPRESSIONS_1D, valor: impressions, meta: metaJson }),
      guardarMetrica(db, { fecha, fuente: FUENTE_META_ADS, metrica: METRICA_CLICKS_1D, valor: clicks, meta: metaJson }),
      guardarMetrica(db, { fecha, fuente: FUENTE_META_ADS, metrica: METRICA_REACH_1D, valor: reach, meta: metaJson }),
    ]);

    const fallidas = escrituras.filter((ok) => !ok).length;
    if (fallidas > 0) {
      captureApiWarning(new Error(`No se pudieron escribir ${fallidas} de 4 métricas de Meta Ads`), {
        ruta: RUTA,
        operacion: "guardar-metrica",
        extra: { fecha, spend },
      });
      // Escritura parcial: 207 deja la corrida distinguible sin pintarla en rojo
      // (mismo criterio que cron-resultado.ts).
      return NextResponse.json(
        { ok: false, error: "escritura-parcial", fecha, escritas: 4 - fallidas },
        { status: fallidas === 4 ? 500 : 207 },
      );
    }

    return NextResponse.json({
      ok: true,
      fecha,
      spend,
      impressions,
      clicks,
      reach,
      moneda,
      campanas: campanas?.length ?? null,
    });
  } catch (e) {
    if (e instanceof TokenMetaMuerto) {
      // El caso que MÁS importa señalar: con el token muerto la API deja de
      // responder y el panel mostraría gasto $0, que se lee como "no gastamos"
      // cuando la verdad es "dejamos de medir". Va como error (no warning)
      // porque pide una acción humana y no se arregla con el reintento de mañana.
      console.error("[cron/meta-ads] TOKEN EXPIRADO:", e);
      captureApiError(
        new Error(
          `META_ADS_TOKEN expiró o fue revocado — el gasto de Meta dejó de medirse. ` +
            `Hay que regenerar el token en el Graph API Explorer ` +
            `(developers.facebook.com/tools/explorer, permisos ads_read sobre la cuenta ` +
            `${process.env.META_AD_ACCOUNT_ID ?? "META_AD_ACCOUNT_ID"}), extenderlo a long-lived y ` +
            `actualizarlo en Vercel. Detalle de Meta: ${e.message}`,
        ),
        { ruta: RUTA, operacion: "token-meta-expirado", extra: { fecha } },
      );
      return NextResponse.json({ ok: false, error: "token-expirado", fecha }, { status: 500 });
    }

    // Cualquier otro fallo de la API: se reporta y NO se escribe. Sin fila, el
    // panel dice "sin dato" en vez de "gastamos cero".
    console.error("[cron/meta-ads] error consultando Meta:", e);
    captureApiWarning(e, { ruta: RUTA, operacion: "consultar-meta-ads", extra: { fecha } });
    return NextResponse.json({ ok: false, error: "meta-no-disponible", fecha });
  }
}

// Vercel Cron dispara GET. Se reusa el handler POST con su validación Bearer —
// mismo patrón que sentry-metrics y los scrapers.
export const GET = POST;
