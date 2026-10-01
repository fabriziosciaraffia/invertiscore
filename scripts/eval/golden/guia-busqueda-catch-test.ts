// ============================================================================
// GOLDEN · GUIA-BUSQUEDA (30-sep-2026) — catch-test
// ============================================================================
//   «Por dónde seguir buscando» (FASE 2 de los avisos evaluados). Decisiones de Fabrizio, 30-sep-2026:
//   1 · EL VOCABULARIO DE LA GUÍA: el copy aprobado, palabra por palabra, y nunca «portafolio»,
//       «exclusivo» ni «oportunidad» para describir los parecidos (son una guía, no el portafolio).
//   2 · LA LÍNEA DEL TICKET NO SALE SIN LA GUÍA: el ticket la dice solo donde la guía existe, con el
//       mismo predicado (`hayGuia`) que la monta después de pagar, y la guía tiene su ruta.
//   3 · LOS RESGUARDOS DE LA FICHA: una lectura por aviso, tope global por hora, sin reintentos, el año
//       compartido por edificio, por el proxy; nadie más que «Analizar este» entra por esa puerta.
//   4 · EL CRÉDITO SE DESCUENTA UNA SOLA VEZ por persona y aviso: doble clic, reintento o falla a mitad.
//   5 · EL ORDEN: si ninguno conviene, primero MÁS PLAZO (30 años) y después MÁS PIE (hasta tres escalones
//       dentro del tope); solo los que convienen, hasta tres, el radio más chico; los sospechosos no entran.
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
import { anioDeAviso, claveEdificio, parsearAnioFicha, TOPE_FICHAS_POR_HORA, type AlmacenFichas } from "../../../src/lib/guia/ficha-anio";
import { analizarUnaVez, RECLAMO_VIGENTE_MS, type PiezasAnalizar, type Reclamo } from "../../../src/lib/guia/analizar-una-vez";
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
    [GUIA.titulo, "Por dónde seguir buscando"],
    [GUIA.bajada, "Deptos publicados hoy, parecidos y cercanos al que analizaste."],
    [GUIA.cuerpo, "Franco los revisó con tu pie y tu plazo, y estos son los mejores."],
    [GUIA.ajustada, "Ajustamos tu pie y tu plazo porque ninguno calzaba con esa combinación; estos son los mejores."],
    [GUIA.ninguno, "Ninguno conviene, ni con más plazo ni con más pie. Mejor sigue buscando en otra zona."],
    [GUIA.analizar, "Analizar este"],
    [TICKET_INCLUYE_GUIA, "Incluye una selección de deptos publicados parecidos a este, ya revisados con tu pie y tu plazo. Analizas el que quieras con un clic."],
    [INFORME_DE_AVISO.origen, "Este análisis sale de un aviso publicado."],
    [INFORME_DE_AVISO.antiguedadSupuesta, "El aviso no dice la antigüedad; Franco supuso 25 años, lo más prudente."],
    [INFORME_DE_AVISO.boton, "Quiero verlo"],
    [INFORME_DE_AVISO.bajada, "Franco te hace llegar el aviso"],
    [INFORME_DE_AVISO.listo, "Listo. Franco te hará llegar el depto para que lo evalúes directamente."],
    [INFORME_DE_AVISO.listoBajada, "A tu correo, hoy o mañana hábil."],
  ];
  for (const [tiene, debe] of aprobado) if (tiene !== debe) F(`1 · el copy «${debe}» cambió a «${tiene}»`);
  const vedada = new RegExp(VEDADAS_GUIA.map((w) => w.replace(/o$/, "[oa]s?")).join("|"), "i");
  if (VEDADAS_GUIA.join(",") !== "portafolio,exclusivo,oportunidad") F("1 · la lista de palabras vedadas cambió");
  const textos = [...Object.values(GUIA), ...Object.values(INFORME_DE_AVISO), TICKET_INCLUYE_GUIA, ...Object.values(DESPUES_DE_PAGAR.fraseVeredicto), DESPUES_DE_PAGAR.cuerpo];
  for (const t of textos) if (vedada.test(t)) F(`1 · una palabra vedada describe a los parecidos: «${t}»`);
  for (const f of ["src/components/guia/GuiaBusqueda.tsx", "src/components/guia/InformeDeAviso.tsx", "src/app/api/lo-que-sigue/guia/route.ts"]) {
    const s = sinComentarios(leer(f));
    if (vedada.test(s)) F(`1 · ${f} usa una palabra vedada`);
  }
  const gb = sinComentarios(leer("src/components/guia/GuiaBusqueda.tsx"));
  if (!/\{GUIA\.titulo\}/.test(gb) || !/\{GUIA\.ninguno\}/.test(gb) || !/r\.estado === "ajustada" \? <p className="guia-ajustada">\{GUIA\.ajustada\}<\/p> : <p className="guia-txt">\{GUIA\.cuerpo\}<\/p>/.test(gb)) F("1 · la guía no dice el título, el caso ajustado o el caso sin ninguno con el copy aprobado");
  if (/href=|<img|<a\s/.test(gb)) F("1 · la guía enlaza al aviso o muestra una imagen (sin enlace, sin fotos)");
  const srvGuia = sinComentarios(leer("src/lib/guia/guia-servidor.ts"));
  const respuesta = (srvGuia.match(/export function respuestaGuia\([\s\S]*?\n\}/) ?? [""])[0];
  if (!respuesta || /\bc\.url\b|\burl:|titulo/.test(respuesta)) F("1 · la respuesta de la guía devuelve el enlace o el título del aviso");

  // ── 2 · la línea del ticket, solo con la guía ───────────────────────────────
  if (hayGuia("str") || hayGuia("ltr") !== GUIA_ACTIVA) F("2 · hayGuia no es «guía activa y renta larga»");
  const tk = sinComentarios(leer("src/components/lo-que-sigue/TicketPack.tsx"));
  if (!/\{hayGuia\(ctx\.modalidad\) && <p className="lqs-incluye" data-lqs="ticket-incluye">\{TICKET_INCLUYE_GUIA\}<\/p>\}/.test(tk)) F("2 · el ticket dice la línea de la guía sin preguntar si la guía existe (hayGuia)");
  const ret = sinComentarios(leer("src/app/payments/return/page.tsx"));
  if (!/\{retornoPack && hayGuia\(retornoPack\.modalidad\) && \(paymentStatus === "paid" \|\| paymentStatus === "sin_sesion"\) && \(\s*<GuiaBusqueda /.test(ret)) F("2 · después de pagar no se monta la guía con el mismo predicado que el ticket");
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
  if (!(TOPE_FICHAS_POR_HORA > 0 && TOPE_FICHAS_POR_HORA <= 12)) F("3 · el tope por hora no está o se acerca al bloqueo de la fuente (~36)");
  {
    const leidas = new Map<string, number | null>(), edificios = new Map<string, number>();
    let enLaHora = 0, pedidos = 0, reservas = 0;
    const alm: AlmacenFichas = {
      async anioEdificio(c) { return edificios.get(c) ?? null; },
      async fichaLeida(id) { return leidas.has(id) ? { anio: leidas.get(id) ?? null } : null; },
      async lecturasUltimaHora() { return enLaHora; },
      async reservar(id) { reservas++; if (leidas.has(id)) return false; leidas.set(id, null); enLaHora++; return true; },
      async cerrar(id, _e, anio) { leidas.set(id, anio); },
      async guardarAnioEdificio(c, anio) { edificios.set(c, anio); },
    };
    const ok = async () => { pedidos++; return `construido en el año 2010`; };
    const a = { id: "a", url: "https://x/a", comuna: "Ñuñoa", lat: -33.45, lng: -70.6 };
    const r1 = await anioDeAviso(a, alm, ok, ahora);
    const r2 = await anioDeAviso(a, alm, ok, ahora);
    if (r1.anio !== 2010 || pedidos !== 1) F("3 · la ficha no se lee (o se lee más de una vez)");
    if (r2.origen === "ficha" || reservas !== 1) F("3 · una ficha ya leída se vuelve a pedir");
    const vecino = { ...a, id: "b", url: "https://x/b" };
    const r3 = await anioDeAviso(vecino, alm, ok, ahora);
    if (r3.anio !== 2010 || r3.origen !== "edificio" || pedidos !== 1) F("3 · el año no se comparte con los avisos del mismo edificio");
    const sinAnio = { ...a, id: "c", url: "https://x/c", lat: -33.5 };
    const r4 = await anioDeAviso(sinAnio, alm, async () => { pedidos++; return "sin año"; }, ahora);
    const r5 = await anioDeAviso(sinAnio, alm, async () => { pedidos++; return "construido en 2000"; }, ahora);
    if (r4.anio !== null || r5.anio !== null || pedidos !== 2) F("3 · una ficha sin año se vuelve a pedir");
    // Sin año no hay edificio que la ataje: lo único que la frena es fichas_leidas, mirado ANTES de reservar.
    if (r5.origen !== "ya-leida" || reservas !== 2) F("3 · una ficha ya leída se vuelve a reservar (no se mira fichas_leidas antes de salir)");
    enLaHora = TOPE_FICHAS_POR_HORA;
    const r6 = await anioDeAviso({ ...a, id: "d", url: "https://x/d", lat: -33.6 }, alm, ok, ahora);
    if (r6.origen !== "tope" || pedidos !== 2) F("3 · con la hora llena se sale igual a la fuente (tope global)");
    enLaHora = 0;
    let intentos = 0;
    const r7 = await anioDeAviso({ ...a, id: "e", url: "https://x/e", lat: -33.7 }, alm, async () => { intentos++; throw new Error("503"); }, ahora);
    if (intentos !== 1 || r7.anio !== null) F("3 · una ficha que falla se reintenta (o rompe el informe)");
    if (claveEdificio(a) !== claveEdificio({ ...a })) F("3 · la clave del edificio no es estable");
  }
  const srv = sinComentarios(leer("src/lib/guia/ficha-anio-servidor.ts"));
  if ((srv.match(/\bfetch\(/g) ?? []).length !== 1 || !/dispatcher: proxyDispatcher,/.test(srv) || !/signal: AbortSignal\.timeout\(TIMEOUT_FICHA_MS\)/.test(srv) || /\bfor\s*\(|\bwhile\s*\(|reintent/i.test(srv)) F("3 · la bajada de la ficha no es UN pedido por el proxy con tiempo máximo");
  for (const f of archivosSrc()) {
    if (f.startsWith("src/lib/guia/")) continue;
    const s = sinComentarios(leer(f));
    if (/\bbajarFicha\b|\banioDeAviso\(/.test(s)) F(`3 · ${f} entra a la ficha por fuera de «Analizar este»`);
    if (/antiguedadDelAviso\(/.test(s) && f !== "src/app/api/lo-que-sigue/guia/analizar/route.ts") F(`3 · ${f} lee la antigüedad de la ficha y no es «Analizar este»`);
  }
  const claude = leer("CLAUDE.md");
  if (!/lectura a demanda del año de construcción/.test(claude) || !/tope global por hora/.test(claude) || !/sin reintentos/.test(claude) || !/25 años supuestos/.test(claude)) F("3 · CLAUDE.md no documenta la lectura a demanda, sus resguardos y los 25 años supuestos");

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
  if (!/const r = await analizarUnaVez\(\{/.test(ruta) || (ruta.match(/ensureCreditCharged\(/g) ?? []).length !== 1 || /chargeAnalysisCredit/.test(ruta)) F("4 · «Analizar este» cobra por fuera del candado (analizarUnaVez)");
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
    const r = await elegirGuia(cand, combinacionesGuia({ piePct: 15, plazoAnios: 25 }), async (c, combo) =>
      combo.plazoAnios === 30 || combo.piePct >= 20 ? ev("COMPRAR", 60 + Number(c.avisoId[1])) : ev("AJUSTA SUPUESTOS", 50));
    if (r.estado !== "ajustada" || r.combinacion?.piePct !== 15 || r.combinacion?.plazoAnios !== 30) F("5 · con ninguno a su combinación no prueba primero más plazo");
    if (r.items.length !== TOPE_GUIA || r.radioM !== 1000 || r.items.map((i) => i.c.avisoId).join() !== "c3,c2,c1") F("5 · no son los tres del radio más chico ordenados por puntaje");
    const n = await elegirGuia(cand, combinacionesGuia({ piePct: 20, plazoAnios: 30 }), async () => ev("AJUSTA SUPUESTOS", 69));
    if (n.estado !== "ninguno" || n.items.length !== 0) F("5 · sin ninguno que convenga se muestran igual (debe ser «ninguno», sin lista)");
    const m = await elegirGuia(cand, [{ piePct: 20, plazoAnios: 30 }], async (c) => (c.avisoId === "c5" ? ev("COMPRAR", 70) : ev("AJUSTA SUPUESTOS", 90)));
    if (m.estado !== "normal" || m.items.length !== 1 || m.radioM !== 3000 || m.items[0].ev.veredicto !== "COMPRAR") F("5 · entran los que no convienen, o no se amplía el radio hasta encontrar");
  }
  // ── 6 · sin espera ──────────────────────────────────────────────────────────
  const evalGuia = (srvGuia.match(/const evaluar = async \(c: CandidatoGuia, combo: Combinacion\)[\s\S]*?\n  \};/) ?? [""])[0];
  if (!/const s = sondaConPatch\(body as never, cfg\.uf, mediana as never, asOf, \{\}\);/.test(evalGuia) || /runAnalysis\(/.test(srvGuia)) F("6 · la guía corre el motor entero por candidato (debe ser la sonda)");
  if (!/let mediana = c\.medianaComuna;\s*if \(mediana == null\) \{/.test(evalGuia)) F("6 · la guía pide la mediana en vivo aunque esté guardada en la fila evaluada");
  const evalAviso = sinComentarios(leer("src/lib/avisos/evaluar-aviso.ts"));
  if (!/out\.mediana_comuna = mediana \?\? null;/.test(evalAviso) || !/ae\.mediana_comuna/.test(leer("supabase/migrations/20260930_guia_busqueda.sql"))) F("6 · la evaluación no guarda la mediana comunal (o la RPC no la devuelve)");
  const apiGuia = sinComentarios(leer("src/app/api/lo-que-sigue/guia/route.ts"));
  if (!/const guardada = await guiaGuardada\(admin, a\);\s*const r = guardada \?\? \(await calcularYGuardarGuia\(admin, a\)\);/.test(apiGuia)) F("6 · la pantalla no lee la guía guardada antes de calcularla");
  const confirm = sinComentarios(leer("src/app/api/payments/confirm/route.ts"));
  if (!/if \(hayGuia\(modalidadDeTipo\(filaPack\?\.tipo_analisis as string \| null\)\)\) \{\s*const idGuia = analysisId;\s*waitUntil\(calcularYGuardarGuia\(supabase, idGuia\)/.test(confirm)) F("6 · la guía no se calcula al confirmarse el pago del pack (o se calcula para renta corta)");

  const mig = leer("supabase/migrations/20260930_guia_busqueda.sql");
  if (!/and ae\.arriendo_sospechoso is not true/.test(mig) || !/and sp\.dormitorios = prop_dorms/.test(mig) || !/and sp\.scraped_at >= desde/.test(mig)) F("5 · los candidatos no excluyen los sospechosos, o no piden los mismos dormitorios y los 7 días");

  if (fallas.length) {
    console.log(`  ✗ GUIA-BUSQUEDA · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el copy aprobado sin palabras vedadas; la línea del ticket solo con la guía; la ficha una vez, con tope por hora y sin reintentos; el crédito una sola vez; primero plazo, después pie, y solo los que convienen");
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
// Una corrida intermedia dejó el chequeo de F1 en rojo SIN mutar (el segundo pedido lo atajaba el año
// del edificio, no fichas_leidas): se movió al caso sin año, donde solo fichas_leidas lo frena.

if (require.main === module) {
  runGuiaBusquedaTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
