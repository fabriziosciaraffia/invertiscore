// ============================================================================
// TIER COMPRA — el camino de compra desde planes (19-oct-2026, decisión de Fabrizio)
//
//   1 · UNA SOLA PANTALLA ANTES DE FLOW: /checkout dice el producto, el precio y lo que incluye en una línea. Sin sesión,
//       el correo, «Pagar $19.990» (manda el código) y «o con Google»; el código en la misma pantalla, y al confirmarlo,
//       directo a Flow. Con sesión, el correo puesto y solo el botón de pagar. Ninguna puerta de auth en el camino: ni
//       /registro, ni /entrar. El enlace del correo y Google vuelven con `pagar=1` y la pantalla sigue sola a Flow.
//   2 · LA VUELTA DE FLOW, UN SOLO BOTÓN: «Ver mis análisis» si pagó (de vuelta a los deptos si la compra salió de la
//       página semanal), «Reintentar» si no, que vuelve a la misma compra.
//   3 · «ANALIZAR ESTE» SIN SALDO cae en la misma pantalla de compra.
//   4 · GRATIS: «Empezar gratis» a /deptos, que desde planes dice arriba qué hacer ahí y ofrece el wizard.
//   5 · LAS PANTALLAS DE ENTRAR Y DE CÓDIGO, PLANAS, con la misma lógica de antes.
//   6 · voz.
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/compra-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COMPRA, RETORNO, botonTrasPagar, resumenCompra, rutaReintentar, urlCompra } from "../../../src/lib/compra/compra";
import { PLANES_COPY } from "../../../src/lib/planes";
import { rutaTres } from "../../../src/lib/tres-analisis";
import { RUTA_SUELTO_SEMANAL } from "../../../src/lib/guia/semanal";
import { PAGO_PACK_NO_PASO } from "../../../src/lib/lo-que-sigue/copy";
import { DEPTOS_COPY } from "../../../src/lib/deptos/respuesta";
import { RUTA_WIZARD, hrefAnalizar } from "../../../src/lib/cta-analizar";
import { PLANO } from "../../../src/components/plano/plano";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const VOSEO = /(^|[^a-záéíóúñ])(dejás|tenés|querés|podés|sabés|mirá|tomá|entrá|seguí|registrate|guardá|revisá|poné|compará|elegí|tocá|pedí|escribí|analizá|empezá|cambialo|cancelá|pagá|reintentá|vos)(?![a-záéíóúñ])/i;
/** El trozo de `s` entre dos marcas (la primera aparición de cada una, en orden). Vacío si falta alguna. */
const entre = (s: string, desde: string, hasta: string) => {
  const i = s.indexOf(desde);
  const j = i < 0 ? -1 : s.indexOf(hasta, i + desde.length);
  return i < 0 || j < 0 ? "" : s.slice(i, j);
};
const cuenta = (s: string, re: RegExp) => (s.match(re) ?? []).length;

