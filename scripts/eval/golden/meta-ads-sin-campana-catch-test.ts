// ─────────────────────────────────────────────────────────────────────────────
// Tier META-ADS-SIN-CAMPANA (13-oct-2026, 0 tokens) — el cron de Meta Ads sin un token válido no falla.
//
//   1 · TOKEN VENCIDO (los códigos de Meta 190, 102, 463, 467) o SIN CONFIGURAR: la corrida sale bien, sin trabajo,
//       con la pausa «sin campaña activa»; no escribe métricas, no avisa a Sentry y, cerrada con `cerrarCron`, deja
//       el resultado en verde con la pausa. El token VENCIDO avisa una sola vez (es una acción: regenerarlo; reglas
//       de cron-alertas.ts, 15-oct-2026); sin configurar no avisa.
//   2 · CON UN TOKEN VÁLIDO corre normal: escribe las cinco métricas (con entrega o sin ella; los clics al enlace desde
//       el 15-oct-2026) y sale sin pausa.
//   3 · CUALQUIER OTRA FALLA de Meta sigue siendo falla y avisa: no es «sin campaña», es «no pudimos preguntar».
//   4 · EL VIGILANTE: con la última corrida en pausa, que no escriba métricas no lo pone en rojo (no alerta
//       «sin escribir»); sin la pausa, sí; y cuando el token vuelve y escribe, queda en verde sin pausa.
//   5 · LA RUTA delega en `correrMetaAds` y cierra con su resultado.
// El caso real: el token venció el 11-oct-2026 (code 190) con la cuenta sin entrega desde el 07-oct, y cada día
// llegaban dos alertas —la falla de la corrida y «no escribe métricas de Meta Ads»—.
//
// ACTA (13-oct-2026). La falla del 12-oct a las 12:30 (15:30 UTC) fue el TOKEN VENCIDO, no la cuenta desactivada:
// el log de la corrida dice «Meta rechazó el token (code 190): Error validating access token: Session has expired
// on Sunday, 11-Oct-26 05:41:44 PDT», y el resultado quedó «token-expirado» el 11 y el 12. Las métricas venían en
// cero sin entrega desde el 07-oct. 10/10 mutaciones en ROJO: N1 la ruta vieja · N2 el token vencido vuelve a ser
// falla · N3 avisa a Sentry · N4 sin configurar vuelve a ser falla · N5 el resultado no guarda la pausa · N6 el
// vigilante ignora la pausa · N7 la pausa vale en una corrida fallida · N8 otras fallas cuentan como token muerto ·
// N9 sin campaña escribe ceros · N10 meta-ads sin frescura vigilada.
// Solo:  node --import tsx scripts/eval/golden/meta-ads-sin-campana-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { correrMetaAds, SIN_CAMPANA_ACTIVA, type DepsMetaAds, type FilaMetricaMeta } from "../../../src/lib/meta-ads-cron";
import { cerrarCron, correoDeAlertas, resultadoCron, statusCron, FUENTE_ALERTA, FUENTE_RESULTADO } from "../../../src/lib/cron-resultado";
import { CRONS_VIGILADOS, leerLatidos } from "../../../src/lib/cron-heartbeat";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

type Filtros = Record<string, unknown>;
function supabaseDoble(responder: (tabla: string, f: Filtros, unica: boolean) => unknown) {
  const escrituras: Array<{ tabla: string; fila: Record<string, unknown> }> = [];
  const sb = {
    from(tabla: string) {
      const f: Filtros = {};
      const b: Record<string, unknown> = {};
      const encadenar = (k: string) => (...a: unknown[]) => { f[k] = a.length === 1 ? a[0] : a; return b; };
      for (const m of ["select", "not", "order", "limit", "in", "like", "or", "gte", "lt"]) b[m] = encadenar(m);
      b.eq = (col: string, v: unknown) => { f[`eq:${col}`] = v; return b; };
      b.upsert = (fila: Record<string, unknown>) => { escrituras.push({ tabla, fila }); return Promise.resolve({ error: null }); };
      b.maybeSingle = () => Promise.resolve({ data: responder(tabla, f, true) ?? null, error: null });
      b.then = (ok: (v: unknown) => unknown) => ok({ data: responder(tabla, f, false) ?? [], error: null });
      return b;
    },
  };
  return { sb: sb as never, escrituras };
}

