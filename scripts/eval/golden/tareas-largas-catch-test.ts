// ─────────────────────────────────────────────────────────────────────────────
// Tier TAREAS-LARGAS (09-oct-2026, 0 tokens) — el informe no congela el hilo principal del teléfono.
//
// El incidente: en iPhone (Safari y Chrome, iOS 26.6.2) el informe quedaba en blanco desde «La recomendación
// de Franco» más de un minuto y el ticket tardaba mucho más que sus 8 s. No era un corte: el hilo principal
// ocupado. La alternativa de comunas —23 corridas de `runAnalysis`— se calculaba en el CLIENTE, en un useMemo de
// HeroLTR (al hidratar) y otro de CapitulosInversion (al bajar). Medido en Chromium con perfil de iPhone y la CPU
// frenada 6×: 26,9 s de tareas largas al cargar y 24,3 s al bajar (el demo: 122,8 s y 102,6 s); en WebKit sin
// freno, 14,1 s bloqueado al cargar. Con el arreglo: 1,1–1,7 s y ≤ 0,11 s; WebKit, 0,2–0,3 s.
//
// Fija: (1) la alternativa se calcula UNA vez en el servidor (`informe-ltr.tsx`) con la UF y la fecha congeladas
// y baja por props; ningún componente cliente del informe la calcula; (2) el scroll del ticket trabaja una vez
// por cuadro y no mide el DOM en cada evento —las marcas se miden al montar y cuando cambia el alto de la
// página—; (3) el ancla del área visible, igual; (4) el ticket sigue subiendo a los 8 s.
// La medida en vivo es la sonda `tareas-largas-informe-sonda.ts` (navegador, con tope): ROJO contra producción con
// el código viejo (demo: 122.831 ms al cargar, 102.587 ms al bajar; el informe del reporte: 37.206 / 56.187) y
// VERDE con el arreglo (local 1.513 / 0 y 1.081 / 95; producción, ccc263ea: 3.330 / 0 y 3.424 / 127).
//
// ACTA (09-oct-2026). Contra los archivos de origin/master (V0): ROJO. 21/21 mutaciones en ROJO, cada archivo
// restaurado byte a byte: A1/A2 la recomendación o «Cómo lo pagas» calculan en el cliente · A3–A6 la alternativa
// no baja (informe, results-client, grid → recomendación, grid → capítulos) · A7 otra fecha en el servidor · A8 se
// calcula también con COMPRAR · A9 otro componente cliente la calcula · T1 el scroll del ticket no espera al cuadro
// · T2 vuelve a medir en el cuadro (por `medirMarcas()`, que no nombra getBoundingClientRect: el predicado lo
// prohíbe aparte) · T3 mide con getBoundingClientRect · T4 las marcas no se re-miden al cambiar la página · T5 no
// suelta el cuadro · N1 el ancla lee el alto al colocar · N2 coloca en cada aviso · N3 no espera al cuadro · N4 el
// alto no se lee cuando cambia · N5 no se coloca al montar · E1 el ticket a los 12 s.
// Solo:  node --import tsx scripts/eval/golden/tareas-largas-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ESPERA_FINAL_MS } from "../../../src/lib/lo-que-sigue/disparo-ticket";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
/** El cuerpo de una función flecha `const nombre = (...) => { ... };` (hasta su llave de cierre, contando llaves). */
function cuerpo(src: string, firma: string): string {
  const i = src.indexOf(firma);
  if (i < 0) return "";
  const a = src.indexOf("{", i + firma.length - 1);
  let n = 0;
  for (let j = a; j < src.length; j++) {
    if (src[j] === "{") n++;
    else if (src[j] === "}" && --n === 0) return src.slice(a, j + 1);
  }
  return "";
}
/** La etiqueta de apertura de un elemento JSX (de `<Tag` a su `>` o `/>`), contando llaves: las props con
 *  `=>`, genéricos o JSX adentro no la cortan. */
