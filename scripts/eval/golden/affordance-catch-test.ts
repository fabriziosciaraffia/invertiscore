// ============================================================================
// GOLDEN · AFFORDANCE (28-sep-2026) — catch-test
// ============================================================================
//   Dos reglas del sitio: LO TOCABLE SE VE TOCABLE y LO QUE TARDA SE VE CARGANDO.
//   1 · «Ver un análisis real» del hero (landing) y «Ver un análisis de ejemplo» (portada del
//       wizard) son la píldora con contorno (`he-pild`), no un texto suelto. «Ver cómo calcula» y
//       las pestañas del demo también se ven tocables.
//   2 · Todo enlace que navega pasa por `EnlaceCarga`: al toque queda `data-presionado="1"` y
//       enciende la barra fina bajo el header (`BarraCarga`, `.hf-barra`), que se apaga cuando la
//       ruta que ve (pathname + query, sin hash) no es la de origen, o al tope. La usan la landing,
//       el header, el demo, el wizard, el dashboard, el informe y la cuenta. El estado es
//       `carga-global.ts`, probado acá sin React.
//   3 · Lo que espera SIN cambiar de ruta también: generar el análisis, iniciar el pago (checkout y
//       anexo) y aplicar una corrección en el resumen (dry-run). Presionado y barra hasta la
//       respuesta.
//   4 · `pro_purchased` se retiró: el pago se mide desde el servidor (`pago_confirmado`).
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/affordance-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { claveDeHref, claveDeRuta, hayCarga, iniciarCarga, rutaCarga, suscribirCarga, terminarCarga, versionCarga } from "../../../src/lib/carga-global";
import { clicNavega } from "../../../src/components/chrome/EnlaceCarga";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

