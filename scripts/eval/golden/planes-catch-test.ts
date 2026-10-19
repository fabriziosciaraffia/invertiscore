// ============================================================================
// GOLDEN · PLANES (19-oct-2026) — catch-test
// ============================================================================
//   La oferta (decisión de Fabrizio, 19-oct-2026; src/lib/planes.ts):
//   1 · CUATRO PRODUCTOS Y NADA MÁS: el suelto $9.990 (en segundo plano), el ticket de 24 h 3 × $14.990, el pack
//       3 × $19.990 y el Plan Franco, 20 análisis al mes por $39.990 (el producto plan10_mensual de Flow: mismo planId,
//       mismo monto). El plan de 50, el ilimitado, los anuales y el informe completo de $4.990 dejan de venderse.
//   2 · LO RETIRADO NO SE COMPRA, NI ENTRANDO DIRECTO: payments/create, subscriptions/create y register-callback lo
//       rechazan; el checkout no lo muestra; el carrito abandonado no lo recupera; el anexo AMBAS ya no cobra el
//       desbloqueo. Y LO YA COMPRADO SE RESPETA: lo retirado sigue en el catálogo de Flow (renueva y otorga).
//   3 · EL AUMENTO: el cobro de la renovación otorga 20; el correo «Tu plan ahora trae 20» sale UNA vez, en el cobro que
//       da el primer lote de 20 a quien venía de lotes de 10, y nunca rompe el cobro.
//   4 · LA PÁGINA DE PLANES: tres columnas —gratis, pack, plan—, un botón cada una, el pack con el material del banner y
//       el suelto como línea bajo él, serif solo en el título, el pie de los informes; sin nada retirado.
//   5 · LA CUENTA: plana —el correo; el plan o el saldo, con las compras; el perfil; cómo entras; darte de baja—; los
//       correos se apagan y prenden con sesión, escribiendo lo mismo que el enlace de baja.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/planes-catch-test.ts
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FLOW_PRODUCTS } from "../../../src/lib/flow-products";
import {
  AUMENTO_COPY, PLAN_ANALISIS_MES, PLAN_PRECIO_CLP, PLANES_COPY, PRODUCTO_PLAN, RUTA_PLAN, VENTA_RETIRADA, correspondeAvisoAumento, nombrePlan, seVende,
} from "../../../src/lib/planes";
import { TRES_PRECIO_CLP } from "../../../src/lib/tres-analisis";
import { PACK_PRECIO_CLP } from "../../../src/lib/lo-que-sigue/oferta-pack";
import { SINGLE_PRICE } from "../../../src/lib/pricing";
import { correoPlanAumento } from "../../../src/lib/email/correos";
import { CUENTA_COPY, etiquetaCompra } from "../../../src/app/cuenta/cuenta-copy";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const VOSEO = /(^|[^a-záéíóúñ])(dejás|tenés|querés|podés|sabés|mirá|tomá|entrá|seguí|registrate|guardá|revisá|poné|compará|elegí|tocá|pedí|escribí|analizá|empezá|cambialo|cancelá|vos)(?![a-záéíóúñ])/i;

