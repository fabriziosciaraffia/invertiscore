// ============================================================================
// GOLDEN · SEMANAL (02-oct-2026) — catch-test
// ============================================================================
//   El correo semanal y el regalo (decisiones de Fabrizio):
//   1 · LA SELECCIÓN: solo Comprar con los números de la persona, por puntaje; la ficha se chequea de a
//       uno y se para en CINCO publicados; con menos de TRES no hay correo; si faltó cupo, «pendiente».
//   2 · DOMINGO ARMA, LUNES SALE: la semana es el lunes del envío; los crons en vercel.json y vigilados.
//   3 · EL REGALO: a los 14 días sin compras ni plan, una vez por persona (marca condicional antes del
//       crédito), con «El próximo que analices va por cuenta de Franco.»; vence a los 60 días.
//   4 · EL CORREO: el titular, las dos variantes (banda con el hero como imagen y alt; tarjetas sin
//       banda), cada depto una tarjeta con el precio grande y el veredicto en su color, el botón rojo
//       «Analizar uno · $9.990» sin saldo (al suelto, nunca al pack) y «Analizar uno» con saldo; la baja.
//       Sin «oportunidades», «portafolio» ni «exclusivo».
//   5 · UNA VEZ: la fila se toma antes de mandar y se suelta si Resend falla; solo con tres vigentes.
//   6 · EL CLIC relee la ficha; «Analizar este» desde el correo usa la combinación de SU selección.
//   7 · LOS EVENTOS: enviado, abierto, clic, compra que vino del correo, regalo usado.
//   8 · LA BAJA de un clic (GET del pie y POST del List-Unsubscribe) y las tablas cerradas al cliente.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/semanal-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIAS_VIGENCIA_REGALO, MINIMO_SEMANAL, RUTA_SUELTO_SEMANAL, TOPE_SEMANAL, correspondeRegalo, elegirSemanal, rangoSemanal, semanaDelEnvio, varianteDe,
} from "../../../src/lib/guia/semanal";
import { COLOR_VEREDICTO, SEMANAL, URL_BANDA_SEMANAL, correoSemanal, textoBusca, type DatosCorreoSemanal } from "../../../src/lib/email/correo-semanal";
import { eventoSemanalAbierto } from "../../../src/lib/medicion-correo";
import { ROJO } from "../../../src/lib/email/plantilla-clara";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const VOSEO = /(^|[^a-záéíóúñ])(dejás|tenés|querés|podés|sabés|mirá|tomá|entrá|seguí|registrate|guardá|revisá|poné|compará|elegí|tocá|pedí|escribí|analizá|empezá|vos)(?![a-záéíóúñ])/i;