function etiqueta(src: string, tag: string): string {
  const i = src.indexOf(tag);
  if (i < 0) return "";
  let n = 0;
  for (let j = i + tag.length; j < src.length; j++) {
    const c = src[j];
    if (c === "{") n++;
    else if (c === "}") n--;
    else if (n === 0 && c === ">") return src.slice(i, j + 1);
  }
  return "";
}
function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(join(RAIZ, dir))) {
    const p = `${dir}/${f}`;
    if (statSync(join(RAIZ, p)).isDirectory()) out.push(...archivos(p));
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

export function runTareasLargasTier(): { hard: number } {
  console.log("\n─── TIER TAREAS-LARGAS (el informe no congela el hilo principal del teléfono · 0 tokens) ───");
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);

  // ── 1 · la alternativa de comunas: una vez, en el servidor ──────────────────
  const informe = sinComentarios(leer("src/app/analisis/[id]/informe-ltr.tsx"));
  if (/^"use client"/.test(informe.trim())) F("1 · informe-ltr.tsx dejó de ser componente de servidor");
  const llamadas = informe.match(/construirAlternativaComunas\(/g) ?? [];
  if (llamadas.length !== 1 || !/construirAlternativaComunas\(\{ input: inputDataRaw, ufClp: ufFrozen, asOf: asOfFrozen \}\)/.test(informe))
    F("1 · el informe no calcula la alternativa de comunas una vez en el servidor, con la UF y la fecha congeladas (las del cliente)");
  if (!/const alternativaComunas = veredictoInforme !== "COMPRAR" && inputDataRaw\s*\?/.test(informe))
    F("1 · la alternativa se calcula también cuando el veredicto es COMPRAR (23 corridas del motor para nada)");
  const pasa = /alternativaComunas=\{alternativaComunas\}/;
  if (!pasa.test(etiqueta(informe, "<PremiumResults"))) F("1 · la alternativa no baja del servidor al informe");
  const rc = sinComentarios(leer("src/app/analisis/[id]/results-client.tsx"));
  if (!pasa.test(etiqueta(rc, "<SubjectCardGrid"))) F("1 · results-client no le pasa la alternativa al informe");
  const grid = sinComentarios(leer("src/components/analysis/SubjectCardGrid.tsx"));
  if (!pasa.test(etiqueta(grid, "<HeroLTR"))) F("1 · la recomendación no recibe la alternativa calculada en el servidor");
  if (!pasa.test(etiqueta(grid, "<CapitulosInversion"))) F("1 · «Cómo lo pagas» no recibe la alternativa calculada en el servidor");
  const hero = sinComentarios(leer("src/components/analysis/HeroLTR.tsx"));
  if (!/const alternativa = sinSalidaRecomendacion && inputData \? alternativaComunas : null;/.test(hero)) F("1 · la recomendación no usa la alternativa que llega del servidor");
  const caps = sinComentarios(leer("src/components/analysis/CapitulosInversion.tsx"));
  if (!/const lineaAlternativa = veredicto !== "COMPRAR" \? lineaAlternativaComunas\(alternativaComunas\) : null;/.test(caps)) F("1 · «Cómo lo pagas» no usa la alternativa que llega del servidor");
  // Ningún componente cliente del informe corre la alternativa (23 corridas del motor en el hilo principal).
  const clientes = [...archivos("src/components"), ...archivos("src/app/analisis")].filter((p) => /^\s*["']use client["']/.test(leer(p)));
  const calculan = clientes.filter((p) => /construirAlternativaComunas\(/.test(sinComentarios(leer(p))));
  if (clientes.length < 20) F(`1 · el censo de componentes cliente no corrió (${clientes.length} archivos)`);
  if (calculan.length) F(`1 · un componente cliente calcula la alternativa de comunas en el navegador: ${calculan.join(", ")}`);

  // ── 2 · el scroll del ticket: una vez por cuadro, sin medir el DOM ──────────
  const tk = sinComentarios(leer("src/components/lo-que-sigue/TicketPack.tsx"));
  const alDesplazar = cuerpo(tk, "const alDesplazar = () => {");
  const enCuadroTk = cuerpo(tk, "const revisarEnCuadro = () => {");
  if (!/window\.addEventListener\("scroll", alDesplazar, \{ passive: true \}\)/.test(tk)) F("2 · el ticket no escucha el scroll (un salto más allá de la marca no contaría)");
  if (!/^\{\s*if \(!cuadro\) cuadro = window\.requestAnimationFrame\(revisarEnCuadro\);\s*\}$/.test(alDesplazar)) F("2 · el scroll del ticket no espera al cuadro: trabaja en cada evento");
  if (!enCuadroTk || /getBoundingClientRect|offsetHeight|offsetTop|getComputedStyle|medirMarcas\(/.test(enCuadroTk + alDesplazar)) F("2 · el scroll del ticket mide el DOM en cada evento (fuerza un layout del informe por evento)");
  if (!/revisarMarcas\(\{ finTop: finEnPagina - y, recoTop: recoEnPagina === null \? null : recoEnPagina - y, alto: window\.innerHeight \}, vigia, d\)/.test(enCuadroTk)) F("2 · el scroll del ticket no mira las dos marcas con lo medido de la página");
  if (!/const roPagina = typeof ResizeObserver !== "undefined" \? new ResizeObserver\(medirMarcas\) : null;\s*roPagina\?\.observe\(document\.body\);/.test(tk) || !/medirMarcas\(\);/.test(tk))
    F("2 · las marcas no se miden al montar ni cuando cambia el alto de la página (quedan viejas al abrir un capítulo)");
  if (!/if \(cuadro\) window\.cancelAnimationFrame\(cuadro\);\s*roPagina\?\.disconnect\(\);/.test(tk)) F("2 · el cuadro pedido o el observer de la página no se sueltan al desmontar");

  // ── 3 · el ancla del área visible: una vez por cuadro, el alto leído cuando cambia ─
  const ancla = sinComentarios(leer("src/lib/lo-que-sigue/area-visible.ts"));
  const hooks = ancla.split(/export function /).slice(1);
  if (hooks.length !== 2) F(`3 · el ancla no tiene sus dos hooks (${hooks.length})`);
  for (const h of hooks) {
    const nombre = h.slice(0, h.indexOf("("));
    const colocar = cuerpo(h, "const colocar = () => {");
    if (!colocar || /offsetHeight|getBoundingClientRect|getComputedStyle/.test(colocar)) F(`3 · ${nombre} mide el DOM cada vez que coloca`);
    if (!/const enCuadro = \(\) => \{\s*if \(!cuadro\) cuadro = window\.requestAnimationFrame\(colocar\);\s*\};/.test(h)) F(`3 · ${nombre} no coloca una vez por cuadro`);
    if (!/vv\.addEventListener\("scroll", enCuadro\);/.test(h) || !/vv\.addEventListener\("resize", enCuadro\);/.test(h) || /addEventListener\("(scroll|resize)", colocar\)/.test(h)) F(`3 · ${nombre} coloca en cada aviso del área visible`);
    if (!/colocar\(\);/.test(h)) F(`3 · ${nombre} no se coloca al montar, antes de pintar (iOS: el borde salta a mitad de la transición)`);
  }
  if (!/new ResizeObserver\(\(\) => \{ alto = el\.offsetHeight; enCuadro\(\); \}\)/.test(ancla)) F("3 · el alto de la pestaña no se lee cuando cambia (sin él, se lee en cada aviso)");

  // ── 4 · el ticket sigue a los 8 s ───────────────────────────────────────────
  if (ESPERA_FINAL_MS !== 8_000) F(`4 · el ticket ya no sube a los 8 s de llegar al final (${ESPERA_FINAL_MS} ms)`);

  if (fallas.length) {
    console.log(`  ✗ TAREAS-LARGAS · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — la alternativa de comunas se calcula una vez en el servidor y ningún componente cliente la corre; el scroll del ticket y el ancla trabajan una vez por cuadro sin medir el DOM; el ticket sube a los 8 s");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  process.exit(runTareasLargasTier().hard ? 1 : 0);
}