export function runPlanesTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER PLANES (la oferta del 19-oct-2026: cuatro productos, el Plan Franco de 20, la página de planes y la cuenta · 0 tokens) ───");

  // 1 · los cuatro productos, con sus precios
  if (FLOW_PRODUCTS.single.amount !== 9_990 || SINGLE_PRICE !== 9_990) F("1 · el suelto no cuesta $9.990");
  if (FLOW_PRODUCTS.pack3.amount !== 14_990 || PACK_PRECIO_CLP !== 14_990 || FLOW_PRODUCTS.pack3.capacity !== 3) F("1 · el ticket de 24 h no es 3 por $14.990");
  if (FLOW_PRODUCTS.tres_analisis.amount !== 19_990 || TRES_PRECIO_CLP !== 19_990 || FLOW_PRODUCTS.tres_analisis.capacity !== 3) F("1 · el pack no es 3 por $19.990");
  const plan = FLOW_PRODUCTS.plan10_mensual;
  if (PRODUCTO_PLAN !== "plan10_mensual" || plan.amount !== 39_990 || plan.capacity !== 20 || PLAN_ANALISIS_MES !== 20 || PLAN_PRECIO_CLP !== 39_990) F("1 · el Plan Franco no es 20 análisis al mes por $39.990 (sobre plan10_mensual)");
  if (plan.planId !== "franco_plan10_mensual" || plan.billing !== "monthly" || plan.plan !== "plan10" || plan.isUnlimited) F("1 · el Plan Franco cambió de planId o de plan persistido: la suscripción de quien ya lo tiene no renovaría a 20");
  const seVenden = (Object.keys(FLOW_PRODUCTS) as Array<keyof typeof FLOW_PRODUCTS>).filter((k) => seVende(k)).sort().join(",");
  if (seVenden !== ["pack3", "plan10_mensual", "single", "tres_analisis"].join(",")) F(`1 · lo que se vende no son los cuatro productos: ${seVenden}`);
  if ([...VENTA_RETIRADA].sort().join(",") !== ["plan10_annual", "plan50_annual", "plan50_mensual", "unlimited_annual", "unlimited_mensual", "unlock"].join(",")) F("1 · la lista de lo retirado no es el plan de 50, el ilimitado, los anuales y el informe completo");
  if (seVende("pro") || seVende("subscription")) F("1 · se venden productos que no están en el catálogo");

  // 2 · lo retirado no se compra; lo comprado se respeta
  for (const k of VENTA_RETIRADA) if (!(k in FLOW_PRODUCTS)) F(`2 · ${k} salió del catálogo: una suscripción vigente no resolvería su producto al renovar`);
  const pc = sinComentarios(leer("src/app/api/payments/create/route.ts"));
  if (!/if \(!seVende\(product\)\) \{\s*return NextResponse\.json\(\{ error: "Este producto ya no se vende" \}, \{ status: 410 \}\);/.test(pc)) F("2 · payments/create vende el informe completo o el «pro» legado");
  const sc = sinComentarios(leer("src/app/api/subscriptions/create/route.ts"));
  if (!/if \(!seVende\(product\)\) \{\s*return NextResponse\.json\(\{ error: "Este plan ya no se vende" \}, \{ status: 410 \}\);/.test(sc)) F("2 · subscriptions/create acepta planes retirados");
  const rc = sinComentarios(leer("src/app/api/subscriptions/register-callback/route.ts"));
  const iSeVende = rc.indexOf("if (!seVende(match.key))"), iAlta = rc.indexOf('flowPost("subscription/create"');
  if (iSeVende < 0 || iAlta < iSeVende) F("2 · register-callback activa un plan retirado iniciado antes del corte");
  const ck = sinComentarios(leer("src/app/checkout/page.tsx"));
  if (!/if \(!p \|\| !seVende\(key\)\) return null;/.test(ck)) F("2 · el checkout muestra una tarjeta de compra de un producto retirado");
  // Sin sesión, un producto retirado no manda a registrarse para después decir «Plan no encontrado».
  if (!/const sinProducto = !product;\s*useEffect\(\(\) => \{\s*if \(sinProducto\) return;\s*const supabase = createClient\(\);/.test(ck)) F("2 · el checkout de un producto retirado pide entrar antes de decir que no existe");
  if (!/productosRecuperables\(Object\.keys\(FLOW_PRODUCTS\) as FlowProductKey\[\]\)\.filter\(seVende\)/.test(sinComentarios(leer("src/app/api/cron/abandoned-checkout/route.ts")))) F("2 · el carrito abandonado invita a retomar la compra de un producto retirado");
  const anexo = sinComentarios(leer("src/components/comparativa/ResumenAnexoModal.tsx"));
  if (/product: "unlock"|\$4\.990|4990/.test(anexo)) F("2 · el anexo AMBAS vuelve a vender el informe completo");
  if (existsSync(join(RAIZ, "src/app/api/payment/create/route.ts"))) F("2 · vuelve api/payment/create, que marcaba premium un análisis sin cobrar");
  const confirm = sinComentarios(leer("src/app/api/payments/confirm/route.ts"));
  if (!/"unlock"/.test(confirm)) F("2 · payments/confirm ya no aplica un desbloqueo ya pagado (lo comprado se respeta)");

  // 3 · el aumento
  if (!correspondeAvisoAumento([10, 10, 10, 20]) || correspondeAvisoAumento([10, 10, 10, 20, 20]) || correspondeAvisoAumento([20]) || correspondeAvisoAumento([10, 10]))
    F("3 · el aviso del aumento no sale exactamente una vez, al primer lote de 20 de quien venía de 10");
  const pcg = sinComentarios(leer("src/lib/subscriptions/process-charge.ts"));
  if (!/grantCredits\(userId, match\.key, match\.product\.capacity \?\? 0,/.test(pcg)) F("3 · la renovación no otorga la capacidad del catálogo");
  if (!/if \(granted && match\?\.key === PRODUCTO_PLAN && userEmail\) \{\s*try \{[\s\S]{0,400}correspondeAvisoAumento\([\s\S]{0,300}sendPlanAumentoEmail\(/.test(pcg) || !/\} catch \(e\) \{\s*console\.error\("\[processSubscriptionCharge\] aviso del aumento falló:", e\);/.test(pcg))
    F("3 · el correo del aumento no sale solo cuando el cobro otorgó, o puede romper el cobro");
  const correo = correoPlanAumento({ nombre: "Camila", precio: "$39.990" });
  if (correo.subject !== "Tu plan ahora trae 20 análisis al mes" || !correo.html.includes("20 análisis al mes, el doble, al mismo precio: $39.990") || !correo.html.includes("/analisis/nuevo-v4"))
    F(`3 · el correo no lo cuenta como aumento al mismo precio: ${correo.subject}`);
  if (!/"plan_aumento"/.test(leer("src/lib/medicion-correo.ts")) || !/id: "plan_aumento"/.test(leer("src/lib/email/catalogo.ts"))) F("3 · el correo del aumento no se mide o no está en el catálogo de correos");

  // 4 · la página de planes
  const pag = sinComentarios(leer("src/app/pricing/page.tsx"));
  const css = leer("src/app/pricing/planes.css");
  const cols = Array.from(pag.matchAll(/<section className="pl-col[^"]*" data-planes="(\w+)">/g)).map((m) => m[1]).join(",");
  if (cols !== "gratis,pack,plan") F(`4 · las columnas no son gratis, pack y plan, en ese orden (${cols})`);
  const seccion = (k: string) => { const i = pag.indexOf(`data-planes="${k}"`); const j = pag.indexOf("</section>", i); return i < 0 ? "" : pag.slice(i, j); };
  // Un botón por columna. Gratis tiene dos ALTERNATIVAS (con sesión / sin sesión) y el plan una (comprar / ya lo tienes),
  // así que se cuenta por columna lo que esperamos exacto: 2 en gratis, 1 en el pack, 1 + su estado en el plan.
  const cuenta = (s: string, re: RegExp) => (s.match(re) ?? []).length;
  if (cuenta(seccion("gratis"), /className="pl-boton[^"]*"/g) !== 2 || cuenta(seccion("gratis"), /data-planes="boton-gratis"/g) !== 2) F("4 · la columna gratis no tiene un botón (por caso de sesión)");
  if (cuenta(seccion("pack"), /className="pl-boton[^"]*"/g) !== 1) F("4 · la columna del pack no tiene exactamente un botón");
  if (cuenta(seccion("plan"), /className="pl-boton[^"]*"/g) !== 1 || cuenta(seccion("plan"), /className="pl-estado"/g) !== 1) F("4 · la columna del plan no tiene exactamente un botón (o su estado para quien ya lo tiene)");
  if (!/className="pl-col pl-pack"/.test(pag) || !/\.pl-pack \{[^}]*background: #1F3D67 url\("\/landing\/hero-m2x\.webp"\)/.test(css) || !/\.pl-pack::after \{[^}]*grano-256\.png/.test(css) || !/\.pl-pack \.pl-boton \{ background: #FAFAF8; color: #0F0F0F; \}/.test(css)) F("4 · el pack no va destacado con el material del banner");
  // ⚠ ACTA (19-oct-2026, segunda pasada de Fabrizio) · el suelto pasa de enlace a botón secundario de borde fino, del
  // mismo ancho que el del pack, con «Comprar solo 1 por $9.990».
  if (!/<EnlaceCarga href=\{RUTA_SUELTO_PLANES\} className="pl-secundario" data-planes="suelto">\{C\.pack\.suelto\}/.test(seccion("pack")) || PLANES_COPY.pack.suelto !== "Comprar solo 1 por $9.990"
    || !/\.pl-secundario \{[^}]*width: 100%;[^}]*border: 1px solid rgba\(250, 250, 248, 0\.55\);[^}]*font-weight: 500;/.test(css)) F("4 · el suelto no es un botón secundario de borde fino y del mismo ancho, «Comprar solo 1 por $9.990»");
  if (!/href=\{rutaTres\("planes"/.test(seccion("pack")) || !/href=\{RUTA_PLAN\}/.test(seccion("plan")) || RUTA_PLAN !== "/checkout?product=plan10_mensual") F("4 · los botones del pack o del plan no van a su compra");
  if (!/\{conPlan \? \(\s*<EnlaceCarga href="\/cuenta" className="pl-estado"/.test(seccion("plan"))) F("4 · a quien ya tiene un plan se le vuelve a vender");
  if ((css.match(/font-heading/g) ?? []).length !== 1 || !/\.pl-titulo \{[^}]*font-family: var\(--font-heading\)/.test(css) || !/^\.pl \{[^}]*font-family: var\(--font-ui\)/m.test(css)) F("4 · hay serif fuera del título (o la página no va en Inter)");
  if (!/<AppFooter variant="informe" \/>/.test(pag)) F("4 · el pie no es el limpio de los informes");
  const visible = [JSON.stringify(PLANES_COPY), pag].join("\n");
  if (/Plan 50|Ilimitado|ilimitad|anual|4\.990|Informe completo|PRICING_PLANS|PricingPlans|SavingsCalculator/.test(visible)) F("4 · la página de planes muestra algo retirado");
  if (existsSync(join(RAIZ, "src/components/landing/PricingPlans.tsx")) || existsSync(join(RAIZ, "src/components/landing/SavingsCalculator.tsx"))) F("4 · vuelven las cuatro cards o la calculadora de ahorro");
  // LOS TEXTOS (19-oct-2026, segunda pasada de Fabrizio), exactos.
  const C = PLANES_COPY;
  const exactos4: Array<[string, string]> = [
    [C.bajada, "Con cualquiera de los tres recibes cada semana los deptos que convienen según tu perfil. La diferencia es cuántos análisis tienes para los que te interesan."],
    [C.gratis.incluye.join(" | "), "Cada semana, los deptos que convienen según tu perfil | Un análisis gratis al crear tu cuenta | Un análisis más por cada amigo que invites"],
    [C.pack.nombre, "Pack de 3"], [C.pack.detalle, "Todo lo de Gratis, más 3 análisis"], [`${C.pack.precio} ${C.pack.unidad}`, "$19.990 pago único"],
    [C.pack.ahorro, "$6.663 cada uno, en vez de $9.990"], [C.pack.condicion, "No vencen"], [C.pack.boton, "Comprar el pack"],
    [C.plan.detalle, "Todo lo de Gratis, más 20 análisis cada mes"], [`${C.plan.precio} ${C.plan.unidad}`, "$39.990 al mes"],
    [C.plan.ahorro, "$2.000 cada uno, en vez de $9.990"],
    [C.plan.condicion, "Los que no uses se acumulan por un año. Cancelas cuando quieras"], [C.plan.boton, "Contratar el plan"],
    [`${C.demo.antes} ${C.demo.enlace}`, "¿Quieres ver cómo es un análisis? Mira uno real"],
  ];
  for (const [real, esperado] of exactos4) if (real !== esperado) F(`4 · «${real}» debía ser «${esperado}»`);
  if (/El informe de cada análisis/.test(JSON.stringify(C))) F("4 · vuelve «El informe de cada análisis»");
  // ⚠ ACTA (19-oct-2026, tercera pasada de Fabrizio) · la cifra grande es LO QUE SE PAGA y la línea de abajo hace la cuenta
  // del ahorro. Las dos cifras salen del catálogo, no escritas a mano, y el ahorro va bajo el precio en las dos.
  const planesTs = sinComentarios(leer("src/lib/planes.ts"));
  if (!/precio: fmtCLP\(TRES_PRECIO_CLP\),/.test(planesTs) || !/precio: fmtCLP\(PLAN_PRECIO_CLP\),/.test(planesTs)
    || !/ahorro: `\$\{porAnalisis\(TRES_PRECIO_CLP, 3\)\} cada uno, en vez de \$\{fmtCLP\(SUELTO_CLP\)\}`/.test(planesTs)
    || !/ahorro: `\$\{porAnalisis\(PLAN_PRECIO_CLP, PLAN_ANALISIS_MES\)\} cada uno, en vez de \$\{fmtCLP\(SUELTO_CLP\)\}`/.test(planesTs)) F("4 · el precio o el ahorro no salen del catálogo");
  if (!/<span className="pl-monto">\{C\.pack\.precio\}<\/span><span className="pl-unidad">\{C\.pack\.unidad\}<\/span><\/p>\s*<p className="pl-ahorro">\{C\.pack\.ahorro\}<\/p>/.test(seccion("pack"))
    || !/<span className="pl-monto">\{C\.plan\.precio\}<\/span><span className="pl-unidad">\{C\.plan\.unidad\}<\/span><\/p>\s*<p className="pl-ahorro">\{C\.plan\.ahorro\}<\/p>/.test(seccion("plan"))) F("4 · lo grande no es lo que se paga, o el ahorro no va justo debajo");
  // Las dos pagadas, la MISMA estructura, y la cifra con el mismo peso (la misma clase, sin pisarla en el pack).
  const estructura = (k: string) => Array.from(seccion(k).matchAll(/className="(pl-[a-z]+)/g)).map((m) => m[1]).filter((c) => c !== "pl-secundario" && c !== "pl-estado").join(">");
  if (estructura("pack") !== estructura("plan") || !/pl-nombre>pl-detalle>pl-precio>pl-monto>pl-unidad>pl-ahorro>pl-condicion>pl-accion>pl-boton/.test(estructura("pack"))) F(`4 · las dos tarjetas pagadas no tienen la misma estructura (${estructura("pack")} / ${estructura("plan")})`);
  if (/\.pl-pack \.pl-monto|\.pl-pack \.pl-precio/.test(css)) F("4 · el precio del pack pesa distinto que el del plan");
  // Y se leen igual: en columnas lo que suman ocupa dos líneas, así los dos precios quedan a la misma altura (QA del
  // 19-oct-2026: el del plan se cortaba en dos y el del pack no).
  if (!/@media \(min-width: 768px\) \{ \.pl-detalle \{ min-height: 2\.7em; \} \}/.test(css)) F("4 · el precio del pack y el del plan quedan a distinta altura");
  // Sin describir qué trae el análisis; para eso, el demo.
  if (/veredicto|comparables|los números|proyecci|escenario/i.test(JSON.stringify(C) + pag)) F("4 · la página describe qué trae el análisis");
  if (!/<p className="pl-nota" data-planes="demo">\s*\{C\.demo\.antes\} <EnlaceCarga href=\{C\.demo\.ruta\}>\{C\.demo\.enlace\}<\/EnlaceCarga>/.test(pag) || C.demo.ruta !== "/demo" || !existsSync(join(RAIZ, "src/app/demo/page.tsx"))) F("4 · bajo las tarjetas no está «Mira uno real» con el enlace al demo");
  if (PLANES_COPY.plan.resumen !== "20 análisis al mes") F("4 · la cuenta no dice «20 análisis al mes»");

  // 5 · la cuenta
  const cta = sinComentarios(leer("src/app/cuenta/page.tsx"));
  const orden = ['data-cuenta="correo"', "data-cuenta={plan ?", "<PerfilBusquedaCasa", 'data-cuenta="entrar"', 'data-cuenta="baja"'].map((t) => cta.indexOf(t));
  if (orden.some((i) => i < 0) || orden.some((i, k) => k > 0 && i < orden[k - 1])) F(`5 · la cuenta no es correo → plan o saldo → perfil → cómo entras → darte de baja (${orden.join(",")})`);
  if (!/<CorreosCuenta inicial=\{correos\} \/>/.test(cta) || !/<DeleteAccountButton \/>/.test(cta) || !/\{activo && <CancelSubscriptionButton \/>\}/.test(cta)) F("5 · darse de baja no ofrece los correos, eliminar la cuenta o cancelar el plan");
  if (!/const conGoogle = \(user\.identities \?\? \[\]\)\.some\(\(i\) => i\.provider === "google"\);/.test(cta) || !/COMO_ENTRAR/.test(leer("src/app/cuenta/cuenta-copy.ts"))) F("5 · «cómo entras» no dice el código ni Google");
  if (/rounded-lg border|bg-\[var\(--franco-card\)\] p-6|StatusBadge|font-mono/.test(cta)) F("5 · la cuenta vuelve a las tarjetas, las insignias o el mono: no es plana");
  const ruta = sinComentarios(leer("src/app/api/cuenta/correos/route.ts"));
  if (!/if \(!user\) return NextResponse\.json\(\{ error: "Sin sesión" \}, \{ status: 401 \}\);/.test(ruta) || !/const COLUMNA = \{ semanal: "semanal_baja_at", inmediato: "inmediato_baja_at" \} as const;/.test(ruta) || !/\[COLUMNA\[correo\]\]: body\.recibe \? null : new Date\(\)\.toISOString\(\)/.test(ruta) || !/upsert\(\{ user_id: user\.id,/.test(ruta)) F("5 · los correos de la cuenta no escriben lo mismo que el enlace de baja, o sin sesión");
  if (nombrePlan("plan10", false) !== "Plan Franco" || nombrePlan("plan50", false) !== "Plan 50" || nombrePlan(null, true) !== "Plan Ilimitado" || etiquetaCompra("plan10_mensual") !== "Plan Franco" || etiquetaCompra("tres_analisis") !== "3 análisis") F("5 · el plan o las compras no se nombran como la oferta (o quien tiene un plan retirado no lo ve con su nombre)");
  const dialogo = sinComentarios(leer("src/app/cuenta/cancel-dialog.tsx"));
  if (/Pro|Free|signal-red\]? bg-transparent|border-signal-red/.test(dialogo) || CUENTA_COPY.cancelar.texto !== "No se renueva más. Los análisis que ya tienes siguen vigentes hasta que vencen.") F("5 · cancelar habla de «Pro» y «Free» o va en rojo");

  // 6 · voz
  const textos = [AUMENTO_COPY.asunto, AUMENTO_COPY.cuerpo("$39.990"), AUMENTO_COPY.acumulan, ...Object.values(PLANES_COPY).flatMap((v) => (typeof v === "string" ? [v] : Object.values(v).flatMap((x) => (Array.isArray(x) ? x : [String(x)])))), JSON.stringify(CUENTA_COPY)];
  for (const t of textos) if (VOSEO.test(t)) F(`6 · voseo: «${t.slice(0, 80)}»`);

  if (fallas.length === 0) console.log("  ✓ VERDE — cuatro productos y nada más; lo retirado no se compra ni entrando directo, y lo comprado sigue; el Plan Franco de 20 con su correo de aumento una vez; tres columnas con el pack destacado y el suelto debajo; la cuenta plana con los correos, el plan y la baja");
  for (const f of fallas) console.log(`  ✗ ${f}`);
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runPlanesTier();
  process.exit(hard > 0 ? 1 : 0);
}

// ─── ACTA · verificado EN ROJO por mutación (19-oct-2026) ────────────────────
//   Mutaciones (scratchpad mutar-planes.cjs), cada archivo restaurado byte a byte:
//   N1 el plan vuelve a 10 · N2 se vende el plan de 50 · N26 el plan cambia de planId (§1)
//   N3 payments/create sin el corte · N4 subscriptions/create sin el corte · N5 register-callback activa lo retirado · N6 el
//   checkout lo muestra · N7 el carrito abandonado lo recupera · N8 el anexo vuelve a vender el informe completo (§2)
//   N9 el aumento se avisa cada mes · N10 aunque el cobro no otorgue · N11 el correo no lo cuenta como aumento · N27 el
//   aviso rompe el cobro (§3)
//   N12 otra columna · N13 el pack sin el banner · N14 sin el suelto · N15 dos botones en el plan · N31 dos en el pack · N32
//   gratis sin botón con sesión · N16 al que tiene plan se le vuelve a vender · N17 serif en la columna · N18 el pie con
//   enlaces · N25 gratis sin el regalo · N28 el botón del pack va a otra compra (§4)
//   N19 sin «cómo entras» · N20 sin los correos · N21 volver a recibir no borra la baja · N22 vuelve la tarjeta · N23
//   cancelar vuelve a «Pro» · N24 el de 10 se llama «Plan 10» · N29 sin cancelar el plan · N30 sin Google (§5)
//   N33 lo retirado pide entrar antes de decir que no existe (§2, del QA en el preview).
//   33/33 ROJO. N15 salió VERDE la primera vez: el chequeo de «un botón» pedía TRES apariciones para fallar (una rama
//   laxa); se reescribió por columna, con el número exacto, y quedó ROJO.
//   Segunda pasada (los textos de Fabrizio, mismo día): P1 otra línea arriba · P2 vuelve «El informe de cada análisis» ·
//   P3 el precio del pack escrito a mano · P4 el pack esconde el total · P5 el plan con otra estructura · P6 el precio del
//   pack pesa distinto · P7 el pack describe el análisis · P8 sin el enlace al demo · P9 el secundario con borde grueso ·
//   P10 el secundario angosto · P11 otra condición del plan · P12 el precio del plan sobre otro número · P13 la página
//   describe el análisis fuera del copy · P15 los precios a distinta altura (§4). N14 y N31 se reescribieron sobre el
//   botón secundario.
//   Tercera pasada (lo grande es lo que se paga; el ahorro, debajo): P3, P4, P5 y P12 reescritos sobre `ahorro` · P14 lo
//   grande vuelve a ser el precio por análisis · P16 el plan muestra grande el ahorro · P17 el ahorro del pack sobre el
//   precio · P18 el pack vuelve a llamarse «Pack» (con «Pack de 3» se lee a la primera que son tres). 51/51 ROJO, con
//   AFFORDANCE y LO-QUE-SIGUE (AF1, AF2, LQ1) también en ROJO.
