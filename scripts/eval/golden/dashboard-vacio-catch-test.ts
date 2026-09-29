// ============================================================================
// GOLDEN · DASHBOARD-VACIO (29-sep-2026) — catch-test
// ============================================================================
//   La bienvenida del dashboard vacío (lo primero que ve quien entra por /registro) en el sistema
//   nuevo:
//   1 · SIN MONO NI MAYÚSCULAS ESPACIADAS: Inter; nada de font-mono ni uppercase.
//   2 · EL WORDMARK FIEL: FrancoLogo, no uno armado a mano.
//   3 · SIN ROJO DECORATIVO: el único rojo es el botón de la acción principal; los números de los
//       pasos van en tinta.
//   4 · LA TRÍADA COMO ESTÁ: los tres ChipVeredicto.
//   5 · «GRATIS» SOLO SI ES VERDAD: el botón y la línea de abajo dicen gratis solo con el crédito de
//       bienvenida sin usar, leído de user_credits en la página.
//   6 · LO QUE FRANCO HACE: analizar sus deptos Y las oportunidades del portafolio (como el banner);
//       con perfil, «Franco busca para ti:» con chips editables; sin perfil, que se arma con el primero.
//   7 · EN TUTEO.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/dashboard-vacio-catch-test.ts
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BIENVENIDA, primerAnalisisGratis } from "../../../src/app/dashboard/bienvenida-copy";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");
const VOSEO = /(^|[^a-záéíóúñ])(dejás|tenés|querés|podés|sabés|mirá|tomá|entrá|seguí|registrate|guardá|revisá|poné|compará|elegí|tocá|pedí|escribí|analizá|empezá|vos)(?![a-záéíóúñ])/i;

