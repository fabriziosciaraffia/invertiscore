// ============================================================================
// GOLDEN · STR AL REDISEÑO — catch-test (11-sep-2026). 0 tokens.
// ============================================================================
// Contrato: docs/wireframes/rediseno-informe/contrato-diseno-informe.md §11 (qué es
// distinto en STR), §2, §6, §8 y §10. Mockup: informe-str-mockup.html.
//
// LTR tuvo su pasada en 4a+4b+4c. STR hereda todo lo compartido y este tier fija lo que
// es PROPIO de §11, bloque por bloque. BLOQUE A (esqueleto, cifras y zona):
//
//   1. EL INTERRUPTOR DE STR — RETIRADO CON ACTA. Fijaba la constante propia y su
//      derivación en la página; el encendido (12-sep-2026) retiró la aserción del valor
//      y el retiro del andamio, el mismo día, retiró el interruptor entero: el rediseño
//      es el único camino en las dos modalidades.
//
//   2. EL ESQUELETO DE §2: la portada es caja; los hallazgos salen del hero a su sección
//      propia con la línea que declara (podada) o el título viejo (prosa vieja), sin
//      esconderse detrás del gate de la prosa; el hero no repite el título que la
//      sección ya lleva. Ya pasó tres veces en LTR: el gate de la prosa dejaba la página
//      sin hallazgos.
//
//   3. LOS TÍTULOS DE §10, sin condición: «Las cifras que tienes que ver», «Detalle de
//      la inversión», «Ubicación · comuna»; los del camino viejo, ausentes.
//
//   4. LAS CIFRAS DE §6: tarifa y ocupación PRIMERO, destacadas con un contorno de 1,5 px
//      en --line2, la línea «Las dos primeras son el supuesto del que cuelga todo lo
//      demás» encima, y después ingreso, flujo, cap rate por día (referencia 5,0%) y TIR.
//      La primitiva compartida gana dos props OPCIONALES y LTR no las pasa.
//
//   5. LA ZONA DE §8: tres tarjetas —ocupación primero, tarifa, comparables— con las
//      píldoras del par direccional, el pie común con la fecha de las estimaciones y SIN
//      la tipo-line del reglamento (retirada); ninguna queda en la sección.
//
//   6. LA RUTA DEV con `?rediseno=1` — RETIRADO CON ACTA (12-sep-2026): sin interruptor no
//      hay nada que encender; la ruta dev monta la página STR tal cual.
//
//   8. EL LIENZO DE §2: la ruta STR pinta «--page» en el wrapper (`doc-lienzo`). Sin él
//      —medido en el DOM el 11-sep-2026— wrapper y body quedaban en el gris de la app
//      (#F6F6F7) y las tarjetas (#F4F4F6) no se distinguían de nada. Mismo bug que
//      0b825fca en LTR. La ruta dev también lo lleva, o los shots mienten.
//
// BLOQUE B (hero y recomendación en su sitio):
//
//   7. EL ORDEN DE §2 LO EMITE `HeroStrDictamen`, como `HeroLTR`: hero → `{hallazgos}` →
//      recomendación con caja, con su marca de telemetría. La página deja de envolver al
//      hero en su sección (con el envoltorio el orden es inalcanzable) y le pasa la
//      sección de hallazgos ya armada; el camino viejo monta la suya. El hero no se monta
//      vacío. `PosicionFranco` recibe `estado` (§5) y el título del contrato.
//
// Corre dentro del QUICK (tier "estructura-str-rediseno") y standalone:
//   node --import tsx scripts/eval/golden/estructura-str-rediseno-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => { try { return readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n"); } catch { return ""; } };

const STR = leer("src/app/analisis/renta-corta/[id]/results-client.tsx");
const HSTR = leer("src/components/analysis/str/HeroStrDictamen.tsx");
const CIF = leer("src/components/analysis/str/SeisCifrasStr.tsx");
const PRIM = leer("src/components/analysis/shared/SeisCifras.tsx");
const NUMS_LTR = leer("src/components/analysis/LosNumeros.tsx");
const ZONA = leer("src/components/analysis/str/ZonaStrSection.tsx");
const CSS = leer("src/components/analysis/portada/PortadaInforme.tsx");
const DEV = leer("src/app/dev/drawers-pixel/page.tsx");

/** La regla CSS de un selector exacto dentro de un bloque `<style>` inline. */
function reglaDe(sel: string, txt: string): string | null {
  for (const m of txt.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = m[1].split(",").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
    if (sels.includes(sel)) return m[2];
  }
  return null;
}
/** Orden de aparición: cada aguja después de la anterior. Devuelve la primera que falla. */
function enOrden(txt: string, agujas: string[]): string | null {
  let desde = 0;
  for (const a of agujas) {
    const i = txt.indexOf(a, desde);
    if (i === -1) return a;
    desde = i + a.length;
  }
  return null;
}

