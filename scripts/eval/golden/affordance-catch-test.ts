// ============================================================================
// GOLDEN · AFFORDANCE (28-sep-2026) — catch-test
// ============================================================================
//   Dos reglas del sitio: LO TOCABLE SE VE TOCABLE y LO QUE TARDA SE VE CARGANDO.
//   1 · «Ver un análisis real» del hero (landing) y «Ver un análisis de ejemplo» (portada del
//       wizard) son la píldora con contorno (`he-pild`), no un texto suelto. «Ver cómo calcula» y
//       las pestañas del demo también se ven tocables.
//   2 · Todo enlace que navega pasa por `EnlaceCarga`: al toque queda `data-presionado="1"` y
//       enciende la barra fina bajo el header (`BarraCarga`, `.hf-barra`), que se apaga cuando la
//       ruta cambió o al tope. El hero, las pestañas del demo, el header, el pie y CtaAnalizar la
//       usan. El estado es `carga-global.ts`, probado acá sin React.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/affordance-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hayCarga, iniciarCarga, rutaCarga, suscribirCarga, terminarCarga, versionCarga } from "../../../src/lib/carga-global";
import { clicNavega } from "../../../src/components/chrome/EnlaceCarga";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

export function runAffordanceTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER AFFORDANCE (tocable y cargando, 0 tokens) ───");

  // ── 1 · LO TOCABLE SE VE TOCABLE ───────────────────────────────────────────
  const entrada = sinComentarios(leer("src/components/landing-v14/Entrada.tsx"));
  if (!/<LinkMedido href="\/demo" className="he-pild" evento=\{EV\.ejemplo\}/.test(entrada)) F("1 · «Ver un análisis real» del hero no es la píldora (he-pild)");
  const portada = sinComentarios(leer("src/components/formulario-v4/screenEntrada.tsx"));
  if (!/pie=\{<EnlaceCarga href="\/demo" className="he-pild"/.test(portada)) F("1 · «Ver un análisis de ejemplo» de la portada del wizard no es la píldora con carga");
  const heroCss = leer("src/components/entrada/hero-entrada.css");
  const pild = (heroCss.match(/\.he-pild \{([^}]*)\}/) ?? [])[1] ?? "";
  if (!/border-radius: 99px/.test(pild) || !/border: 1\.5px solid/.test(pild) || !/height: 38px/.test(pild) || !/display: inline-flex/.test(pild)) F("1 · la píldora del hero no tiene el contorno, el radio y el alto de «Entrar»");
  if (/\.he-pie a \{[^}]*font-style: italic/.test(heroCss)) F("1 · vuelve el texto suelto en serif itálica en el pie del hero");
  if (!/\.he-pild:hover, \.he-pild:focus-visible, \.he-pild\[data-presionado="1"\] \{ background: var\(--he-papel\)/.test(heroCss)) F("1 · la píldora del hero no se rellena al presionarla");
  const landingCss = leer("src/components/landing-v14/landing.css");
  const como = (landingCss.match(/\.lv-como \{([^}]*)\}/) ?? [])[1] ?? "";
  if (!/border-radius: var\(--lv-rad-pill\)/.test(como) || !/border: 1\.5px solid/.test(como)) F("1 · «Ver cómo calcula» sigue siendo un texto subrayado suelto");
  const demo = sinComentarios(leer("src/app/demo/demo-cabecera.tsx"));
  if (!/<EnlaceCarga\s*\n\s*key=\{p\.modalidad\}\s*\n\s*href=\{p\.href\}\s*\n\s*role="tab"/.test(demo)) F("1 · las pestañas del demo no son EnlaceCarga");
  if (!/rounded-full border px-4/.test(demo) || !/bg-\[var\(--franco-text\)\] text-\[var\(--franco-bg\)\]/.test(demo)) F("1 · las pestañas del demo no se ven como píldoras (la activa rellena en tinta)");

  // ── 2 · LO QUE TARDA SE VE CARGANDO ────────────────────────────────────────
  // (a) el estado, sin React
  {
    const cambios: boolean[] = [];
    const soltar = suscribirCarga(() => cambios.push(hayCarga()));
    const v0 = versionCarga();
    terminarCarga();
    if (hayCarga() || versionCarga() !== v0) F("2 · terminar sin nada en curso cambia el estado");
    iniciarCarga("/"); iniciarCarga("/demo");
    if (!hayCarga() || cambios.join(",") !== "true") F(`2 · iniciar dos veces no es idempotente (${cambios.join(",")})`);
    if (rutaCarga() !== "/") F(`2 · la carga no recuerda la ruta de origen (la primera manda): ${rutaCarga()}`);
    terminarCarga();
    if (hayCarga() || cambios.join(",") !== "true,false" || rutaCarga() !== "") F(`2 · terminar no apaga la carga o avisa de más (${cambios.join(",")})`);
    soltar();
    iniciarCarga("/"); terminarCarga();
    if (cambios.length !== 2) F("2 · un oyente dado de baja sigue recibiendo cambios");
  }
  // (b) qué clics navegan
  const clic = { button: 0 };
  if (!clicNavega(clic, "/demo")) F("2 · un clic normal a una ruta interna no cuenta como navegación");
  if (clicNavega({ button: 0, metaKey: true }, "/demo") || clicNavega({ button: 1 }, "/demo") || clicNavega({ button: 0, ctrlKey: true }, "/demo")) F("2 · abrir en pestaña nueva enciende la carga");
  if (clicNavega(clic, "/demo", "_blank") || clicNavega(clic, "https://x.y") || clicNavega(clic, "//x.y") || clicNavega({ button: 0, defaultPrevented: true }, "/demo")) F("2 · un destino externo, un target nuevo o un clic ya cancelado encienden la carga");
  // (c) el enlace: presionado + iniciarCarga en el mismo clic, y se suelta al cambiar la ruta
  const enlace = sinComentarios(leer("src/components/chrome/EnlaceCarga.tsx"));
  if (!/if \(clicNavega\(e, hrefTexto, target\) && !\(hrefTexto === pathname\)\) \{\s*\n\s*setPresionado\(true\);\s*\n\s*iniciarCarga\(pathname\);/.test(enlace)) F("2 · EnlaceCarga no marca presionado ni enciende la carga en el clic");
  if (!/data-presionado=\{presionado \? "1" : undefined\}/.test(enlace) || !/useEffect\(\(\) => \{ setPresionado\(false\); \}, \[pathname\]\);/.test(enlace)) F("2 · EnlaceCarga no expone data-presionado o no lo suelta al cambiar la ruta");
  // (d) la barra: en el header, se apaga al cambiar la ruta y al tope
  const barra = sinComentarios(leer("src/components/chrome/BarraCarga.tsx"));
  // Compara con la ruta de ORIGEN, no con la anterior que vio: el header se remonta entre la landing
  // y la app, y una barra recién montada en /demo nunca vio el cambio (medido en el preview: 15 s
  // hasta el tope con el demo ya en pantalla desde los 4 s).
  if (!/if \(activa && rutaCarga\(\) !== pathname\) terminarCarga\(\);\s*\n\s*\}, \[activa, pathname\]\);/.test(barra) || /useRef/.test(barra)) F("2 · la barra no se apaga cuando la ruta que ve no es la de origen");
  if (!/window\.setTimeout\(terminarCarga, TOPE_CARGA_MS\)/.test(barra) || !/export const TOPE_CARGA_MS = 15_000;/.test(barra)) F("2 · la barra no tiene tope");
  if (!/<div className="hf-barra" data-activa=\{activa \? "1" : "0"\} aria-hidden="true" \/>/.test(barra)) F("2 · la barra no es .hf-barra con data-activa");
  const header = sinComentarios(leer("src/components/chrome/HeaderFranco.tsx"));
  if (!/<BarraCarga \/>\s*\n\s*<\/header>/.test(header)) F("2 · el header único no monta la barra");
  if (/<Link\b/.test(header)) F("2 · el header navega con <Link> pelado: sin presionado ni barra");
  if (/<Link\b/.test(sinComentarios(leer("src/components/landing-v14/Marca.tsx")))) F("2 · el pie de la landing navega con <Link> pelado");
  const headerCss = leer("src/components/chrome/header-franco.css");
  if (!/\.hf-barra \{ position: absolute; left: 0; right: 0; bottom: 0; height: 2px;/.test(headerCss) || !/\.hf-barra\[data-activa="1"\]::before \{/.test(headerCss) || !/@keyframes hf-barra/.test(headerCss)) F("2 · la barra no está dibujada bajo el header");
  if (!/\.hf-barra\[data-activa="1"\]::before \{[^}]*background: currentColor;/.test(headerCss)) F("2 · la barra no toma el color del texto del header (el header no usa el rojo)");
  if (!/\[data-presionado="1"\] \{ opacity: 0\.72; transform: translateY\(1px\);/.test(leer("src/app/globals.css"))) F("2 · el estado presionado no tiene estilo global");
  // (e) quién la usa
  const linkMedido = sinComentarios(leer("src/components/landing-v14/LinkMedido.tsx"));
  if (!/return <EnlaceCarga href=\{href\} className=\{className\} onClick=\{medir\}>/.test(linkMedido) || /from "next\/link"/.test(linkMedido)) F("2 · LinkMedido (el hero, «Ver planes») no navega con carga");
  for (const [f, rx, que] of [
    ["src/components/landing-v14/Secciones.tsx", /<EnlaceCarga className="lv-como" href="\/metodologia">/, "«Ver cómo calcula»"],
    ["src/components/landing-v14/Marca.tsx", /<EnlaceCarga href="\/metodologia">Cómo calcula<\/EnlaceCarga>/, "el pie de la landing"],
    ["src/components/CtaAnalizar.tsx", /<EnlaceCarga\s*\n\s*href=\{hrefAnalizar\(origen, \{ comuna \}\)\}/, "CtaAnalizar"],
  ] as const) {
    if (!rx.test(sinComentarios(leer(f)))) F(`2 · ${que} no navega con carga`);
  }

  if (fallas.length) {
    console.log(`  ✗ AFFORDANCE · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 30)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el enlace del hero es la píldora; el hero, las pestañas del demo, el header, el pie y CtaAnalizar quedan presionados y encienden la barra bajo el header, que se apaga al cambiar la ruta o al tope");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES (28-sep-2026, 13/13 en rojo, restauradas) ─────────────────────────────
// M1 hero sin píldora (he-pild → he-suelto) · M2 EnlaceCarga sin iniciarCarga(pathname) · M3 el header sin
// <BarraCarga /> · M4 pestañas del demo vuelven a <Link> · M5 la barra sin ::before · M6 la barra no
// se apaga al cambiar la ruta · M7 iniciarCarga no enciende (if (!activa) return) · M8 clicNavega
// ignora metaKey · M9 LinkMedido vuelve a <Link> · M10 portada del wizard sin píldora · M11 la barra
// vuelve al rojo · M12 la barra compara con la ruta anterior que vio (useRef) en vez del origen ·
// M13 iniciarCarga no guarda la ruta. Cada una cae en su fila; las trece restauradas byte a byte.

if (require.main === module) {
  const { hard } = runAffordanceTier();
  process.exit(hard ? 1 : 0);
}
