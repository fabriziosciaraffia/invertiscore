/**
 * TIER COMUNAS-DISENO — las páginas de comuna en el diseño actual, con sus enlaces y su SEO intactos (20-oct-2026,
 * goal de Fabrizio). Tres tipos de página: el índice (/comunas), la de cada comuna (/comunas/[slug], con su variante
 * sin datos) y /cobertura.
 *
 *   1 · DISEÑO: la hoja `comunas.css` (prefijo `cm-`), Inter en todo y serif solo en títulos; sin rótulos en mono ni
 *       versalitas, sin sombras, sin el semáforo verde y ámbar, sin lavados rojos; botones en píldora (tinta o borde);
 *       la cabecera y el pie actuales.
 *   2 · ENLACES de cada tipo: el índice y /cobertura enlazan las 25 del roster; la comparativa solo enlaza comunas con
 *       página (San Bernardo enlazaba a un 404); el análisis cae en el wizard con la comuna puesta y «Ver los deptos» en
 *       /deptos con esa comuna elegida — para las 25, desde que Renca entró a la cobertura.
 *   3 · SEO: título, descripción, canónica, Open Graph y datos estructurados (FAQPage) de cada tipo, iguales. El único
 *       título que cambió, por decisión, es el del índice («— Franco» repetido).
 *   4 · DATOS: la venta pasa la regla de la evaluación de la noche (plausible.ts); el índice y la comparativa usan la
 *       cifra del título; el m² en pesos usa la UF del día; la prosa que contradice la tabla no se publica.
 *
 * Se verificó EN ROJO contra producción: corrido sobre una copia de master (el código que estaba publicado) falla en
 * las cuatro partes. Y con mutaciones, una regla por vez (acta al pie). 0 tokens.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => (existsSync(join(RAIZ, p)) ? readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n") : "");
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
/** Un módulo del árbol, o null si no existe (en la copia de producción todavía no estaban algunos). */
function cargar<T>(ruta: string): T | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(join(RAIZ, ruta)) as T;
  } catch {
    return null;
  }
}

const PAGINAS = {
  indice: "src/app/comunas/page.tsx",
  detalle: "src/app/comunas/[slug]/page.tsx",
  cobertura: "src/app/cobertura/page.tsx",
} as const;
const COMPONENTES = [
  "src/components/comunas/VeredictoCuota.tsx",
  "src/components/comunas/TablaTipologias.tsx",
  "src/components/comunas/PlusvaliaComunaSection.tsx",
  "src/components/comunas/ChipEstimado.tsx",
];
/** Lo que el diseño viejo dejaba en el marcado y el plano ya no usa. */
const VIEJO = /\bfont-mono\b|\bfont-body\b|\bfont-heading\b|\buppercase\b|\bshadow(-sm)?\b|\brounded-(xl|2xl|lg|r-2xl)\b|franco-positive|franco-warning|franco-v-adjust|#C8323C|monospace|text-\[var\(--franco|bg-\[#C8323C\]|rentColor/;

