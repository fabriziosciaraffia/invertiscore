// ─────────────────────────────────────────────────────────────────────────────
// Tier ALERTAS-CRONS (15-oct-2026, 0 tokens) — las alertas de los crons avisan solo cuando hace falta una persona.
//
// Reglas de Fabrizio (src/lib/cron-alertas.ts): (1) una corrida fallida no avisa si la siguiente se pone al día; avisa
// si fallan dos seguidas o si pasa un día sin una buena; (2) lo que necesita una acción avisa en el acto y una vez;
// (3) lo resuelto solo queda en el registro y el panel; (4) los crons de varias corridas al día, a lo más un correo
// por día con lo que quedó sin resolver al cierre; (5) nada se repite mientras dure el mismo episodio.
//
// EL CASO QUE ABRE EL TIER (pedido de Fabrizio): una corrida fallida seguida de una buena NO manda correo — por el
// camino entero (latirCron → cerrarCron → la vigilancia), con el estado guardado entre corridas.
//
// Ningún correo sale de verdad: el envío (`correoDeAlertas`) se reemplaza por un contador.
//
// ACTA DE MUTACIONES (15-oct-2026): 15/15 en ROJO, restauradas byte a byte. M1 avisar a la primera falla (§0 rojo: el
// caso pedido) · M2 la acción se repite (también META-ADS-SIN-CAMPANA) · M3 los de varias corridas avisan al cerrar ·
// M4 el umbral sin-buena de un intervalo · M5 el resumen en cada vigilancia · M6 la ficha manda correo en el acto
// (también GUIA-BUSQUEDA) · M7 atrasado y sin escribir se repiten · M8 la buena no resetea las fallas (§0 rojo) · M9 la
// corrida colgada no cuenta · M10 el vigilante espera su propio resumen · M11 el BCCh sin acción · M12 Meta sin acción
// (también META-ADS-SIN-CAMPANA) · M13 un cron fuera de la lista de varias corridas · M14 el bloqueo avisa con una
// lectura buena · M15 la vigilancia avisa sin deduplicar.
// Solo:  node --env-file=.env.local --import tsx scripts/eval/golden/alertas-crons-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as A from "../../../src/lib/cron-alertas";
import { cerrarCron, correoDeAlertas, FUENTE_ALERTA } from "../../../src/lib/cron-resultado";
import { latirCron, CRONS_VIGILADOS } from "../../../src/lib/cron-heartbeat";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");

/** Una base en memoria: metrics_daily y cron_estado, con lo justo que usan latirCron y cerrarCron. */
function baseEnMemoria() {
  const tablas = new Map<string, Map<string, Record<string, unknown>>>();
  const clave = (t: string, f: Record<string, unknown>) => (t === "cron_estado" ? String(f.nombre) : `${f.fecha}|${f.fuente}|${f.metrica}`);
  const sb = {
    from(t: string) {
      const filtros: Array<[string, unknown]> = [];
      const b: Record<string, unknown> = {};
      const filas = () => Array.from((tablas.get(t) ?? new Map()).values()).filter((f) => filtros.every(([c, v]) => f[c] === v));
      b.select = () => b;
      b.eq = (c: string, v: unknown) => { filtros.push([c, v]); return b; };
      b.maybeSingle = async () => ({ data: filas()[0] ?? null, error: null });
      b.upsert = async (fila: Record<string, unknown>) => {
        if (!tablas.has(t)) tablas.set(t, new Map());
        tablas.get(t)!.set(clave(t, fila), { ...fila });
        return { error: null };
      };
      return b;
    },
  };
  return { sb: sb as never, tablas, alertas: () => Array.from((tablas.get("metrics_daily") ?? new Map()).values()).filter((f) => f.fuente === FUENTE_ALERTA) };
}

const correos: Array<{ cron: string; problema: string }> = [];

/** Cuántas corridas tiene un cron en su día, según su expresión de vercel.json (minutos × horas). */
function corridasEnSuDia(expr: string): number {
  const [min, hora] = expr.split(/\s+/);
  const cuenta = (campo: string, total: number) => {
    if (campo === "*") return total;
    const paso = /^\*\/(\d+)$/.exec(campo);
    if (paso) return Math.ceil(total / Number(paso[1]));
    return campo.split(",").reduce((n, p) => { const r = /^(\d+)-(\d+)$/.exec(p); return n + (r ? Number(r[2]) - Number(r[1]) + 1 : 1); }, 0);
  };
  return cuenta(min, 60) * cuenta(hora, 24);
}