/** Dependencias falsas: Meta responde lo que se le diga; se cuentan las escrituras y los avisos. */
function deps(meta: (url: string) => [number, unknown]) {
  const guardadas: FilaMetricaMeta[] = [];
  const avisos: string[] = [];
  let llamadas = 0;
  const d: DepsMetaAds = {
    fetch: async (url) => { llamadas++; const [status, cuerpo] = meta(url); return new Response(JSON.stringify(cuerpo), { status }); },
    guardar: async (fila) => { guardadas.push(fila); return true; },
    avisar: (e) => { avisos.push(String(e)); },
    log: () => {},
  };
  return { d, guardadas, avisos, llamadas: () => llamadas };
}

export async function runMetaAdsSinCampanaTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER META-ADS-SIN-CAMPANA (sin token válido, el cron calla y el vigilante no lo cuenta · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  const P = { token: "t", cuenta: "act_1", fecha: "2026-10-12" };

  // ── 1 · token vencido o sin configurar: sin campaña activa, en silencio ─────────────────────────────────
  for (const code of [190, 102, 463, 467]) {
    const x = deps(() => [400, { error: { code, message: "Error validating access token: Session has expired on Sunday, 11-Oct-26 05:41:44 PDT." } }]);
    const r = await correrMetaAds(P, x.d);
    if (resultadoCron(r.conteo) !== "ok" || statusCron(r.conteo) !== 200) F(`1 · con el token vencido (code ${code}) la corrida falla (${resultadoCron(r.conteo)}): alerta cada día`);
    if (r.extra.pausa !== SIN_CAMPANA_ACTIVA) F(`1 · con el token vencido (code ${code}) la corrida no dice «${SIN_CAMPANA_ACTIVA}»`);
    if (x.avisos.length) F(`1 · con el token vencido (code ${code}) avisa a Sentry: no es silencio`);
    if (x.guardadas.length) F(`1 · con el token vencido (code ${code}) escribe métricas (un cero diría «no gastamos»)`);
  }
  {
    const x = deps(() => [200, { data: [] }]);
    const r = await correrMetaAds({ ...P, token: undefined }, x.d);
    if (resultadoCron(r.conteo) !== "ok" || r.extra.pausa !== SIN_CAMPANA_ACTIVA || x.avisos.length || x.llamadas()) F("1 · sin el token configurado no sale en silencio con «sin campaña activa» (o igual le pregunta a Meta)");
  }
  {
    // Cerrada con cerrarCron: el resultado queda en verde con la pausa. ⚠ ACTA (15-oct-2026, regla de Fabrizio: lo que
    // necesita una acción «avisa de inmediato y una sola vez») · el token vencido avisa UNA vez; ya avisado, no repite.
    const correos: string[] = [];
    correoDeAlertas.enviar = async (p) => { correos.push(p.problema); };
    const x = deps(() => [400, { error: { code: 190, message: "expired" } }]);
    const r = await correrMetaAds(P, x.d);
    const { sb, escrituras } = supabaseDoble(() => null);
    const res = await cerrarCron(sb, "meta-ads", r.conteo, r.extra);
    const estadoGuardado = escrituras.find((e) => e.tabla === "cron_estado")?.fila.estado;
    const ya = supabaseDoble((tabla) => (tabla === "cron_estado" ? { estado: estadoGuardado } : null));
    await cerrarCron(ya.sb, "meta-ads", r.conteo, r.extra);
    if (correos.length !== 1 || !/META_ADS_TOKEN/.test(correos[0] ?? "") || ya.escrituras.some((e) => e.fila.fuente === FUENTE_ALERTA)) F(`1 · el token vencido no avisa una sola vez (${correos.length} correos)`);
    // Sin el token configurado es a propósito (sin campaña): no hay nada que hacer, no avisa.
    const sinConfig = await correrMetaAds({ ...P, token: undefined }, deps(() => [200, { data: [] }]).d);
    const sc = supabaseDoble(() => null);
    await cerrarCron(sc.sb, "meta-ads", sinConfig.conteo, sinConfig.extra);
    if (sc.escrituras.some((e) => e.fila.fuente === FUENTE_ALERTA)) F("1 · sin el token configurado avisa");
    const fila = escrituras.find((e) => e.fila.fuente === FUENTE_RESULTADO);
    const cuerpo = (await res.json()) as Record<string, unknown>;
    if (res.status !== 200 || !fila || fila.fila.valor !== 0) F("1 · cerrada, la corrida sin campaña no queda en verde (valor 0) o no responde 200");
    if ((fila?.fila.meta as Record<string, unknown> | undefined)?.pausa !== SIN_CAMPANA_ACTIVA) F("1 · el resultado de la corrida no guarda la pausa: el vigilante no puede saber que no escribir es lo esperado");
    if (escrituras.filter((e) => e.fila.fuente === FUENTE_ALERTA).length !== 1) F("1 · la primera corrida con el token vencido no anota su aviso");
    if (cuerpo.pausa !== SIN_CAMPANA_ACTIVA) F("1 · la respuesta del cron no dice «sin campaña activa»");
  }

  // ── 2 · con un token válido corre normal ─────────────────────────────────────────────────────────────
  {
    const x = deps((url) => (url.includes("level=account")
      ? [200, { data: [{ spend: "1234.5", impressions: "1000", clicks: "40", inline_link_clicks: "31", reach: "800", account_currency: "CLP" }] }]
      : [200, { data: [{ campaign_id: "c1", campaign_name: "Campaña", spend: "1234.5" }] }]));
    const r = await correrMetaAds(P, x.d);
    const spend = x.guardadas.find((g) => g.metrica === "spend_1d");
    if (resultadoCron(r.conteo) !== "ok" || r.extra.pausa !== undefined) F("2 · con un token válido la corrida no sale normal (o sale en pausa)");
    if (x.guardadas.length !== 5 || spend?.valor !== 1234.5 || (spend?.meta as { campanas?: unknown[] } | undefined)?.campanas?.length !== 1) F(`2 · con un token válido no escribe las cinco métricas con el gasto (${x.guardadas.length} escritas)`);
    // Los clics al enlace (15-oct-2026): su propia métrica, del campo de Meta que cuenta los que llevan al sitio.
    if (x.guardadas.find((g) => g.metrica === "link_clicks_1d")?.valor !== 31) F("2 · con un token válido no escribe los clics al enlace");
    if (x.avisos.length) F("2 · con un token válido avisa a Sentry");
  }
  {
    const x = deps(() => [200, { data: [] }]);
    const r = await correrMetaAds(P, x.d);
    if (resultadoCron(r.conteo) !== "ok" || r.extra.pausa !== undefined || x.guardadas.length !== 5 || x.guardadas.some((g) => g.valor !== 0) || (x.guardadas[0]?.meta as { sin_entrega?: boolean } | undefined)?.sin_entrega !== true)
      F("2 · con un token válido y sin entrega no escribe el cero medido (sin_entrega), o sale en pausa");
  }

  // ── 3 · cualquier otra falla de Meta sigue siendo falla ─────────────────────────────────────────────
  for (const [status, cuerpo, que] of [[500, { error: { code: 2, message: "Service temporarily unavailable" } }, "una caída de Meta"], [400, { error: { code: 17, message: "User request limit reached" } }, "el límite de pedidos"], [502, {}, "un 502 sin cuerpo"]] as const) {
    const x = deps(() => [status, cuerpo]);
    const r = await correrMetaAds(P, x.d);
    if (resultadoCron(r.conteo) !== "fallo" || r.extra.pausa !== undefined) F(`3 · ${que} sale como «sin campaña» o como corrida sana: tiene que ser falla`);
    if (x.avisos.length !== 1) F(`3 · ${que} no avisa a Sentry`);
  }

  // ── 4 · el vigilante no cuenta la pausa ─────────────────────────────────────────────────────────────
  if (!CRONS_VIGILADOS.find((c) => c.nombre === "meta-ads")?.frescura) F("4 · meta-ads dejó de tener frescura vigilada: con el token de vuelta nadie vería que deja de escribir");
  const ahora = Date.now();
  const hace = (h: number) => new Date(ahora - h * 3600e3).toISOString();
  const estadoMeta = async (resultadoMeta: { valor: number; meta: Record<string, unknown> | null }, escribioHaceHoras: number) => {
    const latidos = CRONS_VIGILADOS.map((c) => ({ metrica: c.nombre, medido_at: hace(0.5) }));
    const resultados = CRONS_VIGILADOS.map((c) => (c.nombre === "meta-ads" ? { metrica: c.nombre, ...resultadoMeta, medido_at: hace(0.49) } : { metrica: c.nombre, valor: 0, meta: null, medido_at: hace(0.49) }));
    const { sb } = supabaseDoble((tabla, f, unica) => {
      if (tabla === "metrics_daily" && !unica) return f["eq:fuente"] === "cron" ? latidos : f["eq:fuente"] === FUENTE_RESULTADO ? resultados : [];
      if (unica) return { [String(f.select)]: f["eq:fuente"] === "meta_ads" ? hace(escribioHaceHoras) : hace(1) };
      return [];
    });
    return (await leerLatidos(sb)).find((e) => e.nombre === "meta-ads")!;
  };
  {
    // El 13-oct: corre cada día en pausa y la última métrica es del 10-oct (72 h).
    const e = await estadoMeta({ valor: 0, meta: { procesados: 0, exitosos: 0, fallidos: 0, pausa: SIN_CAMPANA_ACTIVA } }, 72);
    if (e.enRojo || e.sinEscribir) F(`4 · con la última corrida en pausa, el vigilante lo cuenta como falla (${e.motivo})`);
    if (e.pausa !== SIN_CAMPANA_ACTIVA) F("4 · el estado del cron no dice que está en pausa «sin campaña activa»");
    const sinPausa = await estadoMeta({ valor: 0, meta: { procesados: 1, exitosos: 1, fallidos: 0 } }, 72);
    if (!sinPausa.sinEscribir || !sinPausa.enRojo) F("4 · sin la pausa, 72 h sin escribir no se pinta en rojo (la vigilancia de frescura dejó de funcionar)");
    const fallaConPausa = await estadoMeta({ valor: 2, meta: { procesados: 1, exitosos: 0, fallidos: 1, pausa: SIN_CAMPANA_ACTIVA } }, 72);
    if (!fallaConPausa.enRojo || fallaConPausa.pausa !== null) F("4 · una corrida FALLIDA con la marca de pausa apaga la vigilancia (la pausa vale solo en una corrida que salió bien)");
    const vuelve = await estadoMeta({ valor: 0, meta: { procesados: 1, exitosos: 1, fallidos: 0 } }, 0.5);
    if (vuelve.enRojo || vuelve.pausa !== null) F("4 · con el token de vuelta y la métrica escrita, el cron no queda en verde y sin pausa");
  }

  // ── 5 · la ruta delega en la corrida y cierra con su resultado ──────────────────────────────────────
  const ruta = sinComentarios(leer("src/app/api/cron/meta-ads/route.ts"));
  if (!/const r = await correrMetaAds\(\s*\{ token: process\.env\.META_ADS_TOKEN, cuenta: process\.env\.META_AD_ACCOUNT_ID, fecha: ayerUTC\(\) \},/.test(ruta) || !/return cerrarCron\(db, "meta-ads", r\.conteo, r\.extra\);/.test(ruta)) F("5 · la ruta de meta-ads no corre `correrMetaAds` ni cierra con su resultado");
  if (/capturarFallaDeCron|CORRIDA_FALLIDA|graph\.facebook/.test(ruta)) F("5 · la ruta de meta-ads decide fallas por su cuenta, fuera de `correrMetaAds`");

  if (fallas.length) {
    console.log(`  ✗ META-ADS-SIN-CAMPANA · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — sin un token válido (vencido, revocado o sin configurar) el cron sale bien con «sin campaña activa», sin escribir; el token vencido avisa una sola vez y el vigilante no lo cuenta; con el token de vuelta escribe normal; cualquier otra falla de Meta sigue siendo falla");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runMetaAdsSinCampanaTier().then((r) => process.exit(r.hard ? 1 : 0));
}
