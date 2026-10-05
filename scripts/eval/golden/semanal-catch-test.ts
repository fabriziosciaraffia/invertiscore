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
//   9 · LA PRUEBA A/B (02-oct-2026): abierto, clic y compra llevan la variante; el regalo dice «Vence el [fecha].».
//  10 · EL RESPALDO (05-oct-2026): con menos de tres Comprar publicados en sus comunas, completa HASTA TRES
//       con Comprar de comunas vecinas y después con Ajustar que dan Comprar con 10% de descuento, marcados
//       «Conviene si lo negocias» en el correo y en /semanal; si ni así hay tres, no sale. Las vecinas son
//       simétricas y toda comuna cubierta tiene alguna.
//  11 · A QUIÉN (05-oct-2026): toda persona con un informe de renta larga (y quien tenga perfil), con el
//       perfil armado desde sus informes; el primer correo se presenta con la baja a la vista.
//  12 · EL PRECHEQUEO (05-oct-2026): de lunes a sábado, cada hora de la noche, se chequean por turnos los
//       avisos que cada selección va a necesitar (el siguiente que le pediría la regla del domingo); un
//       publicado chequeado vale la semana para el armado; el domingo solo completa lo que falte.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/semanal-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DESCUENTO_NEGOCIABLE, DIAS_VIGENCIA_REGALO, MARCA_NEGOCIAR, MEMORIA_SEMANAL_MS, repartirChequeos, siguienteAChequear, MINIMO_SEMANAL, RUTA_SUELTO_SEMANAL, rutaSueltoSemanal, textoVence, TOPE_SEMANAL, correspondeRegalo, elegirSemanal, esPrimerSemanal, rangoSemanal, semanaDelEnvio, varianteDe,
} from "../../../src/lib/guia/semanal";
import { COMUNAS_SIN_VECINAS, comunasVecinas, vecinasDe } from "../../../src/lib/comunas-vecinas";
import { COMUNAS_DISPONIBLES } from "../../../src/lib/comunas-disponibles";
import { filaDesdeInforme } from "../../../src/lib/perfil-busqueda-servidor";
import { perfilDeBusqueda } from "../../../src/lib/perfil-busqueda";
import { chequearPublicacion, type AlmacenPublicacion } from "../../../src/lib/guia/publicacion";
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
  if (!/if \(ir === "comprar"\) return volver\(rutaSueltoSemanal\(sel\.variante as "banda" \| "tarjetas" \| null\)\);/.test(clic)) F("6 · «Analizar uno · $9.990» no va a comprar el suelto");
  if (!/"clic", almacenPublicacion\(admin\), bajarFicha/.test(srv)) F("6 · el chequeo del clic no usa la memoria y el tope de siempre");
  const ruta = sinComentarios(leer("src/app/api/lo-que-sigue/guia/analizar/route.ts"));
  if (!/typeof b\.semanal === "string"\s*\? await combinacionSemanal\(admin, b\.semanal, user\.id, o\.analysisId, b\.avisoId\)/.test(ruta)) F("6 · «Analizar este» desde el correo no usa la combinación de su selección");
  if (!/data\.user_id !== userId \|\| data\.origen_analysis_id !== origenId/.test(srv) || !/some\(\(i\) => i\.avisoId === avisoId\)\) return null;/.test(srv)) F("6 · la combinación del correo no verifica persona, origen y aviso");

  // 7 · los eventos
  if (!/event: "semanal_enviado"/.test(srv)) F("7 · falta semanal_enviado");
  const ab = eventoSemanalAbierto({ event: "correo_abierto", distinctId: "u", uuid: "x", properties: { tipo: "semanal" } });
  if (ab?.event !== "semanal_abierto" || ab.uuid === "x" || eventoSemanalAbierto({ event: "correo_abierto", distinctId: "u", properties: { tipo: "bienvenida" } }) !== null || eventoSemanalAbierto({ event: "correo_clic", distinctId: "u", properties: { tipo: "semanal" } }) !== null) F("7 · la apertura del semanal no da semanal_abierto (o lo da de más)");
  if (!/const semanal = eventoSemanalAbierto\(evento, carga\);\s*if \(semanal\) await capturarServidor\(semanal\);/.test(sinComentarios(leer("src/app/api/webhooks/resend/route.ts")))) F("7 · el webhook no emite semanal_abierto");
  if (!/event: "semanal_clic"/.test(clic)) F("7 · falta semanal_clic");
  const conf = sinComentarios(leer("src/app/api/payments/confirm/route.ts"));
  if (!/deCorreo\?\.origen === "semanal"\) \{\s*await capturarServidor\(\{ event: "semanal_compra"/.test(conf) || !/\.\.\.\(prePaymentData\?\.origen === "semanal" \? \{ origen: "semanal",/.test(conf)) F("7 · la compra que vino del correo no se mide (o se pierde el origen al confirmar)");
  if (!/\.\.\.\(origenBody === "semanal" \? \{ origen: "semanal" \} : \{\}\)/.test(sinComentarios(leer("src/app/api/payments/create/route.ts"))) || !/searchParams\.get\("origen"\) === "semanal"/.test(leer("src/app/checkout/page.tsx"))) F("7 · el checkout no lleva el origen del correo al pago");
  const cg = sinComentarios(leer("src/lib/credits-grant.ts"));
  if (!/if \(updated && grant\.source === FUENTE_REGALO_SEMANAL\) \{\s*void capturarServidor\(\{ event: "semanal_regalo_usado"/.test(cg) || !/\.select\("id, remaining, source"\)/.test(cg)) F("7 · el regalo usado no se mide");

  // 8 · la baja y las tablas
  const baja = sinComentarios(leer("src/app/api/semanal/baja/route.ts"));
  if (!/export async function GET/.test(baja) || !/export async function POST/.test(baja) || !/semanal_baja_at: new Date\(\)\.toISOString\(\)/.test(baja)) F("8 · la baja no es de un clic (GET y POST)");
  if (!/"List-Unsubscribe": `<\$\{urlBaja\}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"/.test(leer("src/lib/email.ts"))) F("8 · el correo no lleva List-Unsubscribe de un clic");
  const mig = leer("supabase/migrations/20261002_correo_semanal.sql");
  if (!/revoke all on public\.semanal_selecciones from anon, authenticated;/.test(mig) || !/from public, anon, authenticated;/.test(mig) || !/unique \(user_id, semana\)/.test(mig)) F("8 · la selección o su RPC quedan abiertas al cliente, o se puede armar dos veces por semana");

  // 9 · la prueba A/B y el vencimiento
  if (rutaSueltoSemanal("banda") !== "/checkout?product=single&origen=semanal&variante=banda" || rutaSueltoSemanal(null) !== RUTA_SUELTO_SEMANAL) F("9 · la compra del correo no lleva la variante");
  const abV = eventoSemanalAbierto({ event: "correo_abierto", distinctId: "u", uuid: "x", properties: { tipo: "semanal" } }, { data: { tags: [{ name: "variante", value: "tarjetas" }] } });
  if (abV?.properties?.variante !== "tarjetas") F("9 · semanal_abierto no dice la variante");
  if (!/tags: \[\{ name: "variante", value: variante \}\]/.test(leer("src/lib/email.ts")) || !/sendSemanalEmail\(user\.email, correo, fila\.user_id, enlaces\.baja, variante\)/.test(srv)) F("9 · el correo no sale con el tag de su variante");
  if (!/eventoSemanalAbierto\(evento, carga\)/.test(leer("src/app/api/webhooks/resend/route.ts"))) F("9 · el webhook no le pasa la carga (sin variante)");
  if (!/properties: \{ semana: sel\.semana, variante: sel\.variante,/.test(clic)) F("9 · semanal_clic no dice la variante");
  if (!/properties: \{ product: payment\.product, amount: payment\.amount, variante: deCorreo\.variante \?\? null \}/.test(conf) || !/origen: "semanal", \.\.\.\(prePaymentData\.variante \? \{ variante: prePaymentData\.variante \} : \{\}\)/.test(conf)) F("9 · semanal_compra no dice la variante (o el confirm la pierde)");
  if (!/varianteBody === "banda" \|\| varianteBody === "tarjetas"\) \? \{ variante: varianteBody \}/.test(sinComentarios(leer("src/app/api/payments/create/route.ts"))) || !/if \(varianteCorreo\) body\.variante = varianteCorreo;/.test(leer("src/app/checkout/page.tsx"))) F("9 · el checkout no lleva la variante al pago");
  if (textoVence("2026-12-01T15:00:00Z") !== "Vence el 1 de diciembre.") F(`9 · el vencimiento no se lee: «${textoVence("2026-12-01T15:00:00Z")}»`);
  const conFecha = correoSemanal({ ...base, variante: "tarjetas", saldo: 1, conRegalo: true, regaloVence: "2026-12-01T15:00:00Z" }).html;
  if (!conFecha.includes(`${SEMANAL.regaloBajada} Vence el 1 de diciembre.</td>`)) F("9 · el correo no dice cuándo vence el regalo");
  if (!/const regaloVence = correspondeRegalo\([\s\S]{0,260}\? await otorgarRegalo\(admin, fila\.user_id\)/.test(srv) || !/    regaloVence,\n/.test(srv) || !/return vence;/.test(srv)) F("9 · el envío no le pasa al correo el vencimiento del regalo que otorgó");

  // 10 · el respaldo
  {
    type R = { avisoId: string; scoreCron: number | null };
    const mk = (id: string, s: number): R => ({ avisoId: id, scoreCron: s });
    const tabla: Record<string, { v: string; s: number; d?: string }> = {
      p1: { v: "COMPRAR", s: 80 }, p2: { v: "AJUSTA SUPUESTOS", s: 70, d: "COMPRAR" }, p3: { v: "AJUSTA SUPUESTOS", s: 75, d: "AJUSTA SUPUESTOS" }, p4: { v: "BUSCAR OTRA", s: 90, d: "COMPRAR" },
      v1: { v: "COMPRAR", s: 60 }, v2: { v: "COMPRAR", s: 85 }, v3: { v: "COMPRAR", s: 50 }, v4: { v: "AJUSTA SUPUESTOS", s: 72, d: "COMPRAR" },
    };
    const evR = async (c: R) => ({ veredicto: tabla[c.avisoId].v, score: tabla[c.avisoId].s, flujo: 1 });
    const evD = async (c: R) => ({ veredicto: tabla[c.avisoId].d ?? tabla[c.avisoId].v, score: 0, flujo: 1 });
    const correrR = async (propias: R[], vecinas: R[], estado: (id: string) => "publicado" | "despublicado" = () => "publicado") => {
      const pedidos: string[] = [];
      let pidioVecinas = 0;
      const r = await elegirSemanal(propias, evR, async (c) => { pedidos.push(c.avisoId); return estado(c.avisoId); }, {
        vecinas: async () => { pidioVecinas++; return vecinas; }, evaluarConDescuento: evD,
      });
      return { r, pedidos, pidioVecinas, lista: r.items.map((x) => `${x.c.avisoId}:${x.tramo}`).join(",") };
    };
    // a · con tres Comprar en sus comunas no se mira el respaldo.
    const pidio = { n: 0 };
    const evA = (c: R) => Promise.resolve({ veredicto: "COMPRAR", score: 100 - Number(c.avisoId.slice(1)), flujo: 1 });
    const tresB = await elegirSemanal(["a2", "a3", "a5"].map((id, i) => mk(id, 90 - i)), evA, async () => "publicado" as const, {
      vecinas: async () => { pidio.n++; return [mk("v2", 1)]; }, evaluarConDescuento: async () => { pidio.n++; return null; },
    });
    if (tresB.estado !== "armada" || tresB.items.some((x) => x.tramo !== "propia") || pidio.n !== 0) F(`10 · con tres Comprar propios igual entra el respaldo (${tresB.items.map((x) => x.tramo).join(",")}, ${pidio.n} llamadas)`);
    // b · un Comprar propio: completa con vecinas por puntaje, hasta tres.
    const b = await correrR([mk("p1", 9), mk("p2", 8), mk("p3", 7), mk("p4", 6)], [mk("v1", 9), mk("v2", 8), mk("v3", 7), mk("v4", 6)]);
    if (b.r.estado !== "armada" || b.lista !== "p1:propia,v2:vecina,v1:vecina") F(`10 · no completa con Comprar vecinos por puntaje hasta tres (${b.r.estado}: ${b.lista})`);
    if (b.pedidos.join(",") !== "p1,v2,v1") F(`10 · el respaldo chequea más fichas que las que necesita (${b.pedidos.join(",")})`);
    // c · sin vecinos que alcancen: Ajustar que con descuento dan Comprar, por puntaje (de sus comunas y vecinas).
    const c = await correrR([mk("p1", 9), mk("p2", 8), mk("p3", 7), mk("p4", 6)], [mk("v4", 6)]);
    if (c.r.estado !== "armada" || c.lista !== "p1:propia,v4:negociar,p2:negociar") F(`10 · no completa con los Ajustar negociables por puntaje (${c.r.estado}: ${c.lista})`);
    if (c.r.items.some((x) => x.tramo === "negociar" && x.ev.veredicto !== "AJUSTA SUPUESTOS")) F("10 · entra como negociable algo que no es Ajustar (un Buscar otro con descuento)");
    // d · ni así tres: no sale.
    const d = await correrR([mk("p1", 9), mk("p3", 7)], [mk("v4", 6)], (id) => (id === "v4" ? "despublicado" : "publicado"));
    if (d.r.estado !== "sin_match" || d.r.items.length !== 0) F(`10 · sin tres ni con el respaldo, igual hay correo (${d.r.estado})`);
    // e · sin respaldo (como antes) no cambia nada.
    const e = await elegirSemanal([mk("p1", 9), mk("p2", 8)], evR, async () => "publicado" as const);
    if (e.estado !== "sin_match") F("10 · sin respaldo un solo Comprar arma correo");
    if (DESCUENTO_NEGOCIABLE !== 0.1 || !/evaluarConDescuento: \(c\) => evaluarA\(c, 1 - DESCUENTO_NEGOCIABLE\)/.test(srv) || !/vecinas: \(\) => \(vecinas \?\?= leerCandidatos\(comunasVecinas\(propias\)\)\)/.test(srv)) F("10 · el servidor no arma el respaldo con las vecinas y el 10% de descuento");
    if (!/const cc = factorPrecio === 1 \? c : \{ \.\.\.c, precioUF: c\.precioUF \* factorPrecio \};/.test(srv)) F("10 · la evaluación con descuento no baja el precio");
    if (!/\.\.\.\(tramo !== "propia" \? \{ tramo \} : \{\}\)/.test(srv)) F("10 · la selección no guarda de dónde salió cada depto");
    // las vecinas
    const asim = (COMUNAS_DISPONIBLES as readonly string[]).flatMap((x) => vecinasDe(x).filter((y) => !vecinasDe(y).includes(x)).map((y) => `${x}→${y}`));
    if (asim.length || COMUNAS_SIN_VECINAS.length) F(`10 · las vecinas no son simétricas o hay comunas sin vecinas (${[...asim, ...COMUNAS_SIN_VECINAS].join(", ")})`);
    const nm = comunasVecinas(["Ñuñoa", "Macul"]);
    if (nm.includes("Ñuñoa") || nm.includes("Macul") || !nm.includes("Providencia") || !nm.includes("La Florida") || new Set(nm).size !== nm.length) F(`10 · las vecinas de Ñuñoa y Macul no son las de su límite, sin ellas mismas (${nm.join(", ")})`);
    if (vecinasDe("Santiago").includes("Vitacura") || !vecinasDe("Las Condes").includes("Vitacura")) F("10 · las vecinas no siguen los límites comunales");
    // el correo y la página
    const conNeg: DatosCorreoSemanal = { ...base, variante: "tarjetas", deptos: [base.deptos[0], { ...base.deptos[1], comuna: "Macul", tramo: "vecina" }, { ...base.deptos[2], veredicto: "AJUSTA SUPUESTOS", tramo: "negociar" }] };
    const hNeg = correoSemanal(conNeg).html;
    const hProp = correoSemanal({ ...base, variante: "tarjetas" }).html;
    if (MARCA_NEGOCIAR !== "Conviene si lo negocias" || (hNeg.match(new RegExp(`>${MARCA_NEGOCIAR}</td>`, "g")) ?? []).length !== 1 || hProp.includes(MARCA_NEGOCIAR)) F("10 · el Ajustar negociable no lleva «Conviene si lo negocias» (o lo lleva otro)");
    if (!hNeg.includes(", uno de ellos si lo negocias.") || hProp.includes("si lo negocias.")) F("10 · la frase de arriba no dice que uno resulta si lo negocias");
    if (!hNeg.includes(SEMANAL.vecinas) || hProp.includes(SEMANAL.vecinas)) F("10 · no se dice que se sumaron comunas vecinas (o se dice sin que las haya)");
    const lista = sinComentarios(leer("src/app/semanal/semanal-lista.tsx"));
    if (!/\{it\.tramo === "negociar" && <p className="guia-negociar" data-semanal="negociar">\{MARCA_NEGOCIAR\}<\/p>\}/.test(lista)) F("10 · /semanal no marca el Ajustar negociable");
    for (const t of [SEMANAL.vecinas, MARCA_NEGOCIAR, SEMANAL.intro(3, base.busca, "20", 30, 2)]) if (VOSEO.test(t) || /oportunidad|portafolio|exclusiv/i.test(t)) F(`10 · voseo o palabra vedada: «${t}»`);
  }

  // 11 · a quién y la presentación
  {
    if (!/let q = admin\.from\(tabla\)\.select\("user_id"\)\.not\("user_id", "is", null\);\s*if \(tabla === "analisis"\) q = q\.eq\("tipo_analisis", "long-term"\);/.test(srv) || !/await juntar\("perfiles_inversion"\);\s*await juntar\("analisis"\);/.test(srv)) F("11 · el correo no se le arma a toda persona con un informe de renta larga");
    const fi = filaDesdeInforme({ created_at: "2026-08-01T00:00:00Z", comuna: "Ñuñoa", input_data: { comuna: "Ñuñoa", dormitorios: 2, banos: 2, precio: 4320, piePct: 20, plazoCredito: 25 } });
    if (fi.tipologia !== "2D2B" || fi.comuna !== "Ñuñoa" || fi.presupuestoUf !== 4320 || fi.piePct !== 20 || fi.plazoAnios !== 25 || fi.modalidad !== "ltr") F(`11 · el informe no se lee como fila de perfil (${JSON.stringify(fi)})`);
    const pf = perfilDeBusqueda([fi]);
    if (!pf.completo || pf.modalidad !== "ltr" || pf.precioMaxUf !== 4400 || pf.dormitorios.join() !== "2") F(`11 · un informe solo no arma un perfil completo (${JSON.stringify(pf)})`);
    const pbs = sinComentarios(leer("src/lib/perfil-busqueda-servidor.ts"));
    if (!/\.eq\("user_id", userId\)\.eq\("tipo_analisis", "long-term"\)/.test(pbs) || !/if \(conFila\.has\(a\.id as string\)\) continue;\s*informes\.push\(filaDesdeInforme\(/.test(pbs)) F("11 · el perfil no suma los informes de renta larga sin fila de perfil");
    const pres = correoSemanal({ ...base, variante: "tarjetas", presentacion: true }).html;
    const hProp = correoSemanal({ ...base, variante: "tarjetas" }).html;
    const frase = "Desde ahora, cada semana te mandamos los deptos publicados que mejor resultan con lo que buscas.";
    const iFrase = pres.indexOf(frase), iBaja = pres.indexOf(`<a href="https://x/baja" style="color: `), iTarjeta = pres.indexOf("UF 4.291");
    if (SEMANAL.presentacion !== frase || iFrase < 0 || hProp.includes(frase)) F("11 · el primer correo no se presenta con la frase aprobada (o se presenta siempre)");
    if (iBaja < 0 || iBaja > iTarjeta || !pres.includes(`${SEMANAL.presentacionBaja} <a href="https://x/baja"`)) F("11 · la presentación no deja la baja a la vista, arriba de los deptos");
    if (!esPrimerSemanal(0) || !esPrimerSemanal(null) || esPrimerSemanal(1)) F("11 · el primero no es el que no tiene envíos anteriores");
    if (!/\.from\("semanal_selecciones"\)\.select\("id", \{ count: "exact", head: true \}\)\.eq\("user_id", fila\.user_id\)\.not\("enviada_at", "is", null\)\.neq\("id", fila\.id\)/.test(srv)
      || !/const presentacion = !eAntes && esPrimerSemanal\(enviadasAntes\);/.test(srv) || !/    presentacion,\n    urlBoton: enlaces\.boton,/.test(srv)) F("11 · el envío no cuenta los correos anteriores para presentarse (o no se lo pasa al correo)");
    for (const t of [SEMANAL.presentacion, `${SEMANAL.presentacionBaja} ${SEMANAL.presentacionBajaEnlace}.`]) if (VOSEO.test(t)) F(`11 · voseo: «${t}»`);
  }

  // 12 · el prechequeo
  {
    if (MEMORIA_SEMANAL_MS !== 7 * 864e5) F("12 · un chequeo no vale la semana del armado");
    const ahora = new Date("2026-10-11T15:00:00Z");
    const almacen = (diasAtras: number) => ({ publicacion: async () => ({ estado: "publicado" as const, chequeadoAt: new Date(ahora.getTime() - diasAtras * 864e5) }) }) as unknown as AlmacenPublicacion;
    const aviso = { id: "x", url: "https://x/y", edificio: "e" };
    const nada = async () => { throw new Error("no se lee"); };
    const martes = await chequearPublicacion(aviso, "guia", almacen(5), nada, { sinLeer: true, ahora, memoriaMs: MEMORIA_SEMANAL_MS });
    const deDia = await chequearPublicacion(aviso, "guia", almacen(5), nada, { sinLeer: true, ahora });
    const viejo = await chequearPublicacion(aviso, "guia", almacen(8), nada, { sinLeer: true, ahora, memoriaMs: MEMORIA_SEMANAL_MS });
    if (martes.estado !== "publicado" || deDia.estado !== "sin-chequeo" || viejo.estado !== "sin-chequeo") F(`12 · la memoria de la semana no vale para el armado o vale de más (${martes.estado} · ${deDia.estado} · ${viejo.estado})`);
    // el siguiente: el que pediría la regla del domingo, sin salir a la fuente
    type Q = { avisoId: string; scoreCron: number | null };
    const qs: Q[] = ["q1", "q2", "q3", "q4", "q5"].map((id, i) => ({ avisoId: id, scoreCron: 10 - i }));
    const evQ = async (c: Q) => ({ veredicto: "COMPRAR", score: 100 - Number(c.avisoId.slice(1)), flujo: 1 });
    const mem = (m: Record<string, "publicado" | "despublicado">) => async (c: Q) => m[c.avisoId] ?? ("sin-chequeo" as const);
    const s1 = await siguienteAChequear(qs, evQ, mem({ q1: "publicado", q2: "despublicado" }));
    const s2 = await siguienteAChequear(qs, evQ, mem({ q1: "publicado", q2: "publicado", q3: "publicado" }));
    const s3 = await siguienteAChequear(qs.slice(0, 2), evQ, mem({ q1: "despublicado", q2: "despublicado" }));
    if (s1?.avisoId !== "q3") F(`12 · el siguiente a chequear no es el que pediría el domingo (${s1?.avisoId})`);
    if (s2 !== null) F("12 · con tres publicados de la semana igual se sigue chequeando");
    if (s3 !== null) F("12 · sin nada por chequear igual se pide uno");
    // por turnos
    const necesita: Record<string, number> = { a: 2, b: 2, c: 1 };
    const hechos: string[] = [];
    let cupo = 4;
    const n = await repartirChequeos(["a", "b", "c"], async (p) => (necesita[p] > 0 ? p : null), async (p) => { necesita[p]--; hechos.push(p); cupo--; }, () => cupo > 0);
    if (hechos.join("") !== "abca" || n !== 4) F(`12 · los chequeos no van por turnos dentro del presupuesto (${hechos.join("")}, ${n})`);
    const hechos2: string[] = [];
    await repartirChequeos(["a", "b"], async (p) => (hechos2.filter((h) => h === p).length < (p === "a" ? 3 : 1) ? p : null), async (p) => { hechos2.push(p); }, () => true);
    if (hechos2.join("") !== "abaa") F(`12 · quien ya no necesita no sale de la fila (o se para antes) (${hechos2.join("")})`);
    // el servidor, el cron y la vigilancia
    if (!/sinLeer: presupuesto\.bloqueada \|\| presupuesto\.lecturas >= LECTURAS_POR_CORRIDA_SEMANAL,\s*memoriaMs: MEMORIA_SEMANAL_MS,/.test(srv)) F("12 · el armado no usa la memoria de la semana");
    if (!/const g = await elegirSemanal\(candidatos, evaluar, publicadoConPresupuesto\(admin, presupuesto\), respaldo\);/.test(srv)) F("12 · el armado no elige con la preparación compartida");
    if (!/\{ sinLeer: true, memoriaMs: MEMORIA_SEMANAL_MS \}/.test(srv) || !/return p \? siguienteAChequear\(p\.candidatos, p\.evaluar, enMemoria, p\.respaldo\) : null;/.test(srv)) F("12 · el prechequeo no elige el siguiente con lo ya chequeado en la semana");
    const rp = sinComentarios(leer("src/app/api/cron/semanal-prechequeo/route.ts"));
    if (!/await prechequearSemana\(admin, personas, cfg, presupuesto, \{ turno, hastaMs: t0 \+ PRESUPUESTO_MS \}\)/.test(rp) || !/latirCron\(admin, "semanal-prechequeo"\)/.test(rp)) F("12 · el cron no prechequea");
    if (!/"path": "\/api\/cron\/semanal-prechequeo",\s*"schedule": "35 3-8 \* \* 1-6"/.test(vj)) F("12 · el prechequeo no corre de noche de lunes a sábado");
    if (!/nombre: "semanal-prechequeo"[^}]*intervaloHoras: 24/.test(hb)) F("12 · el prechequeo no está vigilado");
  }

  if (fallas.length === 0) console.log("  ✓ SEMANAL: Comprar publicados de a uno hasta cinco (tres o nada), domingo/lunes, regalo a los 14 días una vez, dos variantes con precio grande y botón rojo al suelto, una vez por semana, clic que relee la ficha, los cinco eventos y la baja de un clic; respaldo hasta tres con vecinas y Ajustar negociables marcados; a toda persona con informe de renta larga, presentándose la primera vez; prechequeo por turnos en las noches, que vale la semana");
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
//   30/30 en rojo; cada archivo restaurado byte a byte.
//   §9 (02-oct-2026, la prueba A/B y el vencimiento): V1 compra sin variante · V2 abierto sin variante · V3 correo
//   sin tag · V4 webhook sin carga · V5/V6 compra sin variante (evento o confirm) · V7/V8 create o checkout sin
//   variante · V9 fecha en otro formato · V10/V11 correo o envío sin la fecha · V12 clic sin variante: 12/12 ROJO.
//   §10–§11 (05-oct-2026, respaldo y a quién): 21/21 ROJO. R1 el respaldo entra con tres propios · R2 las vecinas
//   llenan hasta cinco · R3 entra todo Ajustar sin el descuento · R4 sin vecinas, directo a Ajustar · R5 negociables solo de sus
//   comunas · R6 descuento de 20% · R7 la evaluación con descuento no baja el precio · R8/R9 correo o /semanal sin la marca ·
//   R10 vecinas en un solo sentido · R11 las vecinas incluyen las propias · R12 solo a quien tiene perfil · R13 el perfil sin los
//   informes sin fila · R14 se presenta siempre · R15 el primero mal contado · R16 la presentación sin la baja a la vista ·
//   R17 el conteo cuenta la fila que se manda · R18 la frase sin «si lo negocias» · R19 sin la frase de las vecinas · R20 el
//   informe pierde el pie · R21 la selección no guarda el tramo.
//   §12 (05-oct-2026, el prechequeo): 12/12 ROJO. P1 la memoria de un día · P2 chequearPublicacion ignora la
//   memoria pedida · P3 el armado sin la memoria de la semana · P4 el siguiente es el último que falta · P5 se sigue
//   chequeando con la selección completa · P6 sin turnos · P7 se pasa del presupuesto · P8 sale a la fuente para saber qué
//   falta · P9 el cron también el domingo · P10 sin vigilancia · P11 el armado sin la preparación compartida · R7 de nuevo
//   sobre la preparación compartida. Y la excepción de la banda en CORREOS: la banda
//   también en «tarjetas» y la banda sin alt dan ROJO en CORREOS (2/2).
