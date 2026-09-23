// ─────────────────────────────────────────────────────────────────────────────
// TIER SIN-SEMÁFORO (23-sep-2026) · el informe no pinta ocre ni verde fuera de la tríada.
//
// Decisión de Fabrizio: la tríada del veredicto (rojo · ciruela · azul) es legítima; el semáforo
// viejo del dato (--doc-good verde, --doc-warn ocre) no. Censo en el DOM: seis grupos vivos, todos
// del semáforo —las zonas del Dial (que además NOMBRAN un veredicto, así que ya iban a la tríada
// por la regla del 07-sep), la frontera de arriba del Dial, el par que mejora del pop-up, la barra
// firme/proyectado de la planilla, y el año de entrega de la planilla— más catorce reglas de
// componentes muertos. Fija:
//   1 · NINGÚN CONSUMIDOR del semáforo: `var(--doc-good)` / `var(--doc-warn)` no aparecen en
//       ningún archivo de src fuera de comentarios. Los tokens siguen declarados (el tier de la
//       paleta los fija) y sin lector.
//   2 · SUS HEX, SOLO EN SU DECLARACIÓN: #2E8B57 · #57B98A · #B7791F · #DFA34F no aparecen sueltos.
//   3 · LAS ZONAS DEL DIAL LEEN LA TRÍADA CON NOMBRE (--verdict-buscar / -ajusta / -comprar), y esos
//       tres valen lo mismo que las reglas [data-verdict] de globals.css.
//   4 · EL MAPA EN UN SOLO COLOR (decisión de Fabrizio, 23-sep-2026): las nueve categorías de
//       ZoneMap con el mismo relleno —--ink-600, el valor de globals.css—, sin la cruz roja de
//       clínicas, y la leyenda con el ícono de la categoría (con un color, la forma distingue).
//       Eran nueve colores, con un ámbar (trenes) y un lima (parques).
//   5 · EL DIAL LTR DICE «AJUSTAR», como STR: sus zonas, fronteras y total pasan por
//       etiquetaVeredicto(…, "frase"); imprimía el valor persistido («AJUSTA SUPUESTOS», «BUSCAR OTRA»).
// Lo del DOM lo mide `sin-ocre-verde-sonda.ts`.
// Verificado EN ROJO por mutación. Corre solo: node --import tsx scripts/eval/golden/sin-semaforo-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) => s.replace(/\{\/\*[^]*?\*\/\}/g, "").replace(/\/\*[^]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const archivos = (dir: string, out: string[] = []): string[] => {
  for (const n of readdirSync(join(RAIZ, dir))) {
    const p = join(dir, n).replace(/\\/g, "/");
    if (statSync(join(RAIZ, p)).isDirectory()) archivos(p, out);
    else if (/\.(tsx?|css)$/.test(n)) out.push(p);
  }
  return out;
};

export function runSinSemaforoTier(): { hard: number } {
  console.log("\n─── TIER SIN-SEMÁFORO (sin ocre ni verde fuera de la tríada · 0 tokens) ───");

  for (const p of archivos("src")) {
    const v = sinComentarios(leer(p));
    const usos = v.match(/var\(--doc-(?:good|warn)\b/g);
    if (usos) F(`1 · ${p} pinta con el semáforo (${usos.length} × ${usos[0]})`);
    // Los hex del semáforo, fuera de la línea que declara el token.
    for (const linea of v.split("\n")) {
      if (/--doc-(?:good|warn):#/.test(linea)) continue;
      const h = linea.match(/#(?:2E8B57|57B98A|B7791F|DFA34F)\b/i);
      if (h) F(`2 · ${p} usa el hex del semáforo ${h[0]} suelto`);
    }
  }

  const A = sinComentarios(leer("src/components/analysis/hallazgos/HallazgosAcordeon.tsx"));
  for (const z of ["buscar", "ajusta", "comprar"]) {
    if (!new RegExp(`\\.dial-zone\\.${z}\\{background:var\\(--verdict-${z}\\)\\}`).test(A)) F(`3 · la zona «${z}» del Dial no lee --verdict-${z}`);
  }
  const G = leer("src/app/globals.css");
  const nom = (k: string) => (G.match(new RegExp(`--verdict-${k}:(#[0-9A-Fa-f]{6})`)) ?? [])[1]?.toUpperCase();
  const tri = (v: string) => (G.match(new RegExp(`\\[data-verdict="${v}"\\]\\{--verdict:(#[0-9A-Fa-f]{6})`)) ?? [])[1]?.toUpperCase();
  for (const [k, v] of [["buscar", "BUSCAR OTRA"], ["ajusta", "AJUSTA SUPUESTOS"], ["comprar", "COMPRAR"]] as const) {
    if (!nom(k) || nom(k) !== tri(v)) F(`3 · --verdict-${k} (${nom(k)}) no vale lo mismo que [data-verdict="${v}"] (${tri(v)})`);
  }

  // ── 4 · el mapa en un solo color ──
  const Z = sinComentarios(leer("src/components/zone-insight/ZoneMap.tsx"));
  const ink600 = (G.match(/--ink-600:\s*(#[0-9A-Fa-f]{6})/) ?? [])[1]?.toUpperCase();
  const marcador = (Z.match(/const MARCADOR = "(#[0-9A-Fa-f]{6})"/) ?? [])[1]?.toUpperCase();
  if (!marcador || marcador !== ink600) F(`4 · el marcador del mapa (${marcador}) no es --ink-600 (${ink600})`);
  const cat = Z.slice(Z.indexOf("const CATEGORY_ICONS"), Z.indexOf("const CATEGORY_LABELS"));
  const fondos = [...cat.matchAll(/bg: ([^,\n]+),/g)].map((m) => m[1].trim());
  if (fondos.length !== 9 || fondos.some((f) => f !== "MARCADOR")) F(`4 · las categorías del mapa no comparten el color (${fondos.join(" · ")})`);
  const trazos = [...cat.matchAll(/stroke: "(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1].toUpperCase());
  if (trazos.some((t) => t !== "#FAFAF8")) F(`4 · algún ícono del mapa no es blanco (${trazos.join(" · ")})`);
  if (!/<img src=\{markerDataUri\(spec, 16\)\}/.test(Z) || /background: spec\.bg/.test(Z)) F("4 · la leyenda del mapa vuelve al punto de color en vez del ícono");

  // ── 5 · el Dial LTR con la etiqueta visible ──
  const D = sinComentarios(leer("src/components/analysis/drawers/DrawersPropios.tsx"));
  if (!/const rotulo = \(v: string\): string => etiquetaVeredicto\(v, "frase"\);/.test(D)) F("5 · el Dial LTR no tiene el rótulo de la etiqueta visible");
  if (/zonas\.push\(\{ k: (?!rotulo\()/.test(D)) F("5 · una zona del Dial LTR imprime el valor persistido del veredicto");
  if (/k: `y (?:cae|sube) a \$\{(?!rotulo\()/.test(D)) F("5 · una frontera del Dial LTR imprime el valor persistido del veredicto");
  if (/\{d\.base\}/.test(D)) F("5 · el total del Dial LTR imprime el valor persistido del veredicto");

  if (fallas.length) {
    console.log(`  ✗ SIN-SEMÁFORO · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ VERDE — ningún consumidor de --doc-good / --doc-warn en src, sus hex solo en la declaración, las zonas del Dial con la tríada con nombre (mismos hex que [data-verdict]), el mapa en un solo color con la leyenda por ícono, y el Dial LTR con la etiqueta visible");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runSinSemaforoTier();
  process.exit(hard ? 1 : 0);
}
