// ============================================================================
// GOLDEN · DASHBOARD-VACIO (29-sep-2026; corto desde el 01-oct-2026) — catch-test
// ============================================================================
//   La bienvenida del dashboard vacío (lo primero que ve quien entra por /registro) en el sistema
//   nuevo:
//   1 · SIN MONO NI MAYÚSCULAS ESPACIADAS: Inter; nada de font-mono ni uppercase.
//   2 · EL WORDMARK FIEL: FrancoLogo, no uno armado a mano.
//   3 · SIN ROJO DECORATIVO: el único rojo es el botón de la acción principal.
//   4 · LA TRÍADA COMO ESTÁ: los tres ChipVeredicto.
//   5 · «GRATIS» SOLO SI ES VERDAD: el botón dice gratis solo con el crédito de bienvenida sin usar,
//       leído de user_credits en la página.
//   6 · LO QUE FRANCO HACE: analizar sus deptos Y las oportunidades de inversión, con las frases
//       aprobadas; con perfil, sus chips editables en UNA línea dentro del segundo bloque.
//   7 · EN TUTEO.
//   8 · CORTA (01-oct-2026, decisión de Fabrizio): el saludo, el titular, los dos bloques y el botón.
//       Nada más: sin los tres pasos, sin «Ver un informe de ejemplo», sin «Cuando quieras más» ni los
//       planes, sin la caja «Lo que Franco busca para ti se arma con tu primer análisis».
//   9 · EL SALUDO CON EL NOMBRE REAL: sin él, «Hola.» —nunca la parte del correo antes de la @—.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/dashboard-vacio-catch-test.ts
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BIENVENIDA, primerAnalisisGratis } from "../../../src/app/dashboard/bienvenida-copy";
import { nombreReal } from "../../../src/lib/welcome";

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
  // 4
  for (const v of ["COMPRAR", "AJUSTA SUPUESTOS", "BUSCAR OTRA"]) if (!b.includes(`<ChipVeredicto v="${v}" />`)) F(`4 · falta ${v} con ChipVeredicto`);
  // 5
  if (primerAnalisisGratis({ welcome_credit_used: false }) !== true || primerAnalisisGratis({ welcome_credit_used: true }) !== false || primerAnalisisGratis(null) !== false || primerAnalisisGratis({}) !== false) F("5 · primerAnalisisGratis no sigue al crédito de bienvenida");
  if (BIENVENIDA.boton(true) !== "Analiza tu primer depto gratis" || /gratis/i.test(BIENVENIDA.boton(false))) F("5 · el botón no es «Analiza tu primer depto gratis», o dice gratis sin el crédito de bienvenida");
  if (!/\{yendo \? BIENVENIDA\.cargando : BIENVENIDA\.boton\(gratis\)\}/.test(b)) F("5 · el botón no depende de gratis");
  const pag = sinComentarios(leer("src/app/dashboard/page.tsx"));
  if (!/\.select\("onboarding_completed, welcome_credit_used"\)/.test(pag) || !/const gratis = primerAnalisisGratis\(creditsRow\);/.test(pag)) F("5 · la página no lee el crédito de bienvenida para decidir «gratis»");
  if ((pag.match(/<Bienvenida nombre=\{firstName \|\| null\} gratis=\{gratis\} perfil=\{perfil\}/g) ?? []).length !== 2) F("5 · las dos ramas vacías del dashboard no usan la bienvenida con gratis y perfil");
  // 6
  if (BIENVENIDA.titular !== "Esto es lo que Franco hace por ti.") F("6 · el titular no es «Esto es lo que Franco hace por ti.»");
  if (BIENVENIDA.hace.length !== 2 || BIENVENIDA.hace[0]?.titulo !== "Analiza tus deptos.") F("6 · no son los dos bloques, o el primero no es «Analiza tus deptos.»");
  if (BIENVENIDA.hace[1]?.titulo !== "Te hace llegar oportunidades de inversión.") F("6 · el título del bloque de oportunidades no es «Te hace llegar oportunidades de inversión.»");
  if (BIENVENIDA.hace[1]?.texto !== "Franco tiene un portafolio de deptos para invertir, y todos pasaron por el mismo análisis que vas a hacer tú. Estamos abriendo el acceso: te escribimos apenas tengamos uno que calce con lo que buscas.") F("6 · el texto del bloque de oportunidades no es el aprobado");
  if (!/\{i === 1 && perfil && <ChipsPerfil perfil=\{perfil\} demo=\{demo\} \/>\}/.test(b)) F("6 · los chips del perfil no van dentro del segundo bloque");
  if (!/className="flex flex-nowrap items-center gap-2 overflow-x-auto \[scrollbar-width:none\]"/.test(b) || (b.match(/<span aria-hidden="true">\{/g) ?? []).length !== 3 || (b.match(/<select aria-label=/g) ?? []).length !== 3 || !/fetch\("\/api\/lo-que-sigue\/perfil"/.test(b)) F("6 · los chips del perfil no son tres, editables y en una línea");
  if (!/if \(demo\) return;/.test(b)) F("6 · la demo escribe el perfil");
  if (!/\.from\("perfiles_inversion"\)[\s\S]{0,200}\.eq\("user_id", user\.id\)/.test(pag) || !/pref_tipologia \?\? perfilRow\.tipologia/.test(pag)) F("6 · la página no lee el perfil (con lo editado primero)");
  // 7
  const textos = [BIENVENIDA.saludo("x"), BIENVENIDA.saludo(null), BIENVENIDA.titular, ...BIENVENIDA.hace.flatMap((h) => [h.titulo, h.texto]), BIENVENIDA.boton(true), BIENVENIDA.boton(false)];
  for (const t of textos) if (VOSEO.test(t)) F(`7 · voseo: «${t}»`);
  // 8 · corta
  const copy = sinComentarios(leer("src/app/dashboard/bienvenida-copy.ts"));
  for (const [re, que] of [
    [/pasos|Cómo es tu primer análisis/, "los tres pasos"],
    [/informe de ejemplo|href="\/demo"/, "«Ver un informe de ejemplo»"],
    [/Cuando quieras más|PRICING_PLANS|planes|Ver plan|\/pricing/i, "los planes"],
    [/se arma con tu primer análisis|sinPerfil|Franco busca para ti/, "la caja «Lo que Franco busca para ti se arma con tu primer análisis»"],
    [/bajoBoton|Gratis y sin tarjeta/, "la línea bajo el botón"],
  ] as const) if (re.test(b) || re.test(copy)) F(`8 · vuelve ${que} a la bienvenida`);
  if ((b.match(/<button\b/g) ?? []).length !== 1 || /<EnlaceCarga\b|<Link\b|<a\s/.test(b)) F("8 · la bienvenida tiene otra acción además del botón");
  if (/conPlanes/.test(pag) || /conPlanes/.test(b)) F("8 · vuelve la variante con planes");
  // 9 · el saludo
  if (BIENVENIDA.saludo(null) !== "Hola." || BIENVENIDA.saludo("Camila") !== "Hola, Camila.") F("9 · el saludo no es «Hola, {nombre}.» o «Hola.»");
  if (nombreReal({ full_name: "Camila Rojas" }) !== "Camila" || nombreReal({ name: "  José  Pérez " }) !== "José" || nombreReal({}) !== null || nombreReal(null) !== null || nombreReal({ full_name: "  " }) !== null) F("9 · nombreReal no toma el primer nombre real (o inventa uno)");
  if (!/const firstName = nombreReal\(user\.user_metadata\) \?\? "";/.test(pag) || /firstName = fullName/.test(pag)) F("9 · el saludo del dashboard puede salir del correo (no usa nombreReal)");
  if (/email|correo|split\("@"\)/i.test(sinComentarios(leer("src/lib/welcome.ts")).match(/export function nombreReal[\s\S]*?\n\}/)?.[0] ?? "x")) F("9 · nombreReal mira el correo");

  // los archivos viejos no vuelven
  for (const viejo of ["src/app/dashboard/onboarding-client.tsx", "src/app/dashboard/empty-state.tsx"]) if (existsSync(join(RAIZ, viejo))) F(`2 · volvió ${viejo}`);

  if (fallas.length) {
    console.log(`  ✗ DASHBOARD-VACIO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — corta: el saludo con el nombre real (o «Hola.»), lo que Franco hace en dos bloques con la tríada y los chips del perfil en una línea, y un solo botón; Inter sin mono, FrancoLogo, rojo solo en el botón, «gratis» solo con el crédito de bienvenida");
  }
  return { hard: fallas.length };
}

// ── ACTA v3 (01-oct-2026, la bienvenida corta: 12/12 en rojo, restauradas byte a byte): D20 vuelven los pasos ·
// D21 vuelve el informe de ejemplo · D22 vuelven los planes · D23 vuelve la caja sin perfil · D24 el título viejo
// de oportunidades · D25 los chips fuera del bloque · D26 los chips en varias líneas · D27 el saludo con el correo ·
// D28 nombreReal cae al correo · D29 sin nombre dice otra cosa · D30 el botón sin gratis · D31 una segunda acción.
// Salieron con la bienvenida corta los chequeos de los pasos en tinta, la línea bajo el botón, «Franco busca
// para ti:» y la frase sin perfil (D5, D11, D17, D18 y D19 ya no tienen qué mutar).
// ── ACTA v2 (29-sep-2026, las frases aprobadas, 5/5 en rojo): D15 el texto de oportunidades · D16 el
// título · D17 la frase sin perfil · D18 «Franco busca para ti:» · D19 el perfil arriba del bloque.
// ── ACTA DE MUTACIONES v1 (29-sep-2026, 14/14 en rojo, restauradas byte a byte) ─────────────
// D1 vuelve el mono · D2 mayúsculas · D3 wordmark a mano · D4 rojo en «Ver plan» · D5 números en
// círculo rosado · D6 falta un chip · D7 «gratis» sin crédito · D8 la regla ignora el crédito · D9 la
// página no lo lee · D10 sin el portafolio · D11 sin «Franco busca para ti:» · D12 la demo escribe ·
// D13 voseo · D14 el perfil sin lo editado.

if (require.main === module) {
  const { hard } = runDashboardVacioTier();
  process.exit(hard ? 1 : 0);
}
