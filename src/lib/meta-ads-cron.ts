/**
 * La corrida del cron de Meta Ads, sin la ruta (13-oct-2026): qué pide a Meta, qué escribe y cómo cierra. Las
 * dependencias —el fetch, la escritura en metrics_daily y los avisos a Sentry— entran por parámetro para que el
 * tier META-ADS-SIN-CAMPANA la pruebe sin base ni red. La ruta (`/api/cron/meta-ads`) late, llama acá y cierra con
 * `cerrarCron`.
 *
 * SIN CAMPAÑA ACTIVA (13-oct-2026, decisión de Fabrizio): mientras no haya un token válido —vencido, revocado o sin
 * configurar— el cron termina en SILENCIO: sale bien, sin alerta ni error a Sentry, con la pausa «sin campaña
 * activa» (`cerrarCron`, `extra.pausa`), y la vigilancia no le cuenta que deje de escribir. Hasta el 12-oct el token
 * vencido era una falla con correo diario: el token caducó el 11-oct (code 190, «Session has expired on Sunday,
 * 11-Oct-26 05:41:44 PDT») con la cuenta sin entrega desde el 07-oct, y cada día llegaban dos avisos —la falla de
 * la corrida y «no escribe métricas de Meta Ads» de la vigilancia— por una medición que no tenía nada que medir.
 * Cuando el token vuelve a estar, la corrida siguiente mide y escribe como siempre, sin tocar nada más.
 *
 * Cualquier OTRA falla de Meta (caída, límite, permisos) sigue siendo falla: no es «sin campaña», es «no pudimos
 * preguntar».
 */

import type { ConteoCron } from "@/lib/cron-resultado";
import {
  FUENTE_META_ADS,
  METRICA_CLICKS_1D,
  METRICA_IMPRESSIONS_1D,
  METRICA_REACH_1D,
  METRICA_SPEND_1D,
} from "@/lib/meta-ads";

/** Versión de la Graph API. Explícita: sin versión, Meta usa la más vieja soportada. */
export const GRAPH_VERSION = "v21.0";
const GRAPH_API = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** La frase de la pausa: la ve quien lea el resultado de la corrida. */
export const SIN_CAMPANA_ACTIVA = "sin campaña activa";

/**
 * Códigos de error de Meta que significan "el token ya no sirve".
 *
 *   190 → token inválido, expirado o revocado (el del 11-oct-2026).
 *   102 → sesión caducada.
 *   463 → token expirado explícitamente.
 *   467 → token inválido por cambio de credenciales.
 */
export const CODIGOS_TOKEN_MUERTO = new Set([190, 102, 463, 467]);

/** Error de token: se separa del resto porque no es una falla, es la pausa. */
export class TokenMetaMuerto extends Error {
  constructor(public code: number, mensaje: string) {
    super(mensaje);
  }
}

interface RespuestaGraph {
  data?: Array<Record<string, unknown>>;
  error?: { message?: string; code?: number; type?: string; error_subcode?: number };
}

export interface FilaMetricaMeta {
  fecha: string;
  fuente: string;
  metrica: string;
  valor: number;
  meta?: Record<string, unknown>;
}

export interface DepsMetaAds {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  guardar: (fila: FilaMetricaMeta) => Promise<boolean>;
  /** Aviso a Sentry (warning): fallas que no son la pausa. */
  avisar: (e: unknown, ctx: { ruta: string; operacion: string; extra?: Record<string, unknown> }) => void;
  log: (...a: unknown[]) => void;
}

export interface CorridaMetaAds {
  conteo: ConteoCron;
  extra: Record<string, unknown>;
}

const RUTA = "GET /api/cron/meta-ads";