export function runComunasDisenoTier(): { hard: number } {
  console.log("\n─── TIER COMUNAS-DISENO (el índice, cada comuna y cobertura: diseño plano, enlaces, SEO y datos · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · DISEÑO ───────────────────────────────────────────────────────────────
  const css = leer("src/components/comunas/comunas.css");
  if (!css) F("1 · no existe la hoja de las páginas de comuna (comunas.css)");
  else {
    if (!/\.cm \{ font-family: var\(--font-ui\), "Inter"/.test(css)) F("1 · la hoja no pone Inter en todo");
    if (!/\.cm-titulo \{[^}]*font-family: var\(--font-heading\)[^}]*font-weight: 700/.test(css) || !/\.cm-h2 \{[^}]*font-family: var\(--font-heading\)/.test(css)) F("1 · los títulos no van en serif");
    if (/text-transform:\s*uppercase|letter-spacing:\s*0\.[01]\d*em|font-mono|box-shadow|#10B981|#F59E0B|#FBBF24|franco-positive|franco-warning/.test(css)) F("1 · la hoja vuelve a versalitas, mono, sombras o el semáforo verde y ámbar");
    if (!/\.cm-boton-tinta \{ background: var\(--franco-text\); color: var\(--franco-bg\); \}/.test(css) || !/\.cm-boton-borde \{ border: 1\.5px solid var\(--franco-text\); color: var\(--franco-text\); \}/.test(css) || !/\.cm-boton \{[^}]*border-radius: 99px/.test(css)) F("1 · los botones no son las píldoras de planes (tinta o borde)");
    if (!/\.cm-tarjeta \{[^}]*border-radius: 16px; border: 1px solid var\(--franco-border\); background: var\(--franco-card\)/.test(css)) F("1 · las tarjetas no son las planas de planes (radio 16, borde, sin sombra)");
    // El rojo, solo para lo que sale o falta: ninguna otra cosa lo usa.
    const rojos = (css.match(/[^\n]*#C8323C[^\n]*/g) ?? []).filter((l) => !/cm-negativo/.test(l));
    if (rojos.length) F(`1 · la hoja usa el rojo fuera de lo negativo: ${rojos[0].slice(0, 80)}`);
  }
  for (const [tipo, ruta] of Object.entries(PAGINAS)) {
    const src = leer(ruta);
    const s = sinComentarios(src);
    if (!src) { F(`1 · no encuentro la página ${tipo} (el extractor no corrió)`); continue; }
    if (!/import "@\/components\/comunas\/comunas\.css";/.test(src)) F(`1 · ${tipo}: no carga la hoja del diseño plano`);
    if (!/<main className="cm mx-auto max-w-\[1100px\] px-4 pb-16 pt-8 sm:px-6 md:pt-12" data-comuna="/.test(s)) F(`1 · ${tipo}: el cuerpo no es el del diseño plano (cm, 16 px de margen en el teléfono)`);
    if (!/<h1 className="cm-titulo">/.test(s)) F(`1 · ${tipo}: el título no es el del diseño plano`);
    if (!/<HeaderFranco \/>/.test(s) || !/<AppFooter variant="minimal" \/>/.test(s)) F(`1 · ${tipo}: no lleva la cabecera y el pie actuales (el pie con sus enlaces)`);
    const viejo = s.match(VIEJO);
    if (viejo) F(`1 · ${tipo}: queda el diseño viejo en el marcado (${viejo[0]})`);
    if (!/className="cm-boton cm-boton-tinta"/.test(s)) F(`1 · ${tipo}: el botón del análisis no es la píldora en tinta`);
    if (!/<section className="cm-cierre" data-comuna="cierre">/.test(s)) F(`1 · ${tipo}: el cierre no es la tarjeta plana (era un lavado rojo)`);
  }
  for (const ruta of COMPONENTES) {
    const s = sinComentarios(leer(ruta));
    if (!s) { F(`1 · no encuentro ${ruta}`); continue; }
    const viejo = s.match(VIEJO);
    if (viejo) F(`1 · ${ruta.split("/").pop()}: queda el diseño viejo (${viejo[0]})`);
  }
  if (!/fontFamily="var\(--font-ui\), Inter, sans-serif"/.test(leer("src/components/comunas/PlusvaliaComunaSection.tsx"))) F("1 · el gráfico de plusvalía sigue rotulado en mono");

  // ── 2 · ENLACES ──────────────────────────────────────────────────────────────
  const roster = cargar<{ COMUNAS_ROSTER: ReadonlyArray<{ slug: string; nombre: string }> }>("src/lib/data/comunas-roster")?.COMUNAS_ROSTER ?? [];
  if (roster.length !== 25) F(`2 · el roster no tiene 25 comunas (${roster.length})`);
  const ind = sinComentarios(leer(PAGINAS.indice));
  // Las tres listas del índice (ranking, sin datos, estimadas) enlazan cada comuna a su página; las tres salen del roster.
  if ((ind.match(/href=\{`\/comunas\/\$\{c\.slug\}`\}/g) ?? []).length !== 3 || !/const sinDatos = COMUNAS_ROSTER\.filter/.test(ind) || !/const conDatos = COMUNAS_ROSTER\s*\.map/.test(ind)) F("2 · índice: alguna lista no enlaza cada comuna del roster a su página");
  if (!/<CtaAnalizar origen="comunas_indice"/.test(ind)) F("2 · índice: el análisis no sale por CtaAnalizar con su origen");
  const cob = sinComentarios(leer(PAGINAS.cobertura));
  // Los enlaces se miden por su DESTINO, no por el marcado (el diseño lo mide la parte 1): así el gate no da rojo
  // sobre un enlace que existe con otras clases.
  if (!/const comunas = \[\.\.\.COMUNAS_ROSTER\]/.test(cob) || !/<Link\s+href=\{`\/comunas\/\$\{c\.slug\}`\}/.test(cob)) F("2 · cobertura: no enlaza las comunas del roster");
  if (!/<a\s+href="mailto:hola@refranco\.ai"/.test(cob) || !/<CtaAnalizar origen="cobertura"/.test(cob)) F("2 · cobertura: falta el correo o el análisis");
  const det = sinComentarios(leer(PAGINAS.detalle));
  if ((det.match(/<Link href="\/"[^>]*>Inicio<\/Link>\s*\{" → "\}\s*<Link href="\/comunas"[^>]*>Comunas<\/Link>/g) ?? []).length !== 2) F("2 · comuna: la miga de pan no enlaza el inicio y el índice en las dos variantes");
  if (!/\.filter\(\(c\) => c\.slug !== stats\.slug && c\.precioM2Promedio > 0 && esComunaDelRoster\(c\.slug\)\)/.test(det)) F("2 · comuna: la comparativa enlaza comunas sin página (San Bernardo daba 404)");
  if ((det.match(/<AccionesComuna nombre=\{/g) ?? []).length !== 2) F("2 · comuna: alguna variante no cierra con los dos botones");
  if (!/<CtaAnalizar origen="comuna_detalle" comuna=\{nombre\}/.test(det)) F("2 · comuna: el análisis no cae en el wizard con la comuna puesta");
  if (!/const deptos = comunaDeLaUrl\(nombre\);/.test(det) || !/href=\{`\/deptos\?\$\{new URLSearchParams\(\{ comuna: deptos, origen: "comuna_detalle" \}\)\.toString\(\)\}`\}/.test(det) || !/Ver los deptos de \{nombre\}/.test(det)) F("2 · comuna: «Ver los deptos» no cae en /deptos con la comuna elegida");
  if (!/<a href="\/comunas"[^>]*>\s*mirar otra comuna/.test(leer("src/components/comunas/VeredictoCuota.tsx"))) F("2 · comuna: «mirar otra comuna» ya no enlaza al índice");
  // Por comportamiento: las 25 llegan al wizard con su comuna y a /deptos con su comuna.
  const cta = cargar<{ hrefAnalizar: (o: string, x: { comuna?: string }) => string }>("src/lib/cta-analizar");
  const cob2 = cargar<{ isComunaDisponible: (c: string) => boolean }>("src/lib/comunas-disponibles");
  const dataset = cargar<{ COMUNAS: Array<{ comuna: string }> }>("src/lib/comunas");
  const portada = cargar<{ comunaDeLaUrl?: (t: string) => string | null }>("src/lib/deptos/portada");
  if (!cta || cta.hrefAnalizar("comuna_detalle", { comuna: "Ñuñoa" }) !== "/analisis/nuevo-v4?origen=comuna_detalle&comuna=%C3%91u%C3%B1oa") F("2 · el análisis no apunta al wizard con origen y comuna");
  if (!portada?.comunaDeLaUrl) F("2 · /deptos no sabe leer la comuna de la dirección (comunaDeLaUrl)");
  // La misma comparación que la página del wizard (con el alias «Santiago Centro» → «Santiago»).
  const alias = cargar<{ normalizeComuna: (c: string) => string }>("src/lib/comuna-normalizar")?.normalizeComuna ?? ((c: string) => c);
  if (!/const match = COMUNAS\.find\(\(c\) => normalizeComuna\(c\.comuna\)\.toLowerCase\(\) === normalizeComuna\(comunaParam\)\.toLowerCase\(\)\);/.test(sinComentarios(leer("src/app/analisis/nuevo-v4/page.tsx")))) F("2 · el wizard compara la comuna sin el alias: «Analizar depto en Santiago» llega sin la comuna");
  const sinWizard: string[] = [], sinDeptos: string[] = [];
  for (const c of roster) {
    const enDataset = dataset?.COMUNAS.some((d) => alias(d.comuna).toLowerCase() === alias(c.nombre).toLowerCase());
    if (!enDataset || !cob2?.isComunaDisponible(c.nombre)) sinWizard.push(c.nombre);
    if (portada?.comunaDeLaUrl && portada.comunaDeLaUrl(c.nombre) !== c.nombre) sinDeptos.push(c.nombre);
  }
  if (sinWizard.length) F(`2 · el wizard no precarga (o trata como fuera de cobertura) a: ${sinWizard.join(", ")}`);
  if (sinDeptos.length) F(`2 · /deptos no elige: ${sinDeptos.join(", ")}`);
  const dp = sinComentarios(leer("src/app/deptos/page.tsx"));
  if (!/const portada = await portadaDeptos\(comunaDeLaUrl\(searchParams\?\.comuna\)\);/.test(dp)) F("2 · /deptos no arranca con la comuna de la dirección");

  // ── 3 · SEO ──────────────────────────────────────────────────────────────────
  const indSrc = leer(PAGINAS.indice);
  const seoIndice = [
    /title: "Rentabilidad por Comuna",/,
    /description:\s*"Datos reales de rentabilidad de departamentos en las principales comunas de Santiago\. Actualizado semanalmente\.",/,
    /alternates: \{ canonical: "\/comunas" \},/,
    /title: "Rentabilidad por Comuna — Franco",\s*description:\s*"¿En qué comuna conviene más invertir\? Datos reales de arriendos, precios y rentabilidad en Santiago\.",\s*url: "https:\/\/refranco\.ai\/comunas",/,
    /images: \["\/opengraph-image"\],/,
  ];
  if (seoIndice.some((re) => !re.test(indSrc))) F("3 · índice: el título, la descripción, la canónica o el Open Graph cambiaron");
  const detSrc = leer(PAGINAS.detalle);
  const seoDetalle = [
    /title: `Invertir en \$\{stats\.nombre\} — Rentabilidad y datos reales`,/,
    /description: `Rentabilidad bruta promedio \$\{stats\.rentabilidadBruta\}% en \$\{stats\.nombre\}\. \$\{arriendoDesc\}\. Basado en \$\{stats\.totalPropiedades\} propiedades reales\.`,/,
    /alternates: \{ canonical: `\/comunas\/\$\{stats\.slug\}` \},/,
    /title: `Invertir en \$\{nombre\} — Rentabilidad y datos reales`,/,
    /alternates: \{ canonical: `\/comunas\/\$\{params\.slug\}` \},/,
    /title: `Departamentos en \$\{stats\.nombre\} — ¿Vale la pena invertir\?`,/,
    /<script type="application\/ld\+json" dangerouslySetInnerHTML=\{\{ __html: JSON\.stringify\(faqSchema\) \}\} \/>/,
    /"@type": "FAQPage",\s*mainEntity: \[\s*\.\.\.\(faqEquilibrio \? \[faqEquilibrio\] : \[\]\),\s*\.\.\.\(faqDividendo \? \[faqDividendo\] : \[\]\),\s*\.\.\.\(faqTercera \? \[faqTercera\] : \[\]\),\s*\.\.\.\(faqPlusvalia \? \[faqPlusvalia\] : \[\]\),/,
    /return COMUNAS_ROSTER\.map\(\(c\) => \(\{ slug: c\.slug \}\)\);/,
  ];
  const faltaSeo = seoDetalle.filter((re) => !re.test(detSrc));
  if (faltaSeo.length) F(`3 · comuna: cambió el SEO (${faltaSeo.length} piezas: título, descripción, canónica, Open Graph, FAQPage o las rutas)`);
  // Las FAQ visibles son las mismas del JSON-LD.
  if (!/\(faqSchema\.mainEntity as Array<\{ name: string; acceptedAnswer: \{ text: string \} \}>\)\.map\(/.test(detSrc)) F("3 · comuna: las preguntas visibles ya no son las del JSON-LD");
  const cobSrc = leer(PAGINAS.cobertura);
  if (!/title: "¿Dónde está disponible Franco\?",\s*description:\s*"Franco analiza departamentos como inversión en las comunas de Gran Santiago\. Mira en qué comunas hoy tienes el análisis con datos reales\.",\s*alternates: \{ canonical: "\/cobertura" \},/.test(cobSrc)) F("3 · cobertura: el título, la descripción o la canónica cambiaron");
  if (!/url: `https:\/\/refranco\.ai\/comunas\/\$\{c\.slug\}`/.test(leer("src/app/sitemap.ts"))) F("3 · el sitemap dejó de listar las comunas");

  // ── 4 · DATOS ────────────────────────────────────────────────────────────────
  const pl = cargar<{ ventaPlausible: (p: number, m2: number) => boolean; PRECIO_UF_MIN: number; PRECIO_UF_MAX: number; UF_M2_MIN: number; UF_M2_MAX: number }>("src/lib/avisos/plausible");
  if (!pl) F("4 · no existe la regla compartida de la noche (plausible.ts)");
  else {
    if (pl.PRECIO_UF_MIN !== 700 || pl.PRECIO_UF_MAX !== 60000 || pl.UF_M2_MIN !== 20 || pl.UF_M2_MAX !== 300) F("4 · la regla de la noche cambió de rangos");
    // Los nueve 2D de Puente Alto: UF 825 en 50 m² (16,5 UF/m²) no entra; UF 1.990 en 50 m² sí.
    if (pl.ventaPlausible(825, 50) || !pl.ventaPlausible(1990, 50) || pl.ventaPlausible(650, 30) || pl.ventaPlausible(70000, 400)) F("4 · la regla de la noche no descarta lo implausible");
  }
  const seo = sinComentarios(leer("src/lib/data/comunas-seo.ts"));
  if (!/if \(esVenta && !ventaQueEntra\(r\)\) \{ c\.descartadas\+\+; continue; \}/.test(seo) || !/if \(!ventaPlausible\(precioUF, r\.superficie_m2\)\) return false;/.test(seo) || !/const clave = claveAviso\(/.test(seo) || !/const ventaRows = clasificar\(ventaRowsRaw, true\);/.test(seo)) F("4 · las páginas de comuna no pasan la venta por la regla de la noche");
  if (!/\.select\("comuna, dormitorios, precio, moneda, superficie_m2, scraped_at, condicion, banos, lat, lng"\)/.test(seo)) F("4 · la página no trae baños y coordenadas: no reconoce el mismo depto publicado dos veces");
  const dep = sinComentarios(leer("src/lib/avisos/depurar.ts"));
  if (!/if \(!ventaPlausible\(precioUF, m2\)\) continue;/.test(dep) || !/const clave = claveAviso\(/.test(dep)) F("4 · la evaluación de la noche dejó de usar la regla compartida (las dos pueden separarse)");
  if (!/ventasDescartadas: crudo\?\.descartadas \?\? 0,/.test(seo) || !/\{p\.ventasDescartadas\.toLocaleString\("es-CL"\)\}/.test(leer("src/components/comunas/TablaTipologias.tsx"))) F("4 · la procedencia no declara las ventas que descarta la regla de la noche");
  // La cifra del título manda en el índice y en la comparativa (Puente Alto: 7,0% en el índice, 5,8% en su título).
  const cs = cargar<{ rentabilidadTitulo?: (s: unknown) => { min: number; max: number; medio: number }; textoRentabilidadTitulo?: (s: unknown) => string }>("src/lib/data/comunas-seo");
  if (!cs?.rentabilidadTitulo || !cs.textoRentabilidadTitulo) F("4 · no existe la cifra del título compartida (rentabilidadTitulo)");
  else {
    const fila = (rent: number, fuente: string) => ({ rentabilidadBruta: rent, referencia: { fuente } });
    const pa = { rentabilidadBruta: 7.0, tipologias: [fila(8.3, "comunalPorM2"), fila(5.8, "porTipologia")] };
    const est = { rentabilidadBruta: 6.4, tipologias: [fila(5.9, "comunalPorM2"), fila(6.8, "comunalPorM2")] };
    if (cs.textoRentabilidadTitulo(pa) !== "5,8%" || cs.textoRentabilidadTitulo(est) !== "5,9% a 6,8%" || cs.rentabilidadTitulo(est).medio !== 6.35) F("4 · la cifra del título no sale de las filas con arriendo propio (o de todas, si no hay)");
  }
  if (!/\.sort\(\(a, b\) => rentabilidadTitulo\(b\)\.medio - rentabilidadTitulo\(a\)\.medio\);/.test(ind) || (ind.match(/\{textoRentabilidadTitulo\(c\)\}/g) ?? []).length !== 2) F("4 · el índice no muestra ni ordena por la cifra del título");
  if ((det.match(/textoRentabilidadTitulo\(/g) ?? []).length !== 2 || !/const \{ min: rentMin, max: rentMax \} = rentabilidadTitulo\(stats\);/.test(det)) F("4 · la comparativa o el título no usan la cifra del título");
  if (/\bUF_CLP\b/.test(det) || !/const precioM2CLP = Math\.round\(stats\.precioM2Promedio \* stats\.supuestos\.ufCLP\);/.test(det)) F("4 · el m² en pesos usa una UF fija, no la del día");
  // La prosa que contradice la tabla no se publica (20-oct-2026): en 10 de 25 una tipología había cambiado de lado.
  type Snap = { dorms: number; veredictoFila: string; arriendoCLP: number; ventaUF: number; precioCuotaUF: number };
  const cp = cargar<{
    PROMPT_VERSION_COMUNA: number;
    detectarDrift: (p: unknown, s: unknown, lider: number | null) => { motivos: string[] };
    prosaContradiceLaTabla?: (d: { motivos: string[] }) => boolean;
  }>("src/lib/data/comuna-prosa");
  if (!cp?.prosaContradiceLaTabla) F("4 · no existe la regla de la prosa que contradice la tabla (prosaContradiceLaTabla)");
  else {
    const sup = { tasaAnual: 4.1, piePct: 20, plazoAnos: 30 };
    const t = (veredictoFila: string, precioCuotaUF: number): Snap => ({ dorms: 2, veredictoFila, arriendoCLP: 515000, ventaUF: 2306, precioCuotaUF });
    const prosa = { promptVersion: cp.PROMPT_VERSION_COMUNA, snapshot: { tipologias: [t("noSePagaSola", 3246)], liderDorms: 2, ...sup } };
    const dadoVuelta = cp.detectarDrift(prosa, { tipologias: [t("sePagaSola", 3246)], supuestos: sup }, 2);
    const soloCifra = cp.detectarDrift(prosa, { tipologias: [t("noSePagaSola", 3400)], supuestos: sup }, 2);
    const otroLider = cp.detectarDrift(prosa, { tipologias: [t("noSePagaSola", 3246)], supuestos: sup }, 3);
    if (!cp.prosaContradiceLaTabla(dadoVuelta) || !cp.prosaContradiceLaTabla(otroLider)) F("4 · la prosa con una tipología dada vuelta (o con otro líder) se sigue publicando");
    if (cp.prosaContradiceLaTabla(soloCifra)) F("4 · una cifra movida esconde la prosa: eso lo corrige el generador, no la página");
  }
  if (!/const prosaComuna = prosaGuardada && !prosaContradiceLaTabla\(detectarDrift\(prosaGuardada, stats, lider\?\.dorms \?\? null\)\) \? prosaGuardada : null;/.test(det) || /prosaGuardada\.prosa/.test(det) || !/\{prosaComuna\.prosa\}/.test(det)) F("4 · comuna: la página publica la prosa sin mirar si contradice la tabla");
  // Los veredictos con su nombre de hoy en los tres cierres (decían «comprar, negociar o seguir buscando»).
  for (const [tipo, ruta] of Object.entries(PAGINAS)) if (/negociar o seguir buscando/.test(sinComentarios(leer(ruta)))) F(`4 · ${tipo}: el cierre nombra veredictos viejos («negociar»)`);

  if (fallas.length) {
    console.log(`  ✗ COMUNAS-DISENO · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el índice, cada comuna y cobertura en el diseño plano; enlazan las 25 y nada a un 404; el análisis cae en el wizard con la comuna y «Ver los deptos» en /deptos con la comuna; el SEO igual; la venta con la regla de la noche, la cifra del título en el índice y ninguna prosa que contradiga su tabla");
  }
  return { hard: fallas.length };
}

/*
 * ⚠ ACTA (20-oct-2026) · verificado EN ROJO de dos maneras. (1) Contra producción: el tier corrido sobre una copia de
 * master —el código publicado antes de este cambio— falla en las cuatro partes. (2) Con mutaciones, una regla por vez y
 * restaurando por sha1 (runner del scratchpad de la sesión).
 */

if (require.main === module) {
  const { hard } = runComunasDisenoTier();
  process.exit(hard ? 1 : 0);
}
