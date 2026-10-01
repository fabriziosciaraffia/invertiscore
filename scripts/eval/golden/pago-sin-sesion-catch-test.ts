// ============================================================================
// GOLDEN · PAGO-SIN-SESION (02-oct-2026) — catch-test
// ============================================================================
//   Arreglos del pago del pack y del informe de origen. Decisiones de Fabrizio, 02-oct-2026:
//   1 · SU INFORME EN SU NAVEGADOR: abierto sin sesión en el mismo navegador donde lo hizo (la cookie
//       `franco_anon` calza con `anon_origen_hash`, que el claim conserva), se ve completo y el header
//       dice «Tu análisis» con «Entrar». Otro navegador lo sigue viendo compartido; con sesión manda la
//       sesión; un informe ajeno nunca.
//   2 · EL PAGO SE VERIFICA SIN SESIÓN: la URL de retorno del pack lleva la firma HMAC del commerce_order
//       (secreto: SUPABASE_SERVICE_ROLE_KEY, sin variables nuevas); /api/payments/status con la firma
//       devuelve el estado de ESE pago y el saldo del dueño, y nada sin ella.
//   3 · EL PAGO DE OTRA CUENTA LO DICE: «Este pago es de otra cuenta. Entra con el correo con que pagaste.»,
//       con una acción para entrar con otro correo, en vez de quedarse cargando.
//   6 · RENTA CORTA: «Tu análisis está listo» también para el STR creado con sesión, y la línea del código en
//       el pago confirmado de TODO pack.
//   7 · EL PRECIO DEL PACK NO SALE DEL TICKET: barrido de src/ con lista blanca explícita (abajo).
//   (Los puntos 4 y 5 —la guía con llave y el horizonte después de pagar— viven en GUIA-BUSQUEDA §12 y §13;
//   el saldo real, en §11.)
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red ni base.
// Solo:  node --import tsx scripts/eval/golden/pago-sin-sesion-catch-test.ts
// ============================================================================
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { esNavegadorDeOrigen } from "../../../src/lib/navegador-origen";
import { firmaPago, firmaPagoValida, LARGO_FIRMA_PAGO } from "../../../src/lib/lo-que-sigue/firma-pago";
import { accesoAlPago, estadoDelPago } from "../../../src/lib/lo-que-sigue/retorno-pago";
import { leerRetornoPack, urlRetornoPack } from "../../../src/lib/lo-que-sigue/oferta-pack";
import { PAGO_OTRA_CUENTA } from "../../../src/lib/lo-que-sigue/copy";
import { sinComentarios } from "./lectura-paginada-catch-test";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sc = (p: string) => sinComentarios(leer(p));

function archivosSrc(): string[] {
  const out: string[] = [];
  const rec = (d: string) => {
    for (const n of readdirSync(join(RAIZ, d))) {
      const p = `${d}/${n}`;
      if (statSync(join(RAIZ, p)).isDirectory()) rec(p);
      else if (/\.(ts|tsx)$/.test(n)) out.push(p);
    }
  };
  rec("src");
  return out;
}

