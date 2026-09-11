// ============================================================================
// GOLDEN · STR AL REDISEÑO — catch-test (11-sep-2026). 0 tokens.
// ============================================================================
// Contrato: docs/wireframes/rediseno-informe/contrato-diseno-informe.md §11 (qué es
// distinto en STR), §2, §6, §8 y §10. Mockup: informe-str-mockup.html.
//
// LTR tuvo su pasada en 4a+4b+4c. STR hereda todo lo compartido al recibir `rediseno`
// y este tier fija lo que es PROPIO de §11, bloque por bloque. BLOQUE A (esqueleto,
// cifras y zona):
//
//   1. EL INTERRUPTOR DE STR ES PROPIO Y ESTÁ APAGADO. `REDISENO_INFORME_STR = false`,
//      y la página lo combina con lo heredado del contexto (`?rediseno=1` en la ruta
//      dev), igual que LTR. Encender es un goal aparte con su commit y su revert.
//
//   2. EL ESQUELETO DE §2: la portada es caja; los hallazgos salen del hero a su sección
//      propia con la línea que declara (podada) o el título viejo (prosa vieja), en los
//      DOS caminos, sin esconderse detrás del gate de la prosa; el hero no repite el
//      título que la sección ya lleva. Ya pasó tres veces en LTR: el gate de la prosa
//      dejaba la página sin hallazgos.
//
//   3. LOS TÍTULOS DE §10 detrás del interruptor: «Las cifras que tienes que ver»,
//      «Detalle de la inversión», «Ubicación · comuna».
//
//   4. LAS CIFRAS DE §6: tarifa y ocupación PRIMERO, destacadas con un contorno de 1,5 px
//      en --line2, la línea «Las dos primeras son el supuesto del que cuelga todo lo
//      demás» encima, y después ingreso, flujo, cap rate por día (referencia 5,0%) y TIR.
//      La primitiva compartida gana dos props OPCIONALES y LTR no las pasa.
//
//   5. LA ZONA DE §8: tres tarjetas —ocupación primero, tarifa, comparables— con las
//      píldoras del par direccional, el pie común con la fecha de las estimaciones y SIN
//      la tipo-line del reglamento (retirada). El camino viejo conserva la suya.
//
//   6. LA RUTA DEV monta el provider para STR con `?rediseno=1`, o no hay cómo verlo.
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

const FLAG = leer("src/lib/rediseno-flag.ts");
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

// ── 1 · el interruptor de STR: propio, apagado, y combinado con el contexto ──
{
  if (!/export const REDISENO_INFORME_STR = false;/.test(FLAG)) {
    F("1 · falta `REDISENO_INFORME_STR = false` en rediseno-flag.ts. STR necesita SU interruptor: el de LTR está en true y compartirlo encendería STR con la pasada a medias (contrato §11).");
  }
  if (!/const rediseno = REDISENO_INFORME_STR \|\| redisenoHeredado;/.test(STR)) {
    F("1 · la página STR no deriva `rediseno` de su constante O del contexto heredado. Sin el `||`, la ruta dev con `?rediseno=1` no enciende nada y no hay cómo shotear.");
  }
  if (!/<RedisenoProvider valor=\{rediseno\}>/.test(STR)) F("1 · STR no monta `<RedisenoProvider valor={rediseno}>`: las piezas que leen el contexto (cifras, zona, PosicionFranco) no se enteran");
  const frame = STR.match(/<DocumentoFrame[^>]*>/)?.[0] ?? "";
  if (!/\brediseno=\{rediseno\}/.test(frame)) F(`1 · el DocumentoFrame de STR no pasa \`rediseno={rediseno}\`: sin la clase doc-r2 el CSS del rediseño no aplica. Encontrado: «${frame.slice(0, 80)}»`);
}

