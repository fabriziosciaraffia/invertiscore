// ============================================================================
// GOLDEN · GUIA-BUSQUEDA (30-sep-2026) — catch-test
// ============================================================================
//   «Por dónde seguir buscando» (FASE 2 de los avisos evaluados). Decisiones de Fabrizio, 30-sep-2026:
//   1 · EL VOCABULARIO DE LA GUÍA: el copy aprobado, palabra por palabra, y nunca «portafolio»,
//       «exclusivo» ni «oportunidad» para describir los parecidos (son una guía, no el portafolio).
//   2 · LA LÍNEA DEL TICKET NO SALE SIN LA GUÍA: el ticket la dice solo donde la guía existe, con el
//       mismo predicado (`hayGuia`) que la monta después de pagar, y la guía tiene su ruta.
//   3 · LOS RESGUARDOS DE LA FICHA: un GET sin seguir redirecciones, tope global por hora, sin reintentos, el
//       año compartido por edificio, por el proxy; solo la guía y «Analizar este» entran por esa puerta.
//   4 · EL CRÉDITO SE DESCUENTA UNA SOLA VEZ por persona y aviso: doble clic, reintento o falla a mitad.
//   5 · EL ORDEN: si ninguno conviene, primero MÁS PLAZO (30 años) y después MÁS PIE (hasta tres escalones
//       dentro del tope); solo los que convienen, hasta tres, el radio más chico; los sospechosos no entran.
//   7 · DESPUÉS DE PAGAR, UNA IDEA (01-oct-2026): «Tienes 3 análisis. Empieza por estos.», la frase de la
//       guía, los chips, las tarjetas y una línea para analizar otro depto con los números cargados. Sin el
//       bloque de color ni la frase por veredicto. Las tarjetas en Inter, sin mono ni mayúsculas.
//   8 · QUIEN PAGÓ SIN CUENTA escribe el código en la misma tarjeta y el informe sale al entrar, sin salir
//       de la pantalla (nada de mandarlo a /registro).
//   9 · SOLO PUBLICADOS (01-oct-2026): la guía chequea la ficha de los mejores de a uno y para al juntar tres;
//       lo que no se pudo chequear no se muestra; un chequeo se recuerda 24 horas; un despublicado sale de la
//       guía, de avisos_evaluados y del cron; al clic se relee y un despublicado NO descuenta crédito; cada
//       lectura queda con su código y motivo, el panel la muestra y un bloqueo alerta.
//  10 · «QUIERO VERLO» AUTOMÁTICO (01-oct-2026): el aviso le llega a la persona al instante, una sola vez
//       por interés, nunca si el aviso se despublicó o no se pudo chequear; nada sale a hola@; la vista del
//       admin es solo lectura.
//   6 · SIN ESPERA (30-sep-2026): la guía recalcula con la sonda del motor y la mediana guardada en la fila
//       evaluada (sin consultas en vivo), se calcula al confirmarse el pago del pack y se guarda por informe.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK. Sin red ni base.
// Solo:  node --import tsx scripts/eval/golden/guia-busqueda-catch-test.ts
// ============================================================================
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { GUIA, INFORME_DE_AVISO, TICKET_INCLUYE_GUIA, VEDADAS_GUIA } from "../../../src/lib/guia/copy";
import { DESPUES_DE_PAGAR } from "../../../src/lib/lo-que-sigue/copy";
import { GUIA_ACTIVA, hayGuia } from "../../../src/lib/guia/activa";
import { claveEdificio, parsearAnioFicha } from "../../../src/lib/guia/ficha-anio";
import {
  chequearPublicacion, clasificarFicha, leerFicha, MAX_LECTURAS_GUIA, MEMORIA_PUBLICACION_MS, TOPE_FICHAS_POR_HORA,
  type AlmacenPublicacion, type EstadoPublicacion, type LecturaFicha, type MotivoFicha, type RespuestaFicha,
} from "../../../src/lib/guia/publicacion";
import { pastillaFichas, type LecturasFicha } from "../../../src/lib/admin-fichas";
import { sinDespublicados } from "../../../src/lib/avisos/depurar";
import { mandarAvisoUnaVez, type PiezasQuieroVerlo } from "../../../src/lib/guia/quiero-verlo";
import { correoAvisoPedido } from "../../../src/lib/email/correos";
import { resumirQuieroVerlo, semanaDe } from "../../../src/lib/admin-quiero-verlo";
import { analizarAvisoDeGuia, analizarUnaVez, RECLAMO_VIGENTE_MS, type PiezasAnalizar, type Reclamo } from "../../../src/lib/guia/analizar-una-vez";
import { combinacionesGuia, elegirGuia, TOPE_GUIA, type Combinacion, type Evaluado } from "../../../src/lib/guia/seleccion";
import { sinComentarios } from "./lectura-paginada-catch-test";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");

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