// ── 7 · LA LISTA BLANCA DEL PRECIO DEL PACK ─────────────────────────────────────
// El pack de 3 a $14.990 se ofrece SOLO en el ticket del primer informe anónimo, una vez; el registrado compra
// el análisis suelto o un plan. El precio puede aparecer (fuera de comentarios) únicamente en:
export const LISTA_BLANCA_PRECIO_PACK: Readonly<Record<string, string>> = {
  "src/lib/lo-que-sigue/oferta-pack.ts": "define la constante (PACK_PRECIO_CLP) y lo que se deriva de ella",
  "src/lib/flow-products.ts": "el monto que se le cobra a Flow: la fuente de verdad del cobro",
  "src/lib/pricing.ts": "los precios internos de la UI (hoy no lo nombra; permitido por la decisión)",
  "src/components/lo-que-sigue/TicketPack.tsx": "el ticket: el único lugar donde se ofrece",
  "src/lib/lo-que-sigue/copy.ts": "el copy del ticket y del checkout del pack (recibe el precio como parámetro)",
  "src/app/api/lo-que-sigue/pack/route.ts": "abre la orden del pack desde el ticket",
  "src/app/checkout/page.tsx": "el checkout del pack (el ticket con sesión pasa por ahí)",
  "src/app/api/payments/create/route.ts": "crea la orden del checkout: el mapa de montos por producto",
  "src/app/api/payments/confirm/route.ts": "la confirmación del pago de Flow",
  "src/lib/email.ts": "el correo transaccional del pago confirmado",
  "src/lib/email/correos.ts": "las plantillas del pago confirmado y de la boleta",
  "src/lib/email/catalogo.ts": "la vista previa de esos correos en /admin (muestras con el monto del pack)",
};
const PRECIO_PACK = [
  /\b14[.\s]?990\b/,
  /\bPACK_PRECIO_CLP\b|\bPACK_UNITARIO_CLP\b|\bPACK_AHORRO_CLP\b/,
  /FLOW_PRODUCTS\s*(?:\.\s*pack3\b|\[\s*(?:PRODUCTO_PACK|["']pack3["'])\s*\])/,
];

export async function runPagoSinSesionTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER PAGO-SIN-SESION (su informe en su navegador, el pago con firma, el precio del pack en el ticket · 0 tokens) ───");

  // ── 1 · su informe en su navegador ──────────────────────────────────────────
  {
    const token = "token-de-la-cookie";
    const hash = createHash("sha256").update(token).digest("hex");
    const casos: Array<[Parameters<typeof esNavegadorDeOrigen>[0], boolean, string]> = [
      [{ conSesion: false, duenoId: "u1", origenHash: hash, tokenCookie: token }, true, "su navegador, sin sesión"],
      [{ conSesion: true, duenoId: "u1", origenHash: hash, tokenCookie: token }, false, "con sesión (manda la sesión)"],
      [{ conSesion: false, duenoId: null, origenHash: hash, tokenCookie: token }, false, "una fila sin dueño (es el anónimo-dueño de siempre)"],
      [{ conSesion: false, duenoId: "u1", origenHash: hash, tokenCookie: "otro-token" }, false, "OTRO navegador (cookie que no calza)"],
      [{ conSesion: false, duenoId: "u1", origenHash: hash, tokenCookie: null }, false, "un navegador sin cookie"],
      [{ conSesion: false, duenoId: "u1", origenHash: null, tokenCookie: token }, false, "una fila sin hash de origen"],
      [{ conSesion: false, duenoId: "u1", origenHash: token, tokenCookie: token }, false, "el token en claro en vez del hash"],
    ];
    for (const [e, debe, que] of casos) if (esNavegadorDeOrigen(e) !== debe) F(`1 · ${que}: ${debe ? "no se reconoce" : "se reconoce"} como su navegador`);

    const claim = sc("src/lib/anon-claim.ts");
    if (!/anon_claim_token_hash: null,/.test(claim)) F("1 · el claim deja de cerrar la ventana de claim (anon_claim_token_hash)");
    if (!/\.update\(\{ anon_origen_hash: hash \}\)\s*\.in\("id", filas\.map\(\(f\) => f\.id as string\)\)\s*\.eq\("user_id", user\.id\);/.test(claim)) F("1 · el claim no conserva el hash del navegador de origen (o lo escribe fuera de las filas que adoptó)");
    const mig = "supabase/migrations/20261002_analisis_anon_origen_hash.sql";
    if (!existsSync(join(RAIZ, mig)) || !/ADD COLUMN IF NOT EXISTS anon_origen_hash TEXT DEFAULT NULL/.test(leer(mig))) F("1 · falta la migración de anon_origen_hash");

    const modos: Array<[string, string, string]> = [
      ["src/app/analisis/[id]/informe-ltr.tsx", "analisis.user_id", "LTR"],
      ["src/app/analisis/renta-corta/[id]/informe-str.tsx", "data.user_id", "STR"],
    ];
    for (const [f, dueno, m] of modos) {
      const s = sc(f);
      const reconoce = new RegExp(`const isOrigenNavegador = !modoDemo && esNavegadorDeOrigen\\(\\{\\s*conSesion: isLoggedIn,\\s*duenoId: ${dueno.replace(".", "\\.")},\\s*origenHash: \\(data as Record<string, unknown>\\)\\.anon_origen_hash as string \\| null \\| undefined,\\s*tokenCookie: anonToken,\\s*\\}\\);`);
      if (!reconoce.test(s)) F(`1 · ${m}: el informe no reconoce al navegador de origen por la cookie contra anon_origen_hash`);
      if (!/\} else if \(isOrigenNavegador\) \{\s*accessLevel = "premium";\s*\} else if \(!isLoggedIn\) \{\s*accessLevel = "guest";/.test(s)) F(`1 · ${m}: su informe en su navegador no se ve completo (o el reconocimiento va después del invitado)`);
      if (!/sha256Hex\(anonToken\) === anonHash;/.test(s) || !/!isLoggedIn && (analisis|data)\.user_id === null && !!anonToken/.test(s)) F(`1 · ${m}: el anónimo-dueño deja de exigir fila sin dueño y cookie que calce`);
    }
    const ltr = sc("src/app/analisis/[id]/informe-ltr.tsx");
    if (!/const isSharedLink = !isLoggedIn && !!analisis\.user_id && !isOrigenNavegador;/.test(ltr)) F("1 · LTR: su navegador sigue contando como enlace compartido");
    if (!/: isOrigenNavegador\s*\? \{ modo: "suyo" \}\s*: accessLevel === "guest" \|\| isAnonOwner/.test(ltr)) F("1 · LTR: el header de su navegador no es «Tu análisis» (o se decide después de «compartido»)");
    if (!/isAnonOwner=\{isAnonOwner\}/.test(ltr)) F("1 · LTR: el informe deja de pasar isAnonOwner tal cual (el ticket del pack volvería a quien ya reclamó)");
    const strC = sc("src/app/analisis/renta-corta/[id]/results-client.tsx");
    if (!/isOrigenNavegador\s*\? \{ modo: "suyo" \}\s*: accessLevel === "guest" \|\| isAnonOwner/.test(strC) || !/isOrigenNavegador,\s*simulacionStr,/.test(sc("src/app/analisis/renta-corta/[id]/informe-str.tsx"))) F("1 · STR: el header de su navegador no es «Tu análisis»");
    const hf = sc("src/components/chrome/HeaderFranco.tsx");
    if (!/if \(modo === "suyo"\) contextoInforme = <span className="hf-ctx hf-solo-ancho"><b>Tu análisis<\/b>Entra para verlo en tu cuenta<\/span>;/.test(hf) || !/\} else if \(modo === "suyo"\) \{\s*derecha = <>\{entrar\}<\/>;/.test(hf)) F("1 · el header «suyo» no dice «Tu análisis» con «Entrar»");
    if (/modo === "suyo"[^\n]*Compartido/.test(hf)) F("1 · el header «suyo» dice «Compartido contigo»");
  }

  // ── 2 · el pago se verifica sin sesión, con la firma ─────────────────────────
  {
    const S = "secreto-de-prueba-de-32-caracteres!";
    const f1 = firmaPago("franco-orden-1", S);
    if (f1.length !== LARGO_FIRMA_PAGO || !/^[A-Za-z0-9_-]+$/.test(f1) || firmaPago("franco-orden-1", S) !== f1) F("2 · la firma no es estable, del largo fijo y segura para la URL");
    if (firmaPago("franco-orden-2", S) === f1 || firmaPago("franco-orden-1", S + "x") === f1) F("2 · la firma no depende de la orden y del secreto");
    const otra = (f1[0] === "A" ? "B" : "A") + f1.slice(1);
    const validas: Array<[string | null, string | null, string | null, boolean, string]> = [
      ["franco-orden-1", f1, S, true, "la firma de esa orden"],
      ["franco-orden-2", f1, S, false, "la firma de OTRA orden"],
      ["franco-orden-1", otra, S, false, "una firma alterada"],
      ["franco-orden-1", f1.slice(0, 20), S, false, "una firma corta"],
      ["franco-orden-1", f1, null, false, "sin secreto en el servidor"],
      ["franco-orden-1", null, S, false, "sin firma"],
      [null, f1, S, false, "sin orden"],
    ];
    for (const [o, t, s, debe, que] of validas) if (firmaPagoValida(o, t, s) !== debe) F(`2 · ${que} ${debe ? "no valida" : "valida"}`);
    const fp = sc("src/lib/lo-que-sigue/firma-pago.ts");
    if ((fp.match(/process\.env\.[A-Z_]+/g) ?? []).join(",") !== "process.env.SUPABASE_SERVICE_ROLE_KEY" || !/timingSafeEqual\(/.test(fp)) F("2 · la firma usa otro secreto que SUPABASE_SERVICE_ROLE_KEY (variable nueva) o compara sin tiempo constante");

    const u = urlRetornoPack("https://refranco.ai", "franco-orden-1", "11111111-2222-3333-4444-555555555555", "COMPRAR", "ltr", f1);
    const ida = leerRetornoPack(new URL(u).searchParams);
    if (!ida || ida.firma !== f1 || ida.order !== "franco-orden-1") F("2 · la firma no va y vuelve en la URL de retorno del pack");
    if (leerRetornoPack(new URL(u.replace(f1, "x<y")).searchParams)?.firma !== null) F("2 · una firma con forma inválida se lee igual");
    for (const [f, re] of [
      ["src/app/api/lo-que-sigue/pack/route.ts", /urlRetornoPack\([^;]*, firmarPago\(commerceOrder\)\)/],
      ["src/app/api/payments/create/route.ts", /urlRetornoPack\([^;]*, firmarPago\(commerceOrder\)\)/],
      ["src/app/api/payments/confirm/route.ts", /urlRetornoPack\([^;]*, firmarPago\(payment\.commerce_order\)\)/],
    ] as const) if (!re.test(sc(f))) F(`2 · ${f} arma la URL de retorno del pack sin la firma`);

    const st = sc("src/app/api/payments/status/route.ts");
    const get = (st.match(/export async function GET[\s\S]*?\n\}/) ?? [""])[0];
    const i401 = get.search(/if \(!user && !firmaPagoValida\(commerceOrder, firma\)\) \{\s*return NextResponse\.json\(\{ error: "No autenticado" \}, \{ status: 401 \}\);/);
    const iLee = get.search(/\.from\("payments"\)/);
    if (i401 < 0 || iLee < 0 || i401 > iLee) F("2 · /api/payments/status lee pagos sin sesión y sin firma válida");
    const ramaFirma = (get.match(/if \(acceso === "firma"\) \{[\s\S]*?\n {2}\}/) ?? [""])[0];
    if (!/const payment = \{ commerce_order: fila\.commerce_order, product: fila\.product, amount: fila\.amount, status: fila\.status, analysis_id: fila\.analysis_id \};/.test(ramaFirma) || /payment_data|user_id|email/.test(ramaFirma.replace(/const dueno[^\n]*/, ""))) F("2 · con la firma, el estado del pago trae más que lo justo (payment_data, el dueño o el correo)");
    if (!/sinSesion: true, \.\.\.\(fila\.status === "paid" \? await saldoDe\(admin, dueno\) : \{\}\)/.test(ramaFirma)) F("2 · con la firma, el saldo sale aunque el pago no esté pagado (o no sale)");
    if (!/if \(nivel === "subscriber"\) return \{ saldo: 0, ilimitado: true \};\s*return \{ saldo: await getAvailableCredits\(userId, admin\), ilimitado: false \};/.test(st)) F("2 · el saldo no es el real (ledger + legacy, ilimitado para la suscripción)");

    const accesos: Array<[Parameters<typeof accesoAlPago>[0], string]> = [
      [{ sesionUserId: null, duenoPago: "u1", firmaValida: true }, "firma"],
      [{ sesionUserId: null, duenoPago: "u1", firmaValida: false }, "sin_datos"],
      [{ sesionUserId: null, duenoPago: null, firmaValida: true }, "sin_datos"],
      [{ sesionUserId: null, duenoPago: undefined, firmaValida: true }, "sin_datos"],
      [{ sesionUserId: "u1", duenoPago: "u1", firmaValida: false }, "propio"],
      [{ sesionUserId: "u2", duenoPago: "u1", firmaValida: true }, "otra_cuenta"],
      [{ sesionUserId: "u2", duenoPago: "u1", firmaValida: false }, "otra_cuenta"],
      [{ sesionUserId: "u1", duenoPago: undefined, firmaValida: false }, "no_existe"],
    ];
    for (const [e, debe] of accesos) if (accesoAlPago(e) !== debe) F(`2/3 · ${JSON.stringify(e)} da «${accesoAlPago(e)}», no «${debe}»`);
    if (estadoDelPago("paid") !== "paid" || estadoDelPago("rejected") !== "error" || estadoDelPago("cancelled") !== "error" || estadoDelPago("pending") !== "pending" || estadoDelPago(undefined) !== "pending") F("2 · el estado del pago se lee mal (un rechazado no dice que no pasó)");

    const ret = sc("src/app/payments/return/page.tsx");
    if (!/const llavePago: LlavePago \| null = retornoPack\?\.firma && order \? \{ order, firma: retornoPack\.firma \} : null;/.test(ret) || !/fetch\(order \? `\/api\/payments\/status\?order=\$\{encodeURIComponent\(order\)\}\$\{firma\}` : "\/api\/payments\/status"\)/.test(ret)) F("2 · la pantalla de después de pagar no manda la firma al pedir el estado");
    if (!/\{paymentStatus === "error" && retornoPack && \(\s*<div [^>]*data-lqs="retorno-pack-no-paso">/.test(ret) || !/\{PAGO_PACK_NO_PASO\.titulo\}/.test(ret)) F("2 · el pack rechazado sin sesión no dice que el pago no pasó");
    if (!/\{paymentStatus === "sin_sesion" && \(/.test(ret) || /\{!retornoPack && paymentStatus === "sin_sesion"/.test(ret)) F("2 · sin sesión ni firma, el pack no cae a la pantalla de entrar");
  }

  // ── 3 · el pago de otra cuenta lo dice ─────────────────────────────────────
  {
    if (PAGO_OTRA_CUENTA.titulo !== "Este pago es de otra cuenta." || PAGO_OTRA_CUENTA.cuerpo !== "Entra con el correo con que pagaste." || PAGO_OTRA_CUENTA.boton !== "Entrar con otro correo") F("3 · el copy del pago de otra cuenta no es el aprobado");
    const st = sc("src/app/api/payments/status/route.ts");
    if (!/if \(acceso === "otra_cuenta"\) return NextResponse\.json\(\{ payment: null, otraCuenta: true \}\);/.test(st)) F("3 · /api/payments/status no avisa que el pago es de otra cuenta");
    const ret = sc("src/app/payments/return/page.tsx");
    const iOtra = ret.search(/if \(data\.otraCuenta\) \{\s*setPaymentStatus\("otra_cuenta"\);\s*return;\s*\}/);
    const iPago = ret.search(/if \(data\.payment\) \{/);
    if (iOtra < 0 || iPago < 0 || iOtra > iPago) F("3 · la pantalla no corta en «otra cuenta» antes de esperar el pago (queda cargando)");
    if (!/\{paymentStatus === "otra_cuenta" && \([\s\S]{0,200}?\{PAGO_OTRA_CUENTA\.titulo\}[\s\S]{0,200}?\{PAGO_OTRA_CUENTA\.cuerpo\}[\s\S]{0,300}?onClick=\{entrarConOtroCorreo\}[\s\S]{0,300}?\{PAGO_OTRA_CUENTA\.boton\}/.test(ret)) F("3 · la pantalla de otra cuenta no dice qué pasa o no da la acción de entrar con otro correo");
    if (!/async function entrarConOtroCorreo\(\) \{\s*try \{ await createClient\(\)\.auth\.signOut\(\); \}[^\n]*\n\s*window\.location\.assign\(hrefEntrar\(volverAca, "pack"\)\);/.test(ret)) F("3 · «Entrar con otro correo» no cierra la sesión ni vuelve a este pago");
  }

  // ── 6 · renta corta: el correo de listo y la línea del código ───────────────
  {
    const stR = sc("src/app/api/analisis/short-term/route.ts");
    if (!/if \(data\?\.id && user\?\.email && !ambasGroupId\) \{[\s\S]{0,700}?waitUntil\(sendAnalysisReadyEmail\(para, nombrePersona, titulo, Number\(data\.score\) \|\| 0, veredictoStr, data\.id as string, undefined, \{ userId: user\.id \}\)\);/.test(stR)) F("6 · el STR creado con sesión no manda «Tu análisis está listo» (o lo manda también en AMBAS)");
    const em = sc("src/lib/email.ts");
    const fn = (em.match(/export async function sendPaymentConfirmationEmail[\s\S]*?\n\}/) ?? [""])[0];
    if (!/const lineaCodigo = product === 'pack3' \? \[LINEA_CODIGO_PACK\] : null;/.test(fn) || !/\.\.\.\(lineaCodigo \? \{ despues: lineaCodigo \} : \{\}\)/.test(fn)) F("6 · el pago confirmado del pack de renta corta no dice cómo entrar (la línea depende de la guía)");
    if (/despues: \[[^\]]*\] \} : \{\}\)/.test(fn.replace(/\.\.\.\(lineaCodigo[^\n]*/, "")) || /guia \? \{ despues/.test(fn)) F("6 · la línea del código vuelve a colgar de la guía");
  }

  // ── 7 · el precio del pack, solo en el ticket ──────────────────────────────
  {
    if (Object.keys(LISTA_BLANCA_PRECIO_PACK).length !== 12) F("7 · la lista blanca del precio del pack cambió (agregar un lugar es una decisión de Fabrizio, no del código)");
    for (const f of Object.keys(LISTA_BLANCA_PRECIO_PACK)) if (!existsSync(join(RAIZ, f))) F(`7 · la lista blanca nombra un archivo que no existe: ${f}`);
    if (!PRECIO_PACK.some((re) => re.test(sc("src/components/lo-que-sigue/TicketPack.tsx")))) F("7 · el barrido no ve el precio ni en el ticket (el patrón se rompió)");
    for (const f of archivosSrc()) {
      if (LISTA_BLANCA_PRECIO_PACK[f]) continue;
      const s = sc(f);
      const hit = PRECIO_PACK.find((re) => re.test(s));
      if (hit) F(`7 · el precio del pack aparece fuera del ticket: ${f} (${String(hit).slice(0, 40)}…)`);
    }
  }

  if (fallas.length) {
    console.log(`  ✗ PAGO-SIN-SESION · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — su informe se ve completo en su navegador y compartido en otro; el pago se verifica con la firma y sin ella no hay datos; el de otra cuenta lo dice; el STR avisa que está listo y todo pack dice cómo entrar; el precio del pack, solo en el ticket");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES (02-oct-2026) ─────────────────────────────────────────────
// 26/26 en rojo a la primera, restauradas byte a byte (sha256 antes y después; scratchpad/mutar.py):
//   1 · P1 con sesión se reconoce el navegador · P2 no compara la cookie · P3 el claim no conserva el hash ·
//       P4 LTR: su navegador no ve completo · P5 LTR: sigue como enlace compartido · P6 LTR: header compartido ·
//       P7 el header «suyo» dice «Compartido contigo» · P8 STR compara contra anon_claim_token_hash.
//   2 · P9 la firma con CRON_SECRET (variable que no está en todos los entornos) · P10 la firma no depende de la
//       orden · P11 valida cualquier firma del largo · P12 status sin el 401 · P13 con la firma devuelve la fila
//       entera · P17 el ticket sin firma · P18 el correo sin firma · P25 el pack rechazado no lo dice.
//   3 · P14 la firma le gana a la sesión de otra cuenta · P15 status no avisa «otra cuenta» · P16 la pantalla
//       no corta en «otra cuenta» · P26 «Entrar con otro correo» sin cerrar la sesión.
//   6 · P19 el STR manda «listo» también en AMBAS (duplicado con el LTR) · P20 la línea del código cuelga de la
//       guía (el pack de renta corta queda sin ella).
//   7 · P21 «3 análisis · $14.990» en DespuesDePagar · P22 PACK_PRECIO_CLP en GuiaBusqueda · P23
//       FLOW_PRODUCTS.pack3.amount en /cuenta · P24 la lista blanca crece.

if (require.main === module) {
  runPagoSinSesionTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
