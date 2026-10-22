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
//  13 · DESCARTAR, NO DAR POR VIGENTE (05-oct-2026): el domingo, con el tope que quede, se vuelven a
//       chequear los avisos de las selecciones armadas, los chequeados hace más tiempo primero; la que
//       pierde uno se arma de nuevo. Y /semanal está viva: el que ya no está publicado lo dice —«Este ya no
//       está publicado»— y en su lugar va el siguiente mejor del perfil, chequeado y guardado.
//  14 · EL REINTENTO NO ALERTA (05-oct-2026): una selección que falla en una corrida intermedia del domingo se
//       reintenta en la siguiente y no cuenta como fallida; solo en la de las 23 UTC es una falla.
//  15 · LO YA VISTO NO OCUPA LUGAR (19-oct-2026): en el correo y en /semanal, los cinco son primero los que la persona no ha
//       visto (ni analizados ni mandados en las últimas cuatro semanas); solo si no alcanzan cinco se completa con lo visto,
//       marcado «Ya te lo mandamos» o «Ya lo analizaste» y siempre al final. El caso: un depto ya analizado y cinco nuevos
//       disponibles → el analizado no aparece.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/semanal-catch-test.ts
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DESCUENTO_NEGOCIABLE, DIAS_VIGENCIA_REGALO, MARCA_NEGOCIAR, MEMORIA_SEMANAL_MS, prechequearConPresupuesto, siguienteYEstado,
  DIAS_VISTO, MARCA_VISTO, REGLA_CORTA, REGLA_LARGA, queEnviarSemanal, vistosDeFilas,
  FRESCO_DOMINGO_MS, MAX_CHEQUEOS_REEMPLAZO, esUltimaCorridaArmar, SEMANAL_PAGINA, filasDePagina, rechequearAvisos, siguienteReemplazo, RUTA_SUELTO_SEMANAL, rutaSueltoSemanal, textoVence, TOPE_SEMANAL, correspondeReactivacion, elegirSemanal, esPrimerSemanal, rangoSemanal, semanaDelEnvio, varianteDe,
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
    // ⚠ ACTA (20-oct-2026, SEMANAL-SIN-MINIMO) · el mínimo de tres se derogó: con 1 o 2 confirmados sale la selección.
    if (r.estado !== "armada" || r.items.length !== 2) F(`1 · con dos publicados la selección no sale (${r.estado}, ${r.items.length})`);
    const p = await correr((id) => (["a2", "a3"].includes(id) ? "publicado" : "sin-chequeo"));
    if (p.r.estado !== "pendiente") F("1 · sin cupo para chequear, la selección no queda pendiente");
  }
  const rg = rangoSemanal({ precioMinUf: 3000, precioMaxUf: 4500 });
  if (!rg || rg.ufMax !== 4500 || rg.ufMin !== 2700 || rangoSemanal({ precioMinUf: null, precioMaxUf: null }) !== null) F("1 · el rango de precio no es piso −10% al tope");

  // 2 · domingo arma, lunes sale
  if (semanaDelEnvio(new Date("2026-10-04T15:00:00Z")) !== "2026-10-05" || semanaDelEnvio(new Date("2026-10-05T12:00:00Z")) !== "2026-10-05" || semanaDelEnvio(new Date("2026-10-07T12:00:00Z")) !== "2026-10-12")
    F("2 · la semana no es el lunes del envío");
  const vj = leer("vercel.json");
  // ⚠ ACTA (13-oct-2026) · el envío corre a las 12:00 y a las 12:30 del lunes (presupuesto de 240 s; lo que no
  // alcanza lo toma la segunda), y el lunes de 08 a 11 UTC se reintentan las pendientes (SEMANAL-SIN-SILENCIO §2).
  // ⚠ ACTA (19-oct-2026) · el armado del domingo pasa de :05 a :25: a las 14:05 y 20:05 arrancaba un minuto después del cierre
  // de scrape-unidades-nuevas y heredaba la ventana mala del proxy (el 18-oct perdió 48 lecturas de ficha).
  if (!/"path": "\/api\/cron\/semanal-armar",\s*"schedule": "25 11-23 \* \* 0"/.test(vj) || !/"path": "\/api\/cron\/semanal-enviar",\s*"schedule": "0,30 12 \* \* 1"/.test(vj)) F("2 · los crons no arman el domingo y mandan el lunes");
  const hb = leer("src/lib/cron-heartbeat.ts");
  if (!/nombre: "semanal-armar"[^}]*intervaloHoras: 168/.test(hb) || !/nombre: "semanal-enviar"[^}]*intervaloHoras: 168/.test(hb)) F("2 · los crons del semanal no están vigilados con su cadencia semanal");

  // 3 · el regalo
  const ahora = new Date("2026-10-05T12:00:00Z");
  const hace = (d: number) => new Date(ahora.getTime() - d * 864e5);
  // ⚠ ACTA (16-oct-2026, decisión de Fabrizio, goal «la puerta B») · el regalo de los 14 días pasa a ser el de
  // REACTIVACIÓN: 4 semanas sin analizar, uno cada 90 días, sin plan ni otro regalo vivo (semanal.ts ›
  // correspondeReactivacion; el detalle lo prueba PUERTA-B §6). Registrarse ahora SÍ regala (regalo-alta.ts).
  const r0 = { registradoAt: hace(60), ultimoAnalisisAt: hace(28), ultimaReactivacionAt: null, plan: false, regaloVivo: false, ahora };
  if (!correspondeReactivacion(r0)) F("3 · a las 4 semanas sin analizar no hay regalo");
  if (correspondeReactivacion({ ...r0, ultimoAnalisisAt: hace(27.9) })) F("3 · hay regalo antes de las 4 semanas");
  if (correspondeReactivacion({ ...r0, ultimaReactivacionAt: hace(60).toISOString() })) F("3 · el regalo se da dos veces en 90 días");
  if (correspondeReactivacion({ ...r0, plan: true })) F("3 · hay regalo para quien tiene plan");
  const srv = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
  const iMarca = srv.indexOf('.is("regalo_otorgado_at", null)');
  const iCredito = srv.indexOf('from("credit_grants").insert(');
  const iMarcaR = srv.indexOf(".or(`regalo_otorgado_at.is.null,regalo_otorgado_at.lt.${antes}`)");
  if (iMarcaR < 0 || iCredito < 0 || iMarcaR > iCredito || !/source: FUENTE_REGALO_REACTIVACION/.test(srv)) F("3 · el crédito del regalo no espera a ganar la marca condicional");
  void iMarca;
  if (DIAS_VIGENCIA_REGALO !== 60 || !/DIAS_VIGENCIA_REGALO \* 864e5/.test(srv)) F("3 · el regalo no vence a los 60 días");
  if (SEMANAL.regalo !== "El próximo que analices va por cuenta de Franco.") F("3 · la frase del regalo no es la aprobada");
  // ⚠ ACTA (16-oct-2026) · derogada a propósito «registrarse no regala nada»: desde la puerta B, toda cuenta nueva nace con
  // su análisis de regalo, y lo otorga UN solo lugar (regalo-alta-servidor.ts › asegurarRegaloDeAlta; PUERTA-B §5).
  const reg = sinComentarios(leer("src/app/api/analisis/claim/route.ts")) + sinComentarios(leer("src/lib/welcome.ts"));
  if (/from\("credit_grants"\)\.insert/.test(reg)) F("3 · el registro carga créditos por fuera del regalo de alta");

  // 4 · el correo
  const base: DatosCorreoSemanal = {
    variante: "banda", nombre: "Camila", busca: textoBusca({ dormitorios: [2], comunas: ["Ñuñoa", "Macul"], precioMaxUf: 4500 }), piePct: 20, plazoAnios: 30,
    deptos: [1, 2, 3].map((i) => ({ comuna: "Ñuñoa", tipologia: "2D2B", m2: 58, precioUF: 4290 + i, veredicto: "COMPRAR", score: 80, flujo: i === 3 ? -18000 : 64000, url: `https://x/clic?a=${i}` })),
    saldo: 0, conRegalo: false, urlBoton: "https://x/semanal", urlTres: "https://x/tres", urlBaja: "https://x/baja",
  };
  if (base.busca !== "2 dormitorios, Ñuñoa y Macul, hasta UF 4.500") F(`4 · lo que busca no se lee: «${base.busca}»`);
  const banda = correoSemanal(base).html;
  const tarjetas = correoSemanal({ ...base, variante: "tarjetas", saldo: 2 }).html;
  const regalo = correoSemanal({ ...base, variante: "tarjetas", saldo: 1, conRegalo: true }).html;
  // ⚠ ACTA (20-oct-2026, SEMANAL-SIN-MINIMO) · el asunto y el titular dicen cuántos: «Encontré N que te convienen».
  if (correoSemanal(base).subject !== `Encontré ${base.deptos.length} que te convienen`) F(`4 · el asunto no dice cuántos: ${correoSemanal(base).subject}`);
  if (!banda.includes(`src="${URL_BANDA_SEMANAL}"`) || !banda.includes(`alt="${SEMANAL.titular}"`)) F("4 · la variante banda no lleva la banda del hero con el titular en el alt");
  if (tarjetas.includes(URL_BANDA_SEMANAL) || !tarjetas.includes(`font-weight: 700; color: #0F0F0F;">Encontré ${base.deptos.length} que te convienen</td>`)) F("4 · la variante tarjetas lleva banda o no lleva el titular en serif");
  for (const [n, h] of [["banda", banda], ["tarjetas", tarjetas]] as const) {
    if ((h.match(/font-size: 28px; line-height: 1\.1; font-weight: 700;/g) ?? []).length !== 3) F(`4 · ${n}: el precio no va grande en cada tarjeta`);
    if (!h.includes(`color: ${COLOR_VEREDICTO.COMPRAR};">Comprar`) || COLOR_VEREDICTO.COMPRAR !== "#2B558F") F(`4 · ${n}: el veredicto no va en su color`);
    if ((h.match(new RegExp(`<td bgcolor="${ROJO}" style="border-radius: 999px; background: ${ROJO};">`, "g")) ?? []).length !== 1) F(`4 · ${n}: el botón principal no es uno y rojo`);
    if (/oportunidad|portafolio|exclusiv/i.test(h)) F(`4 · ${n}: aparece una palabra vedada`);
    if (/14\.990|14990|pack/i.test(h)) F(`4 · ${n}: el correo ofrece el ticket de $14.990`);
    if (!h.includes('href="https://x/baja"') || !h.includes(SEMANAL.baja)) F(`4 · ${n}: sin el enlace para dejar de recibirlo`);
  }
  // Sin saldo (13-oct-2026, decisión de Fabrizio): el mismo «Analizar uno» a la selección y, debajo, la línea del pack de
  // tres (lo fija CORREOS-RECORRIDO). Hasta entonces era «Analizar uno · $9.990» a comprar el suelto.
  if (!banda.includes(`<a href="https://x/semanal" style="display: inline-block; padding: 15px 30px;`) || !banda.includes(">Analizar uno</a>") || !banda.includes(`<a href="https://x/tres"`) || /\$9\.990/.test(banda)) F("4 · sin saldo el botón no es «Analizar uno» a la selección con la línea del pack debajo");
  if (!tarjetas.includes(`<a href="https://x/semanal" style="display: inline-block; padding: 15px 30px;`) || !tarjetas.includes(">Analizar uno</a>")) F("4 · con saldo el botón no es «Analizar uno» a la selección");
  if (!regalo.includes(`<b>${SEMANAL.regalo}</b>`) || banda.includes(SEMANAL.regalo)) F("4 · el regalo no sale solo cuando corresponde");
  if (!banda.includes("−$18.000") || !banda.includes(`color: ${ROJO};">−$18.000`)) F("4 · el flujo negativo no va en rojo");
  // `ir=comprar` sigue llevando al suelto: es lo que ofrecían los correos que ya salieron con «Analizar uno · $9.990».
  if (RUTA_SUELTO_SEMANAL !== "/checkout?product=single&origen=semanal") F("4 · el «Analizar uno · $9.990» de los correos ya enviados no compra el suelto marcado como del correo");
  for (const t of [SEMANAL.titular, SEMANAL.intro(3, base.busca, "20", 30), SEMANAL.regaloBajada, SEMANAL.revisados, SEMANAL.porQue]) if (VOSEO.test(t)) F(`4 · voseo: «${t}»`);
  if (varianteDe("a") === varianteDe("b") && varianteDe("b") === varianteDe("c") && varianteDe("c") === varianteDe("d")) F("4 · las variantes no se reparten");

  // 5 · una vez
  const iTomar = srv.indexOf('update({ estado: "enviada", enviada_at:');
  const iMandar = srv.indexOf("await sendSemanalEmail(");
  if (iTomar < 0 || iMandar < 0 || iTomar > iMandar || !/\.is\("enviada_at", null\)\.select\("id"\);\s*if \(\(tomada\?\.length \?\? 0\) !== 1\) return "ya";/.test(srv)) F("5 · el correo se manda sin tomar la fila antes");
  // ⚠ ACTA (13-oct-2026, decisión de Fabrizio: que nadie reciba silencio por un error nuestro) · la fila vuelve a SU
  // estado (la pendiente no pasa a armada), y con menos de tres sale lo confirmado; sin ninguno, el correo corto. La
  // regla fina vive en SEMANAL-SIN-SILENCIO §2–§3; acá, que la fila se suelte y que el envío pase por la regla.
  if (!/if \(!r\.ok\) \{\s*await admin\.from\("semanal_selecciones"\)\.update\(\{ estado: fila\.estado, enviada_at: null \}\)/.test(srv)) F("5 · si Resend falla, la fila no se suelta");
  // ⚠ ACTA (16-oct-2026, goal «la puerta B») · la regla sabe del correo del día: con él en la semana, el lunes va solo
  // si hay nuevos («nada» descarta); sin bloques, como sin deptos.
  // ⚠ ACTA (19-oct-2026, «lo ya visto no ocupa lugar») · la regla recibe además cuántos son NUEVOS: lo visto no cuenta como nuevo después del correo del día (SEMANAL §15).
  if (!/const que = queEnviarSemanal\(conLargo \|\| conCorto \? deptos\.length \+ deptosCortos\.length : 0, \{ delDiaReciente: delDia\.enviado, nuevos: conLargo \|\| conCorto \? nuevos : 0 \}\);\s*if \(que === "nada"\) return descartar\(\);\s*if \(que === "vacio"\) return enviarSinSeleccion\(admin, fila, sitio\);/.test(srv)) F("5 · el envío no pasa por la regla de qué mandar (queEnviarSemanal)");
  if (!/pb\?\.semanal_baja_at\) return descartar\(\);/.test(srv)) F("5 · se le manda a quien se dio de baja");

  // 6 · el clic y el análisis
  const clic = sinComentarios(leer("src/app/api/semanal/clic/route.ts"));
  // ⚠ ACTA (21-oct-2026, recorrido real de Fabrizio por la puerta B) · el clic aterriza en el dashboard (hrefSeleccion): el
  // despublicado va como \`d=1\` por el mismo destino, no por una URL armada a mano.
  if (!/const estado = await chequearAlClic\(admin, avisoId\)/.test(clic) || !/return volver\(hrefSeleccion\(t, avisoId, estado === "despublicado"\)\);/.test(clic)) F("6 · el clic no relee la ficha");
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
  if (!/\.\.\.\(origenBody === "semanal" \? \{ origen: "semanal" \} : \{\}\)/.test(sinComentarios(leer("src/app/api/payments/create/route.ts"))) || !/const origenParam = uno\(searchParams, "origen"\);\s*const origen = origenParam === "semanal" \? "semanal"/.test(leer("src/app/checkout/page.tsx"))) F("7 · el checkout no lleva el origen del correo al pago");
  const cg = sinComentarios(leer("src/lib/credits-grant.ts"));
  // ⚠ ACTA (16-oct-2026, goal «la puerta B») · también el de reactivación (el mismo correo); el de registrarse, aparte.
  if (!/if \(updated && \(grant\.source === FUENTE_REGALO_SEMANAL \|\| grant\.source === FUENTE_REGALO_REACTIVACION\)\) \{\s*void capturarServidor\(\{ event: "semanal_regalo_usado"/.test(cg) || !/\.select\("id, remaining, source"\)/.test(cg)) F("7 · el regalo usado no se mide");

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
  if (!/varianteBody === "banda" \|\| varianteBody === "tarjetas"\) \? \{ variante: varianteBody \}/.test(sinComentarios(leer("src/app/api/payments/create/route.ts"))) || !/if \(varianteCorreo\) body\.variante = varianteCorreo;/.test(leer("src/app/checkout/compra-cliente.tsx"))) F("9 · el checkout no lleva la variante al pago");
  if (textoVence("2026-12-01T15:00:00Z") !== "Vence el 1 de diciembre.") F(`9 · el vencimiento no se lee: «${textoVence("2026-12-01T15:00:00Z")}»`);
  const conFecha = correoSemanal({ ...base, variante: "tarjetas", saldo: 1, conRegalo: true, regaloVence: "2026-12-01T15:00:00Z" }).html;
  if (!conFecha.includes(`${SEMANAL.regaloBajada} Vence el 1 de diciembre.</td>`)) F("9 · el correo no dice cuándo vence el regalo");
  // ⚠ ACTA (16-oct-2026) · el regalo del envío es el de reactivación (correspondeReactivacion / otorgarReactivacion).
  if (!/const regaloVence = correspondeReactivacion\([\s\S]{0,420}\? await otorgarReactivacion\(admin, fila\.user_id\)/.test(srv) || !/    regaloVence,\n/.test(srv) || !/return vence;/.test(srv)) F("9 · el envío no le pasa al correo el vencimiento del regalo que otorgó");

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
    // ⚠ ACTA (20-oct-2026, SEMANAL-SIN-MINIMO) · sin tres ni con el respaldo, salen los dos confirmados.
    if (d.r.estado !== "armada" || d.lista !== "p1:propia") F(`10 · sin tres ni con el respaldo, el confirmado no sale solo (${d.r.estado}: ${d.lista})`);
    // e · sin respaldo (como antes) no cambia nada.
    const e = await elegirSemanal([mk("p1", 9), mk("p2", 8)], evR, async () => "publicado" as const);
    if (e.estado !== "armada" || e.items.length === 0 || e.items[0].c.avisoId !== "p1") F(`10 · sin respaldo, un Comprar confirmado no arma correo (${e.estado}, ${e.items.length})`);
    if (DESCUENTO_NEGOCIABLE !== 0.1 || !/evaluarConDescuento: \(c\) => evaluarA\(c, 1 - DESCUENTO_NEGOCIABLE\)/.test(srv) || !/vecinas: \(\) => \(vecinas \?\?= leerCandidatos\(comunasVecinas\(propias\)\)\)/.test(srv)) F("10 · el servidor no arma el respaldo con las vecinas y el 10% de descuento");
    if (!/const cc = factorPrecio === 1 \? c : \{ \.\.\.c, precioUF: c\.precioUF \* factorPrecio \};/.test(srv)) F("10 · la evaluación con descuento no baja el precio");
    if (!/\.\.\.\(tramo === "vecina" \|\| tramo === "negociar" \? \{ tramo \} : \{\}\)/.test(srv)) F("10 · la selección no guarda de dónde salió cada depto");
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
    // Desde el 13-oct-2026 también a quien solo tiene informes de renta corta (decisión de Fabrizio; CORREOS-RECORRIDO).
    if (!/let q = admin\.from\(tabla\)\.select\("user_id"\)\.not\("user_id", "is", null\);\s*if \(tabla === "analisis"\) q = q\.in\("tipo_analisis", \["long-term", "short-term"\]\);/.test(srv) || !/await juntar\("perfiles_inversion"\);\s*await juntar\("analisis"\);/.test(srv)) F("11 · el correo no se le arma a toda persona con un informe");
    const fi = filaDesdeInforme({ created_at: "2026-08-01T00:00:00Z", comuna: "Ñuñoa", input_data: { comuna: "Ñuñoa", dormitorios: 2, banos: 2, precio: 4320, piePct: 20, plazoCredito: 25 } });
    if (fi.tipologia !== "2D2B" || fi.comuna !== "Ñuñoa" || fi.presupuestoUf !== 4320 || fi.piePct !== 20 || fi.plazoAnios !== 25 || fi.modalidad !== "ltr") F(`11 · el informe no se lee como fila de perfil (${JSON.stringify(fi)})`);
    const pf = perfilDeBusqueda([fi]);
    if (!pf.completo || pf.modalidad !== "ltr" || pf.precioMaxUf !== 4400 || pf.dormitorios.join() !== "2") F(`11 · un informe solo no arma un perfil completo (${JSON.stringify(pf)})`);
    const pbs = sinComentarios(leer("src/lib/perfil-busqueda-servidor.ts"));
    if (!/\.eq\("user_id", userId\)\.eq\("tipo_analisis", "long-term"\)/.test(pbs) || !/if \(conFila\.has\(a\.id as string\)\) continue;\s*const fila = filaDesdeInforme\([^;]*\);\s*informes\.push\(fila\);/.test(pbs)) F("11 · el perfil no suma los informes de renta larga sin fila de perfil");
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
    const s1 = (await siguienteYEstado(qs, evQ, mem({ q1: "publicado", q2: "despublicado" }))).aviso;
    const y2 = await siguienteYEstado(qs, evQ, mem({ q1: "publicado", q2: "publicado", q3: "publicado" }));
    const s2 = y2.aviso;
    const y3 = await siguienteYEstado(qs.slice(0, 2), evQ, mem({ q1: "despublicado", q2: "despublicado" }));
    const s3 = y3.aviso;
    if (s1?.avisoId !== "q3") F(`12 · el siguiente a chequear no es el que pediría el domingo (${s1?.avisoId})`);
    if (s2 !== null || !y2.armada) F("12 · con tres publicados de la semana igual se sigue chequeando (o no dice que se arma)");
    if (s3 !== null || y3.armada) F("12 · sin nada por chequear igual se pide uno (o dice que se arma sin tres)");
    // por turnos. ⚠ ACTA (09-oct-2026): `repartirChequeos` y `siguienteAChequear` se retiraron —sin llamador desde
    // que el prechequeo usa `prechequearConPresupuesto` y `siguienteYEstado`—; los mismos casos, sobre esas dos.
    const necesita: Record<string, number> = { a: 2, b: 2, c: 1 };
    const hechos: string[] = [];
    let cupo = 4;
    const n = (await prechequearConPresupuesto(["a", "b", "c"], null, async (p) => (necesita[p] > 0 ? p : null), async (p) => { necesita[p]--; hechos.push(p); cupo--; }, () => cupo > 0, () => true)).chequeos;
    if (hechos.join("") !== "abca" || n !== 4) F(`12 · los chequeos no van por turnos dentro del presupuesto (${hechos.join("")}, ${n})`);
    const hechos2: string[] = [];
    await prechequearConPresupuesto(["a", "b"], null, async (p) => (hechos2.filter((h) => h === p).length < (p === "a" ? 3 : 1) ? p : null), async (p) => { hechos2.push(p); }, () => true, () => true);
    if (hechos2.join("") !== "abaa") F(`12 · quien ya no necesita no sale de la fila (o se para antes) (${hechos2.join("")})`);
    // el servidor, el cron y la vigilancia
    if (!/sinLeer: presupuesto\.bloqueada \|\| presupuesto\.lecturas >= LECTURAS_POR_CORRIDA_SEMANAL,\s*memoriaMs: MEMORIA_SEMANAL_MS,/.test(srv)) F("12 · el armado no usa la memoria de la semana");
    if (!/const publicado = publicadoConPresupuesto\(admin, presupuesto\);/.test(srv) || (srv.match(/const g = await elegirSemanal\(candidatos, evaluar, publicado, respaldo, REGLA_(LARGA|CORTA), visto\);/g) ?? []).length !== 2) F("12 · el armado no elige con la preparación compartida");
    // ⚠ ACTA (09-oct-2026) · el prechequeo elige con `siguienteYEstado` (lo mismo que el `siguienteAChequear` retirado, y
    // además si la selección se arma: el cierre ya no vuelve a recorrer a nadie) y el cron le pasa DÓNDE QUEDÓ
    // la corrida anterior en vez de un turno por hora. La regla y el presupuesto, en el tier PRECHEQUEO-PRESUPUESTO.
    // ⚠ ACTA (19-oct-2026) · el armado y el prechequeo pasan además la regla de cada bloque y lo ya visto (§15).
    if (!/\{ sinLeer: true, memoriaMs: MEMORIA_SEMANAL_MS \}/.test(srv) || !/p\.ltr \? await siguienteYEstado\(p\.ltr\.candidatos, p\.ltr\.evaluar, enMemoria, p\.ltr\.respaldo, REGLA_LARGA, p\.ltr\.visto\) : null,\s*p\.str \? await siguienteYEstado\(p\.str\.candidatos, p\.str\.evaluar, enMemoria, p\.str\.respaldo, REGLA_CORTA, p\.str\.visto\) : null,/.test(srv)) F("12 · el prechequeo no elige el siguiente con lo ya chequeado en la semana");
    const rp = sinComentarios(leer("src/app/api/cron/semanal-prechequeo/route.ts"));
    // (09-oct-2026, segunda pasada: «desde» se calcula una vez, porque también va al log del cierre.)
    // ⚠ ACTA (12-oct-2026, el techo) · la llamada lleva además `progreso`, lo que se sabe mientras corre: si el techo
    // de 280 s corta la corrida, de ahí sale por quién seguir. Lo fija PRECHEQUEO-PRESUPUESTO §6.
    if (!/const desde = desdeDondeQuedo\(personas, anterior\?\.siguiente \?\? null\);/.test(rp) || !/await prechequearSemana\(admin, personas, cfg, presupuesto, \{\s*desde,\s*hastaMs: t0 \+ PRESUPUESTO_PRECHEQUEO_MS,\s*progreso,\s*\}\)/.test(rp) || !/latirCron\(admin, "semanal-prechequeo"\)/.test(rp)) F("12 · el cron no prechequea");
    if (!/"path": "\/api\/cron\/semanal-prechequeo",\s*"schedule": "35 3-8 \* \* 1-6"/.test(vj)) F("12 · el prechequeo no corre de noche de lunes a sábado");
    if (!/nombre: "semanal-prechequeo"[^}]*intervaloHoras: 24/.test(hb)) F("12 · el prechequeo no está vigilado");
  }

  // 13 · descartar, no dar por vigente
  {
    const ahora = Date.parse("2026-10-11T20:00:00Z");
    const h = (horas: number) => ahora - horas * 3600_000;
    const pedidos: string[] = [];
    let cupo = 3;
    const r = await rechequearAvisos(
      [{ avisoId: "a", chequeadoAt: h(30) }, { avisoId: "b", chequeadoAt: h(120) }, { avisoId: "c", chequeadoAt: null }, { avisoId: "d", chequeadoAt: h(2) }, { avisoId: "b", chequeadoAt: h(120) }, { avisoId: "e", chequeadoAt: h(60) }],
      async (id) => { pedidos.push(id); cupo--; return id === "b" ? "despublicado" : "publicado"; },
      () => cupo > 0, ahora,
    );
    if (pedidos.join() !== "c,b,e") F(`13 · el domingo no rechequea primero los chequeados hace más tiempo (sin fecha primero, sin repetir, sin los de hoy) dentro del tope (${pedidos.join()})`);
    if (!r.caidos.has("b") || r.caidos.size !== 1 || r.chequeados !== 3) F("13 · el rechequeo no devuelve los que ya no están");
    const todos: string[] = [];
    await rechequearAvisos([{ avisoId: "a", chequeadoAt: h(30) }, { avisoId: "d", chequeadoAt: h(2) }, { avisoId: "c", chequeadoAt: null }], async (id) => { todos.push(id); return "publicado"; }, () => true, ahora);
    if (FRESCO_DOMINGO_MS !== 24 * 3600_000 || todos.join() !== "c,a") F(`13 · lo chequeado hoy se vuelve a leer (o lo de ayer no) (${todos.join()})`);
    // el reemplazo
    type Rc = { avisoId: string; scoreCron: number | null };
    const rcs: Rc[] = ["r1", "r2", "r3", "r4", "r5", "r6"].map((id, i) => ({ avisoId: id, scoreCron: 10 - i }));
    const tablaR: Record<string, [string, number]> = { r1: ["COMPRAR", 90], r2: ["AJUSTA SUPUESTOS", 99], r3: ["COMPRAR", 85], r4: ["COMPRAR", 80], r5: ["COMPRAR", 75], r6: ["COMPRAR", 70] };
    const evR2 = async (c: Rc) => ({ veredicto: tablaR[c.avisoId][0], score: tablaR[c.avisoId][1], flujo: 1 });
    const vistosR: string[] = [];
    const rr = await siguienteReemplazo(rcs, new Set(["r1"]), evR2, async (c) => { vistosR.push(c.avisoId); return c.avisoId === "r5" ? "publicado" : "despublicado"; });
    if (rr?.c.avisoId !== "r5" || vistosR.join() !== "r3,r4,r5") F(`13 · el reemplazo no es el siguiente Comprar publicado por puntaje, sin los de la selección (${rr?.c.avisoId} · ${vistosR.join()})`);
    const sinCh = await siguienteReemplazo(rcs, new Set(["r1"]), evR2, async (c) => (c.avisoId === "r3" ? "sin-chequeo" : "publicado"));
    if (sinCh?.c.avisoId !== "r4") F(`13 · un reemplazo sin chequear entra a la página (${sinCh?.c.avisoId})`);
    const nada = await siguienteReemplazo(rcs, new Set(), evR2, async () => "despublicado");
    if (nada !== null || MAX_CHEQUEOS_REEMPLAZO !== 3) F("13 · el reemplazo chequea sin tope o inventa uno");
    // las filas de la página
    const its = [{ avisoId: "x1" }, { avisoId: "x2" }, { avisoId: "y1", reemplazaA: "x2" }, { avisoId: "y2", reemplazaA: "x2" }, { avisoId: "x3" }];
    const fp = filasDePagina(its, new Set(["x2", "y2", "x3"]));
    const desc = fp.map((f) => `${f.item.avisoId}:${f.caido ? "caido" : "ok"}:${f.reemplazo?.avisoId ?? "-"}`).join(",");
    if (desc !== "x1:ok:-,x2:caido:y1,x3:caido:-") F(`13 · las filas de la página no dicen el caído con su reemplazo vigente (${desc})`);
    if (SEMANAL_PAGINA.caido !== "Este ya no está publicado") F("13 · el aviso de caído no es «Este ya no está publicado»");
    // el servidor, la página y el cron
    const sv = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
    if (!/items = \[\.\.\.items, \{ \.\.\.itemDe\(r\.c, r\.ev\), reemplazaA: f\.item\.avisoId \}\];/.test(sv) || !/await admin\.from\(sel\.tabla\)\.update\(corta \? \{ items_str: items \} : \{ items \}\)\.eq\("id", sel\.id\);/.test(sv)) F("13 · el reemplazo no se guarda en la selección");
    if (!/\(await chequearPublicacion\(\{ id: c\.avisoId, url: c\.url, edificio: claveEdificio\(c\) \}, "clic", almacen, bajarFicha\)\)\.estado/.test(sv) || !/const pool = \[\.\.\.prep\.p\.candidatos, \.\.\.\(await prep\.p\.respaldo\.vecinas\(\)/.test(sv)) F("13 · el reemplazo no se chequea en el momento (o no mira las vecinas)");
    if (!/const x = await chequearPublicacion\(\{ id: avisoId, url: f\.url, edificio: claveEdificio\(f\) \}, "guia", almacen, bajarFicha\);/.test(sv)) F("13 · el rechequeo del domingo da por vigente lo chequeado en la semana");
    if (!/\.update\(\{ estado: "pendiente" \}\)\.in\("id", caidas\.map\(\(s\) => s\.id\)\)\.eq\("estado", "armada"\)\.is\("enviada_at", null\)/.test(sv)) F("13 · la selección que perdió un aviso no se vuelve a armar");
    const ar = sinComentarios(leer("src/app/api/cron/semanal-armar/route.ts"));
    if (!/const re = await rechequearArmadas\(admin, semana, presupuesto\);/.test(ar) || !/for \(const userId of re\.usuarios\) \{[\s\S]{0,120}await armarSeleccion\(admin, userId, semana, cfg, presupuesto\);/.test(ar)) F("13 · el domingo no rechequea las armadas ni rearma en la misma corrida");
    // ⚠ ACTA (21-oct-2026) · la selección vive en el dashboard; la lee el cargador compartido, viva como siempre.
    const pg = sinComentarios(leer("src/lib/guia/seleccion-pagina-servidor.ts"));
    if (!/const tabla = sel\.fuente === "inmediato" \? "avisos_inmediatos" : "semanal_selecciones";[\s\S]*?seleccionViva\(admin, \{ tabla, id: sel\.id, userId, items: sel\.items \}, cfg\)/.test(pg)) F("13 · /semanal no está viva");
    const li = sinComentarios(leer("src/app/semanal/semanal-lista.tsx"));
    if (!/<p className="guia-caido-txt">\{SEMANAL_PAGINA\.caido\}<\/p>/.test(li) || !/\{f\.reemplazo && tarjeta\(f\.reemplazo\)\}/.test(li)) F("13 · /semanal no dice el caído o no muestra el reemplazo en su lugar");
    // ⚠ ACTA (21-oct-2026) · antes de pedir la página de nuevo se cierra el aviso, que ahora queda abierto mientras genera.
    if (!/if \(res\.status === 410 && d\.error === "despublicado"\) \{ setConfirmar\(null\); router\.refresh\(\); break; \}/.test(li)) F("13 · si se da de baja al analizar, la página no trae el siguiente");
    for (const s of [SEMANAL_PAGINA.caido, SEMANAL_PAGINA.enSuLugar]) if (VOSEO.test(s)) F(`13 · voseo: «${s}»`);
  }

  // 14 · el reintento no alerta
  {
    if (esUltimaCorridaArmar(new Date("2026-10-04T22:05:00Z")) || !esUltimaCorridaArmar(new Date("2026-10-04T23:05:00Z")) || esUltimaCorridaArmar(new Date("2026-10-04T11:05:00Z"))) F("14 · la última corrida del armado no es la de las 23 UTC");
    const ar = sinComentarios(leer("src/app/api/cron/semanal-armar/route.ts"));
    const catches = ar.match(/\} catch \(e\) \{\s*(?:\/\/[^\n]*\s*)?if \(ultima\) cuenta\.fallidas\+\+;\s*else cuenta\.reintentar\+\+;/g) ?? [];
    if (catches.length !== 2 || !/const ultima = esUltimaCorridaArmar\(new Date\(t0\)\);/.test(ar)) F(`14 · una falla de una corrida intermedia cuenta como fallida (y alerta) aunque la siguiente la reintente (${catches.length} de 2)`);
    if (/cuenta\.fallidas\+\+;\s*capturar/.test(ar)) F("14 · queda un catch que cuenta fallida sin mirar si hay reintento");
    if (!/"25 11-23 \* \* 0"/.test(vj)) F("14 · el armado ya no termina a las 23 UTC: revisar esUltimaCorridaArmar");
  }

  // 15 · lo ya visto no ocupa lugar (19-oct-2026)
  {
    type V = { avisoId: string; scoreCron: number | null };
    const mk = (id: string, s: number): V => ({ avisoId: id, scoreCron: s });
    const comprar = (s: number) => ({ veredicto: "COMPRAR", score: s, flujo: 1000 });
    const pub = async () => "publicado" as const;
    const ids = (r: { items: Array<{ c: V; visto?: string }> }) => r.items.map((x) => `${x.c.avisoId}${x.visto ? `:${x.visto}` : ""}`).join(",");
    try {
      // EL CASO: una persona con un depto ya analizado (el de mejor puntaje) y cinco nuevos disponibles: el analizado no aparece.
      const seis = ["ana", "n1", "n2", "n3", "n4", "n5"].map((id, i) => mk(id, 99 - i));
      const evSeis = async (c: V) => comprar(c.avisoId === "ana" ? 95 : 90 - Number(c.avisoId.slice(1)));
      const pedidos: string[] = [];
      const caso = await elegirSemanal(seis, evSeis, async (c) => { pedidos.push(c.avisoId); return "publicado" as const; }, undefined, REGLA_LARGA, (c) => (c.avisoId === "ana" ? "analizado" : null));
      if (caso.items.some((x) => x.c.avisoId === "ana")) F(`15 · con cinco nuevos disponibles, el depto ya analizado igual aparece (${ids(caso)})`);
      if (ids(caso) !== "n1,n2,n3,n4,n5") F(`15 · con cinco nuevos, la selección no son los cinco nuevos por puntaje (${ids(caso)})`);
      if (pedidos.includes("ana")) F("15 · se gasta una lectura de ficha en un depto ya visto habiendo nuevos que alcanzan");
      // Sin cinco nuevos, se completa con lo visto, marcado y SIEMPRE al final (aunque lo visto tenga mejor puntaje).
      const mix = ["m1", "m2", "x1", "x2", "x3", "m3"].map((id, i) => mk(id, 99 - i));
      const evMix = async (c: V) => comprar(({ m1: 98, m2: 97, m3: 96, x1: 80, x2: 79, x3: 78 } as Record<string, number>)[c.avisoId]);
      const vMix = (c: V) => (c.avisoId.startsWith("m") ? (c.avisoId === "m2" ? "analizado" : "mandado") : null) as "mandado" | "analizado" | null;
      const r2 = await elegirSemanal(mix, evMix, pub, undefined, REGLA_LARGA, vMix);
      if (ids(r2) !== "x1,x2,x3,m1:mandado,m2:analizado") F(`15 · con tres nuevos, lo visto no completa al final y marcado (${ids(r2)})`);
      // Sin ningún nuevo, lo visto (marcado) arma la selección.
      const r3 = await elegirSemanal(mix.filter((c) => c.avisoId.startsWith("m")), evMix, pub, undefined, REGLA_LARGA, vMix);
      if (r3.estado !== "armada" || ids(r3) !== "m1:mandado,m2:analizado,m3:mandado") F(`15 · sin nuevos, lo visto no completa la selección (${r3.estado}: ${ids(r3)})`);
      // Un nuevo de una comuna vecina le gana el lugar a uno visto de sus comunas.
      const propV = [mk("p1", 99), mk("v1", 98), mk("v2", 97), mk("v3", 96), mk("v4", 95)];
      const vecN = [mk("c1", 90), mk("c2", 89), mk("c3", 88)];
      const evPV = async (c: V) => comprar(c.scoreCron ?? 0);
      const r4 = await elegirSemanal(propV, evPV, pub, { vecinas: async () => vecN }, REGLA_LARGA, (c) => (c.avisoId.startsWith("v") ? "mandado" : null));
      if (ids(r4) !== "p1,c1,c2,v1:mandado,v2:mandado" || r4.items.find((x) => x.c.avisoId === "c1")?.tramo !== "vecina") F(`15 · lo visto de sus comunas le gana el lugar a un nuevo de una vecina (${ids(r4)})`);
      // Renta corta: la misma regla.
      const r5 = await elegirSemanal(mix, evMix, pub, undefined, REGLA_CORTA, vMix);
      if (ids(r5) !== "x1,x2,x3,m1:mandado,m2:analizado") F(`15 · en renta corta lo visto no va al final (${ids(r5)})`);
      // El prechequeo: armada con lo visto pero con un nuevo sin chequear, se sigue por el nuevo.
      const memVis = async (c: V) => (c.avisoId === "x2" ? "sin-chequeo" as const : "publicado" as const);
      const pre = await siguienteYEstado(mix, evMix, memVis, undefined, REGLA_LARGA, vMix);
      if (pre.armada || pre.aviso?.avisoId !== "x2") F(`15 · el prechequeo da por armada con lo visto y deja sin chequear un nuevo (${pre.aviso?.avisoId ?? "nada"}, armada ${pre.armada})`);
      const preSin = await siguienteYEstado(mix, evMix, memVis, undefined, REGLA_LARGA);
      if (!preSin.armada) F("15 · sin vistos, el prechequeo cambió (armada con tres publicados ya chequeados)");
      // Lo visto se lee de lo mandado (los dos bloques) y de lo analizado; lo analizado pesa más; el informe de renta larga.
      const vs = vistosDeFilas({
        enviadas: [{ items: [{ avisoId: "a" }, { avisoId: "b" }], items_str: [{ avisoId: "c" }] }],
        informes: [{ id: "inf-b", avisoId: "b", largo: true }, { id: "inf-d", avisoId: "d", largo: false }, { id: "inf-b-viejo", avisoId: "b", largo: true }],
      });
      if (vs.get("a")?.visto !== "mandado" || vs.get("c")?.visto !== "mandado" || vs.get("b")?.visto !== "analizado" || vs.get("b")?.informeLargo !== "inf-b"
        || vs.get("d")?.visto !== "analizado" || vs.get("d")?.informeLargo !== undefined || vs.has("e")) F(`15 · lo visto no se arma de lo mandado y lo analizado (${JSON.stringify(Array.from(vs.entries()))})`);
      if (DIAS_VISTO !== 28 || MARCA_VISTO.mandado !== "Ya te lo mandamos" || MARCA_VISTO.analizado !== "Ya lo analizaste") F("15 · la ventana no son cuatro semanas o las marcas no son «Ya te lo mandamos» / «Ya lo analizaste»");
      // El lunes después del correo del día va solo si hay NUEVOS: lo visto no cuenta.
      if (queEnviarSemanal(3, { delDiaReciente: true, nuevos: 0 }) !== "nada" || queEnviarSemanal(3, { delDiaReciente: true, nuevos: 1 }) !== "seleccion" || queEnviarSemanal(3, { nuevos: 0 }) !== "seleccion") F("15 · después del correo del día sale un lunes solo con lo ya visto (o sin correo del día no sale)");
    } catch (err) {
      F(`15 · la selección no distingue lo ya visto (${(err as Error).message})`);
    }
    // El correo: la marca en la tarjeta.
    const cv = correoSemanal({ variante: "tarjetas", nombre: "Ana", busca: "2 dormitorios, Ñuñoa", piePct: 20, plazoAnios: 25, saldo: 1, conRegalo: false, urlBoton: "b", urlTres: "t", urlBaja: "z",
      deptos: [{ comuna: "Ñuñoa", tipologia: "2D2B", m2: 58, precioUF: 3980, veredicto: "COMPRAR", score: 80, flujo: 20000, url: "x" }, { comuna: "Macul", tipologia: "2D1B", m2: 50, precioUF: 3500, veredicto: "COMPRAR", score: 85, flujo: 10000, url: "y", visto: "mandado" } as DatosCorreoSemanal["deptos"][number]] });
    const iNuevo = cv.html.indexOf("UF 3.980"), iVisto = cv.html.indexOf("UF 3.500"), iMarca = cv.html.indexOf('data-marca="visto">Ya te lo mandamos<');
    if (iMarca < 0 || !(iNuevo < iVisto && iVisto < iMarca) || (cv.html.match(/data-marca="visto"/g) ?? []).length !== 1) F("15 · el correo no marca «Ya te lo mandamos» en el depto ya mandado (o lo marca en otro)");
    // El cableado: el armado, el prechequeo, la página viva y el envío usan lo visto.
    const srv = sinComentarios(leer("src/lib/guia/semanal-servidor.ts"));
    if (!/const g = await elegirSemanal\(candidatos, evaluar, publicado, respaldo, REGLA_LARGA, visto\);/.test(srv) || !/const g = await elegirSemanal\(candidatos, evaluar, publicado, respaldo, REGLA_CORTA, visto\);/.test(srv)) F("15 · el armado elige sin lo ya visto");
    if (!/const vistos = await vistosDePersona\(admin, userId\);\s*const prep = await prepararSeleccion\(admin, userId, cfg, \{ perfilLeido: pp, vistos \}\);/.test(srv) || !/prepararSeleccionStr\(admin, userId, cfg, pp, vistos\)/.test(srv)) F("15 · el armado no lee lo visto para los dos bloques");
    if (!/siguienteYEstado\(p\.ltr\.candidatos, p\.ltr\.evaluar, enMemoria, p\.ltr\.respaldo, REGLA_LARGA, p\.ltr\.visto\)/.test(srv) || !/siguienteYEstado\(p\.str\.candidatos, p\.str\.evaluar, enMemoria, p\.str\.respaldo, REGLA_CORTA, p\.str\.visto\)/.test(srv)) F("15 · el prechequeo elige sin lo ya visto");
    if (!/\.filter\(\(c\) => !prep\.p\.visto\(c\)\);/.test(srv)) F("15 · en la página viva, un depto ya visto puede tomar el lugar de uno caído");
    if (!/const vistos: Vistos = opts\.nuevosDesde \|\| opts\.delDia \? new Map\(\) : \(opts\.vistos \?\? await vistosDePersona\(admin, userId\)\);/.test(srv) || !/visto: \(c\) => vistos\.get\(c\.avisoId\)\?\.visto \?\? null,/.test(srv)) F("15 · la preparación no marca lo ya visto");
    if (!/const nuevos = \[\.\.\.deptos, \.\.\.deptosCortos\]\.filter\(\(d\) => !d\.visto\)\.length;/.test(srv) || !/delDiaReciente: delDia\.enviado, nuevos: conLargo \|\| conCorto \? nuevos : 0 \}/.test(srv)) F("15 · el envío cuenta lo ya visto como nuevo");
    if (!/\.\.\.\(visto \? \{ visto \} : \{\}\)/.test(srv) || !/const informeId = visto === "analizado" \? informeVisto\?\.\(c\.avisoId\) : undefined;/.test(srv)) F("15 · la selección no guarda la marca (o el informe del ya analizado)");
    const strSrv = sinComentarios(leer("src/lib/guia/semanal-str-servidor.ts"));
    if (!/const vistos = vistosLeidos \?\? await vistosDePersona\(admin, userId\);/.test(strSrv) || !/visto: \(c\) => vistos\.get\(c\.avisoId\)\?\.visto \?\? null,/.test(strSrv)) F("15 · el bloque de renta corta no marca lo ya visto");
    const vis = existsSync(join(RAIZ, "src/lib/guia/vistos-servidor.ts")) ? sinComentarios(leer("src/lib/guia/vistos-servidor.ts")) : "";
    if (!/\.from\("semanal_selecciones"\)\.select\("items, items_str"\)\.eq\("user_id", userId\)\.not\("enviada_at", "is", null\)\.gte\("enviada_at", desde\)/.test(vis)
      || !/const desde = new Date\(ahora\.getTime\(\) - DIAS_VISTO \* 864e5\)\.toISOString\(\);/.test(vis)
      || !/\.from\("analisis"\)\.select\("id, tipo_analisis, aviso:input_data->origenAviso->>avisoId"\)\.eq\("user_id", userId\)/.test(vis)) F("15 · lo visto no se lee de los correos de las últimas cuatro semanas y de lo analizado");
    // La página: la marca y, en renta larga, «Ya lo analizaste · Ver informe».
    const pg = sinComentarios(leer("src/app/semanal/semanal-lista.tsx"));
    if (!/\{it\.visto && !\(it\.visto === "analizado" && informeDe\(it\)\) && <p className="guia-negociar" data-semanal="visto">\{MARCA_VISTO\[it\.visto\]\}<\/p>\}/.test(pg)) F("15 · /semanal no marca lo ya visto");
    // ⚠ ACTA (21-oct-2026) · en renta larga también se lee en vivo lo ya analizado (\`informes\`, del servidor), no solo lo que
    // traía el depto al armarse (tier PUERTA-B-RECORRIDO §6).
    if (!/const informeDe = \(it: ItemSemanal\): string \| undefined => it\.informeId \?\? informes\[it\.avisoId\];/.test(pg) || !/href=\{corta \? `\/analisis\/renta-corta\/\$\{informe\}` : `\/analisis\/\$\{informe\}`\}/.test(pg)) F("15 · en renta larga, un depto ya analizado no lleva a su informe");
  }

  if (fallas.length === 0) console.log("  ✓ SEMANAL: Comprar publicados de a uno hasta cinco (tres o nada), domingo/lunes, regalo de reactivación (4 semanas sin analizar, uno cada 90 días), dos variantes con precio grande y botón rojo a la selección (sin saldo, con la línea del pack de tres), una vez por semana, clic que relee la ficha, los cinco eventos y la baja de un clic; respaldo hasta tres con vecinas y Ajustar negociables marcados; a toda persona con informe (desde el 13-oct, también solo de renta corta), presentándose la primera vez; prechequeo por turnos en las noches que sirve para descartar; rechequeo del domingo; /semanal viva con reemplazo; el reintento no alerta");
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
//   sobre la preparación compartida.
//   §13 (05-oct-2026, descartar y la página viva): 13/13 ROJO (V2, V7 y V9 al segundo intento: V2 y V9 quedaron VERDES
//   y se agregaron el rechequeo sin tope y el reemplazo «sin-chequeo»; V7 no aplicaba por la sangría). V1 los recientes primero ·
//   V2 vuelve a leer lo de hoy · V3 pasa el tope · V4 rechequea con la memoria de la semana · V5 no se rearma · V6 el cron no
//   rechequea · V7 el reemplazo puede ser Ajustar · V8 repite uno de la selección · V9 sin chequear · V10 no se guarda · V11
//   toma un reemplazo caído · V12 esconde el caído sin decirlo · V13 la página no está viva.
//   §14 (05-oct-2026, el reintento no alerta): 3/3 ROJO. R1 la última corrida es la de las 22 · R2 la falla intermedia
//   cuenta como fallida · R3 el rearmado intermedio cuenta como fallido. Y la excepción de la banda en CORREOS: la banda
//   también en «tarjetas» y la banda sin alt dan ROJO en CORREOS (2/2).
//   13-oct-2026 (decisión de Fabrizio: el registrado sin análisis compra el pack de tres; renta corta recibe el semanal):
//   §4 sin saldo es «Analizar uno» a la selección con la línea del pack debajo (ya no «Analizar uno · $9.990»), §7 el
//   checkout lee el origen por origenParam, §11 la lista incluye a quien solo tiene informes de renta corta. 3/3 ROJO:
//   S-a el correo sin la línea del pack · S-b el checkout pierde el origen · S-c solo renta larga en la lista.
//   §15 (19-oct-2026, lo ya visto no ocupa lugar; scratchpad rojo-semanal-prod.cjs y mutar-semanal15.cjs, restaurados byte a
//   byte): contra el código de producción, ROJO con el caso primero («el depto ya analizado igual aparece (ana,n1,n2,n3,n4)»)
//   y 19/19 mutaciones en ROJO: M1 la elección ignora lo visto · M2 sin marca · M3 sin la segunda vuelta · M4 las vecinas solo
//   con lo visto · M5 el prechequeo da por armada con lo visto · M6 el lunes cuenta lo visto como nuevo · M7 lo mandado le
//   gana a lo analizado · M8 ventana de 7 días · M9 el armado sin lo visto · M10 el prechequeo sin lo visto · M11 la página
//   viva repone con lo visto · M12 el envío cuenta lo visto como nuevo · M13 la selección no guarda la marca · M14 renta corta
//   sin lo visto · M15 lo mandado sin ventana · M16 el correo sin la marca · M17 la página sin la marca · M18 renta larga lleva
//   al informe de renta corta · M19 la preparación lee lo visto en el correo del día. La primera corrida contra producción se
//   cayó leyendo vistos-servidor.ts (no existe allá): ahora su ausencia es una falla, no una caída.
