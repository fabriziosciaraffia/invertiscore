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

export async function runComunasDisenoTier(): Promise<{ hard: number }> {
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
  // El pie es el de planes y del semanal (`informe`, sin la frase en mono) con los mismos tres enlaces del sitio que
  // tenía el `minimal` (PieComunas, 20-oct-2026), y la hoja no pide más fuentes que las de arriba: lo serif es 700
  // (el énfasis lo hereda: en 600 bajaba la serif variable entera y salía más delgado) y el chip va en Inter aunque
  // esté dentro de un nombre serif (en el índice heredaba la serif). Medido: la página dejó de bajar JetBrains Mono y
  // la serif variable (69 kB antes del primer pintado en el teléfono).
  const pie = sinComentarios(leer("src/components/comunas/PieComunas.tsx"));
  if (!/<AppFooter\s+variant="informe"\s+linksSlot=\{/.test(pie) || !/\{ENLACES_PIE\.map\(\(e\) => \(\s*<Link key=\{e\.href\} href=\{e\.href\}>/.test(pie) || !/export const ENLACES_PIE = \[/.test(leer("src/components/chrome/AppFooter.tsx"))) F("1 · el pie no es el de planes con los enlaces del sitio");
  if (css && (!/\.cm-titulo strong, \.cm-titular strong, \.cm-h2 strong \{ font-weight: inherit; \}/.test(css) || !/\.cm-chip \{ font-family: var\(--font-ui\), "Inter", sans-serif;/.test(css) || !/\.cm-pie \{[^}]*font-family: var\(--font-ui\), "Inter"/.test(css))) F("1 · la hoja pide otra cara de la serif (el énfasis en 600 o el chip heredando la serif) o el pie no va en Inter");
  for (const [tipo, ruta] of Object.entries(PAGINAS)) {
    const src = leer(ruta);
    const s = sinComentarios(src);
    if (!src) { F(`1 · no encuentro la página ${tipo} (el extractor no corrió)`); continue; }
    if (!/import "@\/components\/comunas\/comunas\.css";/.test(src)) F(`1 · ${tipo}: no carga la hoja del diseño plano`);
    if (!/<main className="cm mx-auto max-w-\[1100px\] px-4 pb-16 pt-8 sm:px-6 md:pt-12" data-comuna="/.test(s)) F(`1 · ${tipo}: el cuerpo no es el del diseño plano (cm, 16 px de margen en el teléfono)`);
    if (!/<h1 className="cm-titulo">/.test(s)) F(`1 · ${tipo}: el título no es el del diseño plano`);
    if (!/<HeaderFranco \/>/.test(s) || !/<PieComunas \/>/.test(s)) F(`1 · ${tipo}: no lleva la cabecera y el pie actuales (el pie con sus enlaces)`);
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
  // Y con el rango de esa comuna (decisión de Fabrizio): el de más 2D publicados. Con el de Santiago, «Ver los deptos de
  // Renca» (o de Vitacura, o de Quilicura) llegaba a cero publicados.
  const sv = cargar<{ rangoConMasPublicados?: (admin: unknown, comuna: string, dorms: number[], ahora?: Date) => Promise<string> }>("src/lib/deptos/servidor");
  if (!sv?.rangoConMasPublicados) F("2 · /deptos no elige el rango de la comuna (rangoConMasPublicados)");
  else {
    const llamadas: Array<{ comunas?: string[]; dorms?: number[] }> = [];
    const rpc = (porMin: Record<number, number>) => ({
      rpc: async (_n: string, a: { comunas: string[]; dorms: number[]; uf_min: number }) => {
        llamadas.push(a);
        return { data: [{ comuna: a.comunas[0], total: porMin[a.uf_min] ?? 0, comprar_20: 0, comprar_30: 0 }], error: null };
      },
    });
    const barata = await sv.rangoConMasPublicados(rpc({ 0: 15, 3000: 0, 4000: 0, 5500: 0 }), "Renca", [2]);
    const cara = await sv.rangoConMasPublicados(rpc({ 0: 0, 3000: 0, 4000: 3, 5500: 237 }), "Vitacura", [2]);
    const vacia = await sv.rangoConMasPublicados(rpc({}), "Renca", [2]);
    const empate = await sv.rangoConMasPublicados(rpc({ 0: 5, 3000: 5, 4000: 1 }), "Macul", [2]);
    if (barata !== "hasta-3000" || cara !== "5500-mas") F(`2 · /deptos no arranca en el rango con más publicados de la comuna (${barata}, ${cara})`);
    if (vacia !== "3000-4000" || empate !== "3000-4000") F("2 · sin publicados o con empate, /deptos no se queda en el rango por defecto");
    if (llamadas.some((l) => l.comunas?.length !== 1 || l.dorms?.join() !== "2")) F("2 · el rango de la comuna se cuenta con otras comunas u otra tipología");
  }
  const por = sinComentarios(leer("src/lib/deptos/portada.ts"));
  if (!/const rango = comuna \? await rangoConMasPublicados\(admin, comuna, \[\.\.\.dorms\]\) : ELECCIONES_POR_DEFECTO\.rango;/.test(por) || !/validarElecciones\(\{ \.\.\.ELECCIONES_POR_DEFECTO, comunas, rango, /.test(por) || !/return \{ noche, inicial, comunas, rango \};/.test(por)) F("2 · la portada de /deptos no responde con el rango de la comuna");

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
  // Y la prosa no compara con las otras comunas sin el dato (v6, 20-oct-2026): la v5 dijo «la muestra más grande de las
  // 25» en Providencia (7.ª) y Vitacura (9.ª), «la plusvalía más baja» en Recoleta (22.ª de 23) y «poco común» que
  // todas sus tipologías se pagaran solas en comunas donde eso pasa en 11 de 25.
  type Comp = { total: number; puestoMuestra: number; puestoRentabilidad: number; todasSePaganSolas: { n: number; estaEsUna: boolean }; plusvalia: { puesto: number; de: number } | null };
  const vc = (cp as unknown as { validarComparaciones?: (t: string, c: Comp) => string[] } | null)?.validarComparaciones;
  if (!vc) F("4 · no existe el guard de las comparaciones entre comunas (validarComparaciones)");
  else {
    const c = (o: Partial<Comp>): Comp => ({ total: 25, puestoMuestra: 7, puestoRentabilidad: 19, todasSePaganSolas: { n: 11, estaEsUna: true }, plusvalia: { puesto: 20, de: 23 }, ...o });
    const muestra = "Providencia tiene la muestra más grande entre las 25 comunas publicadas.";
    const ordinal = "Es la séptima muestra más grande de las 25 comunas.";
    const plus = "La plusvalía de 27% en diez años es la más baja que verás entre las 25 comunas publicadas.";
    const raro = "Las tres tipologías se pagan solas, algo poco común entre las 25 comunas.";
    const unaDe = "Tiene una de las muestras más grandes de las 25 comunas.";
    // Dentro de la comuna no es comparar comunas (Cerrillos v6: «el 1D, que concentra la muestra más robusta»).
    const intra = "El 1D, que concentra la muestra más robusta, no se paga solo.";
    // Los puestos dichos con otras palabras, contra la métrica más cercana (Lo Barnechea y La Cisterna, v6).
    const desdeAbajo = "La rentabilidad queda en el puesto 18, y la plusvalía de diez años, 26% acumulado, es la cuarta más baja de las 23 comunas con serie.";
    const mitad = "Tiene una muestra robusta (puesto 10 de 25 comunas) y una rentabilidad bruta que se ubica en la mitad exacta del ranking.";
    const caza = [vc(muestra, c({})), vc(ordinal, c({ puestoMuestra: 3 })), vc(plus, c({ plusvalia: { puesto: 22, de: 23 } })), vc(raro, c({})), vc(unaDe, c({ puestoMuestra: 12 })), vc(desdeAbajo, c({ puestoRentabilidad: 4, plusvalia: { puesto: 23, de: 23 } })), vc(mitad, c({ puestoMuestra: 13, puestoRentabilidad: 11 }))];
    const deja = [vc(muestra, c({ puestoMuestra: 1 })), vc(ordinal, c({})), vc(plus, c({ plusvalia: { puesto: 23, de: 23 } })), vc(raro, c({ todasSePaganSolas: { n: 4, estaEsUna: true } })), vc(unaDe, c({})), vc(intra, c({ puestoMuestra: 18 })), vc(desdeAbajo, c({ puestoRentabilidad: 4, plusvalia: { puesto: 20, de: 23 } })), vc(mitad, c({ puestoMuestra: 10, puestoRentabilidad: 13 }))];
    if (caza.some((e) => !e.length)) F("4 · el guard deja pasar una comparación que no cuadra con el puesto (muestra, ordinal, plusvalía o «poco común»)");
    if (deja.some((e) => e.length)) F("4 · el guard rechaza una comparación cierta");
  }
  const cs2 = cargar<{ comparacionDe?: (s: unknown, parque: unknown[]) => Comp }>("src/lib/data/comunas-seo");
  if (!cs2?.comparacionDe) F("4 · no existe el cálculo de los puestos entre comunas (comparacionDe)");
  else {
    const fila = (rentabilidadBruta: number, veredictoFila: string) => ({ rentabilidadBruta, veredictoFila, referencia: { fuente: "porTipologia" } });
    const com = (slug: string, nombre: string, enCalculo: number, filas: unknown[]) => ({ slug, nombre, rentabilidadBruta: 0, procedencia: { enCalculo }, tipologias: filas });
    // `a` va en un EXTREMO de cada orden: en el medio, ordenar al revés no le cambia el puesto y el chequeo no mediría
    // el sentido (una mutación que invertía la muestra quedó verde así).
    const a = com("a", "Cerrillos", 900, [fila(6.0, "sePagaSola")]);
    const b = com("b", "Conchalí", 300, [fila(5.0, "sePagaSola"), fila(4.0, "noSePagaSola")]);
    const z = com("z", "Comuna sin serie", 100, [fila(5.5, "sePagaSola")]);
    const k = cs2.comparacionDe(a, [a, b, z]);
    // Conchalí (142%) sobre Cerrillos (45%) en plusvalía; la sin serie no entra en esa cuenta.
    if (k.total !== 3 || k.puestoMuestra !== 1 || k.puestoRentabilidad !== 1 || k.todasSePaganSolas.n !== 2 || !k.todasSePaganSolas.estaEsUna || k.plusvalia?.puesto !== 2 || k.plusvalia?.de !== 2 || cs2.comparacionDe(z, [a, b, z]).plusvalia !== null) F("4 · los puestos entre comunas no salen de la muestra, la cifra del título y la plusvalía del parque");
  }
  // ⚠ ACTA (20-oct-2026) · el prompt y sus controles se mudaron del script al núcleo compartido con el cron de los lunes
  // (src/lib/data/comuna-prosa-generador.ts); el script quedó como CLI delgada. La regla es la misma: el modelo recibe los
  // puestos reales del parque del roster, y la comparación que no cuadra se rechaza en cada intento.
  const gen = sinComentarios(leer("src/lib/data/comuna-prosa-generador.ts"));
  const parqueRoster = /const parque = todas\.filter\(\(s\) => esComunaDelRoster\(s\.slug\)\);/.test(sinComentarios(leer("scripts/data/generar-prosa-comunas.ts")))
    && /parque = parque\.filter\(\(s\) => esComunaDelRoster\(s\.slug\)\);/.test(sinComentarios(leer("src/app/api/cron/prosa-comunas/route.ts")));
  if (!parqueRoster || !/await dosIntentos\(o, c\.stats, comparacionDe\(c\.stats, o\.parque\), r\)/.test(gen) || !/\$\{bloqueComparacion\(comparacion\)\}/.test(gen) || !/errores\.push\(\.\.\.validarComparaciones\(texto, comparacion\)\);/.test(gen) || !/errores = validarProsa\(texto, stats, comparacion\);/.test(gen)) F("4 · el generador no le pasa al modelo los puestos reales o no rechaza la comparación que no cuadra");
  if (/Así se hace bien: "la\s+muestra más grande de las 25 comunas"/.test(gen)) F("4 · el prompt vuelve a modelar «la muestra más grande de las 25» sin el puesto");
  if (!/const prosaComuna = prosaGuardada && !prosaContradiceLaTabla\(detectarDrift\(prosaGuardada, stats, lider\?\.dorms \?\? null\)\) \? prosaGuardada : null;/.test(det) || /prosaGuardada\.prosa/.test(det) || !/\{prosaComuna\.prosa\}/.test(det)) F("4 · comuna: la página publica la prosa sin mirar si contradice la tabla");
  // Los veredictos con su nombre de hoy en los tres cierres (decían «comprar, negociar o seguir buscando»).
  for (const [tipo, ruta] of Object.entries(PAGINAS)) if (/negociar o seguir buscando/.test(sinComentarios(leer(ruta)))) F(`4 · ${tipo}: el cierre nombra veredictos viejos («negociar»)`);

  if (fallas.length) {
    console.log(`  ✗ COMUNAS-DISENO · ${fallas.length} falla(s):`);
    for (const f of fallas.slice(0, 40)) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — el índice, cada comuna y cobertura en el diseño plano; enlazan las 25 y nada a un 404; el análisis cae en el wizard con la comuna y «Ver los deptos» en /deptos con la comuna y su rango; el SEO igual; la venta con la regla de la noche, la cifra del título en el índice y ninguna prosa que contradiga su tabla");
  }
  return { hard: fallas.length };
}

/*
 * ⚠ ACTA (20-oct-2026) · verificado EN ROJO de dos maneras. (1) Contra producción: el tier corrido sobre una copia de
 * master —el código publicado antes de este cambio— falla en las cuatro partes. (2) Con mutaciones, una regla por vez y
 * restaurando por sha1 (runner del scratchpad de la sesión).
 */

if (require.main === module) {
  runComunasDisenoTier().then(({ hard }) => process.exit(hard ? 1 : 0));
}
