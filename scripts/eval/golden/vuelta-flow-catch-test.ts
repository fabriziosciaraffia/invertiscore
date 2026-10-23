// ============================================================================
// TIER VUELTA-FLOW — la dirección de vuelta que viaja a Flow cabe, y el resto se lee del pago (22-oct-2026, Fabrizio)
//
// Lo que pasó: Flow corta el `urlReturn` a 200 caracteres. La compra de un suelto desde un depto mandaba 206 (la vuelta al
// dashboard con la selección, el aviso y `analizar=1`, codificada): volvió como `&analiz`, la página no vio `analizar=1`
// y el depto no se analizó solo. Medido en el recorrido real del 22-oct-2026.
//
//   1 · LO QUE VIAJA A FLOW QUEDA BAJO 150 PARA TODO PRODUCTO: la URL más larga posible (orden de 43, pack con firma de 32)
//       cabe; la de la vuelta a un depto, que medía 206, ya no viaja. EN ROJO CON EL CÓDIGO DE HOY: 206 > 200.
//   2 · LA PÁGINA LEE LA VUELTA DEL PAGO GUARDADO (`payment_data.volver`), no de la URL; el pack lee su informe del estado
//       del pago, y el depto también.
//   3 · PAGADO DESDE UN DEPTO: «Pago confirmado. Generando el informe de Providencia · 2D2B · 59 m² · UF 3.500…», genera y
//       abre el informe sola; sin depto, «Tienes un análisis más» (o «3») con «Ir a mi dashboard».
// Verificado EN ROJO contra el código de hoy y por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/vuelta-flow-catch-test.ts
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RETORNO, botonTrasPagar } from "../../../src/lib/compra/compra";
import { TRES_COPY, volverSeguro } from "../../../src/lib/tres-analisis";
import { analizaAlVolver, deptoDeVolver, leerDeptoDelPago, nombreDelDepto, volverAlDepto } from "../../../src/lib/guia/compra-desde-depto";
import { leerRetornoPack, leerRetornoPackDelPago, urlRetornoPack } from "../../../src/lib/lo-que-sigue/oferta-pack";

