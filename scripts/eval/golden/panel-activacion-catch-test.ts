// ============================================================================
// TIER PANEL-ACTIVACION — los dos huecos del panel de activación (21-oct-2026, decisión de Fabrizio)
//
//   1 · TODO EVENTO DEL SERVIDOR DE UNA CUENTA DE PRUEBA LLEVA LA MARCA DESDE EL PRIMER EVENTO, con la misma regla que
//       `es_test_account` (la cuenta está en `test_accounts`): `$set: { test_account: true }` y `prueba: true`, en el
//       punto único (`enviarCaptura`). PostHog guarda las propiedades de la persona en el evento, así que la marca que
//       ponía el navegador después —y solo con el consentimiento— no sacaba de las cohortes lo ya ingerido. Vale para el
//       id de la cuenta, el de su correo y, en una vista de entrada, la cuenta con sesión; la cola también. Si no se
//       puede saber si es de prueba, no sale. EN ROJO CON EL CÓDIGO DE HOY: el evento de una cuenta de prueba salía sin
//       marca.
//   2 · UN INFORME QUE UN PAGO DESBLOQUEA emite `analisis_creado` con via = pago al desbloquearse, como los hechos con
//       saldo, una vez. EN ROJO CON EL CÓDIGO DE HOY: `payments/confirm` no lo emitía.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/panel-activacion-catch-test.ts
// ============================================================================
import "./als-de-next";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requestAsyncStorage } from "next/dist/client/components/request-async-storage.external";
import { capturarServidor, distinctIdDeCorreo, type EventoServidor } from "../../../src/lib/posthog-servidor";
import * as captura from "../../../src/lib/posthog-captura";
import * as vista from "../../../src/lib/vista-entrada";
import * as activacion from "../../../src/lib/medicion-activacion";
import { vaciarColaVencida, type AlmacenAgentes } from "../../../src/lib/agentes-navegador";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
/** El trozo de `s` entre dos marcas (la primera aparición de cada una, en orden). Vacío si falta alguna. */
const entre = (s: string, desde: string, hasta: string) => {
  const i = s.indexOf(desde);
  const j = i < 0 ? -1 : s.indexOf(hasta, i + desde.length);
  return i < 0 || j < 0 ? "" : s.slice(i, j);
};

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const NAVEGADOR = { "user-agent": IPHONE, "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors" };
const PRUEBA = "4b74f725-cced-42a2-aaaa-42df8c534a8a";
const REAL = "0f4d1489-0b03-406f-82bf-f74ec9c4af4e";
const CORREO_PRUEBA = distinctIdDeCorreo("qa-primera-1020-a1-4@refranco.ai");
const LISTA: ReadonlySet<string> = new Set([PRUEBA, CORREO_PRUEBA]);

type Cuerpo = { event: string; distinct_id: string; timestamp?: string; properties: Record<string, unknown> };
const marcada = (c: Cuerpo | undefined) => (c?.properties.$set as Record<string, unknown> | undefined)?.test_account === true && c?.properties.prueba === true;
const sinMarca = (c: Cuerpo | undefined) => !!c && (c.properties.$set as Record<string, unknown> | undefined)?.test_account === undefined && c.properties.prueba !== true;