export function runCompraTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER COMPRA (una sola pantalla antes de Flow; la vuelta con un botón; entrar, plano · 0 tokens) ───");

  // ── 1 · LA PANTALLA DE COMPRA ──────────────────────────────────────────────
  const esperado: Array<[string, Parameters<typeof resumenCompra>[1], string]> = [
    ["tres_analisis", {}, "Pack de 3 | $19.990 | pago único | 3 análisis que no vencen."],
    ["plan10_mensual", {}, "Plan Franco | $39.990 | al mes | 20 análisis al mes. Los que no uses se acumulan por un año. Cancelas cuando quieras."],
    ["single", {}, "1 análisis | $9.990 | pago único | Un análisis que no vence."],
    ["single", { analysisId: "a", comuna: "Providencia" }, "Tu análisis en Providencia | $9.990 | pago único | El informe completo de este depto."],
    ["pack3", { analysisId: "a" }, "Pack de 3 | $14.990 | pago único | 3 análisis que no vencen."],
  ];
  for (const [k, o, txt] of esperado) {
    const r = resumenCompra(k, o);
    const real = r ? `${r.nombre} | ${r.precio} | ${r.unidad} | ${r.incluye}` : "null";
    if (real !== txt) F(`1 · ${k} dice «${real}» (esperado «${txt}»)`);
  }
  for (const k of ["plan50_mensual", "unlimited_mensual", "plan10_annual", "unlock", "pro", "nada"]) if (resumenCompra(k) !== null) F(`1 · ${k} tiene pantalla de compra (no se vende)`);
  if (resumenCompra("plan10_mensual")?.endpoint !== "/api/subscriptions/create" || resumenCompra("tres_analisis")?.endpoint !== "/api/payments/create") F("1 · el plan o el pack van a otro endpoint de cobro");
  if (COMPRA.pagar("$19.990") !== "Pagar $19.990" || COMPRA.google !== "o con Google") F("1 · el botón no dice «Pagar $19.990» o Google no dice «o con Google»");

  const pag = sinComentarios(leer("src/app/checkout/page.tsx"));
  const cli = sinComentarios(leer("src/app/checkout/compra-cliente.tsx"));
  // Ninguna puerta de auth en el camino: el código se pide acá.
  if (/["'`]\/(registro|register|entrar)\b|redirect\(|hrefEntrar/.test(pag + cli)) F("1 · el checkout manda a otra pantalla a entrar");
  // La sesión se lee en el servidor: la pantalla llega con el correo puesto (sin «Cargando...» antes).
  if (!/const \{ data: \{ user \} \} = await supabase\.auth\.getUser\(\);/.test(pag) || !/sesionEmail=\{user\?\.email \?\? null\}/.test(pag) || /Cargando\.\.\./.test(pag + cli)) F("1 · la sesión no se lee en el servidor: la pantalla no llega con el correo puesto");
  if (!/contexto=\{user \? "sitio" : "auth"\}/.test(pag)) F("1 · sin sesión, el header ofrece «Entrar» en medio de la compra");
  // Los tres estados, en una sola pantalla.
  const conSesion = entre(cli, 'data-compra="con-sesion"', 'data-compra="codigo"');
  const codigo = entre(cli, 'data-compra="codigo"', 'data-compra="correo"');
  const correo = entre(cli, 'data-compra="correo"', 'data-compra="pie"');
  if (!/<input id="compra-correo" type="email" readOnly value=\{sesion\}/.test(conSesion) || cuenta(conSesion, /<button\b[^>]*data-compra="pagar"/g) !== 1 || !/onClick=\{handlePay\}/.test(conSesion) || /conGoogle|placeholder=/.test(conSesion)) F("1 · con sesión no es el correo puesto y solo el botón de pagar");
  if (!/onChange=\{\(x\) => entrada\.setCorreo\(x\.target\.value\)\}/.test(correo) || !/onSubmit=\{entrada\.enviarCodigo\}/.test(cli) || !/\{COMPRA\.pagar\(product\.precio\)\}/.test(correo) || !/onClick=\{entrada\.conGoogle\}[^>]*>\s*<span className=\{PLANO\.iconoGoogle\}><IconoGoogle \/><\/span> \{COMPRA\.google\}/.test(correo)) F("1 · sin sesión no están el correo, «Pagar $…» que manda el código y «o con Google»");
  if (!/onSubmit=\{pagarConCodigo\}/.test(cli) || !/maxLength=\{CODIGO_MAX\}/.test(codigo) || !/\{botonPagar\}/.test(codigo)) F("1 · el código no se pide en la misma pantalla con el botón de pagar");
  // Al confirmar el código, directo a Flow: verifica, queda con sesión y paga — en ese orden, sin pasos en el medio.
  if (!/async function pagarConCodigo\(ev: FormEvent\) \{\s*if \(!\(await entrada\.verificar\(ev\)\)\) return;\s*setSesion\(entrada\.enviado\);\s*await handlePay\(\);\s*\}/.test(cli)) F("1 · al confirmar el código no va directo a Flow");
  // El código es el mismo de /entrar (la cuenta nace o entra igual, se reclama lo anónimo): el hook, no una copia.
  if (!/const entrada = useEntradaPorCodigo\(urlCompra\(estaCompra, true\)\);/.test(cli) || /verifyOtp|signInWithOtp/.test(cli)) F("1 · la compra no usa la entrada por código de /entrar (o la copia)");
  // De vuelta del correo o de Google con sesión: sigue sola a Flow, una vez, salvo que ya tenga el plan o el pack venció.
  const sola = entre(cli, "const siguioSola = useRef(false);", "async function otraCuenta()");
  if (!/if \(!props\.pagarAlEntrar \|\| !sesion \|\| siguioSola\.current \|\| yaTienePlan\) return;/.test(sola) || !/siguioSola\.current = true;/.test(sola) || !/void handlePay\(\);/.test(sola) || !/if \(esPack && \(oferta === null \|\| !oferta\.vigente\)\) return;/.test(sola)) F("1 · de vuelta de Google o del enlace del correo, no sigue sola a Flow (o paga dos veces, o paga un plan que ya tiene)");
  if (urlCompra({ product: "tres_analisis", origen: "planes", volver: "/dashboard" }, true) !== "/checkout?product=tres_analisis&origen=planes&volver=%2Fdashboard&pagar=1" || /pagar=/.test(urlCompra({ product: "single" }))) F("1 · la vuelta de Google o del correo no lleva la compra entera con `pagar`");
  // Quien ya tiene el plan no lo vuelve a contratar: «Ya tienes el Plan Franco» y su cuenta.
  if (!/const yaTienePlan = props\.conPlan && !product\.unico;/.test(cli) || !/\{yaTienePlan \? \(\s*<div data-compra="ya-plan">/.test(cli)) F("1 · a quien ya tiene el plan se le ofrece pagarlo de nuevo");
  // Plana, en el diseño actual: sin tarjeta, sin el rojo de antes, sin mono; Inter y serif solo en el título.
  if (/rounded-2xl border|shadow|#C8323C|font-mono|uppercase|font-body|BASE_FEATURES|Continuar al pago|Confirma tu compra/.test(pag + cli)) F("1 · la pantalla de compra vuelve a la tarjeta, al rojo, al mono o a la lista de funciones de antes");
  if (!/className=\{`mt-5 \$\{PLANO\.titulo\}`\} data-compra="producto">\{product\.nombre\}<\/h1>/.test(cli) || !/data-compra="precio"/.test(cli) || !/<p className=\{PLANO\.bajada\} data-compra="incluye">\{product\.incluye\}<\/p>/.test(cli)) F("1 · no están el producto, el precio y lo que incluye en una línea");
  if (!/\bfont-heading\b/.test(PLANO.titulo) || /font-heading/.test(PLANO.bajada + PLANO.campo + PLANO.principal + PLANO.nota) || !/rounded-full/.test(PLANO.principal) || !/\bh-12\b/.test(PLANO.campo) || !/text-\[16px\]/.test(PLANO.campo)) F("1 · las clases planas no son: serif solo en el título, píldora, campo de 48 y 16 px");

  // ── 2 · LA VUELTA DE FLOW, UN SOLO BOTÓN ───────────────────────────────────
  // ⚠ ACTA (22-oct-2026, decisión de Fabrizio tras el recorrido real) · sin depto de por medio la vuelta dice «Tienes un análisis más» con «Ir a mi
  // dashboard» (antes «Ver mis análisis»); desde un depto, la pantalla genera el informe sola (tier VUELTA-FLOW).
  if (RETORNO.irAlDashboard !== "Ir a mi dashboard" || RETORNO.reintentar !== "Reintentar" || PAGO_PACK_NO_PASO.volver !== "Reintentar") F("2 · los botones de la vuelta no dicen «Ir a mi dashboard» y «Reintentar»");
  const b1 = botonTrasPagar(null), b2 = botonTrasPagar("/dashboard"), b3 = botonTrasPagar("/semanal?t=abc&a=1");
  if (b1.texto !== "Ir a mi dashboard" || b1.href !== "/dashboard" || b2.texto !== "Ir a mi dashboard" || b3.texto !== "Volver a los deptos" || b3.href !== "/semanal?t=abc&a=1") F("2 · después de pagar el botón no es «Ir a mi dashboard» (o no vuelve a los deptos desde la página semanal)");
  const reintentos: Array<[Parameters<typeof rutaReintentar>[0], string]> = [
    [{ suscripcion: true }, "/checkout?product=plan10_mensual"],
    [{ producto: "tres_analisis", origen: "semanal", variante: "banda", volver: "/semanal?t=x" }, "/checkout?product=tres_analisis&origen=semanal&variante=banda&volver=%2Fsemanal%3Ft%3Dx"],
    [{ producto: "single", analysisId: "abc", companionStrId: "def" }, "/checkout?product=single&analysisId=abc&companionStrId=def"],
    [{ producto: "plan50_mensual" }, "/pricing"],
    [{ producto: null }, "/pricing"],
  ];
  for (const [r, esp] of reintentos) if (rutaReintentar(r) !== esp) F(`2 · «Reintentar» de ${JSON.stringify(r)} lleva a ${rutaReintentar(r)} (esperado ${esp})`);
  const ret = sinComentarios(leer("src/app/payments/return/page.tsx"));
  const pagado = entre(ret, "{!retornoPack && paymentStatus === \"paid\" && !redirecting && (", "{paymentStatus === \"sin_sesion\" && (");
  const rechazado = entre(ret, "{paymentStatus === \"error\" && !retornoPack && (", "{!ancha && ");
  if (cuenta(pagado, /<(EnlaceCarga|Link|a|button)\b/g) !== 1 || !/<EnlaceCarga href=\{tras\.href\}/.test(pagado)) F("2 · la vuelta con el pago hecho no tiene un solo botón");
  if (cuenta(rechazado, /<(EnlaceCarga|Link|a|button)\b/g) !== 1 || !/<EnlaceCarga href=\{reintentar\} [^>]*>\{RETORNO\.reintentar\}<\/EnlaceCarga>/.test(rechazado)) F("2 · la vuelta sin pago no tiene un solo botón, «Reintentar»");
  if (!/const reintentar = rutaReintentar\(\{\s*suscripcion: type === "subscription",\s*producto,/.test(ret) || !/setDatosPago\(/.test(ret)) F("2 · «Reintentar» no vuelve a la misma compra");
  if (/#FBBF24|#C8323C|rounded-2xl border|Ir al dashboard|Volver al dashboard/.test(ret)) F("2 · la vuelta de Flow vuelve al ámbar, al rojo, a la tarjeta o a un segundo botón");

  // ── 3 · «ANALIZAR ESTE» SIN SALDO, A LA MISMA PANTALLA ──────────────────────
  const aviso = sinComentarios(leer("src/components/guia/AvisoAntesDeAnalizar.tsx"));
  // ⚠ ACTA (21-oct-2026, recorrido real de Fabrizio por la puerta B) · sin saldo, el aviso de la selección ofrece el pack
  // (principal) y el suelto (debajo), los dos a /checkout con el depto (`compras`, lib/guia/compra-desde-depto.ts; tier
  // PUERTA-B-RECORRIDO §5). La guía sigue con su `rutaCompra`. Las dos ramas caen en la pantalla de compra.
  const comprar = sinComentarios(leer("src/app/semanal/semanal-lista.tsx"));
  if (!/const comprar = \(href: string\) => \{ iniciarCarga\(claveActual\(\)\); router\.push\(href\); \};/.test(aviso) || !/onConfirmar=\{sin \? \(\) => comprar\(compras \? compras\.pack\.href : rutaCompra\) : \(\) => alAnalizar\(/.test(aviso) || !/secundario=\{sin && compras \? \{ label: compras\.suelto\.label, onClick: \(\) => comprar\(compras\.suelto\.href\) \} : undefined\}/.test(aviso)
    || !rutaTres("semanal", { volver: "/dashboard?t=x" }).startsWith("/checkout?product=tres_analisis") || !RUTA_SUELTO_SEMANAL.startsWith("/checkout?") || !/compras=\{comprasDelDepto\(\{ token, avisoId: confirmar\.it\.avisoId, origen: origenCompra/.test(comprar)) F("3 · «Analizar este» sin saldo no cae en la pantalla de compra");

  // ── 4 · GRATIS ─────────────────────────────────────────────────────────────
  if (PLANES_COPY.gratis.boton !== "Empezar gratis" || PLANES_COPY.gratis.ruta !== "/deptos?desde=planes") F("4 · el botón de Gratis no dice «Empezar gratis» o no lleva a /deptos desde planes");
  if (!/<EnlaceCarga href=\{C\.gratis\.ruta\} [^>]*>\{C\.gratis\.boton\}<\/EnlaceCarga>/.test(sinComentarios(leer("src/app/pricing/page.tsx")))) F("4 · la página de planes no usa el botón de Gratis");
  if (DEPTOS_COPY.desdePlanes.antes !== "Elige qué buscas y te mandamos los deptos cada semana. ¿Tienes un depto en la mira?" || DEPTOS_COPY.desdePlanes.enlace !== "Analízalo gratis") F("4 · la línea de /deptos desde planes no es la aprobada");
  const deptos = sinComentarios(leer("src/app/deptos/page.tsx"));
  if (!/\{searchParams\?\.desde === "planes" && \(/.test(deptos) || !/\{DEPTOS_COPY\.desdePlanes\.antes\}\{" "\}\s*<EnlaceCarga href=\{hrefAnalizar\("pricing"\)\}[^>]*>\{DEPTOS_COPY\.desdePlanes\.enlace\}<\/EnlaceCarga>/.test(deptos) || !hrefAnalizar("pricing").startsWith(`${RUTA_WIZARD}?`)) F("4 · /deptos desde planes no dice qué hacer ni lleva «Analízalo gratis» al wizard");
  if (deptos.indexOf('data-deptos="desde-planes"') < 0 || deptos.indexOf('data-deptos="desde-planes"') > deptos.indexOf("<DeptosCliente")) F("4 · la línea de /deptos desde planes no va arriba");

  // ── 5 · ENTRAR Y EL CÓDIGO, PLANOS, CON LA MISMA LÓGICA ──────────────────────
  const pantallas: Array<[string, RegExp[]]> = [
    ["src/app/entrar/page.tsx", [/const next = destinoTrasEntrar\(sp\.get\("next"\)\);/]],
    ["src/components/entrar/EntrarConCodigo.tsx", [/const e = useEntradaPorCodigo\(next\);/, /router\.push\(e\.destino\);/]],
    ["src/app/login/page.tsx", [/signInWithPassword\(\{\s*email,\s*password,\s*\}\)/, /await reclamarAnalisisAnonimos\(posthog, "login"\);/, /router\.push\(esDestinoSeguro\(next\) \? next : "\/dashboard"\);/, /marcarOAuthPendiente\("login"\);/]],
    ["src/app/register/page.tsx", [/supabase\.auth\.signUp\(\{/, /emitirAuthCompletada\(posthog, "signup", "email"\);/, /if \(!data\.session\) \{\s*setPendingEmail\(email\);/, /marcarOAuthPendiente\("signup"\);/]],
    ["src/app/recuperar/page.tsx", [/resetPasswordForEmail\(email, \{\s*redirectTo: `\$\{window\.location\.origin\}\/restablecer`,/]],
    ["src/app/restablecer/page.tsx", [/supabase\.auth\.updateUser\(\{ password \}\)/, /event === "PASSWORD_RECOVERY"/]],
  ];
  for (const [f, logica] of pantallas) {
    const s = sinComentarios(leer(f));
    if (!/import \{ PLANO(, UI_PLANO)? \} from "@\/components\/plano\/plano";/.test(s)) F(`5 · ${f} no usa las clases planas`);
    if (/rounded-2xl border|shadow-sm|FrancoLogo|font-mono|#C8323C|font-body/.test(s)) F(`5 · ${f} vuelve a la tarjeta, al logo repetido, al mono o al rojo`);
    // TODOS los títulos (una pantalla tiene uno por estado): con uno plano no basta (C26 salió verde así).
    if (cuenta(s, /<h1\b/g) !== cuenta(s, /<h1 className=\{PLANO\.titulo\}>/g)) F(`5 · ${f}: un título no es el de las pantallas planas`);
    if (/AppFooter variant="minimal"/.test(s)) F(`5 · ${f}: el pie no es el limpio`);
    for (const re of logica) if (!re.test(s)) F(`5 · ${f}: cambió la lógica (${re.source.slice(0, 50)})`);
  }

  // ── 6 · VOZ ────────────────────────────────────────────────────────────────
  const textos = [...Object.values(COMPRA).map((v) => (typeof v === "function" ? v("$1") : v)), JSON.stringify(RETORNO), DEPTOS_COPY.desdePlanes.antes, DEPTOS_COPY.desdePlanes.enlace, PLANES_COPY.gratis.boton];
  for (const t of textos) if (VOSEO.test(t)) F(`6 · voseo: «${t.slice(0, 80)}»`);

  if (fallas.length === 0) console.log("  ✓ VERDE — una sola pantalla antes de Flow (sin sesión el correo y el código ahí mismo, con sesión solo pagar), sin pasar por /entrar; la vuelta con un botón, «Ver mis análisis» o «Reintentar»; «Analizar este» sin saldo a la misma pantalla; «Empezar gratis» a /deptos con su línea; entrar y el código, planos, con la misma lógica");
  for (const f of fallas) console.log(`  ✗ ${f}`);
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runCompraTier();
  process.exit(hard > 0 ? 1 : 0);
}

// ─── ACTA · verificado EN ROJO por mutación (19-oct-2026) ────────────────────
//   Mutaciones (scratchpad mutar-compra.cjs), cada archivo restaurado byte a byte:
//   C1 vuelve la puerta a /registro · C2 la sesión no se lee en el servidor · C3 el header ofrece Entrar · C4 con sesión el
//   correo se edita · C5 sin «o con Google» · C6 el código no va directo a Flow · C7 Google vuelve sin pagar · C8 sigue
//   sola aunque ya tenga el plan · C9 sigue sola dos veces · C10 al que tiene plan se le vende · C11 vuelve la tarjeta ·
//   C12 sin lo que incluye · C13 el pack incluye otra cosa · C14 se vende lo retirado · C30 el pago no lo inicia el
//   código (§1) · C15 la vuelta pagada con dos botones · C16 rechazado no reintenta · C17 reintentar pierde el origen ·
//   C18 desde la semanal no vuelve a los deptos · C19 vuelve el ámbar (§2) · C20 «Analizar este» a otra pantalla (§3) ·
//   C21 gratis vuelve a «Crear mi cuenta» · C22 /deptos sin la línea · C23 «Analízalo gratis» a otro lado (§4) · C24 login
//   vuelve a la tarjeta · C25 login cambia la lógica · C26 recuperar con otro título · C27 register con el pie de antes ·
//   C29 serif fuera del título (§5) · C28 voseo (§6). 30/30 ROJO.
//   C26 salió VERDE la primera vez: el chequeo pedía que hubiera UN título plano, y /recuperar tiene dos (uno por
//   estado): con el otro bastaba. Ahora cuenta que TODOS lo sean.
//   Y los chequeos reapuntados en otros tiers: A1 (AFFORDANCE), L1-L2 (LO-QUE-SIGUE), P1-P2 (PLANES), R1-R3
//   (CORREOS-RECORRIDO), S1-S2 (SEMANAL), E1-E3 (ENTRADA-CÓDIGO): 13/13 ROJO.