async function graphFetch(deps: DepsMetaAds, url: string): Promise<RespuestaGraph> {
  const res = await deps.fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as RespuestaGraph;
  if (json?.error) {
    const { code, message, type } = json.error;
    if (typeof code === "number" && CODIGOS_TOKEN_MUERTO.has(code)) {
      throw new TokenMetaMuerto(code, `Meta rechazó el token (code ${code}): ${message ?? type ?? "sin detalle"}`);
    }
    throw new Error(`Meta ${res.status} (code ${code ?? "?"}): ${String(message ?? "").slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`Meta respondió ${res.status} sin cuerpo de error`);
  return json;
}

/** Los insights llegan como strings ("1234.56"). Lo no numérico se descarta. */
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** La acción que pide un token vencido (15-oct-2026, cron-alertas.ts › regla 2): avisa en el acto y una sola vez. */
export const ACCION_TOKEN_META = "meta-token";

/**
 * Sin nada que medir: sale bien, sin trabajo, con la pausa y el porqué (para quien lea el resultado). Con el token
 * vencido, además declara la ACCIÓN (15-oct-2026, regla de Fabrizio: «un token vencido avisa de inmediato y una sola
 * vez»): la pausa sigue —sin frescura que avise «no escribe»— y el aviso sale una vez por causa. Sin configurar es a
 * propósito (no hay campaña): no pide nada.
 */
function sinCampana(motivo: "token-vencido" | "sin-configurar", detalle: string): CorridaMetaAds {
  const accion = motivo === "token-vencido" ? { codigo: ACCION_TOKEN_META, texto: `Meta rechazó el token de Meta Ads (${detalle}): hay que regenerar META_ADS_TOKEN.` } : undefined;
  return { conteo: { procesados: 0, exitosos: 0, fallidos: 0 }, extra: { pausa: SIN_CAMPANA_ACTIVA, motivo, detalle, ...(accion ? { accion } : {}) } };
}

export async function correrMetaAds(p: { token?: string; cuenta?: string; fecha: string }, deps: DepsMetaAds): Promise<CorridaMetaAds> {
  // Sin token o sin cuenta: no hay con qué medir. Sin campaña activa, en silencio.
  if (!p.token || !p.cuenta) {
    const faltan = [!p.token && "META_ADS_TOKEN", !p.cuenta && "META_AD_ACCOUNT_ID"].filter(Boolean).join(", ");
    deps.log(`[cron/meta-ads] ${SIN_CAMPANA_ACTIVA}: faltan ${faltan}`);
    return sinCampana("sin-configurar", `faltan ${faltan}`);
  }
  const { token, cuenta, fecha } = p;

  try {
    // 1) Nivel cuenta: es la ÚNICA cifra correcta de `reach` (no es aditivo entre campañas).
    const paramsCuenta = new URLSearchParams({
      fields: "spend,impressions,clicks,reach,account_currency",
      time_range: JSON.stringify({ since: fecha, until: fecha }),
      level: "account",
      access_token: token,
    });
    const cuentaRes = await graphFetch(deps, `${GRAPH_API}/${cuenta}/insights?${paramsCuenta}`);
    const fila = cuentaRes.data?.[0];

    // Sin `data` no hubo actividad ese día: un cero legítimo y medido (la cuenta respondió y no gastó).
    const spend = fila ? (num(fila.spend) ?? 0) : 0;
    const impressions = fila ? (num(fila.impressions) ?? 0) : 0;
    const clicks = fila ? (num(fila.clicks) ?? 0) : 0;
    const reach = fila ? (num(fila.reach) ?? 0) : 0;
    const moneda = typeof fila?.account_currency === "string" ? fila.account_currency : null;

    // 2) Desglose por campaña, para el jsonb: contexto, no la medición. Si falla, las métricas se guardan igual.
    let campanas: Array<{ id: unknown; nombre: unknown; spend: number | null }> | null = null;
    try {
      const paramsCampana = new URLSearchParams({
        fields: "campaign_id,campaign_name,spend,impressions,clicks",
        time_range: JSON.stringify({ since: fecha, until: fecha }),
        level: "campaign",
        access_token: token,
      });
      const campRes = await graphFetch(deps, `${GRAPH_API}/${cuenta}/insights?${paramsCampana}`);
      campanas = (campRes.data ?? []).map((c) => ({ id: c.campaign_id, nombre: c.campaign_name, spend: num(c.spend) }));
    } catch (e) {
      deps.log("[cron/meta-ads] desglose por campaña no disponible:", e);
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
    const escrituras = await Promise.all([
      deps.guardar({ fecha, fuente: FUENTE_META_ADS, metrica: METRICA_SPEND_1D, valor: spend, meta: metaJson }),
      deps.guardar({ fecha, fuente: FUENTE_META_ADS, metrica: METRICA_IMPRESSIONS_1D, valor: impressions, meta: metaJson }),
      deps.guardar({ fecha, fuente: FUENTE_META_ADS, metrica: METRICA_CLICKS_1D, valor: clicks, meta: metaJson }),
      deps.guardar({ fecha, fuente: FUENTE_META_ADS, metrica: METRICA_REACH_1D, valor: reach, meta: metaJson }),
    ]);
    const fallidas = escrituras.filter((ok) => !ok).length;
    if (fallidas > 0) {
      deps.avisar(new Error(`No se pudieron escribir ${fallidas} de 4 métricas de Meta Ads`), { ruta: RUTA, operacion: "guardar-metrica", extra: { fecha, spend } });
      return { conteo: { procesados: 4, exitosos: 4 - fallidas, fallidos: fallidas }, extra: { error: "escritura-parcial", fecha, escritas: 4 - fallidas } };
    }
    return { conteo: { procesados: 1, exitosos: 1, fallidos: 0 }, extra: { fecha, spend, impressions, clicks, reach, moneda, campanas: campanas?.length ?? null } };
  } catch (e) {
    if (e instanceof TokenMetaMuerto) {
      // Token vencido o revocado: sin campaña activa, en silencio (ver la cabecera). Queda una línea de log con
      // el código de Meta, para quien busque por qué no hay medición.
      deps.log(`[cron/meta-ads] ${SIN_CAMPANA_ACTIVA}: ${e.message}`);
      return sinCampana("token-vencido", `Meta code ${e.code}`);
    }
    // Cualquier otro fallo de la API: se reporta y NO se escribe (sin fila, el panel dice "sin dato").
    deps.log("[cron/meta-ads] error consultando Meta:", e);
    deps.avisar(e, { ruta: RUTA, operacion: "consultar-meta-ads", extra: { fecha } });
    return { conteo: { procesados: 1, exitosos: 0, fallidos: 1 }, extra: { error: `meta-no-disponible: ${String(e).slice(0, 200)}`, fecha } };
  }
}
