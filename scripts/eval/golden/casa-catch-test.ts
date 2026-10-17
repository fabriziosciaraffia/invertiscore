// ============================================================================
// GOLDEN · CASA (02-oct-2026) — catch-test
// ============================================================================
//   El dashboard de quien ya tiene informes es la casa (mockup aprobado por Fabrizio):
//   1 · EL PERFIL SE ALIMENTA DE TODOS LOS INFORMES: las comunas se suman, los dormitorios también, el
//       tope sale del más caro analizado (redondeado hacia arriba a UF 100) y el piso del más barato;
//       modalidad, pie y plazo del más reciente; lo editado a mano MANDA, campo por campo.
//   2 · EL SALDO REAL: plan / regalo / con N / sin, leído del ledger y del contador legacy.
//   3 · EL COPY APROBADO, frase por frase.
//   4 · EL REGISTRADO COMPRA EL PACK DE TRES (13-oct-2026, decisión de Fabrizio; antes, el suelto): el botón del
//       saldo vacío va al checkout del pack de tres con «3 análisis · $19.990» y vuelve al dashboard; debajo, el
//       suelto «O uno solo · $9.990». El ticket de $14.990 (pack3) no aparece en la casa.
//   5 · EL ORDEN: saludo → saldo → (comprador) la selección → el perfil → sus informes.
//   6 · LO EDITADO SE VALIDA Y SOLO LO ESCRIBE EL SERVIDOR: el PUT pide sesión; la tabla no acepta
//       escrituras de anon/authenticated.
//   7 · SIN «Te escribimos los lunes», sin las vedadas, en tuteo; el rojo solo en el botón de compra y
//       en el error.
//   8 · «TUS INFORMES» EN EL SISTEMA NUEVO (02-oct-2026): Inter, sin mono ni mayúsculas espaciadas, como
//       las tarjetas de la guía (continuar, la tira de cifras, el archivo y sus piezas).
//   9 · LA CASA VENDE (17-oct-2026, decisión de Fabrizio): UNA jerarquía. Arriba, en banner (el material del informe y de
//       /deptos), lo más importante según el estado —la selección de esta semana; sin análisis, el pack; con un regalo
//       sin usar, el regalo; si no, analizar—, un bloque y un botón; debajo, «Invita a alguien» con su propio color;
//       después, plano, el saldo, el perfil compacto y los informes. Con el pie de los informes.
//  10 · EL MENÚ DE COMPARTIR (17-oct-2026): «Invita a alguien · Los dos reciben un análisis» va primero y destacado con
//       el color de «Invita a alguien» del dashboard.
//  11 · «TUS INFORMES», UNA SOLA LISTA (17-oct-2026, decisión de Fabrizio): sin «Continuar» ni la tira de cifras; la marca
//       «Franco» en lo que salió de un aviso y el filtro «De Franco» / «Míos» con sus conteos; por fecha, el más reciente
//       arriba; nombre, comuna, modalidad, veredicto, puntaje, flujo y fecha (sin «Cap» ni «Retorno»); la fila entera abre;
//       en el teléfono, tarjetas de una línea y los filtros de lado.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/casa-catch-test.ts
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CASA } from "../../../src/app/dashboard/casa-copy";
import { ARCHIVO_COPY, buildHref, parseParams } from "../../../src/app/dashboard/dashboard-helpers";
import { estadoSaldo } from "../../../src/lib/casa-saldo";
import { CASA_ARRIBA, bloqueDeArriba } from "../../../src/lib/casa-arriba";
import type { ResumenBloque } from "../../../src/lib/guia/seleccion-casa";
import { MANUAL_VACIO, perfilDeBusqueda, validarCambiosPerfil, type FilaPerfilInforme } from "../../../src/lib/perfil-busqueda";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const VOSEO = /(^|[^a-záéíóúñ])(dejás|tenés|querés|podés|sabés|mirá|tomá|entrá|seguí|registrate|guardá|revisá|poné|compará|elegí|tocá|pedí|escribí|analizá|empezá|cambialo|vos)(?![a-záéíóúñ])/i;

const fila = (o: Partial<FilaPerfilInforme>): FilaPerfilInforme => ({
  creadoAt: "2026-09-01T00:00:00Z", tipologia: "2D1B", comuna: "Ñuñoa", modalidad: "ltr", presupuestoUf: 4000, piePct: 20, plazoAnios: 30,
  prefTipologia: null, prefComuna: null, prefModalidad: null, horizonte: null, ...o,
});

const saldoFuente = () => sinComentarios(leer("src/lib/casa-saldo.ts"));

