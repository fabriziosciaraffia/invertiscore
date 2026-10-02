// ============================================================================
// GOLDEN · CASA (02-oct-2026) — catch-test
// ============================================================================
//   El dashboard de quien ya tiene informes es la casa (mockup aprobado por Fabrizio):
//   1 · EL PERFIL SE ALIMENTA DE TODOS LOS INFORMES: las comunas se suman, los dormitorios también, el
//       tope sale del más caro analizado (redondeado hacia arriba a UF 100) y el piso del más barato;
//       modalidad, pie y plazo del más reciente; lo editado a mano MANDA, campo por campo.
//   2 · EL SALDO REAL: plan / regalo / con N / sin, leído del ledger y del contador legacy.
//   3 · EL COPY APROBADO, frase por frase.
//   4 · EL REGISTRADO COMPRA EL SUELTO: el botón del saldo vacío va a /checkout?product=single con
//       «Analizar otro depto · $9.990»; el pack no aparece en la casa.
//   5 · EL ORDEN: saludo → saldo → (comprador) la selección → el perfil → sus informes.
//   6 · LO EDITADO SE VALIDA Y SOLO LO ESCRIBE EL SERVIDOR: el PUT pide sesión; la tabla no acepta
//       escrituras de anon/authenticated.
//   7 · SIN «Te escribimos los lunes», sin las vedadas, en tuteo; el rojo solo en el botón de compra y
//       en el error.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/casa-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CASA } from "../../../src/app/dashboard/casa-copy";
import { estadoSaldo } from "../../../src/lib/casa-saldo";
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
  if (e({ disponibles: 5, plan: true, regaloRestante: 0, regaloVence: null, todoSinCaducidad: true }).tipo !== "plan") F("2 · con plan no es «plan»");
  if (e({ disponibles: 0, plan: false, regaloRestante: 0, regaloVence: null, todoSinCaducidad: false }).tipo !== "sin") F("2 · sin saldo no es «sin»");
  if (e({ disponibles: 1, plan: false, regaloRestante: 1, regaloVence: null, todoSinCaducidad: false }).tipo !== "regalo") F("2 · con solo el regalo no es «regalo»");
  const reg = e({ disponibles: 1, plan: false, regaloRestante: 1, regaloVence: "2026-12-01T15:00:00Z", todoSinCaducidad: false });
  if (reg.tipo !== "regalo" || reg.vence !== "2026-12-01T15:00:00Z") F("2 · el regalo no trae su vencimiento");
  if (!/regaloVence: vivos\.filter\(\(g\) => g\.source === FUENTE_REGALO_SEMANAL && g\.expires_at\)/.test(saldoFuente())) F("2 · el vencimiento del regalo no sale de su lote");
  if (!/estado\.tipo === "regalo" && estado\.vence \? textoVence\(estado\.vence\)/.test(sinComentarios(leer("src/app/dashboard/casa.tsx")))) F("2 · el dashboard no dice cuándo vence el regalo");
  const con = e({ disponibles: 3, plan: false, regaloRestante: 1, regaloVence: null, todoSinCaducidad: true });
  if (con.tipo !== "con" || con.n !== 3 || !con.noVencen) F("2 · con 3 (uno regalado) no es «con 3, no vencen»");
  const vence = e({ disponibles: 2, plan: false, regaloRestante: 0, regaloVence: null, todoSinCaducidad: false });
  if (vence.tipo !== "con" || vence.noVencen) F("2 · dice «No vencen.» con créditos que vencen");
  const saldo = sinComentarios(leer("src/lib/casa-saldo.ts"));
  if (!/from\("credit_grants"\)[\s\S]{0,200}\.gt\("remaining", 0\)[\s\S]{0,80}expires_at\.is\.null,expires_at\.gt\./.test(saldo) || !/disponibles: ledger \+ legacy/.test(saldo)) F("2 · el saldo no se lee del ledger vigente más el legacy");

  // 3 · el copy
  const exactos: Array<[string, string]> = [
    [CASA.sin.titulo(1), "Tu primer informe ya está en tu cuenta."],
    [CASA.sin.bajada, "Para analizar otro: $9.990, o con un plan."],
    [CASA.sin.boton, "Analizar otro depto · $9.990"],
    [CASA.regalo.titulo, "Tienes 1 análisis. Va por cuenta de Franco."],
    [CASA.con.titulo(3), "Te quedan 3 análisis"],
    [CASA.con.noVencen, "No vencen."],
    [CASA.guiaTitulo, "Te recomendamos empezar por estos"],
    [CASA.perfil.titulo, "Tu perfil de búsqueda"],
    [CASA.perfil.bajada, "Cada semana te enviamos los deptos publicados que mejor resultan con tu perfil. Cámbialo cuando quieras."],
    [CASA.perfil.bajadaComprador, "Cada semana te enviamos los deptos publicados que mejor resultan con tu perfil."],
  ];
  for (const [real, esperado] of exactos) if (real !== esperado) F(`3 · «${real}» debía ser «${esperado}»`);

  // 4 · el suelto, no el pack
  const casa = sinComentarios(leer("src/app/dashboard/casa.tsx"));
  const copy = sinComentarios(leer("src/app/dashboard/casa-copy.ts"));
  const pag = sinComentarios(leer("src/app/dashboard/page.tsx"));
  if (!/export const RUTA_SUELTO = "\/checkout\?product=single";/.test(casa) || !/<EnlaceCarga href=\{RUTA_SUELTO\}[^>]*data-casa="comprar-suelto">\s*\{CASA\.sin\.boton\}/.test(casa)) F("4 · el botón del saldo vacío no compra el análisis suelto");
  for (const [n, s] of [["casa.tsx", casa], ["casa-copy.ts", copy], ["page.tsx", pag.replace(/\.eq\("product", "pack3"\)/, "")]] as const) {
    if (/pack3|14\.990|14990|PACK_|3 análisis ·|Comprar 3/i.test(s)) F(`4 · el pack aparece en la casa (${n})`);
  }
  if (!/fmtCLP\(SINGLE_PRICE\)/.test(copy)) F("4 · el precio del suelto no sale de SINGLE_PRICE");

  // 5 · el orden
  const orden = ["<SaldoCasa estado={saldo}", "<GuiaBusqueda analysisId={guiaCasa.analysisId}", "<PerfilBusquedaCasa", "{CASA.informes}", "<Continuar ", "<Archive"].map((t) => pag.indexOf(t));
  if (orden.some((i) => i < 0) || orden.some((i, k) => k > 0 && i < orden[k - 1])) F(`5 · el orden de la casa no es saldo → selección → perfil → informes (${orden.join(",")})`);
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
  const rojos = casa.match(/signal-red/g) ?? [];
  if (rojos.length !== 2 || !/style=\{\{ background: "var\(--signal-red\)" \}\} data-casa="comprar-suelto"/.test(casa) || !/role="alert" className="[^"]*text-\[var\(--signal-red\)\]/.test(casa)) F(`7 · hay rojo fuera del botón de compra y del error (${rojos.length})`);
  if (/font-mono|uppercase/.test(casa)) F("7 · la casa usa mono o mayúsculas");

  if (fallas.length === 0) console.log("  ✓ CASA: perfil de todos los informes, saldo real, copy aprobado, suelto y no pack, orden, escritura del servidor");
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