/** Las superficies que navegan solo con EnlaceCarga (ningún <Link> ni <a href="/..."> pelado). */
const SUPERFICIES_SIN_LINK: Array<[string, string]> = [
  ["src/components/chrome/HeaderFranco.tsx", "el header"],
  ["src/components/landing-v14/Marca.tsx", "el pie de la landing"],
  ["src/app/dashboard/archive.tsx", "el archivo del dashboard (chips, columnas, filas)"],
  ["src/app/dashboard/continuar.tsx", "«Continuar» del dashboard"],
  ["src/app/dashboard/bienvenida.tsx", "el dashboard vacío (bienvenida y estado vacío, desde el 29-sep-2026)"],
  ["src/app/dashboard/stats-strip.tsx", "la tira de cifras del dashboard"],
  ["src/app/cuenta/page.tsx", "la cuenta"],
  ["src/app/perfil/page.tsx", "el perfil"],
  ["src/app/analisis/comparativa/comparativa-client.tsx", "el informe comparativo"],
  ["src/app/analisis/renta-corta/[id]/results-client.tsx", "el informe STR"],
  ["src/app/analisis/[id]/results-client.tsx", "el informe LTR"],
  ["src/components/analysis/CtaWelcome.tsx", "CtaWelcome del informe"],
  ["src/components/analysis/NextAnalysisCTA.tsx", "NextAnalysisCTA del informe"],
  ["src/components/analysis/SubordinatedBanner.tsx", "SubordinatedBanner del informe"],
];

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
    const s1 = iniciarCarga("/"); const s2 = iniciarCarga("/demo");
    if (!hayCarga() || cambios.join(",") !== "true") F(`2 · iniciar dos veces no es idempotente (${cambios.join(",")})`);
    if (rutaCarga() !== "/") F(`2 · la carga no recuerda la ruta de origen (la primera manda): ${rutaCarga()}`);
    s1(); s1();
    if (!hayCarga() || cambios.length !== 1) F("2 · soltar UNA de dos cargas apaga la barra (o un soltar repetido cuenta doble)");
    s2();
    if (hayCarga() || cambios.join(",") !== "true,false" || rutaCarga() !== "") F(`2 · soltar la última carga no apaga la barra (${cambios.join(",")})`);
    const s3 = iniciarCarga("/");
    terminarCarga();
    if (hayCarga() || cambios.join(",") !== "true,false,true,false") F(`2 · terminar no apaga la carga o avisa de más (${cambios.join(",")})`);
    iniciarCarga("/x"); s3();
    if (!hayCarga()) F("2 · un soltar viejo, posterior a terminarCarga, apaga una carga nueva");
    terminarCarga();
    soltar();
    iniciarCarga("/"); terminarCarga();
    if (cambios.length !== 6) F("2 · un oyente dado de baja sigue recibiendo cambios");
  }
  // (b) la clave de ruta: query sí, hash no
  if (claveDeRuta("/dashboard", "?mod=todas&v=todos") !== "/dashboard?mod=todas&v=todos" || claveDeRuta("/dashboard", "mod=todas") !== "/dashboard?mod=todas" || claveDeRuta("/", "") !== "/") F("2 · claveDeRuta no normaliza la query");
  if (claveDeHref("/dashboard?q=x#archivo") !== "/dashboard?q=x" || claveDeHref("/dashboard#archivo") !== "/dashboard" || claveDeHref("/demo") !== "/demo") F("2 · claveDeHref no saca el hash (un chip del dashboard no se distinguiría de la ruta actual)");
  if (claveDeHref("/dashboard?a=1&b=2") === claveDeHref("/dashboard?a=1")) F("2 · dos queries distintas dan la misma clave");
  // (c) qué clics navegan
  const clic = { button: 0 };
  if (!clicNavega(clic, "/demo")) F("2 · un clic normal a una ruta interna no cuenta como navegación");
  if (clicNavega({ button: 0, metaKey: true }, "/demo") || clicNavega({ button: 1 }, "/demo") || clicNavega({ button: 0, ctrlKey: true }, "/demo")) F("2 · abrir en pestaña nueva enciende la carga");
  if (clicNavega(clic, "/demo", "_blank") || clicNavega(clic, "https://x.y") || clicNavega(clic, "//x.y") || clicNavega({ button: 0, defaultPrevented: true }, "/demo")) F("2 · un destino externo, un target nuevo o un clic ya cancelado encienden la carga");
  // (d) el enlace: presionado + iniciarCarga en el mismo clic; se suelta cuando la carga termina
  const enlace = sinComentarios(leer("src/components/chrome/EnlaceCarga.tsx"));
  if (!/if \(clicNavega\(e, hrefTexto, target\) && claveDeHref\(hrefTexto\) !== claveActual\(\)\) \{\s*\n\s*setPresionado\(true\);\s*\n\s*iniciarCarga\(claveActual\(\)\);/.test(enlace)) F("2 · EnlaceCarga no marca presionado ni enciende la carga en el clic (comparando destino y ruta actual con query)");
  if (!/data-presionado=\{presionado \? "1" : undefined\}/.test(enlace) || !/useEffect\(\(\) => \{ if \(!cargando\) setPresionado\(false\); \}, \[cargando\]\);/.test(enlace)) F("2 · EnlaceCarga no expone data-presionado o no lo suelta cuando la carga termina");
  // (e) la barra: en el header, compara pathname + query con el origen (también recién montada), y tiene tope
  const barra = sinComentarios(leer("src/components/chrome/BarraCarga.tsx"));
  if (!/const busqueda = useSearchParams\(\);\s*\n\s*const clave = claveDeRuta\(pathname, busqueda\.toString\(\)\);/.test(barra)) F("2 · la barra no mira la query (un chip del dashboard no la apagaría)");
  if (!/if \(activa && rutaCarga\(\) !== clave\) terminarCarga\(\);\s*\n\s*\}, \[activa, clave\]\);/.test(barra) || /useRef/.test(barra)) F("2 · la barra no se apaga cuando la ruta que ve no es la de origen");
  if (!/window\.setTimeout\(terminarCarga, TOPE_CARGA_MS\)/.test(barra) || !/export const TOPE_CARGA_MS = 15_000;/.test(barra)) F("2 · la barra no tiene tope");
  if (!/<div className="hf-barra" data-activa=\{activa \? "1" : "0"\} aria-hidden="true" \/>/.test(barra)) F("2 · la barra no es .hf-barra con data-activa");
  const header = sinComentarios(leer("src/components/chrome/HeaderFranco.tsx"));
  if (!/<Suspense fallback=\{null\}>\s*\n\s*<BarraCarga \/>\s*\n\s*<\/Suspense>\s*\n\s*<\/header>/.test(header)) F("2 · el header único no monta la barra (dentro de un Suspense, por useSearchParams)");
  const headerCss = leer("src/components/chrome/header-franco.css");
  if (!/\.hf-barra \{ position: absolute; left: 0; right: 0; bottom: 0; height: 2px;/.test(headerCss) || !/\.hf-barra\[data-activa="1"\]::before \{/.test(headerCss) || !/@keyframes hf-barra/.test(headerCss)) F("2 · la barra no está dibujada bajo el header");
  if (!/\.hf-barra\[data-activa="1"\]::before \{[^}]*background: currentColor;/.test(headerCss)) F("2 · la barra no toma el color del texto del header (el header no usa el rojo)");
  if (!/\[data-presionado="1"\] \{ opacity: 0\.72; transform: translateY\(1px\);/.test(leer("src/app/globals.css"))) F("2 · el estado presionado no tiene estilo global");
  // (f) quién la usa
  const linkMedido = sinComentarios(leer("src/components/landing-v14/LinkMedido.tsx"));
  if (!/return <EnlaceCarga href=\{href\} className=\{className\} onClick=\{medir\}>/.test(linkMedido) || /from "next\/link"/.test(linkMedido)) F("2 · LinkMedido (el hero, «Ver planes») no navega con carga");
  for (const [f, rx, que] of [
    ["src/components/landing-v14/Secciones.tsx", /<EnlaceCarga className="lv-como" href="\/metodologia">/, "«Ver cómo calcula»"],
    ["src/components/landing-v14/Marca.tsx", /<EnlaceCarga href="\/metodologia">Cómo calcula<\/EnlaceCarga>/, "el pie de la landing"],
    ["src/components/CtaAnalizar.tsx", /<EnlaceCarga\s*\n\s*href=\{hrefAnalizar\(origen, \{ comuna \}\)\}/, "CtaAnalizar"],
    ["src/app/dashboard/archive.tsx", /<EnlaceCarga href=\{sortHref\(params, sortKey\)\}/, "las columnas del archivo del dashboard"],
    ["src/app/dashboard/continuar.tsx", /<EnlaceCarga\s*\n\s*href=\{hrefAnalisis\(hero, heroStr\?\.id\)\}/, "«Continuar» del dashboard"],
    ["src/app/cuenta/page.tsx", /<EnlaceCarga href="\/analisis\/nuevo-v4"/, "la cuenta"],
    ["src/app/perfil/page.tsx", /<EnlaceCarga href=\{`\/analisis\/\$\{analysis\.id\}`\}/, "los análisis del perfil"],
    ["src/components/analysis/NextAnalysisCTA.tsx", /<EnlaceCarga\s*\n\s*href=\{accion\.href\}/, "NextAnalysisCTA del informe"],
    ["src/app/analisis/[id]/results-client.tsx", /<EnlaceCarga href="\/analisis\/nuevo-v4"/, "el informe LTR"],
  ] as const) {
    if (!rx.test(sinComentarios(leer(f)))) F(`2 · ${que} no navega con carga`);
  }
  for (const [f, que] of SUPERFICIES_SIN_LINK) {
    const s = sinComentarios(leer(f));
    if (/<Link(?=[\s>/])/.test(s) || /from "next\/link"/.test(s)) F(`2 · ${que} navega con <Link> pelado: sin presionado ni barra`);
    if (/<a href="\/(?!\/)/.test(s)) F(`2 · ${que} navega con <a href="/…"> pelado`);
    if (!/EnlaceCarga/.test(s)) F(`2 · ${que} no importa EnlaceCarga`);
  }

  // ── 3 · LO QUE ESPERA SIN CAMBIAR DE RUTA ──────────────────────────────────
  const resumen = sinComentarios(leer("src/components/formulario-v4/screenResumen.tsx"));
  if (!/setSubmitting\(true\); onTerminal\(\);\s*\n\s*soltarCarga\.current = iniciarCarga\(claveActual\(\)\);/.test(resumen)) F("3 · generar el análisis no enciende la barra al enviar");
  if (!/setSubmitting\(false\);\s*\n\s*soltarCarga\.current\(\);/.test(resumen)) F("3 · un fallo al generar no suelta la barra");
  if ((resumen.match(/disabled=\{submitting \|\| incompleto\} data-presionado=\{submitting \? "1" : undefined\} className=\{cls\}>/g) ?? []).length !== 3) F("3 · el botón de generar (crédito, compra, anónimo) no queda presionado mientras envía");
  if (!/const enEspera = \(field: string\) => dryRun\.pendiente && campoEnEspera === field;/.test(resumen) || !/w\.patchAnswers\(patch\);\s*\n\s*setCampoEnEspera\(field\);/.test(resumen)) F("3 · aplicar una corrección no marca la fila en espera");
  if ((resumen.match(/cargando=\{enEspera\("(\w+)"\)\} onCommit=\{\(v\) => commitEdit\("\1",/g) ?? []).length < 8) F("3 · las filas del resumen no reciben `cargando` con su propio campo");
  const filas = sinComentarios(leer("src/components/formulario-v4/filas.tsx"));
  if ((filas.match(/data-presionado=\{cargando \? "1" : undefined\} aria-busy=\{cargando \|\| undefined\}/g) ?? []).length !== 2) F("3 · FilaNum y FilaOpciones no quedan presionadas mientras el recálculo no llega");
  const dry = sinComentarios(leer("src/components/formulario-v4/useWizardV4DryRun.ts"));
  if (!/setRes\(\(r\) => \(\{ \.\.\.r, pendiente: true \}\)\);\s*\n\s*const soltar = iniciarCarga\(claveActual\(\)\);/.test(dry)) F("3 · el dry-run no enciende la barra ni marca pendiente al cambiar un dato");
  if (!/\.finally\(soltar\);/.test(dry) || !/clearTimeout\(t\);\s*\n\s*soltar\(\);/.test(dry) || !/pendiente: false \}\);/.test(dry)) F("3 · el dry-run no suelta la barra al llegar la respuesta (o al cancelarse)");
  const checkout = sinComentarios(leer("src/app/checkout/page.tsx"));
  if (!/setError\(null\);\s*\n\s*const soltar = iniciarCarga\(claveActual\(\)\);\s*\n\s*try \{/.test(checkout) || !/data-presionado=\{loading \? "1" : undefined\}/.test(checkout)) F("3 · iniciar el pago (checkout) no enciende la barra ni presiona el botón");
  if ((checkout.match(/soltar\(\);\s*\n\s*setLoading\(false\);/g) ?? []).length !== 2 || /\} finally \{/.test(checkout)) F("3 · checkout suelta la barra o el botón antes de que Flow responda (o no los suelta al fallar)");
  const anexo = sinComentarios(leer("src/components/comparativa/ResumenAnexoModal.tsx"));
  if (!/const soltar = iniciarCarga\(claveActual\(\)\);/.test(anexo) || (anexo.match(/soltar\(\);\s*\n\s*setLoading\(false\);/g) ?? []).length !== 2 || !/data-presionado=\{loading \? "1" : undefined\}/.test(anexo)) F("3 · desbloquear el anexo no enciende la barra, no presiona el botón o no suelta al fallar");

  // ── 4 · pro_purchased retirado ─────────────────────────────────────────────
  const retorno = sinComentarios(leer("src/app/payments/return/page.tsx"));
  if (/pro_purchased/.test(retorno)) F("4 · vuelve `pro_purchased` en /payments/return (redundante con `pago_confirmado`)");
  if (!/event: "pago_confirmado",/.test(sinComentarios(leer("src/lib/medicion-pago.ts")))) F("4 · sin `pro_purchased`, `pago_confirmado` tiene que seguir saliendo del servidor");

  if (fallas.length) {
    console.log(`  ✗ AFFORDANCE · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el enlace del hero es la píldora; landing, header, demo, wizard, dashboard, informe y cuenta navegan presionados con la barra bajo el header (query sí, hash no), que se apaga al llegar la ruta o al tope; generar, pagar y corregir esperan presionados con la barra; sin pro_purchased");
  }
  return { hard: fallas.length };
}

// ── ACTA DE MUTACIONES (28-sep-2026, restos: 23/23 en rojo, restauradas) ─────────────────────
// M1 hero sin píldora · M2 EnlaceCarga sin iniciarCarga(claveActual()) · M3 el header sin
// <BarraCarga /> · M4 pestañas del demo vuelven a <Link> · M5 la barra sin ::before · M6 la barra no
// se apaga al ver otra ruta · M7 iniciarCarga no avisa (pendientes === 2) · M8 clicNavega ignora
// metaKey · M9 LinkMedido vuelve a <Link> · M10 portada del wizard sin píldora · M11 la barra en
// rojo · M12 la barra compara con la ruta anterior que vio (useRef) · M13 iniciarCarga no guarda la
// ruta · M14 claveDeHref conserva el hash · M15 la barra ignora la query (usePathname solo) · M16 el
// archivo del dashboard vuelve a <Link> · M17 la cuenta vuelve a <Link> · M18 NextAnalysisCTA vuelve
// a <Link> · M19 generar sin iniciarCarga · M20 el botón de generar sin data-presionado · M21 el
// dry-run sin pendiente:true · M22 checkout suelta en el finally · M23 pro_purchased vuelve.
// Cada una cae en su fila; las veintitrés restauradas byte a byte.

if (require.main === module) {
  const { hard } = runAffordanceTier();
  process.exit(hard ? 1 : 0);
}