export function runDashboardVacioTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER DASHBOARD-VACIO (la bienvenida en el sistema nuevo · 0 tokens) ───");

  const b = sinComentarios(leer("src/app/dashboard/bienvenida.tsx"));
  // 1
  if (/font-mono|JetBrains|monospace|Courier/.test(b)) F("1 · la bienvenida usa mono");
  if (/\buppercase\b|letterSpacing|tracking-\[/.test(b)) F("1 · la bienvenida vuelve a las mayúsculas espaciadas");
  if (!/const UI = "var\(--font-ui\), Inter/.test(b)) F("1 · la bienvenida no va en Inter (--font-ui)");
  // 2
  if (!/<FrancoLogo size="lg" \/>/.test(b) || /franco-wm-re|>\s*re\s*</.test(b)) F("2 · el wordmark no es FrancoLogo (vuelve el armado a mano)");
  // 3
  const rojos = b.match(/signal-red|#C8323C|bg-signal-red|text-signal-red/g) ?? [];
  if (rojos.length !== 1 || !/data-bienvenida="accion"[\s\S]{0,400}style=\{\{ background: "var\(--signal-red\)"/.test(b)) F(`3 · hay rojo fuera del botón principal (${rojos.length} usos)`);
  if (!/<span className="w-5 shrink-0 font-heading text-\[20px\] font-bold leading-\[1\.2\] text-\[var\(--franco-text\)\]" aria-hidden="true">\s*\{i \+ 1\}/.test(b) || /rounded-full[^"]*"[^>]*>\s*\{i \+ 1\}|color-mix\(in srgb, var\(--signal-red\)/.test(b)) F("3 · los números de los pasos no van en tinta (o vuelven los círculos rosados)");
  // 4
  for (const v of ["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"]) if (!b.includes(`<ChipVeredicto v="${v}" />`)) F(`4 · falta ${v} con ChipVeredicto`);
  // 5
  if (primerAnalisisGratis({ welcome_credit_used: false }) !== true || primerAnalisisGratis({ welcome_credit_used: true }) !== false || primerAnalisisGratis(null) !== false || primerAnalisisGratis({}) !== false) F("5 · primerAnalisisGratis no sigue al crédito de bienvenida");
  if (!/gratis/i.test(BIENVENIDA.boton(true)) || /gratis/i.test(BIENVENIDA.boton(false)) || /gratis/i.test(BIENVENIDA.bajoBoton(false, "$9.990")) || /gratis/i.test(BIENVENIDA.planesTexto(false))) F("5 · sin el crédito de bienvenida igual se dice «gratis»");
  if (!/\{yendo \? BIENVENIDA\.cargando : BIENVENIDA\.boton\(gratis\)\}/.test(b) || !/BIENVENIDA\.bajoBoton\(gratis, PRECIO_UNITARIO\)/.test(b)) F("5 · el botón o la línea de abajo no dependen de gratis");
  const pag = sinComentarios(leer("src/app/dashboard/page.tsx"));
  if (!/\.select\("onboarding_completed, welcome_credit_used"\)/.test(pag) || !/const gratis = primerAnalisisGratis\(creditsRow\);/.test(pag)) F("5 · la página no lee el crédito de bienvenida para decidir «gratis»");
  if ((pag.match(/<Bienvenida nombre=\{firstName \|\| null\} gratis=\{gratis\} perfil=\{perfil\}/g) ?? []).length !== 2) F("5 · las dos ramas vacías del dashboard no usan la bienvenida con gratis y perfil");
  // 6
  const hace = BIENVENIDA.hace.map((h) => `${h.titulo} ${h.texto}`).join(" ");
  if (!/Analiza tus deptos/.test(hace) || !/portafolio/.test(hace) || !/oportunidades/.test(hace)) F("6 · no dice lo que Franco hace por un registrado (analizar Y las oportunidades del portafolio)");
  if (!/\.from\("perfiles_inversion"\)[\s\S]{0,200}\.eq\("user_id", user\.id\)/.test(pag) || !/pref_tipologia \?\? perfilRow\.tipologia/.test(pag)) F("6 · la página no lee el perfil (con lo editado primero)");
  if (!/\{BIENVENIDA\.buscaParaTi\}/.test(b) || !/\{BIENVENIDA\.sinPerfil\}/.test(b) || !/fetch\("\/api\/lo-que-sigue\/perfil"/.test(b) || (b.match(/<select aria-label=/g) ?? []).length !== 3) F("6 · falta «Franco busca para ti:» con los tres chips editables, o la frase sin perfil");
  if (!/if \(demo \|\| !perfil\) return;/.test(b)) F("6 · la demo escribe el perfil");
  // 7
  const textos = [BIENVENIDA.saludo("x"), BIENVENIDA.titular, hace, BIENVENIDA.sinPerfil, BIENVENIDA.buscaParaTi, BIENVENIDA.pasosTitulo, ...BIENVENIDA.pasos.flatMap((p) => [p.titulo, p.texto]), BIENVENIDA.boton(true), BIENVENIDA.bajoBoton(true, "$1"), BIENVENIDA.bajoBoton(false, "$1"), BIENVENIDA.ejemplo, BIENVENIDA.planesTitulo, BIENVENIDA.planesTexto(true), BIENVENIDA.verPlan, BIENVENIDA.todosLosPlanes];
  for (const t of textos) if (VOSEO.test(t)) F(`7 · voseo: «${t}»`);
  // los archivos viejos no vuelven
  for (const viejo of ["src/app/dashboard/onboarding-client.tsx", "src/app/dashboard/empty-state.tsx"]) if (existsSync(join(RAIZ, viejo))) F(`2 · volvió ${viejo}`);

  if (fallas.length) {
    console.log(`  ✗ DASHBOARD-VACIO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — Inter sin mono, FrancoLogo, rojo solo en el botón, pasos en tinta, la tríada, «gratis» solo con el crédito de bienvenida, lo que Franco hace (análisis y portafolio) y «Franco busca para ti:» con chips editables");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES v1 (29-sep-2026, 14/14 en rojo, restauradas byte a byte) ─────────────
// D1 vuelve el mono · D2 mayúsculas · D3 wordmark a mano · D4 rojo en «Ver plan» · D5 números en
// círculo rosado · D6 falta un chip · D7 «gratis» sin crédito · D8 la regla ignora el crédito · D9 la
// página no lo lee · D10 sin el portafolio · D11 sin «Franco busca para ti:» · D12 la demo escribe ·
// D13 voseo · D14 el perfil sin lo editado.

if (require.main === module) {
  const { hard } = runDashboardVacioTier();
  process.exit(hard ? 1 : 0);
}