export async function runAlertasCronsTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER ALERTAS-CRONS (avisar solo cuando hace falta una persona · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  // El contador va al comenzar la corrida, no al cargar el módulo: en la QUICK otros tiers ponen el suyo antes.
  correoDeAlertas.enviar = async (p) => { correos.push({ cron: p.cron, problema: p.problema }); };
  const FALLA = { procesados: 1, exitosos: 0, fallidos: 1 };
  const OK = { procesados: 1, exitosos: 1, fallidos: 0 };

  // ── 0 · EL CASO: una corrida fallida seguida de una buena no avisa (camino entero) ──
  for (const nombre of ["scrape-nuevos", "scrape-unidades-nuevas"]) {
    const m = baseEnMemoria();
    correos.length = 0;
    await latirCron(m.sb, nombre);
    await cerrarCron(m.sb, nombre, FALLA, { error: "proyecto 1: http 403" });
    await latirCron(m.sb, nombre);
    await cerrarCron(m.sb, nombre, OK);
    const e = (m.tablas.get("cron_estado")?.get(nombre)?.estado ?? null) as A.EstadoCron | null;
    // Y la vigilancia de después: nada que avisar, tampoco en el resumen del día.
    const conds = e ? A.condicionesDelCron(24, e, { atrasado: false, sinEscribir: false }, new Date()) : [];
    const v = e ? A.alVigilar(e, conds, A.esperaResumen(nombre), true) : null;
    if (correos.length || m.alertas().length || !e || e.fallasSeguidas !== 0 || !e.ultimaBuena || v?.inmediatos.length || v?.resumen.length)
      F(`0 · ${nombre}: una corrida fallida seguida de una buena avisó (${correos.length} correo(s), estado ${JSON.stringify(e)})`);
  }

  // ── 1 · dos seguidas avisan; la tercera no repite; un episodio nuevo vuelve a avisar ──
  {
    const m = baseEnMemoria();
    correos.length = 0;
    const corrida = async (r: typeof FALLA) => { await latirCron(m.sb, "scrape-nuevos"); await cerrarCron(m.sb, "scrape-nuevos", r, r === FALLA ? { error: "x: http 403" } : {}); };
    await corrida(FALLA);
    if (correos.length) F("1 · un cron de una corrida al día avisó a la primera falla");
    await corrida(FALLA);
    if (correos.length !== 1 || !/2 corridas seguidas fallaron/.test(correos[0]?.problema ?? "")) F(`1 · dos fallas seguidas no avisan una vez (${correos.length})`);
    await corrida(FALLA);
    if (correos.length !== 1) F("1 · la tercera falla seguida repite el aviso (mismo episodio)");
    await corrida(OK);
    await corrida(FALLA);
    await corrida(FALLA);
    if (correos.length !== 2) F(`1 · después de ponerse al día, dos fallas nuevas no vuelven a avisar (${correos.length})`);
  }
  // Un cron de VARIAS corridas no avisa al cerrar: espera el resumen del día, una vez.
  {
    const m = baseEnMemoria();
    correos.length = 0;
    for (let i = 0; i < 3; i++) { await latirCron(m.sb, "scrape-unidades-nuevas"); await cerrarCron(m.sb, "scrape-unidades-nuevas", FALLA, { error: "p: http 403" }); }
    if (correos.length) F("1·4 · un cron de varias corridas al día avisó al cerrar (no espera el resumen)");
    const e = m.tablas.get("cron_estado")!.get("scrape-unidades-nuevas")!.estado as A.EstadoCron;
    const c = A.condicionesDelCron(6, e, { atrasado: false, sinEscribir: false }, new Date());
    const antes = A.alVigilar(e, c, true, false);
    const r1 = A.alVigilar(e, c, true, true);
    const r2 = A.alVigilar(r1.estado, c, true, true);
    if (antes.inmediatos.length || antes.resumen.length) F("4 · un cron de varias corridas avisa fuera del resumen del día");
    if (r1.resumen.length !== 1 || r1.inmediatos.length) F("4 · lo que quedó sin resolver al cierre no entra al resumen");
    if (r2.resumen.length) F("5 · el resumen del día siguiente repite la misma causa");
    const sana = A.alVigilar({ ...e, fallasSeguidas: 0, alertas: r1.estado.alertas }, [], true, true);
    if (sana.estado.alertas.length || sana.resumen.length) F("3 · lo resuelto no sale de lo avisado (o entra al resumen)");
  }
  // El vigilante no espera el resumen que arma él: si es él el que falla, ese resumen no llega. Dos seguidas avisan al
  // cerrar, una vez por episodio.
  {
    const m = baseEnMemoria();
    correos.length = 0;
    for (let i = 0; i < 3; i++) { await latirCron(m.sb, A.VIGILANTE); await cerrarCron(m.sb, A.VIGILANTE, FALLA, { error: "leer el estado: x" }); }
    if (correos.length !== 1 || A.esperaResumen(A.VIGILANTE) || !A.esperaResumen("scrape-unidades-nuevas")) F(`1 · las fallas del vigilante esperan el resumen que arma él (${correos.length} avisos tras tres fallas)`);
  }

  // ── 2 · lo que necesita una acción: en el acto, una vez; si se resuelve y vuelve, otra vez ──
  {
    const m = baseEnMemoria();
    correos.length = 0;
    const accion = { codigo: "meta-token", texto: "hay que regenerar META_ADS_TOKEN." };
    const pausa = { procesados: 0, exitosos: 0, fallidos: 0 };
    await cerrarCron(m.sb, "meta-ads", pausa, { pausa: "sin campaña activa", accion });
    await cerrarCron(m.sb, "meta-ads", pausa, { pausa: "sin campaña activa", accion });
    if (correos.length !== 1 || correos[0].problema !== accion.texto) F(`2 · un token vencido no avisa en el acto una sola vez (${correos.length})`);
    await cerrarCron(m.sb, "meta-ads", OK);
    await cerrarCron(m.sb, "meta-ads", pausa, { pausa: "sin campaña activa", accion });
    if (correos.length !== 2) F("2 · un token que se renovó y volvió a vencer no vuelve a avisar");
    // En un cron de varias corridas, la acción también va en el acto (no espera el resumen).
    const v = baseEnMemoria();
    correos.length = 0;
    await cerrarCron(v.sb, "reconcile-subscriptions", FALLA, { error: "flow 401", accion: { codigo: "flow-key", texto: "Flow rechazó la clave." } });
    await cerrarCron(v.sb, "reconcile-subscriptions", FALLA, { error: "flow 401", accion: { codigo: "flow-key", texto: "Flow rechazó la clave." } });
    if (correos.length !== 1) F("2 · en un cron de varias corridas, la acción no avisa en el acto (o se repite)");
    // La acción cubre la falla: misma causa, un solo aviso.
    const s = baseEnMemoria();
    correos.length = 0;
    for (let i = 0; i < 3; i++) await cerrarCron(s.sb, "sentry-metrics", FALLA, { error: "Faltan variables", accion: { codigo: "sentry-config", texto: "Faltan variables de Sentry." } });
    if (correos.length !== 1) F(`2·5 · una acción y sus fallas seguidas mandan más de un aviso (${correos.length})`);
    // Los crons la declaran.
    const { correrMetaAds, ACCION_TOKEN_META } = await import("../../../src/lib/meta-ads-cron");
    const dep = (cuerpo: unknown, status = 400) => ({ fetch: async () => new Response(JSON.stringify(cuerpo), { status }), guardar: async () => true, avisar: () => {}, log: () => {} });
    const vencido = await correrMetaAds({ token: "t", cuenta: "c", fecha: "2026-10-14" }, dep({ error: { code: 190, message: "expired" } }));
    const sinConfig = await correrMetaAds({ token: undefined, cuenta: "c", fecha: "2026-10-14" }, dep({}));
    if ((vencido.extra.accion as A.Accion | undefined)?.codigo !== ACCION_TOKEN_META || sinConfig.extra.accion) F("2 · Meta Ads no declara la acción con el token vencido (o la declara sin configurar, que es a propósito)");
    const sentry = sinComentarios(leer("src/app/api/cron/sentry-metrics/route.ts"));
    if (!/accion: \{ codigo: "sentry-config",/.test(sentry) || !/const tokenRechazado = \/Sentry \(401\|403\)/.test(sentry) || !/accion: \{ codigo: "sentry-token",/.test(sentry)) F("2 · Sentry no declara la acción con variables que faltan o el token rechazado");
    const bcch = sinComentarios(leer("src/app/api/data/update-market/route.ts"));
    if (!/const credenciales = errors\.some\(\(e\) => \/sin credenciales\|BCCh Codigo -5:\/\.test\(e\)\);/.test(bcch) || !/\.\.\.\(credenciales \? \{ accion: \{ codigo: "bcch-credenciales",/.test(bcch)) F("2 · update-market no declara la acción con las credenciales del BCCh rechazadas o faltantes");
  }

  // ── 3 · una corrida que latió y no cerró cuenta como fallida ──
  {
    const t0 = new Date("2026-10-15T02:00:00Z"), t1 = new Date("2026-10-15T08:00:00Z"), t2 = new Date("2026-10-15T14:00:00Z");
    let e = A.alLatir({ ...A.ESTADO_INICIAL, ultimaBuena: "2026-10-14T20:01:00Z" }, t0);
    e = A.alLatir(e, t1);
    if (e.fallasSeguidas !== 1) F("3 · la corrida que se colgó no cuenta como fallida al latir la siguiente");
    const dos = A.condicionesDelCron(6, e, { atrasado: false, sinEscribir: false }, new Date(t1.getTime() + A.MARGEN_CIERRE_MS + 60e3));
    if (!dos.some((c) => c.clave === "fallas")) F("3 · dos corridas seguidas colgadas no son «dos seguidas»");
    const { estado: cerrado } = A.alCerrar(A.alLatir({ ...A.ESTADO_INICIAL }, t0), { ok: true, causa: null, accion: null }, t1, true);
    const uno = A.condicionesDelCron(6, A.alLatir(cerrado, t2), { atrasado: false, sinEscribir: false }, new Date(t2.getTime() + 60e3));
    if (uno.length) F("3 · una corrida recién abierta (dentro del margen) cuenta como colgada");
  }

  // ── 4 · un día sin una corrida buena: no antes de que la siguiente pueda ponerse al día ──
  {
    const diario = 24, ahora = new Date("2026-10-15T12:00:00Z");
    const e = { ...A.ESTADO_INICIAL, ultimaBuena: "2026-10-14T06:30:00Z", fallasSeguidas: 1, causa: "x" };
    const hace = (h: number) => new Date(ahora.getTime() - h * 3600e3).toISOString();
    if (A.umbralSinBuenaHoras(diario) !== 49 || A.umbralSinBuenaHoras(6) !== 25 || A.umbralSinBuenaHoras(1) !== 25 || A.umbralSinBuenaHoras(168) !== 337) F("4 · el umbral de «un día sin una buena» no es un día, o dos intervalos en los crons diarios o más lentos");
    if (A.condicionesDelCron(diario, { ...e, ultimaBuena: hace(30) }, { atrasado: false, sinEscribir: false }, ahora).length) F("4 · un cron diario avisa «sin una buena» antes de que la corrida siguiente pueda ponerse al día");
    if (!A.condicionesDelCron(diario, { ...e, ultimaBuena: hace(50) }, { atrasado: false, sinEscribir: false }, ahora).some((c) => c.clave === "sin-buena")) F("4 · un cron diario sin una buena en dos días no avisa");
    if (!A.condicionesDelCron(6, { ...e, ultimaBuena: hace(26) }, { atrasado: false, sinEscribir: false }, ahora).some((c) => c.clave === "sin-buena")) F("4 · un cron de cada 6 horas sin una buena en un día no avisa");
    if (A.condicionesDelCron(6, { ...e, ultimaBuena: null }, { atrasado: false, sinEscribir: false }, ahora).length) F("4 · sin ninguna buena registrada avisa «sin una buena» (no hay evidencia)");
  }

  // ── 5 · atrasado y sin escribir: una vez por episodio ──
  {
    const e = { ...A.ESTADO_INICIAL, ultimaBuena: new Date().toISOString() };
    const c = A.condicionesDelCron(24, e, { atrasado: true, textoAtrasado: "no corre desde hace 50 h", sinEscribir: true, textoSinEscribir: "no escribe UF" }, new Date());
    const r1 = A.alVigilar(e, c, false, false);
    const r2 = A.alVigilar(r1.estado, c, false, false);
    const r3 = A.alVigilar(r2.estado, [], false, false);
    const r4 = A.alVigilar(r3.estado, c, false, false);
    if (r1.inmediatos.map((x) => x.clave).join() !== "atrasado,sin-escribir" || r2.inmediatos.length || r3.estado.alertas.length || r4.inmediatos.length !== 2) F("5 · atrasado o sin escribir no avisan una vez por episodio (y otra vez si vuelve a pasar)");
  }

  // ── 6 · el bloqueo de la ficha: solo un día sin una lectura buena ──
  {
    const ahora = new Date("2026-10-15T12:00:00Z");
    if (A.condicionBloqueo({ bloqueos24h: 5, ultimaBuena: "2026-10-15T01:00:00Z" }, ahora)) F("6 · un bloqueo avisa con una lectura buena en las últimas 24 horas");
    if (!A.condicionBloqueo({ bloqueos24h: 5, ultimaBuena: "2026-10-14T10:00:00Z" }, ahora)) F("6 · un día sin una lectura buena con bloqueos no avisa");
    if (A.condicionBloqueo({ bloqueos24h: 0, ultimaBuena: null }, ahora)) F("6 · sin bloqueos avisa");
    const ficha = sinComentarios(leer("src/lib/guia/ficha-servidor.ts"));
    if (/avisar\(|alertarUnaVezAlDia|sendAlerta/.test(ficha)) F("6 · la lectura de una ficha bloqueada manda correo en el acto");
  }

  // ── 7 · los crons de varias corridas, los de vercel.json; el cableado ──
  {
    const vj = JSON.parse(leer("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };
    const varias = vj.crons.filter((c) => corridasEnSuDia(c.schedule) > 1).map((c) => c.path.split("/").pop()!).sort();
    const lista = Array.from(A.CRONS_VARIAS_AL_DIA).sort();
    if (varias.join() !== lista.join()) F(`7 · CRONS_VARIAS_AL_DIA no es la lista de vercel.json (${lista.join()} ≠ ${varias.join()})`);
    const cr = sinComentarios(leer("src/lib/cron-resultado.ts"));
    if (!/const \{ estado, avisos \} = alCerrar\(\s*await leerEstadoCron\(sb, nombre\),/.test(cr) || !/esperaResumen\(nombre\),\s*\);\s*await guardarEstadoCron\(sb, nombre, estado\);\s*for \(const a of avisos\) await avisar\(sb, nombre, a, extra\);/.test(cr))
      F("7 · cerrarCron no decide con las reglas (alCerrar) o no guarda el estado");
    if (!/await guardarMetrica\(sb, \{ fecha: hoy, fuente: FUENTE_ALERTA, metrica: `\$\{nombre\}:\$\{a\.clave\}`, valor: 1 \}\);\s*await correoDeAlertas\.enviar\(/.test(cr)) F("7 · el aviso no se anota antes de mandarse");
    if (!/await guardarEstadoCron\(sb, nombre, alLatir\(await leerEstadoCron\(sb, nombre\), new Date\(\)\)\);/.test(sinComentarios(leer("src/lib/cron-heartbeat.ts")))) F("7 · el latido no abre la corrida (no se sabría que se colgó)");
    const vg = sinComentarios(leer("src/app/api/cron/vigilar-crons/route.ts"));
    if (!/const condiciones = condicionesDelCron\(c\.intervaloHoras, e, \{/.test(vg) || !/const r = alVigilar\(e, condiciones, esperaResumen\(c\.nombre\), esResumen\);/.test(vg)
      || !/const esResumen = !hecho;/.test(vg) || !/await guardarMetrica\(sb, \{ fecha: ayer, fuente: FUENTE_ALERTA, metrica: METRICA_RESUMEN, valor: resumen\.length \}\);/.test(vg)
      || !/const bloqueo = condicionBloqueo\(await estadoFicha\(sb\), ahora\);/.test(vg) || /ultimoResultado|alertarUnaVezAlDia/.test(vg))
      F("7 · la vigilancia no avisa con las reglas (inmediatos, resumen del día una vez, bloqueo de ficha)");
    if (CRONS_VIGILADOS.some((c) => !vj.crons.some((x) => x.path.endsWith(`/${c.nombre}`)))) F("7 · un cron vigilado no está en vercel.json");
    const enCodigo = ["src/lib/cron-resultado.ts", "src/app/api/cron/vigilar-crons/route.ts", "src/lib/guia/ficha-servidor.ts"].some((f) => /alertarUnaVezAlDia/.test(sinComentarios(leer(f))));
    if (enCodigo) F("7 · todavía hay alertas «una vez al día» por fuera de las reglas");
  }

  // ── 8 · la tabla del estado, en la base ──
  {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) F("8 · NO CORRIÓ: faltan las variables de Supabase");
    else {
      const { data, error } = await createClient(url, key).from("cron_estado").select("nombre, estado");
      if (error) F(`8 · la tabla cron_estado no está en la base (${error.message})`);
      else if ((data ?? []).length < 10) F(`8 · cron_estado tiene ${data?.length} crons (¿se sembró?)`);
      const mig = leer("supabase/migrations/20261015_cron_estado.sql");
      if (!/revoke all on public\.cron_estado from anon, authenticated;/.test(mig) || !/alter table public\.cron_estado enable row level security;/.test(mig)) F("8 · la tabla del estado la puede leer cualquiera");
    }
  }

  if (fallas.length) {
    console.log(`  ✗ ALERTAS-CRONS · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — una falla seguida de una buena no avisa; dos seguidas, dos saltadas o un día sin una buena sí, una vez; una acción, en el acto y una vez; los de varias corridas, un resumen al día; nada se repite en el mismo episodio");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  runAlertasCronsTier().then((r) => { process.exitCode = r.hard ? 1 : 0; });
}