export async function runSemanalTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER SEMANAL (el correo semanal y el regalo · 0 tokens) ───");

  // 1 · la selección
  type C = { avisoId: string; scoreCron: number | null };
  const cands: C[] = Array.from({ length: 9 }, (_, i) => ({ avisoId: `a${i}`, scoreCron: 90 - i }));
  const ev = (v: string, s: number) => ({ veredicto: v, score: s, flujo: 1000 });
  const evals: Record<string, ReturnType<typeof ev>> = {
    a0: ev("AJUSTA SUPUESTOS", 99), a1: ev("COMPRAR", 70), a2: ev("COMPRAR", 88), a3: ev("COMPRAR", 81), a4: ev("BUSCAR OTRA", 95),
    a5: ev("COMPRAR", 79), a6: ev("COMPRAR", 77), a7: ev("COMPRAR", 76), a8: ev("COMPRAR", 75),
  };
  const correr = async (estado: (id: string) => "publicado" | "despublicado" | "sin-chequeo") => {
    const pedidos: string[] = [];
    const r = await elegirSemanal(cands, async (c) => evals[c.avisoId], async (c) => { pedidos.push(c.avisoId); return estado(c.avisoId); });
    return { r, pedidos };
  };
  {
    const { r, pedidos } = await correr((id) => (id === "a3" ? "despublicado" : "publicado"));
    const ids = r.items.map((x) => x.c.avisoId).join(",");
    if (r.estado !== "armada" || ids !== "a2,a5,a6,a7,a8") F(`1 · la selección no son los Comprar publicados por puntaje (${r.estado}: ${ids})`);
    if (pedidos.join(",") !== "a2,a3,a5,a6,a7,a8") F(`1 · la ficha no se chequea de a uno, en orden, parando en ${TOPE_SEMANAL} (${pedidos.join(",")})`);
    if (r.items.some((x) => x.ev.veredicto !== "COMPRAR")) F("1 · entra algo que no es Comprar");
  }
  {
    const { r } = await correr((id) => (["a2", "a3"].includes(id) ? "publicado" : "despublicado"));
    if (r.estado !== "sin_match" || r.items.length !== 0) F(`1 · con menos de ${MINIMO_SEMANAL} publicados igual hay correo (${r.estado})`);
    const p = await correr((id) => (["a2", "a3"].includes(id) ? "publicado" : "sin-chequeo"));
    if (p.r.estado !== "pendiente") F("1 · sin cupo para chequear, la selección no queda pendiente");
  }
  const rg = rangoSemanal({ precioMinUf: 3000, precioMaxUf: 4500 });
  if (!rg || rg.ufMax !== 4500 || rg.ufMin !== 2700 || rangoSemanal({ precioMinUf: null, precioMaxUf: null }) !== null) F("1 · el rango de precio no es piso −10% al tope");

  // 2 · domingo arma, lunes sale
  if (semanaDelEnvio(new Date("2026-10-04T15:00:00Z")) !== "2026-10-05" || semanaDelEnvio(new Date("2026-10-05T12:00:00Z")) !== "2026-10-05" || semanaDelEnvio(new Date("2026-10-07T12:00:00Z")) !== "2026-10-12")
    F("2 · la semana no es el lunes del envío");
  const vj = leer("vercel.json");
  if (!/"path": "\/api\/cron\/semanal-armar",\s*"schedule": "5 11-23 \* \* 0"/.test(vj) || !/"path": "\/api\/cron\/semanal-enviar",\s*"schedule": "0 12 \* \* 1"/.test(vj)) F("2 · los crons no arman el domingo y mandan el lunes");
  const hb = leer("src/lib/cron-heartbeat.ts");
  if (!/nombre: "semanal-armar"[^}]*intervaloHoras: 168/.test(hb) || !/nombre: "semanal-enviar"[^}]*intervaloHoras: 168/.test(hb)) F("2 · los crons del semanal no están vigilados con su cadencia semanal");

  // 3 · el regalo
  const ahora = new Date("2026-10-05T12:00:00Z");
  const hace = (d: number) => new Date(ahora.getTime() - d * 864e5);
  if (!correspondeRegalo({ registradoAt: hace(14), compras: 0, regaloOtorgadoAt: null, plan: false, ahora })) F("3 · a los 14 días sin compras no hay regalo");
  if (correspondeRegalo({ registradoAt: hace(13.9), compras: 0, regaloOtorgadoAt: null, plan: false, ahora })) F("3 · hay regalo antes de los 14 días");
  if (correspondeRegalo({ registradoAt: hace(30), compras: 1, regaloOtorgadoAt: null, plan: false, ahora })) F("3 · hay regalo para quien compró");
  if (correspondeRegalo({ registradoAt: hace(30), compras: 0, regaloOtorgadoAt: "2026-09-01", plan: false, ahora })) F("3 · el regalo se da dos veces");
  if (correspondeRegalo({ registradoAt: hace(30), compras: 0, regaloOtorgadoAt: null, plan: true, ahora })) F("3 · hay regalo para quien tiene plan");
  const srv = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
  const iMarca = srv.indexOf('.is("regalo_otorgado_at", null)');
  const iCredito = srv.indexOf('from("credit_grants").insert(');
  if (iMarca < 0 || iCredito < 0 || iMarca > iCredito || !/source: FUENTE_REGALO_SEMANAL/.test(srv)) F("3 · el crédito del regalo no espera a ganar la marca condicional");
  if (DIAS_VIGENCIA_REGALO !== 60 || !/DIAS_VIGENCIA_REGALO \* 864e5/.test(srv)) F("3 · el regalo no vence a los 60 días");
  if (SEMANAL.regalo !== "El próximo que analices va por cuenta de Franco.") F("3 · la frase del regalo no es la aprobada");
  const reg = sinComentarios(leer("src/app/api/analisis/claim/route.ts")) + sinComentarios(leer("src/lib/welcome.ts"));
  if (/regalo/i.test(reg)) F("3 · registrarse regala algo");

  // 4 · el correo
  const base: DatosCorreoSemanal = {
    variante: "banda", nombre: "Camila", busca: textoBusca({ dormitorios: [2], comunas: ["Ñuñoa", "Macul"], precioMaxUf: 4500 }), piePct: 20, plazoAnios: 30,
    deptos: [1, 2, 3].map((i) => ({ comuna: "Ñuñoa", tipologia: "2D2B", m2: 58, precioUF: 4290 + i, veredicto: "COMPRAR", score: 80, flujo: i === 3 ? -18000 : 64000, url: `https://x/clic?a=${i}` })),
    saldo: 0, conRegalo: false, urlBoton: "https://x/semanal", urlComprar: "https://x/comprar", urlBaja: "https://x/baja",
  };
  if (base.busca !== "2 dormitorios, Ñuñoa y Macul, hasta UF 4.500") F(`4 · lo que busca no se lee: «${base.busca}»`);
  const banda = correoSemanal(base).html;
  const tarjetas = correoSemanal({ ...base, variante: "tarjetas", saldo: 2 }).html;
  const regalo = correoSemanal({ ...base, variante: "tarjetas", saldo: 1, conRegalo: true }).html;
  if (correoSemanal(base).subject !== "Deptos publicados que Franco revisó para ti") F("4 · el asunto no es el titular aprobado");
  if (!banda.includes(`src="${URL_BANDA_SEMANAL}"`) || !banda.includes(`alt="${SEMANAL.titular}"`)) F("4 · la variante banda no lleva la banda del hero con el titular en el alt");
  if (tarjetas.includes(URL_BANDA_SEMANAL) || !tarjetas.includes(`font-weight: 700; color: #0F0F0F;">${SEMANAL.titular}</td>`)) F("4 · la variante tarjetas lleva banda o no lleva el titular en serif");
  for (const [n, h] of [["banda", banda], ["tarjetas", tarjetas]] as const) {
    if ((h.match(/font-size: 28px; line-height: 1\.1; font-weight: 700;/g) ?? []).length !== 3) F(`4 · ${n}: el precio no va grande en cada tarjeta`);
    if (!h.includes(`color: ${COLOR_VEREDICTO.COMPRAR};">Comprar`) || COLOR_VEREDICTO.COMPRAR !== "#2B558F") F(`4 · ${n}: el veredicto no va en su color`);
    if ((h.match(new RegExp(`<td bgcolor="${ROJO}" style="border-radius: 999px; background: ${ROJO};">`, "g")) ?? []).length !== 1) F(`4 · ${n}: el botón principal no es uno y rojo`);
    if (/oportunidad|portafolio|exclusiv/i.test(h)) F(`4 · ${n}: aparece una palabra vedada`);
    if (/14\.990|14990|pack/i.test(h)) F(`4 · ${n}: el correo ofrece el pack`);
    if (!h.includes('href="https://x/baja"') || !h.includes(SEMANAL.baja)) F(`4 · ${n}: sin el enlace para dejar de recibirlo`);
  }
  if (!banda.includes(`<a href="https://x/comprar" style="display: inline-block; padding: 15px 30px;`) || !banda.includes(">Analizar uno · $9.990</a>")) F("4 · sin saldo el botón no es «Analizar uno · $9.990» a comprar");
  if (!tarjetas.includes(`<a href="https://x/semanal" style="display: inline-block; padding: 15px 30px;`) || !tarjetas.includes(">Analizar uno</a>")) F("4 · con saldo el botón no es «Analizar uno» a la selección");
  if (!regalo.includes(`<b>${SEMANAL.regalo}</b>`) || banda.includes(SEMANAL.regalo)) F("4 · el regalo no sale solo cuando corresponde");
  if (!banda.includes("−$18.000") || !banda.includes(`color: ${ROJO};">−$18.000`)) F("4 · el flujo negativo no va en rojo");
  if (RUTA_SUELTO_SEMANAL !== "/checkout?product=single&origen=semanal") F("4 · el «Analizar uno · $9.990» no compra el suelto marcado como del correo");
  for (const t of [SEMANAL.titular, SEMANAL.intro(3, base.busca, "20", 30), SEMANAL.regaloBajada, SEMANAL.revisados, SEMANAL.porQue]) if (VOSEO.test(t)) F(`4 · voseo: «${t}»`);
  if (varianteDe("a") === varianteDe("b") && varianteDe("b") === varianteDe("c") && varianteDe("c") === varianteDe("d")) F("4 · las variantes no se reparten");

  // 5 · una vez
  const iTomar = srv.indexOf('update({ estado: "enviada", enviada_at:');
  const iMandar = srv.indexOf("await sendSemanalEmail(");
  if (iTomar < 0 || iMandar < 0 || iTomar > iMandar || !/\.is\("enviada_at", null\)\.select\("id"\);\s*if \(\(tomada\?\.length \?\? 0\) !== 1\) return "ya";/.test(srv)) F("5 · el correo se manda sin tomar la fila antes");
  if (!/if \(!r\.ok\) \{\s*await admin\.from\("semanal_selecciones"\)\.update\(\{ estado: "armada", enviada_at: null \}\)/.test(srv)) F("5 · si Resend falla, la fila no se suelta");
  if (!/if \(deptos\.length < MINIMO_SEMANAL \|\| !fila\.combinacion \|\| !fila\.perfil\) return descartar\(\);/.test(srv)) F("5 · se manda con menos de tres vigentes");
  if (!/pb\?\.semanal_baja_at\) return descartar\(\);/.test(srv)) F("5 · se le manda a quien se dio de baja");

  // 6 · el clic y el análisis
  const clic = sinComentarios(leer("src/app/api/semanal/clic/route.ts"));
  if (!/await chequearAlClic\(admin, avisoId\)/.test(clic) || !/&d=1/.test(clic)) F("6 · el clic no relee la ficha");
  if (!/if \(ir === "comprar"\) return volver\(RUTA_SUELTO_SEMANAL\);/.test(clic)) F("6 · «Analizar uno · $9.990» no va a comprar el suelto");
  if (!/"clic", almacenPublicacion\(admin\), bajarFicha/.test(srv)) F("6 · el chequeo del clic no usa la memoria y el tope de siempre");
  const ruta = sinComentarios(leer("src/app/api/lo-que-sigue/guia/analizar/route.ts"));
  if (!/typeof b\.semanal === "string"\s*\? await combinacionSemanal\(admin, b\.semanal, user\.id, o\.analysisId, b\.avisoId\)/.test(ruta)) F("6 · «Analizar este» desde el correo no usa la combinación de su selección");
  if (!/data\.user_id !== userId \|\| data\.origen_analysis_id !== origenId/.test(srv) || !/some\(\(i\) => i\.avisoId === avisoId\)\) return null;/.test(srv)) F("6 · la combinación del correo no verifica persona, origen y aviso");

  // 7 · los eventos
  if (!/event: "semanal_enviado"/.test(srv)) F("7 · falta semanal_enviado");
  const ab = eventoSemanalAbierto({ event: "correo_abierto", distinctId: "u", uuid: "x", properties: { tipo: "semanal" } });
  if (ab?.event !== "semanal_abierto" || ab.uuid === "x" || eventoSemanalAbierto({ event: "correo_abierto", distinctId: "u", properties: { tipo: "bienvenida" } }) !== null || eventoSemanalAbierto({ event: "correo_clic", distinctId: "u", properties: { tipo: "semanal" } }) !== null) F("7 · la apertura del semanal no da semanal_abierto (o lo da de más)");
  if (!/const semanal = eventoSemanalAbierto\(evento\);\s*if \(semanal\) await capturarServidor\(semanal\);/.test(sinComentarios(leer("src/app/api/webhooks/resend/route.ts")))) F("7 · el webhook no emite semanal_abierto");
  if (!/event: "semanal_clic"/.test(clic)) F("7 · falta semanal_clic");
  const conf = sinComentarios(leer("src/app/api/payments/confirm/route.ts"));
  if (!/origen === "semanal"\) \{\s*await capturarServidor\(\{ event: "semanal_compra"/.test(conf) || !/\.\.\.\(prePaymentData\?\.origen === "semanal" \? \{ origen: "semanal" \} : \{\}\)/.test(conf)) F("7 · la compra que vino del correo no se mide (o se pierde el origen al confirmar)");
  if (!/\.\.\.\(origenBody === "semanal" \? \{ origen: "semanal" \} : \{\}\)/.test(sinComentarios(leer("src/app/api/payments/create/route.ts"))) || !/searchParams\.get\("origen"\) === "semanal"/.test(leer("src/app/checkout/page.tsx"))) F("7 · el checkout no lleva el origen del correo al pago");
  const cg = sinComentarios(leer("src/lib/credits-grant.ts"));
  if (!/if \(updated && grant\.source === FUENTE_REGALO_SEMANAL\) \{\s*void capturarServidor\(\{ event: "semanal_regalo_usado"/.test(cg) || !/\.select\("id, remaining, source"\)/.test(cg)) F("7 · el regalo usado no se mide");

  // 8 · la baja y las tablas
  const baja = sinComentarios(leer("src/app/api/semanal/baja/route.ts"));
  if (!/export async function GET/.test(baja) || !/export async function POST/.test(baja) || !/semanal_baja_at: new Date\(\)\.toISOString\(\)/.test(baja)) F("8 · la baja no es de un clic (GET y POST)");
  if (!/"List-Unsubscribe": `<\$\{urlBaja\}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"/.test(leer("src/lib/email.ts"))) F("8 · el correo no lleva List-Unsubscribe de un clic");
  const mig = leer("supabase/migrations/20261002_correo_semanal.sql");
  if (!/revoke all on public\.semanal_selecciones from anon, authenticated;/.test(mig) || !/from public, anon, authenticated;/.test(mig) || !/unique \(user_id, semana\)/.test(mig)) F("8 · la selección o su RPC quedan abiertas al cliente, o se puede armar dos veces por semana");

  if (fallas.length === 0) console.log("  ✓ SEMANAL: Comprar publicados de a uno hasta cinco (tres o nada), domingo/lunes, regalo a los 14 días una vez, dos variantes con precio grande y botón rojo al suelto, una vez por semana, clic que relee la ficha, los cinco eventos y la baja de un clic");
  for (const f of fallas) console.log(`  ✗ ${f}`);
  return { hard: fallas.length };
}

if (require.main === module) {
  runSemanalTier().then(({ hard }) => process.exit(hard > 0 ? 1 : 0));
}

// ─── ACTA · verificado EN ROJO por mutación (02-oct-2026) ────────────────────
//   S1  entra Ajustar ...................................................... ROJO (1)
//   S2  sin orden por puntaje .............................................. ROJO (1)
//   S3  se chequean todas las fichas, sin parar en cinco ................... ROJO (1)
//   S4  correo con un solo depto ........................................... ROJO (1)
//   S5  sin cupo de fichas no queda pendiente .............................. ROJO (1)
//   S6  la semana no es el lunes del envío ................................. ROJO (2)
//   S7  regalo a los 7 días ................................................ ROJO (3)
//   S8  regalo a quien compró .............................................. ROJO (3)
//   S9  el crédito sin la marca condicional ................................ ROJO (3)
//   S10 la banda sin el titular en el alt .................................. ROJO (4)
//   S11 el precio chico .................................................... ROJO (4)
//   S12 el veredicto en tinta .............................................. ROJO (4)
//   S13 el botón en tinta .................................................. ROJO (4)
//   S14 el botón vende el pack ............................................. ROJO (4)
//   S15 una vedada en el pie ............................................... ROJO (4)
//   S16 sin el enlace de baja .............................................. ROJO (4)
//   S17 se manda sin tomar la fila ......................................... ROJO (5)
//   S18 si Resend falla la fila no se suelta ............................... ROJO (5)
//   S19 se le manda a quien se dio de baja ................................. ROJO (5)
//   S20 el clic no relee la ficha .......................................... ROJO (6)
//   S21 «Analizar este» del correo con la combinación de la guía ........... ROJO (6)
//   S22 la selección de otra persona vale .................................. ROJO (6)
//   S23 sin semanal_abierto ................................................ ROJO (7)
//   S24 el confirm pierde el origen ........................................ ROJO (7)
//   S25 el regalo usado sin evento ......................................... ROJO (7)
//   S26 la baja solo por GET ............................................... ROJO (8)
//   S27 sin List-Unsubscribe ............................................... ROJO (8)
//   S28 la RPC abierta al público .......................................... ROJO (8)
//   S29 el envío un martes ................................................. ROJO (2)
//   S30 «Analizar uno · $9.990» compra el pack ............................. ROJO (4)
//   30/30 en rojo; cada archivo restaurado byte a byte. Y la excepción de la banda en CORREOS: la banda
//   también en «tarjetas» y la banda sin alt dan ROJO en CORREOS (2/2).