export async function runGuiaBusquedaTier(): Promise<{ hard: number }> {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER GUIA-BUSQUEDA (la guía de búsqueda y su clic · 0 tokens) ───");

  // ── 1 · el vocabulario ──────────────────────────────────────────────────────
  const aprobado: Array<[string, string]> = [
    [GUIA.titulo, "Tienes 3 análisis. Empieza por estos."],
    [GUIA.cuerpo, "Deptos publicados hoy, parecidos y cercanos al que analizaste. Franco los revisó con tu pie y tu plazo: estos son los mejores."],
    [GUIA.usaUno, "usa 1 de tus 3"],
    [`${GUIA.otroDepto} ${GUIA.otroDeptoEnlace}`, "¿Tienes otro depto en mente? Analízalo con tus números ya cargados"],
    [GUIA.ajustada, "Ajustamos tu pie y tu plazo porque ninguno calzaba con esa combinación; estos son los mejores."],
    [GUIA.ninguno, "Ninguno conviene, ni con más plazo ni con más pie. Mejor sigue buscando en otra zona."],
    [GUIA.analizar, "Analizar este"],
    [GUIA.antiguedad, "Calculado con una antigüedad prudente de 25 años; el informe usa la real si el aviso la tiene."],
    [TICKET_INCLUYE_GUIA, "Incluye una selección de deptos publicados parecidos a este, ya revisados con tu pie y tu plazo. Analizas el que quieras con un clic."],
    [INFORME_DE_AVISO.origen, "Este análisis sale de un aviso publicado."],
    [INFORME_DE_AVISO.antiguedadSupuesta, "El aviso no dice la antigüedad; Franco supuso 25 años, lo más prudente."],
    [INFORME_DE_AVISO.boton, "Quiero verlo"],
    [INFORME_DE_AVISO.bajada, "Franco te hace llegar el aviso"],
    [INFORME_DE_AVISO.listo, "Listo. Te mandamos el aviso a tu correo."],
    [INFORME_DE_AVISO.despublicado, "Este aviso ya no está publicado."],
  ];
  for (const [tiene, debe] of aprobado) if (tiene !== debe) F(`1 · el copy «${debe}» cambió a «${tiene}»`);
  const vedada = new RegExp(VEDADAS_GUIA.map((w) => w.replace(/o$/, "[oa]s?")).join("|"), "i");
  if (VEDADAS_GUIA.join(",") !== "portafolio,exclusivo,oportunidad") F("1 · la lista de palabras vedadas cambió");
  // Las frases con dato (funciones) se barren con un ejemplo.
  const textos = [...Object.values(GUIA).map((x) => (typeof x === "function" ? x("persona@correo.cl") : x)), ...Object.values(INFORME_DE_AVISO), TICKET_INCLUYE_GUIA, ...Object.values(DESPUES_DE_PAGAR.fraseVeredicto), DESPUES_DE_PAGAR.cuerpo];
  for (const t of textos) if (vedada.test(t)) F(`1 · una palabra vedada describe a los parecidos: «${t}»`);
  for (const f of ["src/components/guia/GuiaBusqueda.tsx", "src/components/guia/InformeDeAviso.tsx", "src/app/api/lo-que-sigue/guia/route.ts"]) {
    const s = sinComentarios(leer(f));
    if (vedada.test(s)) F(`1 · ${f} usa una palabra vedada`);
  }
  const gb = sinComentarios(leer("src/components/guia/GuiaBusqueda.tsx"));
  if (!/<h1 className="guia-titulo">\{GUIA\.titulo\}<\/h1>/.test(gb) || !/const frase = !r \? null : !r\.disponible \? null : r\.estado === "ninguno" \? GUIA\.ninguno : r\.estado === "ajustada" \? GUIA\.ajustada : GUIA\.cuerpo;/.test(gb)) F("1 · la guía no dice el título, el caso ajustado o el caso sin ninguno con el copy aprobado");
  if (/<img|<a\s|\bc\.url\b|\bit\.url\b|href=\{?["'`]https?:/.test(gb)) F("1 · la guía enlaza al aviso o muestra una imagen (sin enlace, sin fotos)");
  if (!/<p className="guia-pie">\{GUIA\.antiguedad\} \{GUIA\.pie\}<\/p>/.test(gb)) F("1 · la guía no dice que calcula con 25 años y que el informe usa la real");
  const srvGuia = sinComentarios(leer("src/lib/guia/guia-servidor.ts"));
  const respuesta = (srvGuia.match(/export function respuestaGuia\([\s\S]*?\n\}/) ?? [""])[0];
  if (!respuesta || /\bc\.url\b|\burl:|titulo/.test(respuesta)) F("1 · la respuesta de la guía devuelve el enlace o el título del aviso");

  // ── 2 · la línea del ticket, solo con la guía ───────────────────────────────
  if (hayGuia("str") || hayGuia("ltr") !== GUIA_ACTIVA) F("2 · hayGuia no es «guía activa y renta larga»");
  const tk = sinComentarios(leer("src/components/lo-que-sigue/TicketPack.tsx"));
  if (!/\{hayGuia\(ctx\.modalidad\) && <p className="lqs-incluye" data-lqs="ticket-incluye">\{TICKET_INCLUYE_GUIA\}<\/p>\}/.test(tk)) F("2 · el ticket dice la línea de la guía sin preguntar si la guía existe (hayGuia)");
  const ret = sinComentarios(leer("src/app/payments/return/page.tsx"));
  if (!/\{retornoPack && \(paymentStatus === "paid" \|\| paymentStatus === "sin_sesion"\) && \(\s*hayGuia\(retornoPack\.modalidad\) \? \(\s*<GuiaBusqueda\b/.test(ret)) F("2 · después de pagar no se monta la guía con el mismo predicado que el ticket");
  if (!existsSync(join(RAIZ, "src/app/api/lo-que-sigue/guia/route.ts")) || !/fetch\(`\/api\/lo-que-sigue\/guia\?a=\$\{encodeURIComponent\(analysisId\)\}`\)/.test(gb)) F("2 · la guía no tiene ruta o el componente no la pide");
  for (const f of archivosSrc()) {
    if (f === "src/lib/guia/copy.ts" || f === "src/components/lo-que-sigue/TicketPack.tsx") continue;
    if (/TICKET_INCLUYE_GUIA/.test(sinComentarios(leer(f)))) F(`2 · ${f} usa la línea del ticket fuera del ticket`);
  }

  // ── 3 · los resguardos de la ficha ──────────────────────────────────────────
  const ahora = new Date("2026-09-30T12:00:00Z");
  const casos: Array<[string, number | null]> = [
    [`"characteristics":[{"name":"Dormitorios:","value":"2 "},{"name":"Año de construcción: ","value":"2012"}]`, 2012],
    [`"characteristics":[{"name":"Antigüedad: ","value":"8 años"}]`, 2018],
    [`Edificio de 10 pisos construído en el año 2012, a pasos del metro`, 2012],
    [`Departamento remodelado en 2019, impecable`, null],
    [`construido en 2031`, null],
    [`"characteristics":[{"name":"Dormitorios:","value":"2 "}]`, null],
  ];
  for (const [html, anio] of casos) if (parsearAnioFicha(html, ahora) !== anio) F(`3 · la ficha «${html.slice(0, 50)}…» da ${parsearAnioFicha(html, ahora)}, no ${anio}`);
  if (!(TOPE_FICHAS_POR_HORA > 0 && TOPE_FICHAS_POR_HORA <= 30)) F("3 · el tope por hora no está o se acerca al bloqueo de la fuente (~36)");
  if (!(MAX_LECTURAS_GUIA >= 2 * TOPE_GUIA && MAX_LECTURAS_GUIA <= 16)) F("3 · una guía puede gastar más de 16 GETs (o menos que los que necesita para mostrar tres)");
  // La clasificación de UN GET: solo el código y a dónde redirige. Medido el 01-oct-2026: toda ficha vieja
  // redirige a la nueva (`r_`, `o_`, `b_`), y la nueva responde 200 o 404 «Propiedad no disponible».
  const URL_F = "https://www.toctoc.com/propiedades/venta/departamento/las-condes/edificio-x/4274192";
  const clases: Array<[RespuestaFicha, MotivoFicha]> = [
    [{ status: 200, location: null, html: "<h1>Depto</h1>" }, "publicado"],
    [{ status: 404, location: null, html: null }, "despublicado"],
    [{ status: 410, location: null, html: null }, "despublicado"],
    [{ status: 307, location: "/venta/departamento/las-condes/b_4274192", html: null }, "redirige"],
    [{ status: 307, location: "http://www.toctoc.com/venta/departamento/la-cisterna/r_2166509", html: null }, "redirige"],
    [{ status: 307, location: "http://www.toctoc.com/venta/departamento/estacion-central/o_4293231", html: null }, "redirige"],
    [{ status: 301, location: "https://www.toctoc.com/propiedades/venta/departamento/las-condes/edificio-y/4274192", html: null }, "redirige"],
    [{ status: 302, location: "/venta/departamento/las-condes", html: null }, "despublicado"],
    [{ status: 302, location: "https://otro.cl/venta/departamento/x/r_1", html: null }, "error"],
    [{ status: 302, location: "/captcha?r=1", html: null }, "bloqueo"],
    [{ status: 403, location: null, html: null }, "bloqueo"],
    [{ status: 429, location: null, html: null }, "bloqueo"],
    [{ status: 500, location: null, html: null }, "error"],
    [{ status: 200, location: null, html: "  " }, "error"],
    [{ falla: "tiempo" }, "tiempo"],
    [{ falla: "red" }, "error"],
  ];
  for (const [resp, debe] of clases) {
    const m = clasificarFicha(URL_F, resp).motivo;
    if (m !== debe) F(`3 · la ficha que responde ${JSON.stringify(resp).slice(0, 70)} se lee «${m}», no «${debe}»`);
  }
  {
    let enLaHora = 0, desp = 0;
    const anotadas: LecturaFicha[] = [], cerradas: LecturaFicha[] = [];
    const alm: AlmacenPublicacion = {
      async publicacion() { return null; },
      async lecturasUltimaHora() { return enLaHora; },
      async anotar(l) { anotadas.push(l); enLaHora++; },
      async cerrar(l) { cerradas.push(l); },
      async guardarPublicacion() {},
      async despublicar() { desp++; },
      async alertarBloqueo() {},
    };
    const vieja = "https://www.toctoc.com/propiedades/compraparticularsr/departamento/nunoa/depto-x/77";
    const a = { id: "a", url: vieja, edificio: claveEdificio({ comuna: "Ñuñoa", lat: -33.45, lng: -70.6 }) };
    const urls: string[] = [];
    const fuente = (nueva: RespuestaFicha) => async (u: string): Promise<RespuestaFicha> => {
      urls.push(u);
      return u === vieja ? { status: 307, location: "http://www.toctoc.com/venta/departamento/nunoa/o_77", html: null } : nueva;
    };
    // Un chequeo: la vieja (redirige) y la nueva (por https), dos GETs anotados; el año sale del 200.
    const r1 = await leerFicha(a, "clic", alm, fuente({ status: 200, location: null, html: "construido en el año 2004" }), ahora);
    if (!r1.leida || r1.motivo !== "publicado" || r1.gets !== 2 || urls.join() !== `${vieja},https://www.toctoc.com/venta/departamento/nunoa/o_77`) F(`3 · el chequeo no sigue el salto de la ficha vieja a la nueva por https (${urls.join()})`);
    if (anotadas.map((l) => l.motivo).join() !== "redirige,publicado") F("3 · los dos GETs del chequeo no quedan anotados («redirige» y el resultado)");
    if (!r1.leida || r1.anio !== 2004 || cerradas[0]?.anio !== 2004 || cerradas[0]?.edificio !== a.edificio) F("3 · el chequeo no trae el año de la ficha nueva, o no lo cierra con su edificio (para compartirlo)");
    // La nueva da 404: la baja.
    const r2 = await leerFicha({ ...a, id: "b" }, "guia", alm, fuente({ status: 404, location: null, html: null }), ahora);
    if (!r2.leida || r2.motivo !== "despublicado" || desp !== 1) F("3 · la ficha nueva «no disponible» (404) no se lee como despublicado");
    // Una ficha nueva que vuelve a redirigir no se sigue.
    urls.length = 0;
    const r3 = await leerFicha({ ...a, id: "c" }, "guia", alm, fuente({ status: 307, location: "/venta/departamento/nunoa/o_78", html: null }), ahora);
    if (urls.length !== 2 || !r3.leida || r3.motivo !== "error") F("3 · se sigue más de un salto");
    // Sin reintentos.
    let intentos = 0;
    const r4 = await leerFicha({ ...a, id: "d" }, "guia", alm, async () => { intentos++; throw new Error("503"); }, ahora);
    if (intentos !== 1 || !r4.leida || r4.motivo !== "error") F("3 · una ficha que falla se reintenta o rompe la guía");
    // El tope se mira antes de cada GET, también antes del salto.
    urls.length = 0;
    enLaHora = TOPE_FICHAS_POR_HORA;
    const r5 = await leerFicha({ ...a, id: "e" }, "guia", alm, fuente({ status: 200, location: null, html: "x" }), ahora);
    if (r5.leida || urls.length !== 0) F("3 · con la hora llena se sale igual a la fuente (tope global)");
    enLaHora = TOPE_FICHAS_POR_HORA - 1;
    const r6 = await leerFicha({ ...a, id: "f" }, "guia", alm, fuente({ status: 200, location: null, html: "x" }), ahora);
    if (r6.leida || urls.length !== 1 || r6.gets !== 1) F("3 · el salto a la ficha nueva se da sin cupo en la hora");
    enLaHora = 0;
    const r7 = await leerFicha({ ...a, id: "g", url: null }, "guia", alm, fuente({ status: 200, location: null, html: "x" }), ahora);
    if (r7.leida || urls.length !== 1) F("3 · un aviso sin ficha sale a la fuente");
  }
  const srv = sinComentarios(leer("src/lib/guia/ficha-servidor.ts"));
  if ((srv.match(/\bfetch\(/g) ?? []).length !== 1 || !/redirect: "manual",/.test(srv) || !/dispatcher: proxyDispatcher,/.test(srv) || !/signal: AbortSignal\.timeout\(TIMEOUT_FICHA_MS\)/.test(srv) || /\bfor\s*\(|\bwhile\s*\(|reintent/i.test(srv)) F("3 · la bajada de la ficha no es UN pedido por el proxy, sin seguir redirecciones y con tiempo máximo");
  if (!/from\("lecturas_ficha"\)\.select\("id", \{ count: "exact", head: true \}\)\.gte\("leido_at", desde\)/.test(srv)) F("3 · el tope por hora no cuenta todas las lecturas (bitácora lecturas_ficha)");
  for (const f of archivosSrc()) {
    if (f.startsWith("src/lib/guia/")) continue;
    const s = sinComentarios(leer(f));
    if (/\bbajarFicha\b|\bleerFicha\(|\bchequearPublicacion\(/.test(s) && f !== "src/app/api/lo-que-sigue/guia/analizar/route.ts" && f !== "src/app/api/lo-que-sigue/quiero-verlo/route.ts") F(`3 · ${f} entra a la ficha por fuera de la guía, de «Analizar este» y de «Quiero verlo»`);
    if (/antiguedadDelAviso\(/.test(s) && f !== "src/app/api/lo-que-sigue/guia/analizar/route.ts") F(`3 · ${f} lee la antigüedad de la ficha y no es «Analizar este»`);
  }
  const claude = leer("CLAUDE.md");
  if (!/chequeo de publicación de la guía de búsqueda/.test(claude) || !/tope global por hora/.test(claude) || !/sin reintentos/.test(claude) || !/se recuerda 24 horas/.test(claude) || !/25 años supuestos/.test(claude) || !/`TOPE_FICHAS_POR_HORA` = 30/.test(claude)) F("3 · CLAUDE.md no documenta el chequeo de publicación, sus resguardos, el tope y los 25 años supuestos");

  // ── 4 · el crédito, una sola vez ────────────────────────────────────────────
  {
    type Fila = { analysisId: string | null; cobrado: boolean; mode: string | null; t: number };
    let reloj = 0;
    let fila: Fila | null = null;
    let cobros = 0, creados = 0, fallarCrear = false, sinCredito = false;
    const piezas = (): PiezasAnalizar => ({
      async reclamar(): Promise<Reclamo> {
        await Promise.resolve();
        if (!fila) { fila = { analysisId: null, cobrado: false, mode: null, t: reloj }; return { nueva: true }; }
        return { nueva: false, analysisId: fila.analysisId, cobrado: fila.cobrado, chargeMode: fila.mode, reclamadoHaceMs: reloj - fila.t };
      },
      async retomar() { if (!fila || fila.analysisId) return false; fila.t = reloj; return true; },
      async cobrar() { await Promise.resolve(); if (sinCredito) return { ok: false, status: 403, error: "sin-creditos" }; cobros++; return { ok: true, mode: "paid" }; },
      async marcarCobrado(mode) { if (fila) { fila.cobrado = true; fila.mode = mode; } },
      async crear() { await Promise.resolve(); if (fallarCrear) throw new Error("insert"); creados++; return { id: `inf-${creados}` }; },
      async marcarCreado(id) { if (fila) fila.analysisId = id; },
      async soltar() { if (fila && !fila.analysisId) fila = null; },
    });
    const [x, y] = await Promise.all([analizarUnaVez(piezas()), analizarUnaVez(piezas())]);
    if (cobros !== 1 || creados !== 1) F(`4 · doble clic: ${cobros} cobros y ${creados} informes (debe ser 1 y 1)`);
    if (![x.estado, y.estado].includes("creado") || ![x.estado, y.estado].some((e) => e === "en-curso" || e === "ya-creado")) F("4 · el segundo clic no espera ni devuelve el mismo informe");
    const z = await analizarUnaVez(piezas());
    if (z.estado !== "ya-creado" || cobros !== 1) F("4 · volver a tocar un aviso ya analizado cobra otra vez");
    // falla a mitad: cobrado, sin informe; el reintento (pasado el reclamo vigente) no vuelve a cobrar
    fila = null; cobros = 0; creados = 0; fallarCrear = true;
    await analizarUnaVez(piezas()).catch(() => null);
    fallarCrear = false;
    const w1 = await analizarUnaVez(piezas());
    reloj += RECLAMO_VIGENTE_MS + 1;
    const w2 = await analizarUnaVez(piezas());
    if (w1.estado !== "en-curso" || w2.estado !== "creado" || cobros !== 1 || creados !== 1) F(`4 · después de una falla a mitad el reintento cobra de nuevo (cobros ${cobros}) o no crea el informe`);
    // sin crédito: no queda nada cobrado ni la fila tomada
    fila = null; cobros = 0; creados = 0; sinCredito = true;
    const s1 = await analizarUnaVez(piezas());
    sinCredito = false;
    const s2 = await analizarUnaVez(piezas());
    if (s1.estado !== "sin-cobro" || s2.estado !== "creado" || cobros !== 1) F("4 · sin análisis disponibles la fila queda tomada y bloquea el siguiente intento");
  }
  const ruta = sinComentarios(leer("src/app/api/lo-que-sigue/guia/analizar/route.ts"));
  if (!/const r = await analizarAvisoDeGuia\(\{/.test(ruta) || /analizarUnaVez\(/.test(ruta) || !/return \{ ok: true, piezas: \{\s*async reclamar\(\)/.test(ruta) || (ruta.match(/ensureCreditCharged\(/g) ?? []).length !== 1 || /chargeAnalysisCredit/.test(ruta)) F("4 · «Analizar este» cobra por fuera del candado (analizarUnaVez)");
  if (!/primary key \(user_id, aviso_id\)/.test(leer("supabase/migrations/20260930_guia_busqueda.sql"))) F("4 · guia_analisis no tiene la clave persona + aviso");
  if (!/if \(error\.code !== "23505"\) throw/.test(ruta)) F("4 · el reclamo no distingue «ya existe» de un error real");
  if (!/const \{ data: \{ user \} \} = await supabase\.auth\.getUser\(\);\s*if \(!user\) return NextResponse\.json\(\{ error: "sin-sesion" \}, \{ status: 401 \}\);/.test(ruta) || !/o\.userId !== user\.id/.test(ruta)) F("4 · «Analizar este» corre sin sesión o sobre la guía de otro");

  // ── 5 · el orden: plazo antes que pie; solo los que convienen ───────────────
  const txt = (cs: Combinacion[]) => cs.map((c) => `${c.piePct}/${c.plazoAnios}`).join(" ");
  const casosCombo: Array<[number, number, string]> = [
    [15, 25, "15/25 15/30 20/30 25/30 30/30"],
    [20, 20, "20/20 20/30 25/30 30/30"],
    [10, 30, "10/30 15/30 20/30 25/30"],
    [5, 20, "5/20 5/30 10/30 15/30 20/30"],
    [30, 25, "30/25 30/30"],
  ];
  for (const [pie, plazo, debe] of casosCombo) if (txt(combinacionesGuia({ piePct: pie, plazoAnios: plazo })) !== debe) F(`5 · con pie ${pie}% y ${plazo} años se prueba «${txt(combinacionesGuia({ piePct: pie, plazoAnios: plazo }))}», no «${debe}»`);
  {
    const cand = [
      { avisoId: "c1", distanciaM: 300 }, { avisoId: "c2", distanciaM: 700 }, { avisoId: "c3", distanciaM: 900 },
      { avisoId: "c4", distanciaM: 1500 }, { avisoId: "c5", distanciaM: 2500 },
    ];
    const ev = (v: string, s: number): Evaluado => ({ veredicto: v, score: s, flujo: 0 });
    // Conviene con más plazo O con más pie a igual plazo: tiene que ganar el plazo.
    const todos = async (): Promise<EstadoPublicacion> => "publicado";
    const r = await elegirGuia(cand, combinacionesGuia({ piePct: 15, plazoAnios: 25 }), async (c, combo) =>
      combo.plazoAnios === 30 || combo.piePct >= 20 ? ev("COMPRAR", 60 + Number(c.avisoId[1])) : ev("AJUSTA SUPUESTOS", 50), todos);
    if (r.estado !== "ajustada" || r.combinacion?.piePct !== 15 || r.combinacion?.plazoAnios !== 30) F("5 · con ninguno a su combinación no prueba primero más plazo");
    if (r.items.length !== TOPE_GUIA || r.radioM !== 1000 || r.items.map((i) => i.c.avisoId).join() !== "c3,c2,c1") F("5 · no son los tres del radio más chico ordenados por puntaje");
    const n = await elegirGuia(cand, combinacionesGuia({ piePct: 20, plazoAnios: 30 }), async () => ev("AJUSTA SUPUESTOS", 69), todos);
    if (n.estado !== "ninguno" || n.items.length !== 0) F("5 · sin ninguno que convenga se muestran igual (debe ser «ninguno», sin lista)");
    const m = await elegirGuia(cand, [{ piePct: 20, plazoAnios: 30 }], async (c) => (c.avisoId === "c5" ? ev("COMPRAR", 70) : ev("AJUSTA SUPUESTOS", 90)), todos);
    if (m.estado !== "normal" || m.items.length !== 1 || m.radioM !== 3000 || m.items[0].ev.veredicto !== "COMPRAR") F("5 · entran los que no convienen, o no se amplía el radio hasta encontrar");
  }
  // ── 6 · sin espera ──────────────────────────────────────────────────────────
  const evalGuia = (srvGuia.match(/const evaluar = async \(c: CandidatoGuia, combo: Combinacion\)[\s\S]*?\n  \};/) ?? [""])[0];
  if (!/const s = sondaConPatch\(body as never, cfg\.uf, mediana as never, asOf, \{\}\);/.test(evalGuia) || /runAnalysis\(/.test(srvGuia)) F("6 · la guía corre el motor entero por candidato (debe ser la sonda)");
  if (!/let mediana = c\.medianaComuna;\s*if \(mediana == null\) \{/.test(evalGuia)) F("6 · la guía pide la mediana en vivo aunque esté guardada en la fila evaluada");
  const evalAviso = sinComentarios(leer("src/lib/avisos/evaluar-aviso.ts"));
  // 01-oct-2026: el body sin methodologyVersion corría el modelo de costos viejo (Comprar 73 en la guía, 82 en el
  // informe). Una sola puerta, payloadDeAviso, y nadie de la guía ni de la evaluación llama buildLtrPayload pelado.
  if (!/body\.methodologyVersion = METHODOLOGY_VERSION_ACTUAL;/.test((evalAviso.match(/export function payloadDeAviso[\s\S]*?\n\}/) ?? [""])[0])) F("6 · el body del aviso no lleva methodologyVersion (el motor corre el modelo de costos viejo)");
  for (const f of ["src/lib/avisos/evaluar-aviso.ts", "src/lib/guia/guia-servidor.ts", "src/lib/guia/analizar-servidor.ts"]) {
    const s = sinComentarios(leer(f)).replace(/export function payloadDeAviso[\s\S]*?\n\}/, "");
    if (/buildLtrPayload\(/.test(s)) F(`6 · ${f} arma el body del aviso sin payloadDeAviso (sin methodologyVersion)`);
  }
  if (!/out\.mediana_comuna = mediana \?\? null;/.test(evalAviso) || !/ae\.mediana_comuna/.test(leer("supabase/migrations/20261001_guia_publicados.sql"))) F("6 · la evaluación no guarda la mediana comunal (o la RPC no la devuelve)");
  const apiGuia = sinComentarios(leer("src/app/api/lo-que-sigue/guia/route.ts"));
  if (!/const guardada = await guiaGuardada\(admin, a\);\s*const r = guardada \?\? \(await calcularYGuardarGuia\(admin, a\)\);/.test(apiGuia)) F("6 · la pantalla no lee la guía guardada antes de calcularla");
  const confirm = sinComentarios(leer("src/app/api/payments/confirm/route.ts"));
  if (!/if \(hayGuia\(modalidadDeTipo\(filaPack\?\.tipo_analisis as string \| null\)\)\) \{\s*const idGuia = analysisId;\s*waitUntil\(calcularYGuardarGuia\(supabase, idGuia\)/.test(confirm)) F("6 · la guía no se calcula al confirmarse el pago del pack (o se calcula para renta corta)");

  // ── 7 · después de pagar, una idea ──────────────────────────────────────────
  if (/DESPUES_DE_PAGAR|fraseVeredicto|lqs-mat|lqs-btn|<DespuesDePagar\b/.test(gb)) F("7 · la guía vuelve a traer el bloque de color o la frase por veredicto");
  if (!/\{retornoPack && \(paymentStatus === "paid" \|\| paymentStatus === "sin_sesion"\) && \(\s*hayGuia\(retornoPack\.modalidad\) \? \(\s*<GuiaBusqueda[\s\S]{0,260}?sinGuia=\{<DespuesDePagar [^>]*\/>\}\s*\/>\s*\) : \(\s*<DespuesDePagar /.test(ret)) F("7 · después de pagar se ven la guía y el bloque de color a la vez (con guía, solo la guía)");
  if (!/\{GUIA\.otroDepto\}\{" "\}\s*<EnlaceCarga href=\{conSesion \? precarga : `\/registro\?next=\$\{encodeURIComponent\(precarga\)\}`\}/.test(gb)) F("7 · falta la línea «¿Tienes otro depto en mente? Analízalo con tus números ya cargados» al wizard precargado");
  if (!/<span className="guia-cr">· \{GUIA\.usaUno\}<\/span>/.test(gb)) F("7 · la tarjeta no dice «Analizar este · usa 1 de tus 3»");
  if (!/capturarLqs\(posthog, EVENTOS_LQS\.postPagoVisto, \{ analysisId, veredicto, modalidad: "ltr" \}/.test(gb)) F("7 · la pantalla de después de pagar dejó de medir post_pago_visto");
  const cssGuia = leer("src/components/guia/guia.css");
  const cssTarjetas = cssGuia.slice(0, cssGuia.indexOf("/* ── el informe que sale de un aviso"));
  if (!cssTarjetas || /font-mono|monospace|text-transform:\s*uppercase|letter-spacing:\s*0\.0[5-9]em/.test(cssTarjetas) || !/\.guia \{[^}]*font-family: var\(--font-ui\), "Inter"/.test(cssTarjetas)) F("7 · las tarjetas vuelven al mono o a las mayúsculas (deben ir en Inter)");
  // El modal de confirmación del wizard (01-oct-2026): «El primero va por cuenta de Franco.», sin «sin crear cuenta».
  const resumenW = sinComentarios(leer("src/components/formulario-v4/screenResumen.tsx"));
  if (!/\? "El primero va por cuenta de Franco\."/.test(resumenW) || /sin crear cuenta/.test(resumenW)) F("7 · el modal de confirmación no dice «El primero va por cuenta de Franco.» (o vuelve «sin crear cuenta»)");
  // ── 8 · el código en la tarjeta ─────────────────────────────────────────────
  if (/router\.push\(`\/registro/.test(gb)) F("8 · quien pagó sin cuenta sale de la pantalla a registrarse");
  if (!/if \(!sesion\) \{ setError\(null\); setRegistrando\(it\.avisoId\); return; \}/.test(gb) || !/if \(res\.status === 401\) \{ setConSesion\(false\); setGenerando\(null\); setRegistrando\(it\.avisoId\); return; \}/.test(gb)) F("8 · sin sesión «Analizar este» no pide el código en la tarjeta");
  if (!/\{registrando === it\.avisoId \? \(\s*<RegistroEnTarjeta ctx=\{ctx\} next=\{[^}]*\}[^>]*alEntrar=\{\(\) => \{ setConSesion\(true\); void analizar\(it, true\); \}\} \/>/.test(gb)) F("8 · al entrar con el código no se genera el informe de esa tarjeta");
  const regT = sinComentarios(leer("src/components/guia/RegistroEnTarjeta.tsx"));
  if (!/signInWithOtp\(\{\s*email: c,/.test(regT) || !/verifyOtp\(\{ email: enviado, token: t, type: "email" \}\)/.test(regT) || !/await reclamarAnalisisAnonimos\(posthog, "register"\);[\s\S]{0,260}?EVENTOS_LQS\.registroCompletado[\s\S]{0,120}?alEntrar\(\);/.test(regT)) F("8 · el registro de la tarjeta no es el registro en un paso (código, reclamo y evento antes de generar)");
  if (/router\.|window\.location\.(href|assign)/.test(regT)) F("8 · el registro de la tarjeta navega fuera de la pantalla");


  // ── 9 · solo publicados; un despublicado no cobra ───────────────────────────
  {
    // 9a · la guía nunca muestra un aviso sin chequear, y chequea de a uno hasta juntar tres.
    const cand = ["a", "b", "c", "d", "e", "f"].map((id, k) => ({ avisoId: id, distanciaM: 100 + k * 50 }));
    const pub: Record<string, EstadoPublicacion> = { a: "publicado", b: "despublicado", c: "sin-chequeo", d: "publicado", e: "publicado", f: "publicado" };
    const llamados: string[] = [];
    const g = await elegirGuia(cand, [{ piePct: 20, plazoAnios: 30 }], async (c) => ({ veredicto: "COMPRAR", score: 90 - "abcdef".indexOf(c.avisoId), flujo: 0 }),
      async (c) => { llamados.push(c.avisoId); return pub[c.avisoId]; });
    if (g.items.some((it) => pub[it.c.avisoId] !== "publicado")) F("9 · la guía muestra un aviso despublicado o sin chequear");
    if (g.items.map((it) => it.c.avisoId).join() !== "a,d,e") F(`9 · la guía no son los tres mejores publicados en orden (${g.items.map((it) => it.c.avisoId).join()})`);
    if (llamados.join() !== "a,b,c,d,e") F(`9 · la guía no chequea de a uno, en orden, parando al tercero publicado (chequeó ${llamados.join()})`);
    if (g.sinChequeo !== 1) F("9 · la guía no cuenta los que no pudo chequear");
    const nada = await elegirGuia(cand, [{ piePct: 20, plazoAnios: 30 }], async () => ({ veredicto: "COMPRAR", score: 80, flujo: 0 }), async () => { throw new Error("sin red"); });
    if (nada.items.length !== 0 || nada.estado !== "ninguno" || nada.sinChequeo !== cand.length) F("9 · sin poder chequear, la guía muestra igual");
    const srvG = sinComentarios(leer("src/lib/guia/guia-servidor.ts"));
    if (!/elegirGuia\(candidatos, combinacionesGuia\([^)]*\), evaluar, publicado\)/.test(srvG)) F("9 · la guía del servidor se arma sin el chequeo de publicación");
    if (!/\{ sinLeer: bloqueada \|\| lecturas >= MAX_LECTURAS_GUIA \}/.test(srvG) || !/lecturas \+= r\.lectura\?\.gets \?\? 0;/.test(srvG)) F("9 · la guía lee fichas sin presupuesto (o sigue leyendo después de un bloqueo)");
    if (!/if \(g\.estado === "ninguno" && g\.sinChequeo > 0\) return \{ disponible: false \};/.test(srvG)) F("9 · sin ninguno chequeado, la guía dice «ninguno conviene» en vez de caer a la pantalla de siempre");
    const guardadaFn = (srvG.match(/export async function guiaGuardada[\s\S]*?\n\}/) ?? [""])[0];
    if (!/from\("publicacion_avisos"\)\.select\("aviso_id"\)\.in\("aviso_id", ids\)\.eq\("estado", "despublicado"\);\s*if \(error \|\| \(idas\?\.length \?\? 0\) > 0\) return null;/.test(guardadaFn)) F("9 · la guía guardada sigue mostrando un aviso que se despublicó después");
    if (!/and not exists \(select 1 from publicacion_avisos pd where pd\.aviso_id = sp\.id and pd\.estado = 'despublicado'\)/.test(leer("supabase/migrations/20261001_guia_publicados.sql"))) F("9 · los candidatos traen despublicados");

    // 9a · la memoria de 24 horas y lo que se hace con cada motivo.
    const ahora9 = new Date("2026-10-01T12:00:00Z");
    let mem: { estado: "publicado" | "despublicado"; chequeadoAt: Date } | null = null;
    let pedidos = 0, desp = 0, alertas = 0, guardadas = 0;
    const alm: AlmacenPublicacion = {
      async publicacion() { return mem; },
      async lecturasUltimaHora() { return 0; },
      async anotar() {},
      async cerrar() {},
      async guardarPublicacion() { guardadas++; },
      async despublicar() { desp++; },
      async alertarBloqueo() { alertas++; },
    };
    const av = { id: "x", url: "https://www.toctoc.com/propiedades/venta/departamento/nunoa/y/1", edificio: "e" };
    const resp = (r: RespuestaFicha) => async () => { pedidos++; return r; };
    const ok200 = resp({ status: 200, location: null, html: "<h1>x</h1>" });
    mem = { estado: "publicado", chequeadoAt: new Date(ahora9.getTime() - 60 * 60 * 1000) };
    const m1 = await chequearPublicacion(av, "guia", alm, ok200, { ahora: ahora9 });
    if (m1.estado !== "publicado" || pedidos !== 0) F("9 · un aviso chequeado hace una hora se vuelve a leer (se recuerda 24 horas)");
    mem = { estado: "publicado", chequeadoAt: new Date(ahora9.getTime() - MEMORIA_PUBLICACION_MS - 1) };
    await chequearPublicacion(av, "guia", alm, ok200, { ahora: ahora9 });
    if (pedidos !== 1) F("9 · un chequeo de hace más de 24 horas se da por bueno");
    mem = { estado: "publicado", chequeadoAt: ahora9 };
    await chequearPublicacion(av, "clic", alm, ok200, { forzar: true, ahora: ahora9 });
    if (pedidos !== 2) F("9 · «Analizar este» no vuelve a chequear la ficha");
    mem = null;
    const m4 = await chequearPublicacion(av, "guia", alm, ok200, { sinLeer: true, ahora: ahora9 });
    if (m4.estado !== "sin-chequeo" || pedidos !== 2) F("9 · sin presupuesto se lee igual, o un aviso sin chequear se da por publicado");
    const guardadasAntes = guardadas;
    const m5 = await chequearPublicacion(av, "guia", alm, async (u) => { pedidos++; return /b_1$/.test(u) ? { status: 404, location: null, html: null } : { status: 307, location: "/venta/departamento/nunoa/b_1", html: null }; }, { ahora: ahora9 });
    if (m5.estado !== "despublicado" || desp !== 1 || guardadas !== guardadasAntes + 1 || alertas !== 0) F("9 · un despublicado no queda marcado, no sale de avisos_evaluados, o alerta");
    mem = { estado: "despublicado", chequeadoAt: new Date(ahora9.getTime() - 3 * MEMORIA_PUBLICACION_MS) };
    const m6 = await chequearPublicacion(av, "clic", alm, ok200, { forzar: true, ahora: ahora9 });
    if (m6.estado !== "despublicado" || pedidos !== 4) F("9 · un despublicado marcado se vuelve a leer o vuelve a la guía");
    mem = null;
    const m7 = await chequearPublicacion(av, "guia", alm, resp({ status: 403, location: null, html: null }), { ahora: ahora9 });
    if (m7.estado !== "sin-chequeo" || alertas !== 1) F("9 · un bloqueo no alerta, o el aviso bloqueado se da por publicado");
    if (sinDespublicados([{ id: "x" }, { id: "y" }], new Set(["x"])).map((a) => a.id).join() !== "y") F("9 · el cron vuelve a evaluar los despublicados");
    const cron = sinComentarios(leer("src/app/api/cron/evaluar-avisos/route.ts"));
    if (!/const evaluables = sinDespublicados\(avisosEvaluables\(filas, cfg\.uf\), new Set\(despublicados\.map/.test(cron)) F("9 · el cron de evaluación no deja fuera a los despublicados");
  }
  {
    // 9b · un despublicado nunca descuenta crédito.
    let cobros = 0, reclamos = 0, preparados = 0, avisos = 0;
    const piezas: PiezasAnalizar = {
      async reclamar() { reclamos++; return { nueva: true }; },
      async retomar() { return false; },
      async cobrar() { cobros++; return { ok: true, mode: "paid" }; },
      async marcarCobrado() {},
      async crear() { return { id: "inf" }; },
      async marcarCreado() {},
      async soltar() {},
    };
    const correr = (e: EstadoPublicacion) => analizarAvisoDeGuia({
      async chequear() { return e; },
      async alDespublicar() { avisos++; },
      async preparar() { preparados++; return { ok: true, piezas }; },
    });
    const d = await correr("despublicado");
    if (d.estado !== "despublicado" || cobros !== 0 || reclamos !== 0 || preparados !== 0 || avisos !== 1) F(`9 · un aviso despublicado descuenta crédito o se prepara (cobros ${cobros}, reclamos ${reclamos})`);
    const p = await correr("publicado");
    if (p.estado !== "creado" || cobros !== 1) F("9 · un aviso publicado no se analiza");
    const ruta9 = sinComentarios(leer("src/app/api/lo-que-sigue/guia/analizar/route.ts"));
    if (!/chequearPublicacion\(ficha, "clic", almacenPublicacion\(admin\), bajarFicha, \{ forzar: true \}\)/.test(ruta9)) F("9 · «Analizar este» no relee la ficha antes de cobrar");
    if (!/if \(r\.estado === "despublicado"\) return NextResponse\.json\(\{ error: "despublicado" \}, \{ status: 410 \}\);/.test(ruta9) || !/from\("guias_calculadas"\)\.delete\(\)\.eq\("analysis_id", o\.analysisId\)/.test(ruta9)) F("9 · un despublicado al clic no responde 410 o no obliga a rearmar la guía");
    if (GUIA.despublicado !== "Este aviso ya no está publicado.") F("9 · la tarjeta no dice «Este aviso ya no está publicado.»");
    if (!/if \(res\.status === 410 && d\.error === "despublicado"\) \{\s*setError\(\{ avisoId: it\.avisoId, texto: GUIA\.despublicado \}\);\s*setGenerando\(null\);\s*void reemplazar\(\);/.test(gb)) F("9 · la tarjeta no dice que el aviso se despublicó, o la guía no lo reemplaza");
  }
  {
    // 9c · el panel: un bloqueo es rojo; un despublicado, no.
    const base = (p: Partial<LecturasFicha["porMotivo"]>): LecturasFicha => ({ total: 1, porMotivo: { redirige: 0, publicado: 0, despublicado: 0, bloqueo: 0, error: 0, tiempo: 0, ...p }, ultimoBloqueo: null, falla: false });
    if (pastillaFichas(base({ bloqueo: 1 })).estado !== "error") F("9 · un bloqueo no pone roja la pastilla de fichas");
    if (pastillaFichas(base({ redirige: 5, despublicado: 3, publicado: 2 })).estado !== "ok") F("9 · un despublicado cambia el color de la pastilla");
    if (!/label: "Fichas \(24 h\)",\s*\.\.\.pastillaFichas\(lecturasFicha\),/.test(sinComentarios(leer("src/app/admin/operacion/page.tsx")))) F("9 · el panel de operación no muestra las lecturas de ficha");
    if (!/alertarUnaVezAlDia\([\s\S]{0,400}?"bloqueo",\s*\)/.test(sinComentarios(leer("src/lib/guia/ficha-servidor.ts")))) F("9 · el bloqueo no alerta una vez al día");
  }


  // ── 10 · «Quiero verlo» automático (01-oct-2026) ───────────────────────────
  {
    // El correo sale UNA vez por interés, nunca para un aviso despublicado ni sin chequear.
    type Fila = { enviado: boolean; despublicado: boolean };
    let fila: Fila = { enviado: false, despublicado: false };
    let correos = 0, fallar = false;
    const piezas = (estado: EstadoPublicacion): PiezasQuieroVerlo => ({
      async yaEnviado() { await Promise.resolve(); return fila.enviado; },
      async chequear() { await Promise.resolve(); return estado; },
      async marcarDespublicado() { fila.despublicado = true; },
      async reclamar() { await Promise.resolve(); if (fila.enviado) return false; fila.enviado = true; return true; },
      async enviar() { await Promise.resolve(); if (fallar) return false; correos++; return true; },
      async soltar() { fila.enviado = false; },
    });
    const [a, b] = await Promise.all([mandarAvisoUnaVez(piezas("publicado")), mandarAvisoUnaVez(piezas("publicado"))]);
    const c = await mandarAvisoUnaVez(piezas("publicado"));
    if (correos !== 1 || ![a, b].includes("enviado") || c !== "ya-enviado") F(`10 · el correo del aviso sale más de una vez por interés (${correos} correos)`);
    fila = { enviado: false, despublicado: false }; correos = 0;
    const d = await mandarAvisoUnaVez(piezas("despublicado"));
    if (d !== "despublicado" || correos !== 0 || !fila.despublicado || fila.enviado) F("10 · sale el correo de un aviso despublicado (o no queda anotado)");
    const e = await mandarAvisoUnaVez(piezas("sin-chequeo"));
    if (e !== "sin-chequeo" || correos !== 0) F("10 · sale el correo de un aviso que no se pudo chequear");
    fila = { enviado: false, despublicado: false }; fallar = true;
    const g1 = await mandarAvisoUnaVez(piezas("publicado"));
    fallar = false;
    const g2 = await mandarAvisoUnaVez(piezas("publicado"));
    if (g1 !== "fallo-envio" || g2 !== "enviado" || correos !== 1) F("10 · un envío que falla deja la fila tomada (el siguiente toque no lo manda)");
    const qv = sinComentarios(leer("src/app/api/lo-que-sigue/quiero-verlo/route.ts"));
    if (!/const r = await mandarAvisoUnaVez\(\{/.test(qv) || (qv.match(/sendAvisoPedidoEmail\(/g) ?? []).length !== 1) F("10 · la ruta manda el correo por fuera de mandarAvisoUnaVez");
    if (!/"clic", almacenPublicacion\(admin\), bajarFicha,\s*\);/.test(qv)) F("10 · la ruta no chequea la ficha con la memoria de 24 horas");
    if (!/\.match\(fila\)\.is\("correo_enviado_at", null\)\.select\("analysis_id"\);\s*return \(data\?\.length \?\? 0\) === 1;/.test(qv)) F("10 · el reclamo del correo no es atómico (correo_enviado_at null → ahora)");
    if (!/if \(r === "despublicado"\) return NextResponse\.json\(\{ error: "despublicado" \}, \{ status: 410 \}\);/.test(qv)) F("10 · un aviso despublicado no responde 410");
    if (!/\.from\("interes_avisos"\)\.insert\(/.test(qv)) F("10 · el interés deja de guardarse en la base");
    // Nada sale a hola@ por «Quiero verlo».
    const em = sinComentarios(leer("src/lib/email.ts"));
    const fnPedido = (em.match(/export async function sendAvisoPedidoEmail[\s\S]*?\n\}/) ?? [""])[0];
    if (!fnPedido || /hola@refranco\.ai/.test(fnPedido) || /sendInteresAvisoInterno|interes_aviso/.test(em) || /hola@|sendInteres/.test(qv)) F("10 · «Quiero verlo» sigue mandando algo a hola@");
    // El copy del correo, palabra por palabra.
    const m = correoAvisoPedido({ nombre: "Camila Rojas", comuna: "Ñuñoa", url: "https://ejemplo.cl/aviso", veredicto: "COMPRAR", flujo: 12000 });
    const t = m.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    if (m.subject !== "El depto de Ñuñoa que analizaste") F(`10 · el asunto cambió: «${m.subject}»`);
    for (const frase of ["Hola, Camila:", "Acá está el aviso del depto que pediste.", "Ver el aviso", "Franco lo analizó con tu pie y tu plazo: Comprar, +$12.000 al mes.", "Antes de visitarlo, confirma con quien lo publica que sigue disponible y que el precio es el publicado.", "Franco"]) {
      if (!t.includes(frase)) F(`10 · el correo no dice «${frase}»`);
    }
    if (!/href="https:\/\/ejemplo\.cl\/aviso"/.test(m.html)) F("10 · el botón no lleva al aviso");
    if (/visita|negociaci|te ayudamos|ayudarte/i.test(t.replace("Antes de visitarlo", ""))) F("10 · el correo ofrece ayuda con la visita o la negociación");
    if (!correoAvisoPedido({ nombre: null, comuna: "Macul", url: "https://x", veredicto: "BUSCAR OTRA", flujo: -150000 }).html.replace(/<[^>]+>/g, " ").includes("Hola:")) F("10 · sin nombre el saludo no es «Hola:»");
    // La pantalla.
    const iav = sinComentarios(leer("src/components/guia/InformeDeAviso.tsx"));
    if (!/setEstado\(r\.ok \? "listo" : r\.status === 410 \? "despublicado" : "error"\);/.test(iav) || !/\{INFORME_DE_AVISO\.despublicado\}/.test(iav) || /listoBajada|hoy o mañana/.test(iav)) F("10 · la pantalla no dice «Este aviso ya no está publicado.» o sigue con «hoy o mañana hábil»");
    // El admin: los totales, y solo lectura.
    const res = resumirQuieroVerlo([
      { comuna: "Ñuñoa", veredicto: "COMPRAR", creadoAt: "2026-09-29T15:00:00Z" },
      { comuna: "Ñuñoa", veredicto: "AJUSTA SUPUESTOS", creadoAt: "2026-10-01T15:00:00Z" },
      { comuna: "Macul", veredicto: "COMPRAR", creadoAt: "2026-10-06T15:00:00Z" },
    ]);
    if (res.total !== 3 || res.porComuna[0].k !== "Ñuñoa" || res.porComuna[0].n !== 2 || res.porVeredicto[0].k !== "COMPRAR" || res.porVeredicto[0].n !== 2) F("10 · los totales por comuna o por veredicto no cuadran");
    if (semanaDe("2026-10-01T15:00:00Z") !== "2026-09-28" || res.porSemana.map((x) => `${x.k}:${x.n}`).join() !== "2026-10-05:1,2026-09-28:2") F(`10 · los totales por semana no van de lunes a domingo (${res.porSemana.map((x) => `${x.k}:${x.n}`).join()})`);
    for (const f of ["src/app/admin/quiero-verlo/page.tsx", "src/lib/admin-quiero-verlo.ts"]) {
      if (/\.(insert|update|upsert|delete)\(|\.rpc\(|"use server"/.test(sinComentarios(leer(f)))) F(`10 · ${f} escribe (la vista es solo lectura)`);
    }
    if (!/\{ href: "\/admin\/quiero-verlo", label: "Quiero verlo" \}/.test(leer("src/app/admin/admin-tabs.tsx"))) F("10 · la vista no tiene pestaña en el panel");
  }

  const mig = leer("supabase/migrations/20261001_guia_publicados.sql");
  if (!/and ae\.arriendo_sospechoso is not true/.test(mig) || !/and sp\.dormitorios = prop_dorms/.test(mig) || !/and sp\.scraped_at >= desde/.test(mig)) F("5 · los candidatos no excluyen los sospechosos, o no piden los mismos dormitorios y los 7 días");

  if (fallas.length) {
    console.log(`  ✗ GUIA-BUSQUEDA · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el copy aprobado sin palabras vedadas; la línea del ticket solo con la guía; la ficha con tope por hora y sin reintentos; el crédito una sola vez; primero plazo, después pie, y solo los que convienen; solo publicados, y un despublicado no cobra");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES (30-sep-2026) ─────────────────────────────────────────────
// 34/34 en rojo, restauradas byte a byte (scratchpad/mutar.py):
//   1 · V1 palabra vedada en el cuerpo · V2 la línea del ticket cambia · V3 el caso ajustado no se dice ·
//       V4 la tarjeta enlaza al aviso · V5 la ruta devuelve el enlace · V6 cambia la frase de «ninguno».
//   2 · T1 el ticket dice la línea sin hayGuia · T2 la guía se monta con otro predicado · T3 hayGuia vale
//       para renta corta · T4 la guía pide otra ruta · T5 la línea se usa fuera del ticket.
//   3 · F1 no mira fichas_leidas antes de reservar · F2 sin tope por hora · F3 reintenta · F4 el año no se
//       comparte por edificio · F5 sin proxy · F6 no lee la descripción · F7 un cron importa bajarFicha ·
//       F8 tope en 40 · F9 no reserva antes de salir.
//   4 · C1 el segundo clic no recibe el informe · C2 el reintento vuelve a cobrar · C3 sin espera al
//       reclamo en curso (doble clic = 2 cobros) · C4 sin crédito la fila queda tomada · C5 la ruta cobra
//       por fuera de analizarUnaVez · C6 la clave no es persona + aviso · C7 sobre la guía de otro.
//   5 · O1 no prueba más plazo · O2 prueba primero más pie · O3 entran los que no convienen · O4 no se
//       queda en el radio más chico · O5 entran los sospechosos · O6 el pie pasa el tope · O7 ordena por
//       cercanía y no por puntaje.
// Segunda vuelta (30-sep-2026, la guía sin espera): 41/41 en rojo. Cambian O1 (sin el plazo largo) y V5 (el
// enlace en respuestaGuia, que salió de la ruta); nuevas O8 vuelve a probar 25 años · S1 motor entero por
// candidato · S2 mediana siempre en vivo · S3 la evaluación no guarda la mediana · S4 la pantalla calcula
// siempre · S5 la confirmación no precalcula · S6 precalcula también renta corta.
// Tercera vuelta (01-oct-2026, Comprar 73 en la guía y 82 en el informe): 4/4 en rojo. A1 la guía no dice la
// antigüedad · A2 el body del aviso sin methodologyVersion (modelo de costos viejo) · A3 la guía arma el body
// pelado · A4 cambia la frase de la antigüedad.
// Cuarta vuelta (01-oct-2026, después de pagar una idea + el código en la tarjeta): 14/14 en rojo. P1 vuelve
// el bloque de color con la guía · P2 la frase por veredicto · P3 sin la línea del próximo depto · P4 la tarjeta
// sin «usa 1 de tus 3» · P5 sin post_pago_visto · P6 tarjetas en mono · P7 en mayúsculas · P8 el título viejo ·
// P9 vuelve «sin crear cuenta» · R1 sin cuenta sale a /registro · R2 el 401 no pide el código · R3 al entrar no
// genera · R4 sin reclamar lo anónimo · R5 el registro navega afuera.
// Quinta vuelta (01-oct-2026, solo publicados): 46/46 en rojo. §3 se reescribió: el año ya no tiene lectura
// propia (sale del chequeo de publicación), y la ficha se mudó: toda ficha vieja redirige a la nueva (`r_`,
// `o_`, `b_`), que responde 200 o 404 «Propiedad no disponible» (medido en el navegador el 01-oct-2026). Una
// primera regla leyó `b_` como la baja y marcó 10 avisos vivos: se revirtieron y la regla pasó a dos saltos.
// §3: F1 la redirección decide sin seguir el salto · F2 el 404 no es la baja · F3 `b_` es la baja (la regla
// vieja) · F4 búsqueda sin id = publicado · F5 sigue más de un salto · F6 el salto sin cupo · F7 el salto por
// http · F8 otro host se sigue · F9 el salto no se anota · F10 tope 40 · F11 sigue redirecciones solo · F12 403
// es error · F13 el tope no cuenta la bitácora · F14 el año no se cierra. §9: U1 la guía muestra sin chequear ·
// U2 sin chequeo = publicado · U3 chequea todos de una · U4 error del chequeo = publicado · U5 la guía del
// servidor sin chequeo · U6 sin presupuesto por guía · U6b el presupuesto cuenta chequeos y no GETs · U7 sin
// chequear dice «ninguno» · U8 la guardada no mira despublicados · U9 la RPC trae despublicados · M1 memoria
// eterna · M2 sin memoria · M3 el clic no relee · M4 sinLeer lee igual · M5 el despublicado no sale de
// avisos_evaluados · M6 el despublicado alerta · M7 el bloqueo no alerta · M8 un despublicado marcado se relee ·
// C1 despublicado cobra igual · C2 prepara antes de chequear · C3 la ruta no relee · C5 sin 410 · C6 no se
// rearma la guía · C7 la tarjeta no lo dice · C8 la guía no lo reemplaza · C9 cambia el copy · K1 el cron vuelve
// a evaluar despublicados · K2 sinDespublicados no filtra · P1 un despublicado pinta la pastilla · P2 el bloqueo
// no es rojo · P3 el panel sin la pastilla · P4 el bloqueo sin alerta diaria. U8 y C2 pasaron verdes la primera
// vez (el chequeo de U8 miraba la consulta y no la condición; la mutación C2 dejaba el chequeo de arriba en su
// lugar): se ajustaron y quedaron en rojo.
// Sexta vuelta (01-oct-2026, «Quiero verlo» automático): 22/22 en rojo + 1 equivalente. Q2 sin reclamo (doble
// toque = 2 correos) · Q3 manda al despublicado · Q4 manda sin chequear · Q5 no suelta si falla · Q6 no anota el
// despublicado · R1 la ruta manda por fuera (la primera versión de la mutación no agregaba envío y pasó verde;
// rehecha con un envío real) · R2 la ruta fuerza la lectura · R3 reclamo no atómico · R4 sin 410 · R5 deja de
// guardar el interés · H1 el correo a hola@ · H2 la ruta vuelve a avisar a hola@ · T1 cambia el asunto · T2 sin
// la advertencia · T3 ofrece ayuda con la visita · T4 saludo sin nombre · P1 la pantalla no dice despublicado ·
// P2 vuelve «hoy o mañana hábil» · A1 semanas mal · A2 comunas sin orden · A3 el admin escribe · A4 sin pestaña.
// Q1 (sin mirar si ya salió) quedó VERDE y es EQUIVALENTE: el reclamo atómico igual frena el segundo correo.
// Una corrida intermedia dejó el chequeo de F1 en rojo SIN mutar (el segundo pedido lo atajaba el año
// del edificio, no fichas_leidas): se movió al caso sin año, donde solo fichas_leidas lo frena.

if (require.main === module) {
  runGuiaBusquedaTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
