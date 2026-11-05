// ============================================================================
// GOLDEN · AVISO-COBRO (05-nov-2026) — catch-test
// ============================================================================
//   El aviso de cobro de Flow (urlCallback de los planes). Decisión de Fabrizio, 05-nov-2026: «que el cobro se registre al
//   momento» y un gate que falle si la ruta del aviso responde distinto de 200.
//   La causa medida: la ruta pedía `payment/getStatus` por POST y el servicio es GET; Flow responde 105 «No services
//   available», la ruta contestaba 503 y Flow no vuelve a llamar (el cron lo recogía a la hora siguiente).
//   1 · LA RESPUESTA: 200 siempre que llega el aviso (con token, sin token, cuerpo raro, sonda, sin poder programar).
//   2 · EL TRABAJO EN SEGUNDO PLANO: consulta con esperas crecientes, aplica apenas Flow entrega el pago, concilia si no;
//       el peor caso cabe en el maxDuration de la ruta.
//   3 · LA RUTA: responde lo que dice responderAviso, sin otro camino; consulta por GET; maxDuration declarado.
//   4 · CADA LLAMADA A FLOW CON SU MÉTODO (apiFlow.yaml 3.0.1): un servicio GET pedido por POST es este mismo bug.
//   5 · EN VIVO: POST a la ruta de producción con el token de sonda → 200 (sin redirección). Base: AVISO_URL o refranco.ai.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. La sección 5 llama a producción.
// Solo:  node --import tsx scripts/eval/golden/aviso-cobro-catch-test.ts
// ============================================================================
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { sinComentarios } from "./lectura-paginada-catch-test";
import {
  DURACION_RUTA_AVISO_S, ESPERAS_AVISO_MS, SONDA_AVISO, TOPE_CONCILIAR_MS, procesarAvisoDeCobro, responderAviso, type PiezasAviso,
} from "../../../src/lib/subscriptions/aviso-cobro";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sc = (p: string) => sinComentarios(leer(p));
const RUTA = "src/app/api/subscriptions/payment-callback/route.ts";
/** El tope de una llamada a Flow (flow.ts › FLOW_TIMEOUT_MS) y cuántas hace cada intento (getStatus y getStatusExtended). */
const TOPE_FLOW_MS = 8_000, CONSULTAS_POR_INTENTO = 2;

/** Método de cada servicio de Flow según apiFlow.yaml 3.0.1 (los que usa el repo y sus vecinos). */
const SERVICIOS_GET = new Set([
  "payment/getStatus", "payment/getStatusExtended", "payment/getStatusByCommerceId", "payment/getStatusByFlowOrder", "payment/getPayments",
  "customer/get", "customer/list", "customer/getRegisterStatus", "customer/getSubscriptions", "customer/getCharges",
  "subscription/get", "subscription/list", "plans/get", "plans/list", "invoice/get", "invoice/getOverDue",
]);
const SERVICIOS_POST = new Set([
  "payment/create", "payment/createEmail", "customer/create", "customer/edit", "customer/delete", "customer/register", "customer/unRegister",
  "customer/charge", "customer/collect", "subscription/create", "subscription/cancel", "subscription/changePlan", "plans/create", "plans/edit",
  "plans/delete", "invoice/cancel", "invoice/outsidePayment", "invoice/retryToCollect",
]);

function archivos(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(join(RAIZ, dir))) {
    const p = `${dir}/${n}`;
    if (statSync(join(RAIZ, p)).isDirectory()) { if (n !== "node_modules" && n !== "_archivo") archivos(p, out); }
    else if (/\.(ts|tsx|mjs)$/.test(n)) out.push(p);
  }
  return out;
}

function piezasFalsas(guion: { consultas: Array<"falla" | "ok">; aplicar?: Array<boolean>; reconciliarLanza?: boolean }) {
  const llamadas: string[] = [];
  let iC = 0, iA = 0;
  const p: PiezasAviso = {
    async consultar() { const r = guion.consultas[Math.min(iC++, guion.consultas.length - 1)]; llamadas.push(`consultar:${r}`); if (r === "falla") throw new Error('Flow API error 400: {"code":105}'); return { status: 2, flowOrder: 1, commerceOrder: "sus_x_1_2", amount: 39990 }; },
    async aplicar() { const listo = guion.aplicar ? guion.aplicar[Math.min(iA++, guion.aplicar.length - 1)] : true; llamadas.push(`aplicar:${listo}`); return { listo, motivo: listo ? undefined : "dueño no resuelto" }; },
    async reconciliar() { llamadas.push("reconciliar"); if (guion.reconciliarLanza) throw new Error("cron caído"); },
    async esperar(ms) { llamadas.push(`esperar:${ms}`); },
    avisar(evento) { llamadas.push(`avisar:${evento}`); },
  };
  return { p, llamadas };
}