export function runCasaTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER CASA (el dashboard como casa · 0 tokens) ───");

  // 1 · el perfil
  const filas = [
    fila({ creadoAt: "2026-09-01T00:00:00Z", tipologia: "2D1B", comuna: "Ñuñoa", presupuestoUf: 4230, piePct: 20, plazoAnios: 30, horizonte: "meses" }),
    fila({ creadoAt: "2026-09-20T00:00:00Z", tipologia: "1D1B", comuna: "Macul", presupuestoUf: 2810, piePct: 15, plazoAnios: 25, prefComuna: "San Miguel" }),
    fila({ creadoAt: "2026-09-10T00:00:00Z", tipologia: "Studio", comuna: "Ñuñoa", presupuestoUf: 3100, modalidad: "str", piePct: 30, plazoAnios: 20 }),
  ];
  const p = perfilDeBusqueda(filas);
  if (p.comunas.slice().sort().join("|") !== ["Ñuñoa", "San Miguel"].sort().join("|")) F(`1 · las comunas no se suman (con lo elegido primero): ${p.comunas.join(", ")}`);
  if (p.dormitorios.join(",") !== "0,1,2") F(`1 · los dormitorios no son todos los analizados: ${p.dormitorios.join(",")}`);
  if (p.precioMaxUf !== 4300) F(`1 · el tope no sale del más caro redondeado a UF 100 hacia arriba: ${p.precioMaxUf}`);
  if (p.precioMinUf !== 2800) F(`1 · el piso no sale del más barato redondeado hacia abajo: ${p.precioMinUf}`);
  if (p.modalidad !== "ltr" || p.piePct !== 15 || p.plazoAnios !== 25) F(`1 · modalidad/pie/plazo no son los del informe más reciente: ${p.modalidad} ${p.piePct} ${p.plazoAnios}`);
  if (p.horizonte !== "meses") F("1 · el horizonte no es la última respuesta");
  if (!p.completo || p.editado.length !== 0) F("1 · el perfil inferido no queda completo o se marca como editado");
  const m = perfilDeBusqueda(filas, { ...MANUAL_VACIO, comunas: ["Providencia"], precioMaxUf: 5000, piePct: 25, horizonte: "ya", dormitorios: [3] });
  if (m.comunas.join() !== "Providencia" || m.precioMaxUf !== 5000 || m.piePct !== 25 || m.horizonte !== "ya" || m.dormitorios.join() !== "3") F("1 · lo editado a mano no manda sobre lo inferido");
  if (m.plazoAnios !== 25 || m.modalidad !== "ltr") F("1 · lo no editado dejó de venir de los informes");
  if (!["comunas", "precio", "pie", "horizonte", "dormitorios"].every((c) => (m.editado as string[]).includes(c))) F("1 · no se marca qué vino de la mano");
  if (perfilDeBusqueda([]).completo) F("1 · un perfil sin informes se da por completo");

  // 2 · el saldo
  const e = (d: Parameters<typeof estadoSaldo>[0]) => estadoSaldo(d);
  if (e({ disponibles: 5, plan: true, suscripcion: true, regaloRestante: 0, regaloVence: null, todoSinCaducidad: true }).tipo !== "plan") F("2 · con plan no es «plan»");
  if (e({ disponibles: 0, plan: false, suscripcion: false, regaloRestante: 0, regaloVence: null, todoSinCaducidad: false }).tipo !== "sin") F("2 · sin saldo no es «sin»");
  if (e({ disponibles: 1, plan: false, suscripcion: false, regaloRestante: 1, regaloVence: null, todoSinCaducidad: false }).tipo !== "regalo") F("2 · con solo el regalo no es «regalo»");
  const reg = e({ disponibles: 1, plan: false, suscripcion: false, regaloRestante: 1, regaloVence: "2026-12-01T15:00:00Z", todoSinCaducidad: false });
  if (reg.tipo !== "regalo" || reg.vence !== "2026-12-01T15:00:00Z") F("2 · el regalo no trae su vencimiento");
  // ⚠ ACTA (16-oct-2026, goal «la puerta B») · los regalos son tres (registrarse, reactivación y el viejo de los 14 días):
  // el vencimiento sale de sus lotes, cualquiera de las tres fuentes (regalo-alta.ts › FUENTES_REGALO).
  if (!/const regalos = vivos\.filter\(\(g\) => g\.source != null && FUENTES_REGALO\.has\(g\.source\)\);/.test(saldoFuente()) || !/regaloVence: regalos\.filter\(\(g\) => g\.expires_at\)/.test(saldoFuente())) F("2 · el vencimiento del regalo no sale de su lote");
  // ⚠ ACTA (17-oct-2026, goal «el dashboard vende») · el regalo dice cuándo vence en el banner de arriba y, si arriba manda
  // otra cosa, en el saldo plano.
  {
    const c2 = sinComentarios(leer("src/app/dashboard/casa.tsx"));
    if (!c2.includes('{bloque.vence ? `${textoVence(bloque.vence)} ` : ""}{CASA_ARRIBA.regalo.bajada}') || !c2.includes('estado.tipo === "regalo" ? `${CASA.regalo.titulo}${estado.vence ? ` ${textoVence(estado.vence)}` : ""}`')) F("2 · el dashboard no dice cuándo vence el regalo");
  }
  const con = e({ disponibles: 3, plan: false, suscripcion: false, regaloRestante: 1, regaloVence: null, todoSinCaducidad: true });
  if (con.tipo !== "con" || con.n !== 3 || !con.noVencen) F("2 · con 3 (uno regalado) no es «con 3, no vencen»");
  const vence = e({ disponibles: 2, plan: false, suscripcion: false, regaloRestante: 0, regaloVence: null, todoSinCaducidad: false });
  if (vence.tipo !== "con" || vence.noVencen) F("2 · dice «No vencen.» con créditos que vencen");
  const saldo = sinComentarios(leer("src/lib/casa-saldo.ts"));
  if (!/from\("credit_grants"\)[\s\S]{0,200}\.gt\("remaining", 0\)[\s\S]{0,80}expires_at\.is\.null,expires_at\.gt\./.test(saldo) || !/disponibles: ledger \+ legacy/.test(saldo)) F("2 · el saldo no se lee del ledger vigente más el legacy");

  // 3 · el copy
  const exactos: Array<[string, string]> = [
    [CASA.sin.titulo(1), "Tu primer informe ya está en tu cuenta."],
    [CASA.sin.bajada, "Para analizar otros: 3 análisis por $19.990, sin caducidad."],
    [CASA.sin.boton, "3 análisis · $19.990"],
    [CASA.sin.suelto, "O uno solo · $9.990"],
    // ⚠ ACTA (16-oct-2026, goal «la puerta B») · el regalo se llama regalo: «Tienes un análisis de regalo.».
    [CASA.regalo.titulo, "Tienes un análisis de regalo."],
    [CASA.con.titulo(3), "Te quedan 3 análisis"],
    [CASA.con.noVencen, "No vencen."],
    [CASA.guiaTitulo, "Te recomendamos empezar por estos"],
    [CASA.perfil.titulo, "Tu perfil de búsqueda"],
    [CASA.perfil.bajada, "Cada semana te enviamos los deptos publicados que mejor resultan con tu perfil. Cámbialo cuando quieras."],
    [CASA.perfil.bajadaComprador, "Cada semana te enviamos los deptos publicados que mejor resultan con tu perfil."],
  ];
  for (const [real, esperado] of exactos) if (real !== esperado) F(`3 · «${real}» debía ser «${esperado}»`);

  // 4 · el pack de tres; el suelto debajo; el ticket no
  const casa = sinComentarios(leer("src/app/dashboard/casa.tsx"));
  const copy = sinComentarios(leer("src/app/dashboard/casa-copy.ts"));
  const pag = sinComentarios(leer("src/app/dashboard/page.tsx"));
  if (!/export const RUTA_TRES_CASA = rutaTres\("dashboard", \{ volver: "\/dashboard" \}\);/.test(casa) || !/<EnlaceCarga href=\{RUTA_TRES_CASA\}[^>]*data-casa="comprar-tres">\s*\{CASA\.sin\.boton\}/.test(casa)) F("4 · el botón del saldo vacío no compra el pack de tres");
  if (!/export const RUTA_SUELTO = "\/checkout\?product=single";/.test(casa) || !/<EnlaceCarga href=\{RUTA_SUELTO\}[^>]*data-casa="comprar-suelto">\s*\{CASA\.sin\.suelto\}/.test(casa)) F("4 · debajo del pack no está el suelto");
  for (const [n, s] of [["casa.tsx", casa], ["casa-copy.ts", copy], ["page.tsx", pag.replace(/\.eq\("product", "pack3"\)/, "")]] as const) {
    if (/pack3|14\.990|14990|PACK_/i.test(s)) F(`4 · el ticket de $14.990 aparece en la casa (${n})`);
  }
  if (!/fmtCLP\(SINGLE_PRICE\)/.test(copy)) F("4 · el precio del suelto no sale de SINGLE_PRICE");

  // 5 · el orden
  // ⚠ ACTA (16-oct-2026, goal «la puerta B») · la cuenta sin informes con su perfil a mano tiene su propia casa más arriba
  // (selección del día, regalo y perfil): el orden se mide en la casa de quien tiene informes, desde su consulta.
  // ⚠ ACTA (17-oct-2026, goal «el dashboard vende») · el orden es el de §9: arriba el banner, después «Invita a alguien» y,
  // planos, el saldo, la guía del pack, el perfil y los informes. Las dos casas se miden en §9.
  // ⚠ ACTA (17-oct-2026, goal «una sola lista») · «Continuar» salió: después de «Tus informes» va solo la lista (§11), y la
  // casa con informes se mide desde los hermanos de los pares AMBAS (la consulta de «Continuar» ya no existe).
  const casaConInformes = pag.slice(pag.indexOf("const groupIds = (todas ?? filasPagina)"));
  const orden = ["<BloqueArribaCasa bloque={arriba}", "<InvitaAlguien />", "<SaldoPlano estado={saldo}", "<GuiaBusqueda analysisId={guiaCasa.analysisId}", "<PerfilBusquedaCasa", "{CASA.informes}", "<Archive"].map((t) => casaConInformes.indexOf(t));
  if (orden.some((i) => i < 0) || orden.some((i, k) => k > 0 && i < orden[k - 1])) F(`5 · el orden de la casa no es banner → invitar → saldo → guía → perfil → informes (${orden.join(",")})`);
  if (!/const guiaCasa = packOrigenId && packPerfil && hayGuia\(/.test(pag) || !/saldo\.tipo === "con"/.test(pag) || !/\.eq\("product", "pack3"\)\.eq\("status", "paid"\)/.test(pag)) F("5 · la selección no depende de un pack pagado con saldo y guía activa");
  if (!/comprador=\{!!guiaCasa\}/.test(pag)) F("5 · la bajada del perfil no distingue al comprador");
  const guia = sinComentarios(leer("src/components/guia/GuiaBusqueda.tsx"));
  if (!/if \(!enCasa\) capturarLqs\(posthog, EVENTOS_LQS\.postPagoVisto/.test(guia) || !/enCasa \? <h2 className="guia-titulo">\{enCasa\.titulo\}<\/h2>/.test(guia)) F("5 · la guía en la casa cuenta como post-pago o no cambia su título");

  // 6 · lo editado
  const v1 = validarCambiosPerfil({ comunas: ["Ñuñoa", "Ñuñoa", "Macul"], precioMaxUf: 4499.6, horizonte: "ya", dormitorios: [2, 1] });
  if (!v1.ok || JSON.stringify(v1.cambios) !== JSON.stringify({ dormitorios: [1, 2], comunas: ["Ñuñoa", "Macul"], precio_max_uf: 4500, horizonte_compra: "ya" })) F(`6 · el validador no normaliza a las columnas: ${JSON.stringify(v1)}`);
  for (const malo of [{ comunas: ["Buenos Aires"] }, { precioMaxUf: -1 }, { horizonte: "mañana" }, { plazoAnios: 50 }, { dormitorios: [9] }, { modalidad: "ambas" }, {}]) {
    if (validarCambiosPerfil(malo as Record<string, unknown>).ok) F(`6 · el validador acepta ${JSON.stringify(malo)}`);
  }
  const ruta = sinComentarios(leer("src/app/api/perfil-busqueda/route.ts"));
  if (!/if \(!user\) return NextResponse\.json\(\{ error: "Sin sesión" \}, \{ status: 401 \}\);/.test(ruta) || !/upsert\(\{ user_id: user\.id, \.\.\.v\.cambios/.test(ruta)) F("6 · el PUT no pide sesión o no escribe solo la fila propia");
  const mig = leer("supabase/migrations/20261002_perfil_busqueda.sql");
  if (!/revoke insert, update, delete on public\.perfil_busqueda from anon, authenticated;/.test(mig) || !/enable row level security/.test(mig)) F("6 · la tabla acepta escrituras desde el cliente");

  // 7 · voz y color
  const todos = [casa, copy].join("\n");
  if (/Te escribimos los lunes|los lunes/.test(todos)) F("7 · vuelve «Te escribimos los lunes…»");
  if (/oportunidad|portafolio|exclusivo/i.test(todos)) F("7 · aparece una vedada");
  const frases = [...exactos.map((x) => x[0]), CASA.sin.titulo(4), CASA.plan.titulo, CASA.plan.bajada, CASA.perfil.cuando, ...Object.values(CASA.perfil.horizonte), ...Object.values(CASA.perfil.respondido), CASA.perfil.error];
  for (const t of frases) if (VOSEO.test(t)) F(`7 · voseo: «${t}»`);
  // ⚠ ACTA (17-oct-2026, goal «el dashboard vende») · el botón del pack pasó al banner, en papel sobre el material, como el
  // botón del banner del informe y el de /deptos: el único rojo de la casa es el del error.
  const rojos = casa.match(/signal-red/g) ?? [];
  if (rojos.length !== 1 || !/role="alert" className="[^"]*text-\[var\(--signal-red\)\]/.test(casa)) F(`7 · hay rojo fuera del error (${rojos.length})`);
  if (/font-mono|uppercase/.test(casa)) F("7 · la casa usa mono o mayúsculas");

  // 8 · «Tus informes» en el sistema nuevo
  // ⚠ ACTA (17-oct-2026, goal «una sola lista») · continuar.tsx y stats-strip.tsx se retiraron (§11 mide que no vuelvan).
  for (const f of ["src/app/dashboard/archive.tsx", "src/app/dashboard/dashboard-ui.tsx", "src/app/dashboard/page.tsx"]) {
    const s = sinComentarios(leer(f));
    if (/font-mono|\buppercase\b|tracking-\[0\.\d+em\]|JetBrains/.test(s)) F(`8 · ${f} vuelve al mono o a las mayúsculas espaciadas`);
    if (/>\s*(LARGA|CORTA|AMBAS|RETOMAR|FLUJO|ANÁLISIS)\s*</.test(s)) F(`8 · ${f} escribe un rótulo en mayúsculas`);
  }
  if (!/data-casa="pagina" style=\{\{ fontFamily: "var\(--font-ui\), Inter/.test(pag)) F("8 · el dashboard no va en Inter");
  if (!/TEXTO_MODALIDAD\[label\]/.test(sinComentarios(leer("src/app/dashboard/dashboard-ui.tsx")))) F("8 · el chip de modalidad no dice «Larga/Corta/Ambas»");

  // 9 · la casa vende: una jerarquía según el estado
  {
    const sel: ResumenBloque[] = [{ modalidad: "ltr", titulo: "Para arriendo tradicional", texto: "", deptos: 3, conteos: [{ v: "COMPRAR", n: 3 }] }];
    const sin = estadoSaldo({ disponibles: 0, plan: false, suscripcion: false, regaloRestante: 0, regaloVence: null, todoSinCaducidad: false });
    const regalo = estadoSaldo({ disponibles: 1, plan: false, suscripcion: false, regaloRestante: 1, regaloVence: "2026-11-16T12:00:00Z", todoSinCaducidad: false });
    const conRegalo = estadoSaldo({ disponibles: 3, plan: false, suscripcion: false, regaloRestante: 1, regaloVence: null, todoSinCaducidad: true });
    const con = estadoSaldo({ disponibles: 2, plan: false, suscripcion: false, regaloRestante: 0, regaloVence: null, todoSinCaducidad: true });
    const plan = estadoSaldo({ disponibles: 0, plan: true, suscripcion: true, regaloRestante: 1, regaloVence: null, todoSinCaducidad: true });
    const b = (seleccion: ResumenBloque[] | null, saldo: typeof sin, regaloRestante = 0, regaloVence: string | null = null) => bloqueDeArriba({ seleccion, saldo, regaloRestante, regaloVence });
    if (b(sel, sin).tipo !== "seleccion" || b(sel, regalo, 1).tipo !== "seleccion") F("9 · con selección de esta semana, arriba no manda la selección");
    if (b(null, sin).tipo !== "pack" || b([], sin).tipo !== "pack") F("9 · sin análisis y sin selección, arriba no va el pack");
    const r = b(null, regalo, 1, "2026-11-16T12:00:00Z");
    if (r.tipo !== "regalo" || r.vence !== "2026-11-16T12:00:00Z") F("9 · con un regalo sin usar, arriba no va «Tienes un análisis de regalo» con su vencimiento");
    if (b(null, conRegalo, 1).tipo !== "regalo") F("9 · un regalo sin usar junto a análisis pagados no se anuncia");
    if (b(null, con).tipo !== "analizar" || b(null, plan, 1).tipo !== "analizar") F("9 · con saldo pagado o con el plan, arriba no lleva a analizar (o el plan anuncia un regalo)");

    // Lo cablea la página, en las dos casas, con el regalo leído del ledger.
    if (!/const arriba = bloqueDeArriba\(\{ seleccion: resumen, saldo, regaloRestante: datosSaldo\.regaloRestante, regaloVence: datosSaldo\.regaloVence \}\);/.test(pag) || !/<BloqueArribaCasa bloque=\{arriba\} informes=\{stats\.total\} \/>/.test(pag)) F("9 · la casa con informes no decide el bloque de arriba con bloqueDeArriba");
    if (!/seleccionDeEstaSemana\(admin, user\.id\)\]\);/.test(pag) || !/const arriba0 = bloqueDeArriba\(\{ seleccion: seleccion0 \? resumenSeleccion\(seleccion0\) : null, saldo, regaloRestante: datosSaldo\.regaloRestante, regaloVence: datosSaldo\.regaloVence \}\);/.test(pag) || !/<BloqueArribaCasa bloque=\{arriba0\} informes=\{0\} \/>/.test(pag)) F("9 · la casa sin informes no decide el bloque de arriba (o no lee su selección)");
    // El orden de las dos casas: banner → invitar → (plano) saldo → … ; «Invita a alguien» fuera de lo plano.
    const casaSin = pag.slice(pag.indexOf("const arriba0 = "), pag.indexOf("<AppFooter"));
    const ordenSin = ["<BloqueArribaCasa bloque={arriba0}", "<InvitaAlguien />", '<div className="ca-plano">', "<SaldoPlano estado={saldo} arriba={arriba0.tipo} />", "<PrimerosDeptos ", "<PerfilBusquedaCasa"].map((t) => casaSin.indexOf(t));
    if (ordenSin.some((i) => i < 0) || ordenSin.some((i, k) => k > 0 && i < ordenSin[k - 1])) F(`9 · la casa sin informes no es banner → invitar → plano (saldo, primeros, perfil) (${ordenSin.join(",")})`);
    const ordenCon = ["<BloqueArribaCasa bloque={arriba}", "<InvitaAlguien />", '<div className="ca-plano">', "<SaldoPlano estado={saldo} arriba={arriba.tipo} />"].map((t) => casaConInformes.indexOf(t));
    if (ordenCon.some((i) => i < 0) || ordenCon.some((i, k) => k > 0 && i < ordenCon[k - 1])) F(`9 · en la casa con informes, «Invita a alguien» no queda entre el banner y lo plano (${ordenCon.join(",")})`);
    if (/<h1/.test(pag)) F("9 · la página tiene un título propio además del banner (el saludo volvió a ser el h1)");
    if ((pag.match(/<AppFooter variant="informe" \/>/g) ?? []).length !== 2) F("9 · las dos casas no cierran con el pie de los informes");

    // Un bloque, un botón: cada estado del banner tiene un título y UN botón, y va a su lugar.
    const fn = casa.slice(casa.indexOf("export function BloqueArribaCasa("), casa.indexOf("export function SaldoPlano("));
    const ramas = fn.split(/if \(bloque\.tipo === "|\n  return \(/).slice(1);
    const destino: Record<string, RegExp> = {
      seleccion: /<EnlaceCarga href=\{SELECCION_CASA\.href\} className="ca-banda-btn" data-casa="ver-seleccion">\s*\{SELECCION_CASA\.boton\}/,
      pack: /<EnlaceCarga href=\{RUTA_TRES_CASA\} className="ca-banda-btn" data-casa="comprar-tres">\s*\{CASA\.sin\.boton\}/,
      regalo: /<h1 className="ca-banda-t">\{CASA\.regalo\.titulo\}<\/h1>[\s\S]*<EnlaceCarga href=\{RUTA_NUEVO\} className="ca-banda-btn"/,
      analizar: /<h1 className="ca-banda-t">\{CASA_ARRIBA\.analizar\.titulo\}<\/h1>[\s\S]*<EnlaceCarga href=\{RUTA_NUEVO\} className="ca-banda-btn"/,
    };
    if (ramas.length !== 4) F(`9 · el banner no tiene sus cuatro estados (${ramas.length})`);
    for (const [k, rama] of ramas.entries()) {
      const tipo = k < 3 ? rama.slice(0, rama.indexOf('"')) : "analizar";
      if ((rama.match(/className="ca-banda-btn"/g) ?? []).length !== 1 || (rama.match(/<h1 className="ca-banda-t">/g) ?? []).length !== 1) F(`9 · el estado «${tipo}» del banner no es un título y un botón`);
      if (!destino[tipo]?.test(rama)) F(`9 · el botón del estado «${tipo}» no va a su lugar`);
      if (!new RegExp(`<section className="ca-banda" data-casa="arriba" data-arriba="${tipo}">`).test(rama)) F(`9 · el estado «${tipo}» no va en el banner`);
    }
    if (!/\{b\.conteos\.map\(\(c\) => \([\s\S]{0,200}<ChipVeredicto v=\{c\.v\} variante="sobre-fondo" \/>/.test(fn)) F("9 · la selección del banner no dice sus veredictos con la tríada");
    // El banner es el material del informe; «Invita a alguien», otro color.
    const css = leer("src/app/dashboard/casa.css");
    if (!/\.ca-banda \{[^}]*background: #1F3D67 url\("\/landing\/hero-m2x\.webp"\)/.test(css) || !/\.ca-banda::after \{[^}]*grano-256\.png/.test(css) || !/\.ca-banda-btn \{[^}]*background: #FAFAF8; color: #0F0F0F;/.test(css)) F("9 · el bloque de arriba no es el banner (degradado, grano y botón en papel)");
    if (!/\.ca-banda-t \{[^}]*font-family: var\(--font-heading\)/.test(css) || /\.ca-plano-t \{[^}]*font-family/.test(css)) F("9 · serif fuera de los títulos, o el título del banner sin serif");
    const iv = leer("src/components/invitacion/invita.css");
    const invita = sinComentarios(leer("src/components/invitacion/InvitaAlguien.tsx"));
    if (!/if \(variante === "casa"\) \{\s*return \(\s*<section id="invitar" className="iv-destacado"/.test(invita) || !/\[data-theme="light"\] \.iv-destacado, \[data-theme="light"\] \.iv-menu \{ --iv-fondo: #0F0F0F;/.test(iv) || !/\.iv-destacado, \.iv-menu \{ --iv-fondo: #FAFAF8;[^}]*background: var\(--iv-fondo\)/.test(iv)) F("9 · «Invita a alguien» no tiene su propio color (tinta en claro, papel en oscuro)");
    // Lo plano: sin tarjetas.
    if (/rounded-2xl border|bg-\[var\(--franco-card\)\] p-4|\btarjeta\b/.test(casa)) F("9 · lo de abajo vuelve a ser tarjeta");
    if (!/<div id="perfil" className="ca-plano-sec"/.test(casa) || !/<section className="ca-plano-sec" data-casa="saldo"/.test(casa) || !/<h2 className="ca-plano-t">\{CASA\.perfil\.titulo\}<\/h2>/.test(casa)) F("9 · el saldo o el perfil no van planos");
    if (!/if \(estado\.tipo === "regalo" && arriba === "regalo"\) return null;/.test(casa) || !/\{arriba !== "pack" && \(\s*<EnlaceCarga href=\{RUTA_TRES_CASA\}/.test(casa)) F("9 · el saldo plano repite lo que ya dice el banner");
    const exactos9: Array<[string, string]> = [
      [CASA_ARRIBA.seleccionBajada, "Los deptos publicados que Franco revisó con tus números."],
      [CASA_ARRIBA.pack.titulo, "Analiza tus próximos deptos."],
      [CASA_ARRIBA.regalo.bajada, "Úsalo en el depto que quieras."],
      [CASA_ARRIBA.analizar.titulo, "Analiza tu próximo depto."],
      [CASA.sin.plano, "No te quedan análisis."],
    ];
    for (const [real, esperado] of exactos9) if (real !== esperado) F(`9 · «${real}» debía ser «${esperado}»`);
    for (const t of [...exactos9.map((x) => x[0]), CASA_ARRIBA.analizar.bajada, CASA_ARRIBA.analizar.boton]) if (VOSEO.test(t)) F(`9 · voseo: «${t}»`);
  }

  // 10 · el menú de compartir: la invitación primero, con su color
  {
    const sb = sinComentarios(leer("src/components/chrome/ShareButton.tsx"));
    if (!/<div data-compartir="menu" [^>]*>\s*\{!sinInvitacion && \(\s*<button onClick=\{\(\) => void invitar\(\)\} disabled=\{!invitacion\} className="iv-menu [^"]*" data-compartir="invitar">/.test(sb)) F("10 · «Invita a alguien» no es lo primero del menú, o no va con su color");
    if ((sb.match(/data-compartir="invitar"/g) ?? []).length !== 1) F("10 · «Invita a alguien» aparece más de una vez en el menú");
    if (!/\{invitaCopiada \? REFERIDO_COPY\.copiado : REFERIDO_COPY\.menuCompartir\}<\/span>\s*<span className="iv-m-nota [^"]*">\{REFERIDO_COPY\.menuCompartirNota\}/.test(sb)) F("10 · el ítem no dice «Invita a alguien · Los dos reciben un análisis»");
    if (!/import "@\/components\/invitacion\/invita\.css";/.test(sb)) F("10 · el menú no carga el color de «Invita a alguien»");
    if (!/else setSinInvitacion\(true\);/.test(sb)) F("10 · sin enlace de invitación, el ítem queda colgado en el menú");
  }

  // 11 · «Tus informes», una sola lista (17-oct-2026): sin «Continuar»; el origen a la vista y filtrable; por fecha
  {
    const arch = sinComentarios(leer("src/app/dashboard/archive.tsx"));
    const query = sinComentarios(leer("src/lib/dashboard-query.ts"));
    // Se fue «Continuar»: la tarjeta grande, las tres chicas y la tira de Análisis, Flujo positivo, Puntaje y Modalidad.
    if (existsSync(join(RAIZ, "src/app/dashboard/continuar.tsx")) || existsSync(join(RAIZ, "src/app/dashboard/stats-strip.tsx")) || /<Continuar\b|<StatsStrip\b|Flujo positivo|Puntaje promedio/.test(pag + arch)) F("11 · «Continuar» o la tira de cifras siguen en el dashboard");
    if (!/className="ca-informes flex flex-wrap items-baseline justify-between/.test(pag) || !/<EnlaceCarga href="\/comparar"[^>]*data-lqs="comparar-entrada">/.test(pag) || pag.indexOf("{CASA.informes}") > pag.indexOf('data-lqs="comparar-entrada"')) F("11 · «Comparar» no está a la derecha de «Tus informes»");
    // La marca de origen: «Franco» al lado del nombre de lo que salió de un aviso; lo del wizard, nada.
    if (ARCHIVO_COPY.marca !== "Franco" || ARCHIVO_COPY.deFranco !== "De Franco" || ARCHIVO_COPY.mios !== "Míos") F("11 · el copy de la marca o del filtro no es «Franco» / «De Franco» / «Míos»");
    const marca = arch.slice(arch.indexOf("export function MarcaFranco("), arch.indexOf("// ─── Chips"));
    if (!/if \(!row\.de_franco\) return null;/.test(marca) || !/\{ARCHIVO_COPY\.marca\}/.test(marca)) F("11 · la marca «Franco» no depende de que el informe haya salido de un aviso");
    const fila = arch.slice(arch.indexOf("function FilaAnalisis("), arch.indexOf("// ─── Fila de grupo"));
    if (!/\{displayDireccion\(row\)\}\s*<\/EnlaceCarga>\s*<MarcaFranco row=\{row\} origen=\{origen\} \/>/.test(fila)) F("11 · la marca no va al lado del nombre en la tabla");
    const tel = arch.slice(arch.indexOf('data-archivo="lista-telefono"'));
    if (!/: displayDireccion\(row\)\}\s*<\/span>\s*\{esGrupo \? \([\s\S]{0,160}\) : \(\s*<MarcaFranco row=\{row\} origen=\{origenes\[row\.id\] \?\? null\} \/>/.test(tel)) F("11 · la marca no va al lado del nombre en el teléfono");
    // La vista dice el origen (migración) con la misma regla que origenDeInforme: un avisoId string.
    const mig = leer("supabase/migrations/20261017_dashboard_de_franco.sql");
    if (!/with \(security_invoker = true\)/.test(mig) || !/coalesce\(jsonb_typeof\(\(a\.input_data -> 'origenAviso'::text\) -> 'avisoId'::text\) = 'string'::text, false\) as de_franco/.test(mig) || !/u_buscar,\s*de_franco\s*from/.test(mig)) F("11 · la vista no trae de_franco al final (o pierde security_invoker)");
    // El filtro «De Franco» / «Míos», en la URL, en la consulta y con los conteos de la lista.
    if (parseParams({ o: "franco" }).origen !== "franco" || parseParams({ o: "mios" }).origen !== "mios" || parseParams({ o: "x" }).origen !== "todos") F("11 · el filtro de origen no se lee de la URL (?o=franco|mios)");
    if (!/o=franco/.test(buildHref(parseParams({}), { origen: "franco" })) || buildHref(parseParams({ o: "franco" }), { origen: "todos" }) !== "/dashboard") F("11 · el filtro de origen no viaja en la URL");
    if (!/if \(p\.origen !== "todos"\) \{\s*out = out\.eq\("de_franco", p\.origen === "franco"\);/.test(query) || !/origen: params\.origen,/.test(pag)) F("11 · el filtro de origen no llega a la consulta");
    if (!/\.eq\("es_unidad", true\)\.eq\("de_franco", true\)/.test(query) || !/por_origen: \{ franco: deFranco, mios: total - deFranco \}/.test(query)) F("11 · los conteos del filtro de origen no son los de la lista");
    const filtros = arch.slice(arch.indexOf('data-archivo="filtros"'));
    const iMod = filtros.indexOf('filtro="ambas"'), iFr = filtros.indexOf('filtro="de-franco"'), iMi = filtros.indexOf('filtro="mios"'), iVer = filtros.indexOf("veredictos.map(");
    if (iMod < 0 || iFr < iMod || iMi < iFr || iVer < iMi || !/\{ARCHIVO_COPY\.deFranco\}<Conteo n=\{orig\.franco\} \/>/.test(filtros) || !/\{ARCHIVO_COPY\.mios\}<Conteo n=\{orig\.mios\} \/>/.test(filtros)) F("11 · «De Franco» y «Míos» no están junto a modalidad y veredicto, con sus conteos");
    // El orden: por fecha, el más reciente arriba, siempre (un ?sort= viejo no lo cambia).
    const pv = parseParams({ sort: "score", dir: "asc" });
    if (pv.sort !== "fecha" || pv.dir !== "desc" || /sort=|dir=/.test(buildHref(pv, { q: "x" }))) F("11 · la lista se puede ordenar por otra cosa que la fecha");
    if (!/queryDashboardRows\(supabase, \{ \.\.\.filtros, sort: "fecha", dir: "desc", page: 0, pageSize: tope \}\)/.test(pag) || /sortHref|sortKey/.test(arch)) F("11 · la lista no va por fecha, el más reciente arriba (o vuelve el orden por columna)");
    // Las columnas: nombre, comuna, modalidad, veredicto, puntaje, flujo y fecha. Sin «Cap» ni «Retorno».
    const cols = Array.from(arch.matchAll(/<Th label="([^"]+)"/g)).map((m) => m[1]).join("|");
    if (cols !== "Nombre|Comuna|Modalidad|Veredicto|Puntaje|Flujo|Fecha") F(`11 · las columnas no son nombre, comuna, modalidad, veredicto, puntaje, flujo y fecha (${cols})`);
    if (/cap_rate|multiplicador|fmtCap|fmtMultiplicador|"Cap"|"Retorno"/.test(arch)) F("11 · vuelven «Cap» o «Retorno»");
    // Toda la fila abre el informe, en la tabla y en el teléfono.
    if (!/<tr\s+className=\{`group relative /.test(fila) || !/<EnlaceCarga href=\{abrir\} aria-hidden="true" tabIndex=\{-1\} className="absolute inset-0 z-0" \/>/.test(fila) || !/<EnlaceCarga href=\{abrir\} aria-label=\{displayDireccion\(row\)\} className="absolute inset-0 z-0" \/>/.test(tel)) F("11 · la fila entera no abre el informe");
    // En el teléfono: una línea —nombre, veredicto, flujo y fecha—; los filtros de lado; buscar y agrupar se quedan.
    const li = tel.slice(tel.indexOf("<li"), tel.indexOf("</li>"));
    const piezas = [": displayDireccion(row)}", "<ChipVeredicto v={veredictoDisplay(row)} />", "{fmtCLPSigned(flujo)}", "{fmtFechaCorta(row.created_at)}"].map((t) => li.indexOf(t));
    if (piezas.some((i) => i < 0) || piezas.some((i, k) => k > 0 && i < piezas[k - 1]) || /flex-wrap|<div className="mt-1/.test(li) || !/className=\{`relative flex min-h-\[48px\] items-center/.test(li)) F("11 · en el teléfono la tarjeta no es una línea con nombre, veredicto, flujo y fecha");
    if (!/className="-mx-3 mt-2\.5 flex flex-nowrap items-center gap-1\.5 overflow-x-auto px-3 [^"]*md:flex-wrap/.test(arch)) F("11 · en el teléfono los filtros no se desplazan de lado");
    if (!/<ArchiveSearch params=\{params\} \/>/.test(arch) || !/href=\{buildHref\(params, \{ group: !params\.group, open: \[\] \}\)\}\s*role="switch"/.test(arch) || !/Agrupar por propiedad\s*<\/EnlaceCarga>/.test(arch)) F("11 · se fueron buscar o agrupar por propiedad");
  }

  if (fallas.length === 0) console.log("  ✓ CASA: perfil de todos los informes, saldo real, copy aprobado, el pack de tres con el suelto debajo y sin el ticket, orden, escritura del servidor; arriba el banner según el estado, «Invita a alguien» con su color, lo demás plano; la invitación primero en el menú de compartir");
  for (const f of fallas) console.log(`  ✗ ${f}`);
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runCasaTier();
  process.exit(hard > 0 ? 1 : 0);
}

// ─── ACTA · verificado EN ROJO por mutación (02-oct-2026) ────────────────────
//   K1  las comunas solo del informe más reciente ............................. ROJO (1)
//   K2  el tope sin redondear a UF 100 ......................................... ROJO (1)
//   K3  lo editado a mano no manda (comunas) ................................... ROJO (1)
//   K4  el pie y el plazo del informe más antiguo .............................. ROJO (1)
//   K5  el regalo se cuenta como saldo común ................................... ROJO (2)
//   K6  «No vencen.» siempre ................................................... ROJO (2)
//   K7  el saldo sin el contador legacy ........................................ ROJO (2)
//   K8  otro título para el saldo vacío ........................................ ROJO (3)
//   K9  vuelve «Te escribimos los lunes» ....................................... ROJO (7)
//   K10 el botón del saldo vacío compra el pack ................................ ROJO (4)
//   K11 el precio escrito a mano en el copy .................................... ROJO (4)
//   K12 sin el saldo arriba .................................................... ROJO (5)
//   K13 la selección sin pedir saldo ........................................... ROJO (5)
//   K14 el PUT sin sesión ...................................................... ROJO (6)
//   K15 el validador acepta cualquier comuna ................................... ROJO (6)
//   K16 rojo decorativo en el título del saldo ................................. ROJO (7)
//   K17 la guía de la casa dispara el evento de post-pago ...................... ROJO (5)
//   K18 la tabla sin el revoke de escrituras ................................... ROJO (6)
//   18/18 en rojo; cada archivo restaurado byte a byte.
//   K19 el regalo sin su vencimiento · K20 el dashboard sin la fecha (02-oct-2026): 2/2 ROJO.
//   §8 «Tus informes»: K21 vuelve font-mono al archivo · K22 vuelve uppercase a la tira · K23 «LARGA» en mayúsculas
//   · K24 la página sin Inter · K25 el chip escribe la etiqueta cruda: 5/5 ROJO.
//   13-oct-2026 (decisión de Fabrizio: el registrado sin análisis compra el pack de tres por $19.990): §3 y §4 pasan
//   del suelto al pack, con el suelto debajo; el ticket de $14.990 sigue fuera de la casa. K10 se invierte: K26 el botón
//   vuelve al suelto · K27 sin el suelto debajo · K28 el ticket pack3 en la casa · K29 el rojo deja el botón del pack.
//   4/4 ROJO; cada archivo restaurado byte a byte.
//   17-oct-2026 (goal «el dashboard vende»): §2, §5 y §7 se reescriben (actas en línea) y entran §9 y §10. Mutaciones
//   en la tabla de abajo (scratchpad mutar-casa.cjs), cada archivo restaurado byte a byte:
//   J1 el pack tapa a la selección · J2 una selección vacía manda · J3 sin análisis no va el pack · J4 el regalo sin
//   vencimiento · J5 el plan anuncia el regalo · J6 el regalo solo si es todo el saldo (§9, la decisión pura)
//   J7 la casa con informes no decide · J8 la casa sin informes sin el regalo del ledger · J9 sin su selección · J10
//   «Invita a alguien» dentro de lo plano · J11 el saludo vuelve a ser el h1 · J12 sin el pie · J27 la guía antes del
//   saldo (§5/§9, el cableado y el orden)
//   J13 dos botones en el pack · J14 la selección no lleva a /semanal · J15 el regalo fuera del banner · J16 sin la
//   tríada · J17 el banner sin el material · J18 su botón en rojo · J19 «Invita a alguien» del color del banner · J20
//   vuelve a tarjeta · J21 el perfil vuelve a tarjeta · J22 el saldo repite el regalo · J23 serif en lo plano · J24
//   vuelve el rojo al pack (§7) · J25 otro título · J26 el banner del regalo sin la fecha (§2)
//   M1 la invitación no es lo primero del menú · M2 sin su color · M3 sin el CSS · M4 dos veces · M5 sin «Los dos reciben
//   un análisis» · M6 sin enlace queda colgado · M7 el menú con otro color que el dashboard (§10)
//   34/34 ROJO.
//   17-oct-2026 (goal «una sola lista»): §5 y §8 sin «Continuar» (actas en línea) y entra §11. Mutaciones (scratchpad
//   mutar-lista.cjs), cada archivo restaurado byte a byte: L1 vuelve «Continuar» · L2 «Comparar» no queda a la derecha ·
//   L3 la marca en todo · L4 sin marca en la tabla · L5 sin marca en el teléfono · L6 la vista con otra regla de origen ·
//   L7 la vista sin security_invoker · L8 el filtro no se lee · L9 no viaja en la URL · L10 «Míos» trae los de Franco ·
//   L11 la página no pasa el origen · L12 «Míos» cuenta todo · L13 «Míos» sin conteo · L14 un ?sort= viejo ordena · L15
//   la página ordena por otra cosa · L16 vuelve «Cap» · L17 sin modalidad · L18 la fila no abre el informe · L19 la
//   tarjeta en dos líneas · L20 la tarjeta sin fecha · L21 los filtros no van de lado · L22 se va «Agrupar por
//   propiedad» · L23 otro nombre para el filtro. 23/23 ROJO. La tarjeta del teléfono lleva el veredicto ENTERO, con la
//   tríada (un chip compacto de solo el signo no cumple «nombre, veredicto, flujo y fecha»; se probó y se retiró): el
//   ancho para el nombre sale del chip un punto más chico y del «···» sin borde. K3 la tarjeta con solo el signo. ROJO.