function posthogDeMentira() {
  const cuerpos: Cuerpo[] = [];
  const f = (async (_u: unknown, init?: { body?: unknown }) => {
    cuerpos.push(JSON.parse(String(init?.body)) as Cuerpo);
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  return { cuerpos, deps: { fetch: f, key: "phc_test", host: "https://ph.test" } };
}

/** Un evento por `capturarServidor`, dentro de un pedido del navegador, con la lista de prueba que se le pase. */
async function mandar(ev: EventoServidor, lista: ReadonlySet<string> | null): Promise<{ cuerpos: Cuerpo[]; ok: boolean }> {
  const ph = posthogDeMentira();
  const ok = await requestAsyncStorage.run({ headers: new Headers(NAVEGADOR) } as never, () =>
    capturarServidor(ev, { ...ph.deps, agentes: null, cuentasDePrueba: async () => lista } as never),
  );
  return { cuerpos: ph.cuerpos, ok };
}

export async function runPanelActivacionTier(): Promise<{ hard: number }> {
  console.log("\n─── TIER PANEL-ACTIVACION (la marca de cuenta de prueba en todo evento del servidor; el desbloqueo por pago cuenta · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · LA MARCA DE CUENTA DE PRUEBA ──
  try {
    // El caso central: un evento del servidor de una cuenta de prueba.
    const p = await mandar({ event: "analisis_creado", distinctId: PRUEBA, properties: { via: "wizard" } }, LISTA);
    if (!marcada(p.cuerpos[0])) F(`1 · un evento del servidor de una cuenta de prueba sale sin la marca ($set.test_account y prueba): ${JSON.stringify(p.cuerpos[0]?.properties ?? null).slice(0, 160)}`);
    const r = await mandar({ event: "analisis_creado", distinctId: REAL, properties: { via: "wizard" } }, LISTA);
    if (!sinMarca(r.cuerpos[0])) F("1 · el evento de una cuenta real sale marcado como prueba (o no sale)");
    const c = await mandar({ event: "lead_correo", distinctId: CORREO_PRUEBA, properties: {} }, LISTA);
    if (!marcada(c.cuerpos[0])) F("1 · el evento con el id del correo de una cuenta de prueba sale sin la marca");
    const s = await mandar({ event: "cuenta_atribuida", distinctId: PRUEBA, properties: { $set: { puerta: "B" } } }, LISTA);
    const set = s.cuerpos[0]?.properties.$set as Record<string, unknown> | undefined;
    if (set?.puerta !== "B" || set?.test_account !== true) F("1 · la marca pisa el $set que el evento ya traía");
    const n = await mandar({ event: "analisis_creado", distinctId: PRUEBA, properties: {} }, null);
    if (n.cuerpos.length || n.ok) F("1 · sin saber si es una cuenta de prueba el evento sale igual");
    // La vista de entrada: va a nombre de la visita, y la cuenta con sesión decide.
    const ev = vista.eventoVistaEntrada({ pagina: "landing", ruta: "/", search: "", referer: null, userId: null, consentimiento: null, idPostHog: null, visita: "6b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", esCarga: true, agente: IPHONE, cuentaDeSesion: PRUEBA });
    const ph = posthogDeMentira();
    await vista.enviarVista(ev!, { ...ph.deps, cuentasDePrueba: async () => LISTA } as never);
    if (!ev || !String(ph.cuerpos[0]?.distinct_id ?? "").startsWith("visita:") || ph.cuerpos[0]?.properties.prueba !== true) F("1 · la vista de la landing de una cuenta de prueba con sesión sale sin `prueba`");
    if (JSON.stringify(ph.cuerpos[0] ?? {}).includes(PRUEBA)) F("1 · la vista anónima lleva el id de la cuenta con sesión a PostHog");
    // La cola: lo que esperó sale marcado.
    const filas = [{ id: 1, evento: { event: "correo_entregado", distinctId: PRUEBA, timestamp: "2026-10-01T10:00:00.000Z", properties: {} }, creado: "2026-10-01T10:00:00.000Z" }];
    const a: AlmacenAgentes = {
      async leer() { return null; }, async guardar() {}, async encolar() {},
      async pendientes() { return []; },
      async vencidos() { return filas; },
      async sacar(ids) { for (const id of ids) filas.splice(filas.findIndex((f) => f.id === id), 1); },
    };
    const phCola = posthogDeMentira();
    await vaciarColaVencida(a, { ...phCola.deps, cuentasDePrueba: async () => LISTA } as never, new Date("2026-10-03T00:45:00Z"));
    if (!marcada(phCola.cuerpos[0])) F("1 · un evento de una cuenta de prueba que esperó en la cola sale sin la marca");
    // La cookie de sesión de Supabase, entera y en trozos.
    const sesion = "base64-" + Buffer.from(JSON.stringify({ access_token: "x".repeat(5000), user: { id: PRUEBA } })).toString("base64url");
    const trozos = [{ name: "sb-mxcdyfslbgbipdistmhq-auth-token.1", value: sesion.slice(3180) }, { name: "otra", value: "1" }, { name: "sb-mxcdyfslbgbipdistmhq-auth-token.0", value: sesion.slice(0, 3180) }];
    if (vista.cuentaDeCookieDeSesion(trozos) !== PRUEBA) F("1 · la cuenta con sesión no se lee de la cookie de Supabase en trozos");
    if (vista.cuentaDeCookieDeSesion([{ name: "sb-x-auth-token", value: "base64-basura" }]) !== null || vista.cuentaDeCookieDeSesion([]) !== null) F("1 · una cookie ilegible da una cuenta");
    // La lista por defecto: la RPC, con un minuto de caché, y la última buena si falla.
    captura.olvidarListaDePrueba();
    const pedidos: Array<{ url: string; init?: RequestInit }> = [];
    let falla = false;
    const rpc = (async (url: unknown, init?: RequestInit) => {
      pedidos.push({ url: String(url), init });
      if (falla) return new Response("x", { status: 500 });
      return new Response(JSON.stringify([{ user_id: PRUEBA, id_correo: CORREO_PRUEBA }]), { status: 200 });
    }) as typeof fetch;
    const t0 = Date.parse("2026-10-21T12:00:00Z");
    const l1 = await captura.listaDePrueba({ fetch: rpc, url: "https://sb.test", key: "k", ahora: t0 });
    const l2 = await captura.listaDePrueba({ fetch: rpc, url: "https://sb.test", key: "k", ahora: t0 + 30_000 });
    falla = true;
    const l3 = await captura.listaDePrueba({ fetch: rpc, url: "https://sb.test", key: "k", ahora: t0 + captura.VIDA_LISTA_PRUEBA_MS + 1 });
    captura.olvidarListaDePrueba();
    const l4 = await captura.listaDePrueba({ fetch: rpc, url: "https://sb.test", key: "k", ahora: t0 });
    if (!l1?.has(PRUEBA) || !l1?.has(CORREO_PRUEBA)) F("1 · la lista no trae las cuentas ni el id de su correo");
    if (pedidos[0]?.url !== "https://sb.test/rest/v1/rpc/cuentas_de_prueba" || pedidos[0]?.init?.method !== "POST" || !(pedidos[0]?.init?.headers as Record<string, string>)?.Authorization?.startsWith("Bearer ")) F("1 · la lista no sale de la RPC `cuentas_de_prueba` con el service role");
    if (l2 !== l1 || pedidos.length !== 3) F(`1 · la lista no se guarda un minuto o no se vuelve a pedir después (${pedidos.length} pedidos)`);
    if (!l3?.has(PRUEBA)) F("1 · si la RPC falla se pierde la última lista buena");
    if (l4 !== null) F("1 · sin ninguna lista buena se da por sabido que no es de prueba");
    captura.olvidarListaDePrueba();
  } catch (e) {
    F(`1 · la marca de cuenta de prueba no corre: ${(e as Error).message}`);
  }
  // El cableado: el punto único usa la lista por defecto, el middleware pasa la sesión, la RPC es la regla de test_accounts.
  const nucleo = sinComentarios(leer("src/lib/posthog-captura.ts"));
  // Por defecto, la lista de test_accounts DENTRO DE NEXT (Vercel, el middleware en Edge, `next dev`); en una prueba,
  // ninguna salvo que se pase (los tiers que reemplazan el `fetch` global ejercitan rutas reales sin tocar la base).
  if (!/const lista = await cuentasDePruebaDe\(deps\);\s*if \(!lista\) return false;/.test(nucleo) || !/cuerpoDeCaptura\(ev, key, \{ valor, origen: agente\.origen \}, new Date\(\), esEventoDePrueba\(ev, lista\)\)/.test(nucleo) || !/if \(deps\.cuentasDePrueba\) return deps\.cuentasDePrueba\(\);\s*if \(deps\.fetch \|\| \(!process\.env\.NEXT_RUNTIME && process\.env\.VERCEL !== "1"\)\) return Promise\.resolve\(new Set<string>\(\)\);\s*return listaDePrueba\(\);/.test(nucleo)) F("1 · `enviarCaptura` no pide la lista de cuentas de prueba por defecto (dentro de Next) o no marca con ella");
  // Y que «dentro de Next» se cumpla de verdad: el default de una ruta de Node y del middleware de Edge.
  try {
    const guardado = { rt: process.env.NEXT_RUNTIME, fetch: globalThis.fetch, url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
    const pedidosRpc: string[] = [];
    const cuerpos: Cuerpo[] = [];
    globalThis.fetch = (async (u: unknown, init?: { body?: unknown }) => {
      if (String(u).includes("/rest/v1/rpc/cuentas_de_prueba")) { pedidosRpc.push(String(u)); return new Response(JSON.stringify([{ user_id: PRUEBA, id_correo: null }]), { status: 200 }); }
      cuerpos.push(JSON.parse(String(init?.body)) as Cuerpo);
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://sb.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
    try {
      for (const rt of ["edge", "nodejs"]) {
        process.env.NEXT_RUNTIME = rt;
        captura.olvidarListaDePrueba();
        await captura.enviarCaptura({ event: "x", distinctId: PRUEBA, properties: {} }, { valor: IPHONE, origen: "pedido" }, { key: "phc_test", host: "https://ph.test" });
      }
    } finally {
      globalThis.fetch = guardado.fetch;
      if (guardado.rt === undefined) delete process.env.NEXT_RUNTIME; else process.env.NEXT_RUNTIME = guardado.rt;
      if (guardado.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = guardado.url;
      if (guardado.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = guardado.key;
      captura.olvidarListaDePrueba();
    }
    if (pedidosRpc.length !== 2 || cuerpos.length !== 2 || !cuerpos.every((c) => marcada(c))) F(`1 · dentro de Next (Edge y Node) la lista por defecto no se pide o el evento no sale marcado (${pedidosRpc.length} pedidos, ${cuerpos.length} eventos)`);
  } catch (e) {
    F(`1 · la lista por defecto dentro de Next no corre: ${(e as Error).message}`);
  }
  const mw = sinComentarios(leer("src/middleware.ts"));
  if (!/cuentaDeSesion: persona\?\.id \?\? cuentaDeCookieDeSesion\(request\.cookies\.getAll\(\)\)/.test(mw) || !/conVista\(req, conMedicion\(req, conNavegador\(req, res, event, persona\)\), event, visita, persona\)/.test(mw)) F("1 · el middleware no le pasa a la vista la cuenta con sesión");
  const mig = existsSync(join(RAIZ, "supabase/migrations/20261021_cuentas_de_prueba.sql")) ? leer("supabase/migrations/20261021_cuentas_de_prueba.sql") : "";
  if (!/from public\.test_accounts t\s*left join auth\.users u on u\.id = t\.user_id/.test(mig) || !/'correo:' \|\| substr\(encode\(sha256\(convert_to\(lower\(trim\(u\.email\)\), 'UTF8'\)\), 'hex'\), 1, 24\)/.test(mig) || !/security definer/.test(mig) || !/set search_path = public, pg_temp/.test(mig) || !/revoke all on function public\.cuentas_de_prueba\(\) from public, anon, authenticated;/.test(mig) || !/grant execute on function public\.cuentas_de_prueba\(\) to service_role;/.test(mig)) F("1 · la RPC no es la regla de test_accounts, no calcula el id del correo como `distinctIdDeCorreo` o la puede leer alguien más que el service role");
  if (distinctIdDeCorreo(" QA@Refranco.ai ") !== "correo:" + createHash("sha256").update("qa@refranco.ai").digest("hex").slice(0, 24)) F("1 · `distinctIdDeCorreo` dejó de ser sha256 del correo en minúsculas (la RPC calcula ese)");

  // ── 2 · EL DESBLOQUEO POR PAGO ──
  try {
    const casos: Array<[Parameters<typeof activacion.seDesbloqueaConPago>[0], boolean]> = [
      [{ is_premium: false, pending_payment: true }, true],
      [{ is_premium: false, pending_payment: false }, true],
      [{ is_premium: true, pending_payment: true }, true],
      [{ is_premium: true, pending_payment: false }, false],
      [null, false],
    ];
    for (const [antes, esperado] of casos) if (activacion.seDesbloqueaConPago(antes) !== esperado) F(`2 · con ${JSON.stringify(antes)} el pago ${esperado ? "no cuenta el desbloqueo" : "cuenta un informe que ya estaba abierto"}`);
    if (activacion.VIA_PAGO !== "pago") F("2 · la vía del desbloqueo por pago no es «pago»");
    if (activacion.modalidadDelInforme("short-term") !== "str" || activacion.modalidadDelInforme("long-term") !== "ltr" || activacion.modalidadDelInforme(null) !== "ltr") F("2 · la modalidad del informe pagado no es ltr / str");
    const e = activacion.eventoAnalisisCreado({ userId: REAL, analysisId: "a0d99eb1-9330-4740-bce3-3a0b08fc96a6", modalidad: "ltr", via: activacion.VIA_PAGO });
    if (e.event !== "analisis_creado" || (e.properties as Record<string, unknown>).via !== "pago" || e.uuid !== activacion.eventoAnalisisCreado({ userId: REAL, analysisId: "a0d99eb1-9330-4740-bce3-3a0b08fc96a6", modalidad: "ltr", via: "wizard" }).uuid) F("2 · el evento del desbloqueo por pago no es `analisis_creado` con via = pago y el uuid del informe");
  } catch (e) {
    F(`2 · el desbloqueo por pago no tiene con qué contarse: ${(e as Error).message}`);
  }
  const cf = sinComentarios(leer("src/app/api/payments/confirm/route.ts"));
  const suelto = entre(cf, 'if (userId && product === "single") {', "} else if (userId && product === PRODUCTO_PACK) {");
  const iAntes = suelto.indexOf('const { data: antesDelPago } = await supabase.from("analisis").select("is_premium, pending_payment, tipo_analisis").eq("id", analysisId).maybeSingle();');
  const iConsumo = suelto.indexOf("await consumeCredit(userId, analysisId);");
  const emite = /if \(seDesbloqueaConPago\(antesDelPago\)\) \{\s*await capturarAnalisisCreado\(\{ userId, analysisId, modalidad: modalidadDelInforme\(antesDelPago\?\.tipo_analisis as string \| null\), via: VIA_PAGO \}\);\s*\}/;
  if (iAntes < 0 || iConsumo < 0 || iAntes > iConsumo || !emite.test(suelto)) F("2 · la compra suelta atada a un informe no emite `analisis_creado` con via = pago al desbloquearlo (o lee el informe después de abrirlo)");
  const pro = entre(cf, 'if (product === "pro" && analysisId) {', 'if (premiumError)');
  if (!emite.test(pro) || pro.indexOf("antesDelPago") > pro.indexOf('.update({ is_premium: true })')) F("2 · el desbloqueo `pro` no emite `analisis_creado` con via = pago");
  const doc = leer("docs/posthog-activacion-por-puerta.md");
  if (!/via = pago/.test(doc) || !/\$set: \{ test_account: true \}/.test(doc)) F("3 · el doc del panel no dice que los pagos cuentan (via = pago) ni que el servidor marca las cuentas de prueba");

  if (fallas.length) {
    console.log(`  ✗ PANEL-ACTIVACION · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — todo evento del servidor de una cuenta de prueba sale marcado desde el primero (cuenta, correo, vista con sesión, cola), sin lista no sale; el informe que un pago desbloquea cuenta con via = pago, una vez");
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (21-oct-2026). CONTRA EL CÓDIGO DE HOY (HEAD f3855b48, los archivos del goal de vuelta): 14 fallas,
// entre ellas «un evento del servidor de una cuenta de prueba sale sin la marca» y «la compra suelta atada a un informe
// no emite `analisis_creado` con via = pago». Y 24 mutaciones, cada una restaurada byte a byte, todas ROJAS:
//   P1 sin marca en el cuerpo · P2 la lista no decide · P3 sin lista sale igual · P4 la vista ignora la sesión · P5 la
//   marca pisa el $set · P6 la vista pierde la sesión · P7 el middleware no la pasa · P8 los trozos de la cookie en otro
//   orden · P9 sin caché · P10 la RPC falla y se pierde la lista buena · P11 sin el id del correo · P12 sin lista por
//   defecto · P16 la lista por defecto solo en Vercel (el middleware en Edge quedaría sin marca) · P13 la RPC la lee
//   cualquiera · P14 la vista anónima lleva la cuenta · P15 la lista no reconoce el id
// La primera versión pedía la lista por defecto siempre que no hubiera `fetch` inyectado, y el QUICK salió con 8 fallas
// en VISTA-ENTRADA, AGENTE-SERVIDOR y MEDICION-META: esos tiers reemplazan el `fetch` global y la RPC le llegaba al
// falso. Por eso el default es «dentro de Next», como el almacén de agentes, y este tier lo prueba en Edge y en Node.
//   Q1 un informe no premium sin bloqueo no cuenta · Q2 el suelto no emite · Q3 lee el informe después de abrirlo ·
//   Q4 otra vía · Q5 el `pro` no emite · Q6 la vía no es «pago» · Q7 la modalidad · Q8 el doc

if (require.main === module) {
  runPanelActivacionTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