const RAIZ = join(__dirname, "..", "..", "..");
const existe = (p: string) => existsSync(join(RAIZ, p));
const leer = (p: string) => (existe(p) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const codigo = (p: string) => sinComentarios(leer(p));
function cargar<T>(ruta: string): T | null {
  try { return require(join(RAIZ, ruta)) as T; } catch { return null; }
}
type RetornoFlowMod = typeof import("../../../src/lib/compra/retorno-flow");

const SITIO = "https://refranco.ai";
const ORDEN = "franco-83e3865a-b9ec-4cc4-ba25-ac96b37033a4";
const TOKEN = "c1f72c3abf34757d3dbae63c6ea112b6a88d";
const AVISO = "c1dfbdc9-01db-4d65-b3de-bdcac9bd9aa0";
const FIRMA = "A".repeat(32);

export function runVueltaFlowTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER VUELTA-FLOW (lo que viaja a Flow cabe en 150; la vuelta, el pack y el depto se leen del pago; pagado desde un depto, el informe se genera solo · 0 tokens) ───");
  const rf = cargar<RetornoFlowMod>("src/lib/compra/retorno-flow.ts");

  // ── 1 · lo que viaja a Flow cabe ──
  if (!rf) F("1 · falta src/lib/compra/retorno-flow.ts");
  else {
    if (rf.RETORNO_FLOW_TOPE !== 200 || rf.RETORNO_FLOW_MAX > 150) F(`1 · el tope de Flow es 200 y el techo propio 150 (tope ${rf.RETORNO_FLOW_TOPE}, techo ${rf.RETORNO_FLOW_MAX})`);
    const vueltaDepto = volverAlDepto(TOKEN, AVISO);
    const deAntes = `${SITIO}/payments/return?order=${ORDEN}&volver=${encodeURIComponent(vueltaDepto)}`;
    if (deAntes.length <= rf.RETORNO_FLOW_TOPE) F(`1 · la sonda no reproduce el corte: la vuelta de antes mide ${deAntes.length}, no más de ${rf.RETORNO_FLOW_TOPE}`);
    const suelto = rf.urlRetornoFlow(SITIO, ORDEN);
    const pack = rf.urlRetornoFlow(SITIO, ORDEN, { firma: FIRMA });
    const packSinFirma = rf.urlRetornoFlow(SITIO, ORDEN, { firma: null });
    for (const [n, u] of [["el suelto", suelto], ["el pack", pack], ["el pack sin firma", packSinFirma]] as const) {
      if (u.length > rf.RETORNO_FLOW_MAX) F(`1 · ${n} mide ${u.length} (> ${rf.RETORNO_FLOW_MAX}): ${u}`);
      if (/volver=|%2F|analizar/.test(u)) F(`1 · ${n} sigue llevando la vuelta en la URL: ${u}`);
    }
    if (suelto !== `${SITIO}/payments/return?order=${ORDEN}`) F(`1 · la vuelta del suelto no es la orden sola: ${suelto}`);
    if (pack !== `${SITIO}/payments/return?order=${ORDEN}&lqs=pack&t=${FIRMA}`) F(`1 · la vuelta del pack no es la orden, lqs=pack y la firma: ${pack}`);
    if (packSinFirma !== `${SITIO}/payments/return?order=${ORDEN}&lqs=pack`) F(`1 · el pack sin firma lleva algo más: ${packSinFirma}`);
    const peor = rf.largoMaximoRetorno(SITIO);
    if (peor !== pack.length || peor > rf.RETORNO_FLOW_MAX) F(`1 · el peor caso (${peor}) no es el pack con firma (${pack.length}) o pasa el techo`);
    if (urlRetornoPack(SITIO, ORDEN, FIRMA) !== pack || urlRetornoPack(SITIO, ORDEN, null) !== packSinFirma) F("1 · urlRetornoPack no es urlRetornoFlow con lqs=pack");
    // La orden más larga posible sigue cabiendo.
    if (rf.urlRetornoFlow(SITIO, "franco-" + "f".repeat(36), { firma: FIRMA }).length > rf.RETORNO_FLOW_MAX) F("1 · con la orden más larga posible, el pack no cabe");
    // Los tres creadores de pagos arman la URL con el módulo, y ninguno le pega `volver`.
    const pc = codigo("src/app/api/payments/create/route.ts");
    if (!/urlReturn: product === PRODUCTO_PACK && analysisId\s*\? urlRetornoPack\(SITE_URL, commerceOrder, firmarPago\(commerceOrder\)\)\s*: urlRetornoFlow\(SITE_URL, commerceOrder\),/.test(pc)) F("1 · payments/create no arma la vuelta con urlRetornoFlow / urlRetornoPack");
    if (/urlReturn:[^\n]*volver/.test(pc) || /payments\/return\?order=\$\{commerceOrder\}\$\{/.test(pc)) F("1 · payments/create vuelve a pegar la vuelta (`volver`) a la URL de Flow");
    if (!/urlReturn: urlRetornoPack\(SITE_URL, commerceOrder, firmarPago\(commerceOrder\)\),/.test(codigo("src/app/api/lo-que-sigue/pack/route.ts"))) F("1 · lo-que-sigue/pack no arma la vuelta con urlRetornoPack(sitio, orden, firma)");
    if (!/guiaPack = urlRetornoPack\(SITIO_CORREO, payment\.commerce_order, firmarPago\(payment\.commerce_order\)\);/.test(codigo("src/app/api/payments/confirm/route.ts"))) F("1 · el enlace de la guía en el correo del pago no es la misma vuelta corta");
    // La vuelta sigue guardándose en el pago: es de donde la página la lee.
    if (!/\.\.\.\(volverTres \? \{ volver: volverTres \} : \{\}\),/.test(pc)) F("1 · payments/create ya no guarda la vuelta en payment_data.volver");
  }

  // ── 2 · la página lee la vuelta, el pack y el depto del pago ──
  // (Contra el código de hoy, las funciones nuevas no existen: cada sección cae por su cuenta y las otras siguen midiendo.)
  const ret = codigo("src/app/payments/return/page.tsx");
  try {
  if (/searchParams\.get\("volver"\)/.test(ret)) F("2 · la pantalla sigue leyendo la vuelta de la URL");
  if (!/const vuelta = volverSeguro\(\(data\.payment\.payment_data as \{ volver\?: unknown \} \| null\)\?\.volver\);\s*setVolver\(vuelta\);/.test(ret)) F("2 · la pantalla no lee la vuelta del pago guardado (payment_data.volver, saneada)");
  if (!/setPackInfo\(leerRetornoPackDelPago\(data\.retornoPack\)\);/.test(ret)) F("2 · la pantalla no lee el informe del pack del estado del pago");
  const lr = leerRetornoPack(new URL(urlRetornoPack(SITIO, ORDEN, FIRMA)).searchParams);
  if (!lr || lr.order !== ORDEN || lr.firma !== FIRMA) F("2 · leerRetornoPack no devuelve la orden y la firma de la URL corta");
  if (leerRetornoPack(new URLSearchParams(`order=${ORDEN}`)) !== null) F("2 · sin lqs=pack se cree del pack");
  const p1 = leerRetornoPackDelPago({ analysisId: AVISO, veredicto: "COMPRAR", modalidad: "str" });
  if (!p1 || p1.veredicto !== "COMPRAR" || p1.modalidad !== "str" || p1.analysisId !== AVISO) F("2 · leerRetornoPackDelPago pierde algo");
  if (leerRetornoPackDelPago({ analysisId: AVISO, veredicto: "x", modalidad: "y" })?.veredicto !== "AJUSTA SUPUESTOS" || leerRetornoPackDelPago({ analysisId: "no" }) !== null || leerRetornoPackDelPago(null) !== null) F("2 · leerRetornoPackDelPago no sanea lo que llega");
  const st = codigo("src/app/api/payments/status/route.ts");
  if (!/async function retornoPackDe\(/.test(st) || !/veredicto: readVeredicto\(data\.results as never\) \?\? "AJUSTA SUPUESTOS", modalidad: modalidadDeTipo\(data\.tipo_analisis as string \| null\)/.test(st)) F("2 · /api/payments/status no devuelve el informe, el veredicto guardado y la modalidad del pack");
  if ((st.match(/retornoPack: await retornoPackDe\(admin, (data|fila)\)/g) ?? []).length !== 3) F("2 · /api/payments/status no devuelve retornoPack en sus tres respuestas (sin orden, con firma, con sesión)");
  if (!/async function deptoDelPago\(/.test(st) || !/if \(f\.status !== "paid" \|\| f\.analysis_id \|\| !d \|\| !analizaAlVolver\(volver\)\) return null;/.test(st) || !/if \(!sel \|\| sel\.user_id !== f\.user_id\) return null;/.test(st)) F("2 · /api/payments/status no resuelve el depto del pago (pagado, sin informe atado, con la vuelta de un depto, de la misma cuenta)");
  if ((st.match(/depto: await deptoDelPago\(admin, (data|fila)\)/g) ?? []).length !== 2 || /sinSesion: true[^\n]*depto:/.test(st)) F("2 · el depto del pago no sale con sesión (dos respuestas) o sale sin sesión");
  } catch (e) {
    F(`2 · explotó (faltan leerRetornoPackDelPago o leerRetornoPack con la forma nueva): ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── 3 · pagado desde un depto: genera y abre; sin depto, «Tienes un análisis más» ──
  try {
  const it = { avisoId: AVISO, comuna: "Providencia", tipologia: "2D2B", m2: 59, precioUF: 3500, veredicto: "COMPRAR", score: 91, flujo: 1 };
  if (nombreDelDepto(it) !== "Providencia · 2D2B · 59 m² · UF 3.500") F(`3 · el depto no se nombra como en las tarjetas: ${nombreDelDepto(it)}`);
  if (nombreDelDepto({ ...it, tipologia: null, m2: 45.6, precioUF: 12345 }) !== "Providencia · 46 m² · UF 12.345") F("3 · sin tipología (o con decimales) el nombre sale mal");
  if (RETORNO.generandoDepto(nombreDelDepto(it)) !== "Generando el informe de Providencia · 2D2B · 59 m² · UF 3.500…") F(`3 · la pantalla no dice «Generando el informe de [depto]…»: ${RETORNO.generandoDepto(nombreDelDepto(it))}`);
  if (RETORNO.abriendo.titulo !== "Pago confirmado." || RETORNO.pagado.titulo !== "Pago confirmado.") F("3 · la pantalla pagada no se titula «Pago confirmado.»");
  if (RETORNO.pagado.uno !== "Tienes un análisis más." || RETORNO.pagado.tres !== "Tienes 3 análisis más." || TRES_COPY.listo !== "Tienes 3 análisis más.") F("3 · sin depto no dice «Tienes un análisis más» / «Tienes 3 análisis más»");
  if (RETORNO.irAlDashboard !== "Ir a mi dashboard" || botonTrasPagar(null).texto !== "Ir a mi dashboard" || botonTrasPagar(null).href !== "/dashboard" || botonTrasPagar("/dashboard").texto !== "Ir a mi dashboard") F("3 · el botón sin depto no es «Ir a mi dashboard»");
  if ("verMisAnalisis" in RETORNO || "analizandoDepto" in RETORNO) F("3 · sobreviven las claves de antes («Ver mis análisis», «Franco está analizando este depto…»)");
  const dep = leerDeptoDelPago({ token: TOKEN, avisoId: AVISO, origenId: null, nombre: "x" });
  if (!dep || dep.origenId !== null || leerDeptoDelPago({ token: "zz", avisoId: AVISO, nombre: "x" }) !== null || leerDeptoDelPago({ token: TOKEN, avisoId: AVISO }) !== null) F("3 · leerDeptoDelPago no sanea lo que llega");
  if (!deptoDeVolver(volverSeguro(volverAlDepto(TOKEN, AVISO))) || !analizaAlVolver(volverAlDepto(TOKEN, AVISO))) F("3 · la vuelta a un depto dejó de pedir el análisis solo");
  if (!/async function generarDepto\(depto: DeptoDelPago, vuelta: string \| null\)/.test(ret)) F("3 · la pantalla no tiene generarDepto");
  const gen = ret.slice(ret.indexOf("async function generarDepto("), ret.indexOf("useEffect(() => {"));
  if (!/fetch\("\/api\/lo-que-sigue\/guia\/analizar", \{[\s\S]*?body: JSON\.stringify\(\{ origenId: depto\.origenId, avisoId: depto\.avisoId, semanal: depto\.token \}\)/.test(gen)) F("3 · generarDepto no pide el informe del depto con su selección");
  if (!/if \(res\.status === 409\) \{ await esperar\(ESPERA_GENERAR_MS\); continue; \}/.test(gen)) F("3 · generarDepto no espera un informe en curso");
  if (!/if \(res\.ok && d\.id\) \{ router\.replace\(`\/analisis\/\$\{d\.id\}`\); return; \}/.test(gen)) F("3 · generarDepto no abre el informe generado");
  if (!/if \(d\.error === "sin-creditos" && sinCredito\+\+ < REINTENTOS_CREDITO_RETORNO\) \{ await esperar\(ESPERA_GENERAR_MS\); continue; \}/.test(gen)) F("3 · generarDepto no espera el crédito que el webhook otorga aparte");
  if (!/router\.replace\(vuelta \?\? "\/dashboard"\);/.test(gen)) F("3 · si no puede generar, no vuelve al dashboard con el depto");
  if (!/const depto = leerDeptoDelPago\(data\.depto\);\s*if \(!redirectedRef\.current && !data\.payment\.analysis_id && depto\) \{\s*redirectedRef\.current = true;\s*setRedirecting\(true\);\s*setAlDepto\(depto\);\s*void generarDepto\(depto, vuelta\);/.test(ret)) F("3 · pagado desde un depto, la pantalla no genera el informe una sola vez");
  if (!/\{alDepto \? RETORNO\.generandoDepto\(alDepto\.nombre\) : RETORNO\.abriendo\.cuerpo\}/.test(ret)) F("3 · mientras genera, la pantalla no dice de qué depto");
  if (!/: analysisId \? "Tu análisis está desbloqueado\." : RETORNO\.pagado\.uno/.test(ret) || !/<EnlaceCarga href=\{tras\.href\}[^>]*data-retorno-boton="pagado">\s*\{tras\.texto\}/.test(ret)) F("3 · sin depto, la pantalla no dice «Tienes un análisis más» con el botón al dashboard");
  } catch (e) {
    F(`3 · explotó (faltan nombreDelDepto, leerDeptoDelPago o generandoDepto): ${e instanceof Error ? e.message : String(e)}`);
  }

  if (fallas.length) {
    console.log(`  ✗ VUELTA-FLOW · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — a Flow viaja solo la orden (y lqs=pack + firma), bajo 150; la vuelta, el informe del pack y el depto se leen del pago; pagado desde un depto se genera y abre el informe solo, y sin depto dice «Tienes un análisis más» con «Ir a mi dashboard»");
  }
  return { hard: fallas.length };
}

// ACTA DE MUTACIÓN (22-oct-2026). CONTRA EL CÓDIGO DE HOY (HEAD 41bf3c6c, `src/` del goal de vuelta a HEAD y el módulo
// nuevo apartado): 7 fallas —falta retorno-flow.ts, la pantalla lee la vuelta de la URL y no del pago, no lee el informe
// del pack del estado del pago, y faltan leerRetornoPackDelPago, nombreDelDepto y leerDeptoDelPago—. Y 10 mutaciones,
// cada una restaurada byte a byte, todas ROJAS: F1 la vuelta vuelve a viajar a Flow (206 > 150) · F2 payments/create le
// pega `volver` · F3 la pantalla lee la vuelta de la URL · F4 pagado desde un depto manda al dashboard en vez de generar ·
// F5 el estado del pago no trae el depto con sesión · F6 el depto sale aunque la selección sea de otra cuenta · F7 el botón
// vuelve a «Ver mis análisis» · F8 el depto se nombra sin el precio · F9 generarDepto no espera el crédito · F10 el pack
// vuelve a llevar el informe en la URL (176 > 150).
// Los gates que fijaban la vuelta anterior se reescribieron con su acta: COMPRA §2, CORREOS-RECORRIDO §6, LO-QUE-SIGUE
// «pago»/§9, PAGO-SIN-SESION §2, PUERTA-B-RECORRIDO §5 y GUIA-BUSQUEDA §2/§7/§11/§13.

if (require.main === module) {
  process.exit(runVueltaFlowTier().hard ? 1 : 0);
}