// ── 2 · el esqueleto de §2: caja en la portada, hallazgos a su sección en los dos caminos ──
{
  if (!/<SeccionInforme id="portada" tono="paper" caja=\{rediseno\}>/.test(STR)) {
    F("2 · la portada STR no pide `caja={rediseno}`: es el hero del contrato §3 y una de las dos cajas de §2");
  }
  // Bloque A: UNA sola caja en STR (la portada). La recomendación llega con el bloque B.
  const cajas = [...STR.matchAll(/<SeccionInforme\b[^>]*\bcaja\b/g)].length;
  if (cajas !== 1) F(`2 · hay ${cajas} secciones con «caja» en la página STR y el bloque A pide exactamente 1 (la portada). La segunda —la recomendación— entra con el bloque B, cuando salga del hero.`);
  // El hero recibe `razones` SOLO en el camino viejo: con el rediseño los hallazgos van a su sección.
  if (!/razones=\{\s*(?:\/\*[\s\S]*?\*\/\s*)?!rediseno && strPodada && hallazgosOrdenadosSTR\.length > 0 \? \(/.test(STR)) {
    F("2 · el hero STR sigue recibiendo `razones` con el rediseño encendido: los hallazgos se dibujarían DENTRO del hero y otra vez en su sección, o solo adentro. §2 y §4: sección propia, suelta, después del hero.");
  }
  // La sección existe en los DOS caminos con el rediseño, y en el viejo solo con prosa vieja.
  if (!/\{\(rediseno \|\| !strPodada\) && hallazgosOrdenadosSTR\.length > 0 && \(/.test(STR)) {
    F("2 · la sección «principales-hallazgos» de STR no se monta con `(rediseno || !strPodada)`. Es el gate de la prosa que ya dejó sin hallazgos a LTR tres veces: con el rediseño la sección va SIEMPRE, podada o vieja.");
  }
  if (!/titulo=\{rediseno && strPodada \? lineaQueDeclara\(veredicto\) : "Qué determina el veredicto"\}/.test(STR)) {
    F("2 · el título de la sección de hallazgos STR no es la línea que declara con prosa podada y el título viejo con prosa vieja (§10)");
  }
  // Y el hero no repite la línea que declara cuando la sección ya la lleva.
  if (!/const rediseno = useRediseno\(\);/.test(HSTR)) F("2 · HeroStrDictamen no lee el interruptor");
  if (!/\{!\(rediseno && podada\) && \(\s*<h2/.test(HSTR)) {
    F("2 · HeroStrDictamen sigue pintando su h2 con el rediseño y prosa podada: ese h2 ES la línea que declara, que ahora titula la sección de hallazgos. Se leería dos veces seguidas.");
  }
}

// ── 3 · los títulos de §10, detrás del interruptor ──────────────────────────
{
  if (!/titulo=\{rediseno \? "Las cifras que tienes que ver" : "Las seis cifras"\}/.test(STR)) F("3 · «Las cifras que tienes que ver» no está detrás del interruptor en STR");
  if (!/titulo=\{rediseno \? "Detalle de la inversión" : "Cómo funciona como renta corta"\}/.test(STR)) F("3 · «Detalle de la inversión» no está detrás del interruptor en STR");
  if (!/titulo=\{`\$\{rediseno \? "Ubicación" : "La zona"\} · \$\{comuna\}`\}/.test(STR)) F("3 · «Ubicación · comuna» no está detrás del interruptor en STR");
}

// ── 4 · las cifras de §6: tarifa y ocupación primero, destacadas, con el supuesto encima ──
{
  if (!/const rediseno = useRediseno\(\);/.test(CIF)) F("4 · SeisCifrasStr no lee el interruptor: el orden y el copy de §6 no pueden depender de él");
  const i = CIF.indexOf("rediseno\n    ? [");
  const rama = i === -1 ? "" : CIF.slice(i, CIF.indexOf("\n    : [", i));
  if (!rama) F("4 · no se encontró la rama del rediseño en las cifras STR (`rediseno ? [ … ] : [ … ]`)");
  else {
    const falla = enOrden(rama, ['k: "Tarifa por noche"', 'k: "Ocupación"', 'k: "Ingreso mensual"', 'k: "Flujo mensual"', "por día", 'k: "TIR a 10 años"']);
    if (falla) F(`4 · el orden de §6 se rompió en las cifras STR: no encontré «${falla}» después de lo anterior (tarifa · ocupación · ingreso · flujo · cap rate por día · TIR)`);
    const destacadas = [...rama.matchAll(/destacada: true/g)].length;
    if (destacadas !== 2) F(`4 · ${destacadas} cifras destacadas en la rama del rediseño; §6 destaca exactamente las DOS primeras (tarifa y ocupación)`);
    if (!/CAP_STR_UMBRAL_PCT/.test(rama)) F("4 · el cap rate por día perdió su referencia del motor (CAP_STR_UMBRAL_PCT = 5,0%)");
  }
  if (!/Las dos primeras son el supuesto del que cuelga todo lo demás\./.test(CIF)) F("4 · falta la línea «Las dos primeras son el supuesto del que cuelga todo lo demás.»: en renta corta el ingreso es una estimación y eso se declara (§6)");
  if (!/encabezado=\{rediseno \? /.test(CIF)) F("4 · la línea del supuesto no está detrás del interruptor (`encabezado={rediseno ? …}`)");
  // la primitiva compartida: dos props opcionales, y LTR no las pasa
  if (!/destacada\?: boolean;/.test(PRIM)) F("4 · `CifraInforme` no tiene `destacada?: boolean`");
  if (!/encabezado\?: ReactNode/.test(PRIM)) F("4 · `SeisCifras` no acepta `encabezado?: ReactNode`");
  if (!/className=\{`num-cell\$\{c\.destacada \? " destacada" : ""\}`\}/.test(PRIM)) F("4 · la tarjeta no lleva la clase `destacada` cuando la cifra lo pide");
  if (!/className="nums-sup"/.test(PRIM)) F("4 · la primitiva no dibuja el encabezado como `.nums-sup`");
  if (/destacada|encabezado/.test(NUMS_LTR)) F("4 · LosNumeros (LTR) pasó a usar `destacada` o `encabezado`: son de §6 para STR; LTR no destaca ninguna cifra");
  // el contorno: 1,5 px en --line2, detrás de doc-r2
  const dest = reglaDe(".doc-r2 .num-cell.destacada", CSS);
  if (!dest) F("4 · falta la regla «.doc-r2 .num-cell.destacada»");
  else if (!/1\.5px/.test(dest) || !/var\(--line2\)/.test(dest)) F(`4 · el contorno de la cifra destacada no es de 1,5 px en --line2: «${dest.trim()}»`);
  const sup = reglaDe(".doc-r2 .nums-sup", CSS);
  if (!sup) F("4 · falta la regla «.doc-r2 .nums-sup» de la línea del supuesto");
  else if (!/font-size:\s*12\.5px/.test(sup)) F(`4 · la línea del supuesto no va a 12,5 px: «${sup.trim()}»`);
}

// ── 5 · la zona de §8: ocupación · tarifa · comparables, pie con fecha, sin tipo-line ──
{
  if (!/const rediseno = useRediseno\(\);/.test(ZONA)) F("5 · ZonaStrSection no lee el interruptor");
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
  // la rama del rediseño de la sección: el pie común con fecha y el enlace del contrato
  const j = ZONA.indexOf("rediseno ? (");
  const ramaSec = j === -1 ? "" : ZONA.slice(j, ZONA.indexOf("\n  ) : (", j));
  if (!ramaSec) F("5 · no se encontró la rama `rediseno ? (` en ZonaStrSection");
  else {
    if (!/className="zona-caveat"/.test(ramaSec)) F("5 · la rama del rediseño no dibuja el pie común (`zona-caveat`) con la fecha de las estimaciones");
    if (!/Ver los comparables →/.test(ramaSec)) F("5 · el enlace de §8 es «Ver los comparables →», no «Explorar»");
    if (/tipo-line/.test(ramaSec)) F("5 · la rama del rediseño conserva la tipo-line");
  }
  // y el camino viejo sigue con la suya, porque no se rediseñó
  if (!/className="tipo-line"/.test(ZONA)) F("5 · la tipo-line desapareció del camino viejo: ese informe no cambia hasta que se encienda");
}

// ── 6 · la ruta dev enciende STR con ?rediseno=1 ────────────────────────────
{
  const i = DEV.indexOf('comp === "pagina"');
  const tramo = i === -1 ? "" : DEV.slice(i, i + 900);
  if (!/<RedisenoProvider valor=\{sp\.get\("rediseno"\) === "1"\}>/.test(tramo)) {
    F("6 · la ruta dev no envuelve la página STR en `RedisenoProvider` con `?rediseno=1`: sin eso no hay cómo shotear el rediseño STR antes de encenderlo");
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runEstructuraStrRedisenoTier(): { hard: number } {
  console.log("\n─── TIER ESTRUCTURA-STR-REDISEÑO (contrato §11 · bloque A · 0 tokens) ───");
  if (fallas.length === 0) {
    console.log("  ✓ VERDE — el interruptor STR propio y apagado, la portada en caja, los hallazgos en su sección en los dos caminos, los títulos de §10, tarifa y ocupación primero y destacadas con el supuesto encima, y la zona con ocupación · tarifa · comparables, pie con fecha y sin tipo-line");
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runEstructuraStrRedisenoTier();
  process.exit(hard ? 1 : 0);
}