// ── 1 · el interruptor de STR — RETIRADO CON ACTA (12-sep-2026, retiro del andamio) ──
// Fijaba la constante `REDISENO_INFORME_STR`, la derivación `|| redisenoHeredado`, el provider
// y la prop del frame. Nada de eso existe: el rediseño es el único camino de STR.

// ── 2 · el esqueleto de §2: caja en la portada, hallazgos a su sección en los dos caminos ──
{
  if (!/<SeccionInforme id="portada" tono="paper" caja>/.test(STR)) {
    F("2 · la portada STR no pide `caja`: es el hero del contrato §3 y una de las dos cajas de §2");
  }
  // Las DOS cajas de §2 y nada más: la portada en la página y la recomendación en el hero.
  const cajas = [...(STR + HSTR).matchAll(/<SeccionInforme\b[^>]*\bcaja\b/g)].length;
  if (cajas !== 2) F(`2 · hay ${cajas} secciones con «caja» entre la página STR y HeroStrDictamen, y §2 pide 2: la portada y la recomendación. Si nació una tercera, el contrato dice que va suelta sobre el papel.`);
  // El hero recibe `razones` SOLO en el camino viejo: con el rediseño los hallazgos van a su sección.
  // INVERTIDO (12-sep-2026): el hero ya no recibe `razones`; los hallazgos van a su sección.
  if (/razones=\{/.test(STR) || /\{podada && razones\}/.test(HSTR)) {
    F("2 · el hero STR volvió a recibir `razones`: los hallazgos van a su sección propia, suelta, después del hero (§2 y §4).");
  }
  // Con el rediseño la sección va SIEMPRE —podada o vieja— y viaja al hero por `hallazgos`,
  // que es quien la monta en el medio del orden (bloque B). No cuelga del gate de la prosa.
  const slot = STR.match(/hallazgos=\{[\s\S]*?\n\s{12}\}/)?.[0] ?? "";
  if (!/hallazgos=\{\s*(?:\/\*[\s\S]*?\*\/\s*)?hallazgosOrdenadosSTR\.length > 0 \? \(/.test(STR)) {
    F("2 · la página STR no le pasa a HeroStrDictamen la sección de hallazgos con `hallazgosOrdenadosSTR.length > 0`. Es el gate de la prosa que ya dejó sin hallazgos a LTR tres veces: la sección va SIEMPRE, podada o vieja.");
  }
  if (!/titulo=\{strPodada \? lineaQueDeclara\(veredicto\) : "Qué determina el veredicto"\}/.test(slot)) {
    F("2 · el título de la sección de hallazgos STR (en el slot `hallazgos`) no es la línea que declara con prosa podada y el título viejo con prosa vieja (§10)");
  }
  // INVERTIDO (12-sep-2026): la sección vieja ya no existe en la página; la única la monta
  // el hero. «principales-hallazgos» aparece exactamente una vez.
  if ((STR.match(/id="principales-hallazgos"/g) ?? []).length !== 1) {
    F("2 · la página STR tiene que montar «principales-hallazgos» exactamente UNA vez, dentro del slot `hallazgos` del hero");
  }
  // Y el hero no repite la línea que declara cuando la sección ya la lleva.
  if (/useRediseno/.test(HSTR)) F("2 · HeroStrDictamen volvió a leer un interruptor que ya no existe");
  if (!/\{!podada && \(\s*<h2/.test(HSTR)) {
    F("2 · HeroStrDictamen sigue pintando su h2 con prosa podada: ese h2 ES la línea que declara, que titula la sección de hallazgos. Se leería dos veces seguidas.");
  }
}

// ── 3 · los títulos de §10 — INVERTIDO el 12-sep-2026 (retiro del andamio): sin interruptor,
//        y los del camino viejo ausentes ──
{
  if (!/titulo="Las cifras que tienes que ver"/.test(STR)) F("3 · falta «Las cifras que tienes que ver» en STR");
  if (!/titulo="Detalle de la inversión"/.test(STR)) F("3 · falta «Detalle de la inversión» en STR");
  if (!/titulo=\{`Ubicación · \$\{comuna\}`\}/.test(STR)) F("3 · falta «Ubicación · comuna» en STR");
  for (const viejo of ["Las seis cifras", "Cómo funciona como renta corta", '"La zona"']) {
    if (STR.includes(viejo)) F(`3 · volvió el título del camino viejo «${viejo}» en STR: el andamio se retiró`);
  }
}

// ── 4 · las cifras de §6: tarifa y ocupación primero, destacadas, con el supuesto encima ──
{
  if (/useRediseno/.test(CIF)) F("4 · SeisCifrasStr volvió a leer un interruptor que ya no existe");
  const i = CIF.indexOf("const cifras: CifraInforme[] = [");
  const rama = i === -1 ? "" : CIF.slice(i, CIF.indexOf("\n    ];", i));
  if (!rama) F("4 · no se encontró la lista de cifras STR (`const cifras: CifraInforme[] = [ … ];`)");
  else {
    const falla = enOrden(rama, ['k: "Tarifa por noche"', 'k: "Ocupación"', 'k: "Ingreso mensual"', 'k: "Flujo mensual"', "por día", 'k: "TIR a 10 años"']);
    if (falla) F(`4 · el orden de §6 se rompió en las cifras STR: no encontré «${falla}» después de lo anterior (tarifa · ocupación · ingreso · flujo · cap rate por día · TIR)`);
    const destacadas = [...rama.matchAll(/destacada: true/g)].length;
    if (destacadas !== 2) F(`4 · ${destacadas} cifras destacadas en la rama del rediseño; §6 destaca exactamente las DOS primeras (tarifa y ocupación)`);
    if (!/CAP_STR_UMBRAL_PCT/.test(rama)) F("4 · el cap rate por día perdió su referencia del motor (CAP_STR_UMBRAL_PCT = 5,0%)");
  }
  if (!/Las dos primeras son el supuesto del que cuelga todo lo demás\./.test(CIF)) F("4 · falta la línea «Las dos primeras son el supuesto del que cuelga todo lo demás.»: en renta corta el ingreso es una estimación y eso se declara (§6)");
  if (!/encabezado="Las dos primeras son el supuesto/.test(CIF)) F("4 · la línea del supuesto dejó de pasarse a la primitiva como `encabezado`");
  // la primitiva compartida: dos props opcionales, y LTR no las pasa
  if (!/destacada\?: boolean;/.test(PRIM)) F("4 · `CifraInforme` no tiene `destacada?: boolean`");
  if (!/encabezado\?: ReactNode/.test(PRIM)) F("4 · `SeisCifras` no acepta `encabezado?: ReactNode`");
  if (!/className=\{`num-cell\$\{c\.destacada \? " destacada" : ""\}`\}/.test(PRIM)) F("4 · la tarjeta no lleva la clase `destacada` cuando la cifra lo pide");
  if (!/className="nums-sup"/.test(PRIM)) F("4 · la primitiva no dibuja el encabezado como `.nums-sup`");
  if (/destacada|encabezado/.test(NUMS_LTR)) F("4 · LosNumeros (LTR) pasó a usar `destacada` o `encabezado`: son de §6 para STR; LTR no destaca ninguna cifra");
  // el contorno: 1,5 px en --line2
  const dest = reglaDe(".doc-dictamen .num-cell.destacada", CSS);
  if (!dest) F("4 · falta la regla «.doc-dictamen .num-cell.destacada»");
  else if (!/1\.5px/.test(dest) || !/var\(--line2\)/.test(dest)) F(`4 · el contorno de la cifra destacada no es de 1,5 px en --line2: «${dest.trim()}»`);
  const sup = reglaDe(".doc-dictamen .nums-sup", CSS);
  if (!sup) F("4 · falta la regla «.doc-dictamen .nums-sup» de la línea del supuesto");
  else if (!/font-size:\s*12\.5px/.test(sup)) F(`4 · la línea del supuesto no va a 12,5 px: «${sup.trim()}»`);
}

// ── 5 · la zona de §8: ocupación · tarifa · comparables, pie con fecha, sin tipo-line ──
{
  if (/useRediseno/.test(ZONA)) F("5 · ZonaStrSection volvió a leer un interruptor que ya no existe");
  const i = ZONA.indexOf("export function ZonaCeldasStrR2");
  const fin = i === -1 ? -1 : ZONA.indexOf("\n}\n", i);
  const r2 = i === -1 || fin === -1 ? "" : ZONA.slice(i, fin);
  if (!r2) F("5 · no existe `ZonaCeldasStrR2`, las tres tarjetas de §8 para STR");
  else {
    const falla = enOrden(r2, ['className="zc-k">Tu ocupación<', 'className="zc-k">Tu tarifa por noche<', 'className="zc-k">Contra quién te comparan<']);
    if (falla) F(`5 · el orden de §8 se rompió en las tarjetas STR: no encontré «${falla}» después de lo anterior (ocupación · tarifa · comparables)`);
    if (/tipo-line/.test(r2)) F("5 · las tarjetas del rediseño dibujan la tipo-line: la regulación se retiró y §8 no la lista");
    if (!/zp-/.test(r2) && !/<Pildora/.test(r2)) F("5 · las tarjetas STR no usan las píldoras del par direccional (`zp-…`)");
  }
  // el cuerpo de la sección (12-sep-2026: un solo camino): el pie común con fecha y el enlace
  const j = ZONA.indexOf("const cuerpo = (");
  const ramaSec = j === -1 ? "" : ZONA.slice(j, ZONA.indexOf("\n  );", j));
  if (!ramaSec) F("5 · no se encontró `const cuerpo = (` en ZonaStrSection");
  else {
    if (!/className="zona-caveat"/.test(ramaSec)) F("5 · la rama del rediseño no dibuja el pie común (`zona-caveat`) con la fecha de las estimaciones");
    if (!/Ver los comparables →/.test(ramaSec)) F("5 · el enlace de §8 es «Ver los comparables →», no «Explorar»");
    if (/tipo-line/.test(ramaSec)) F("5 · la rama del rediseño conserva la tipo-line");
  }
  // INVERTIDO (12-sep-2026): el camino viejo se fue con su tipo-line; ninguna queda en la sección.
  if (/className="tipo-line"/.test(ZONA)) F("5 · volvió la tipo-line a ZonaStrSection: la regulación se retiró y el camino viejo también");
}

// ── 7 · bloque B: hero → hallazgos → recomendación, emitidos por HeroStrDictamen ──
{
  // 7a · la recomendación es sección propia, caja, con su marca, y la emite el hero.
  const iRec = HSTR.indexOf('<SeccionInforme id="recomendacion"');
  if (iRec === -1) {
    F("7 · HeroStrDictamen no emite la sección «recomendacion». La recomendación sigue DENTRO del hero y el lector lee la conclusión antes que lo que la sostiene (§2).");
  } else {
    const abre = HSTR.slice(iRec, HSTR.indexOf(">", iRec));
    if (!/\bcaja\b/.test(abre)) F("7 · la sección «recomendacion» de STR no pide `caja`: es la segunda de las dos de §2");
    const iHall = HSTR.indexOf("{hallazgos}");
    if (iHall === -1) F("7 · HeroStrDictamen no monta el slot `{hallazgos}`, que es lo que va en el medio del orden");
    else if (iHall > iRec) F("7 · en HeroStrDictamen el slot `{hallazgos}` quedó DESPUÉS de la recomendación: el orden de §2 es hero → hallazgos → recomendación");
    if (!/<MarcaSeccion seccion="recomendacion" tipo="str"/.test(HSTR)) F("7 · la sección «recomendacion» de STR no emite su marca de telemetría");
  }
  // 7b · el hero no se monta vacío, y el camino viejo sigue siendo UNA sección.
  if (!/const heroTieneCuerpo\s*=/.test(HSTR)) F("7 · HeroStrDictamen no decide si el hero tiene cuerpo propio: con prosa podada y sin apertura quedaría una sección vacía con su margen");
  if (!/\{heroTieneCuerpo && \(/.test(HSTR)) F("7 · la sección «hero» de STR se monta sin condición");
  // 7b' · RETIRADO CON ACTA (12-sep-2026): «apagado devuelve UNA sección» — ya no hay apagado.
  if (/if \(!rediseno\)/.test(HSTR)) F("7 · HeroStrDictamen volvió a tener un camino apagado");
  if (!/<MarcaSeccion seccion="hero" tipo="str"/.test(HSTR)) F("7 · la marca de telemetría del hero no viaja con la sección (se emitía en la página, que ya no la envuelve)");
  // 7c · la página ya no envuelve al hero, y le pasa las dos cosas que necesita.
  if (/<SeccionInforme id="hero"/.test(STR)) F("7 · la página STR volvió a envolver a HeroStrDictamen en la sección «hero»: con ese envoltorio todo lo que el hero emita queda ANIDADO y el orden de §2 es inalcanzable");
  if (!/<HeroStrDictamen[\s\S]{0,700}hallazgos=\{/.test(STR)) F("7 · la página STR no le pasa `hallazgos` a HeroStrDictamen");
  if (!/<HeroStrDictamen[\s\S]{0,700}accessLevel=\{accessLevel\}/.test(STR)) F("7 · la página STR no le pasa `accessLevel` a HeroStrDictamen, que ahora emite las marcas");
  // 7d · la recomendación recibe el estado de §5 y el título del contrato, solo con el rediseño.
  if (!/estado=\{estadoRec\}/.test(HSTR)) F("7 · PosicionFranco no recibe `estado` desde el hero STR (§5: la bajada se dibuja por estado)");
  if (!/estadoRecomendacion\(veredicto,/.test(HSTR)) F("7 · el estado de la recomendación STR no sale de `estadoRecomendacion`, la fuente única de LTR");
  if (!/titulo="La recomendación de Franco"/.test(HSTR)) F("7 · el título de la caja no es «La recomendación de Franco» (§5)");
}

// ── 8 · el lienzo de §2 en la ruta STR y en la ruta dev ───────────────────
{
  if (!/className="min-h-screen bg-\[var\(--franco-bg\)\] doc-lienzo"/.test(STR)) {
    F("8 · el wrapper de la página STR no pinta `doc-lienzo`: el informe queda sobre el gris de la app y las tarjetas no se distinguen del fondo (§2, mismo bug que 0b825fca)");
  }
  if (!/className="doc-lienzo"/.test(DEV)) F("8 · la ruta dev no pinta el lienzo para LTR: el shot sale sobre el gris de la app y no es el de la ruta real");
}

// ── 6 · la ruta dev enciende STR con ?rediseno=1 — RETIRADO CON ACTA (12-sep-2026) ──
// Exigía el `RedisenoProvider` con `?rediseno=1` alrededor de la página STR, porque sin
// eso no había cómo shotear el rediseño antes de encenderlo. El retiro del andamio se
// llevó el provider y la constante: la ruta dev monta la página tal cual la sirve la real,
// y lo que queda de ella lo fija el bloque 8 (el lienzo).

// ── 9 · la apertura de la prosa podada NO se monta en el hero (12-sep-2026) ──
// Igual que LTR: con prosa podada (v17+) el hero STR no pinta `respuestaDirecta` ni
// `reencuadre`. El prompt los sigue generando (v19, quieto) y la base los conserva; lo
// que cambia es que la página no los lee. El hero podado solo se monta con el error o
// el skeleton de generación. El camino viejo (prosa v16 y anteriores, 94 filas anónimas
// que no regeneran) conserva su apertura: su h2 es la pregunta de esa prosa y la
// respuesta la contesta — sin ella quedaría una pregunta sin respuesta.
{
  if (!/const heroTieneCuerpo = !podada \|\| Boolean\(prosaError\) \|\| Boolean\(aiLoading\);/.test(HSTR)) {
    F("9 · `heroTieneCuerpo` en HeroStrDictamen no es exactamente `!podada || Boolean(prosaError) || Boolean(aiLoading)`: con prosa podada la apertura no cuenta como cuerpo, igual que en LTR");
  }
  if (!/\{!podada && respuesta \? \(/.test(HSTR)) {
    F("9 · la apertura del hero STR no está detrás de `!podada && respuesta`: con prosa podada `respuestaDirecta` y `reencuadre` no se montan (igual que LTR)");
  }
  if (/\{respuesta \? \(/.test(HSTR)) F("9 · HeroStrDictamen volvió a montar la apertura con `{respuesta ? (` pelado, sin el gate de la prosa vieja");
  // y el reencuadre no tiene un render propio fuera de esa rama
  const ocurrencias = HSTR.match(/renderPlumon\(reencuadre\)/g)?.length ?? 0;
  if (ocurrencias !== 1) F(`9 · \`renderPlumon(reencuadre)\` aparece ${ocurrencias} veces en HeroStrDictamen; va UNA, dentro de la rama de la prosa vieja`);
  const iApertura = HSTR.indexOf("{!podada && respuesta ? (");
  const iReenc = HSTR.indexOf("renderPlumon(reencuadre)");
  if (iApertura !== -1 && iReenc !== -1 && iReenc < iApertura) F("9 · `renderPlumon(reencuadre)` quedó ANTES de la rama `!podada && respuesta`: se estaría montando con prosa podada");
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runEstructuraStrRedisenoTier(): { hard: number } {
  console.log("\n─── TIER ESTRUCTURA-STR-REDISEÑO (contrato §11 · bloques A y B · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — las dos cajas de §2 en el orden hero → hallazgos → recomendación emitido por el hero STR, los hallazgos en su sección en los dos caminos sin colgar de la prosa, el hero que no se monta vacío, la recomendación con estado y título del contrato, los títulos de §10, tarifa y ocupación primero y destacadas con el supuesto encima, y la zona con ocupación · tarifa · comparables, pie con fecha y sin tipo-line");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runEstructuraStrRedisenoTier();
  process.exit(hard ? 1 : 0);
}