export async function runAvisoCobroTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER AVISO-COBRO (el aviso de cobro de Flow: 200 siempre, por GET, al momento · 0 tokens, llama a producción) ───");

  // ── 1 · la respuesta: 200 siempre ─────────────────────────────────────────
  {
    const form = (cuerpo: string) => new Request("https://x/api/subscriptions/payment-callback", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: cuerpo });
    const casos: Array<[string, Request, (t: string) => void, string | null]> = [];
    const programados: string[] = [];
    casos.push(["con token", form("token=ABC123"), (t) => { programados.push(t); }, "recibido"]);
    casos.push(["sin token", form(""), (t) => { programados.push(t); }, "sin-token"]);
    casos.push(["cuerpo que no es formulario", new Request("https://x", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }), (t) => { programados.push(t); }, "sin-token"]);
    casos.push(["sonda", form(`token=${SONDA_AVISO}`), (t) => { programados.push(t); }, "sonda"]);
    casos.push(["sin poder programar", form("token=XYZ"), () => { throw new Error("waitUntil no disponible"); }, "recibido-sin-programar"]);
    for (const [nombre, req, programar, esperado] of casos) {
      const r = await responderAviso(req, programar).catch((e) => ({ status: 0 as const, body: { status: `lanzó: ${e instanceof Error ? e.message : e}` } }));
      if (r.status !== 200) F(`1 · el aviso ${nombre} responde ${r.status}, no 200: LA RUTA DEL AVISO RESPONDE DISTINTO DE 200`);
      if (esperado && r.body.status !== esperado) F(`1 · el aviso ${nombre} se lee como «${r.body.status}» (esperado «${esperado}»)`);
    }
    if (programados.join(",") !== "ABC123") F(`1 · se programó trabajo donde no correspondía (o no donde sí): ${programados.join(",") || "nada"}`);
  }

  // ── 2 · el trabajo en segundo plano ───────────────────────────────────────
  {
    // Flow no entrega el pago dos veces y a la tercera sí: se aplica una vez, sin conciliar.
    const a = piezasFalsas({ consultas: ["falla", "falla", "ok"] });
    const ra = await procesarAvisoDeCobro("T", a.p);
    if (ra.resultado !== "aplicado" || a.llamadas.filter((l) => l.startsWith("aplicar")).length !== 1 || a.llamadas.includes("reconciliar")) F(`2 · con Flow entregando el pago al tercer intento no se aplica una vez (${a.llamadas.join(" ")})`);
    if (!a.llamadas.includes(`esperar:${ESPERAS_AVISO_MS[1]}`)) F("2 · entre intentos no se espera");
    // Flow nunca lo entrega: se intenta en toda la ventana y después se concilia.
    const b = piezasFalsas({ consultas: ["falla"] });
    const rb = await procesarAvisoDeCobro("T", b.p);
    if (rb.resultado !== "conciliado" || rb.intentos !== ESPERAS_AVISO_MS.length || b.llamadas.filter((l) => l === "reconciliar").length !== 1) F(`2 · sin el pago en la ventana no se concilia (o no se agotan los intentos): ${rb.resultado}, ${rb.intentos} intento(s)`);
    // El dueño todavía no se resuelve (carrera con el alta) y al otro intento sí: se reintenta y se aplica.
    const c = piezasFalsas({ consultas: ["ok"], aplicar: [false, true] });
    const rc = await procesarAvisoDeCobro("T", c.p);
    if (rc.resultado !== "aplicado" || c.llamadas.filter((l) => l.startsWith("aplicar")).length !== 2) F("2 · un cobro que todavía no se puede aplicar no se reintenta");
    // La conciliación cae: no revienta, lo avisa.
    const d = piezasFalsas({ consultas: ["falla"], reconciliarLanza: true });
    const rd = await procesarAvisoDeCobro("T", d.p).catch(() => null);
    if (!rd || !d.llamadas.includes("avisar:reconciliar-fallo")) F("2 · si la conciliación cae, el trabajo revienta o no lo avisa");
    // El peor caso cabe en la ruta.
    const peor = ESPERAS_AVISO_MS.reduce<number>((s, x) => s + x, 0) + ESPERAS_AVISO_MS.length * TOPE_FLOW_MS * CONSULTAS_POR_INTENTO + TOPE_CONCILIAR_MS;
    if (peor > DURACION_RUTA_AVISO_S * 1000) F(`2 · el peor caso del aviso (${Math.round(peor / 1000)} s) no cabe en los ${DURACION_RUTA_AVISO_S} s de la ruta`);
    if (ESPERAS_AVISO_MS.reduce<number>((s, x) => s + x, 0) < 60_000) F("2 · la ventana de reintentos es menor a un minuto");
  }

  // ── 3 · la ruta ───────────────────────────────────────────────────────────
  {
    const r = sc(RUTA);
    if (!/export async function POST\(request: Request\) \{\s*const respuesta = await responderAviso\(request, \(token\) => waitUntil\(procesarAvisoDeCobro\(token, piezasReales\(token\)\)\)\);\s*return NextResponse\.json\(respuesta\.body, \{ status: respuesta\.status \}\);\s*\}/.test(r)) F("3 · la ruta del aviso no responde lo que dice responderAviso (o no deja el trabajo en segundo plano)");
    if ((r.match(/NextResponse\.json\(/g) ?? []).length !== 1 || /status:\s*5\d\d/.test(r)) F("3 · la ruta del aviso tiene otro camino de respuesta (o un 5xx): LA RUTA DEL AVISO RESPONDE DISTINTO DE 200");
    if (!/export const maxDuration = (\d+);/.test(r) || Number(/export const maxDuration = (\d+);/.exec(r)?.[1]) !== DURACION_RUTA_AVISO_S) F("3 · la ruta no declara el maxDuration del trabajo en segundo plano");
    if (!/return \(await flowGet\("payment\/getStatus", \{ token \}\)\) as EstadoPagoFlow;/.test(r) || !/return \(await flowGet\("payment\/getStatusExtended", \{ token \}\)\) as EstadoPagoFlow;/.test(r)) F("3 · el aviso no consulta el pago por GET");
    if (/flowPost/.test(r)) F("3 · el aviso usa flowPost: payment/getStatus es GET (Flow responde 105 «No services available»)");
  }

  // ── 4 · cada llamada a Flow con su método ─────────────────────────────────
  {
    let vistas = 0;
    for (const f of [...archivos("src"), ...archivos("scripts").filter((p) => !p.startsWith("scripts/eval/"))]) {
      const s = sinComentarios(leer(f));
      for (const m of s.matchAll(/flow(Post|Get)\(\s*"([^"]+)"/g)) {
        vistas++;
        const metodo = m[1] === "Post" ? "POST" : "GET", servicio = m[2];
        const debe = SERVICIOS_GET.has(servicio) ? "GET" : SERVICIOS_POST.has(servicio) ? "POST" : null;
        if (!debe) F(`4 · ${f}: «${servicio}» no está en la tabla de métodos de Flow (agrégalo leyendo apiFlow.yaml)`);
        else if (debe !== metodo) F(`4 · ${f}: «${servicio}» se pide por ${metodo} y Flow lo sirve por ${debe} (responde 105 «No services available»)`);
      }
    }
    if (vistas < 10) F(`4 · el recorrido encontró ${vistas} llamadas a Flow: no encontró el sitio`);
  }

  // ── 5 · en vivo: la ruta de producción responde 200 ───────────────────────
  {
    const url = process.env.AVISO_URL ?? "https://refranco.ai/api/subscriptions/payment-callback";
    // AbortController con su reloj limpiado a mano: AbortSignal.timeout deja un handle que en Windows revienta al salir.
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), 20_000);
    try {
      const r = await fetch(url, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `token=${SONDA_AVISO}`, signal: corte.signal });
      const cuerpo = (await r.json().catch(() => null)) as { status?: string } | null;
      if (r.status !== 200) F(`5 · ${url} responde ${r.status} al aviso de sonda: LA RUTA DEL AVISO RESPONDE DISTINTO DE 200`);
      else if (cuerpo?.status !== "sonda") F(`5 · ${url} responde 200 pero no reconoce la sonda («${cuerpo?.status ?? "sin cuerpo"}»): no es la ruta nueva`);
    } catch (e) {
      F(`5 · NO CORRIÓ: no se pudo llamar a ${url} (${e instanceof Error ? e.message : e})`);
    } finally {
      clearTimeout(reloj);
    }
  }

  if (fallas.length) {
    console.log(`  ✗ AVISO-COBRO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el aviso responde 200 siempre (también la ruta de producción, con la sonda); consulta por GET con esperas y aplica al momento, concilia si Flow no entrega; cada llamada a Flow va con su método");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES (05-nov-2026) ─────────────────────────────────────────────
// La sección 5 nació EN ROJO sin mutar nada contra producción: la ruta vieja respondía 503 a la sonda (y a todo aviso:
// pedía payment/getStatus por POST). Se pone en verde con el deploy de esta ruta.
// 14/14 mutaciones en rojo (AVISO_URL=localhost con la ruta nueva en `next dev`), restauradas byte a byte:
//   1 · sin token con 400 · sin poder programar lanzando · la sonda programando trabajo.
//   2 · sin esperas · sin conciliar · un cobro no aplicable dado por listo · la conciliación caída reventando · una ventana
//       que no cabe en la ruta.
//   3 · la ruta con 503 (también la llamada en vivo) · sin waitUntil · la consulta por POST · otro maxDuration.
//   4 · subscription/get pedido por POST · un servicio fuera de la tabla.

if (require.main === module) {
  // exitCode y no process.exit(): con el socket keep-alive del fetch abierto, process.exit revienta libuv en Windows
  // («Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)»).
  runAvisoCobroTier().then(({ hard }) => { process.exitCode = hard ? 1 : 0; });
}
