// ─────────────────────────────────────────────────────────────────────────────
// TIER MUDANZA-CAPÍTULOS (23-sep-2026) · los once capítulos —cinco de LTR, seis de STR— abren en el
// pop-up (el `Modal` de vocabulario.tsx: hoja en teléfono, panel en escritorio) y no en acordeón.
//
// Reglas:
//   1 · NINGÚN CAPÍTULO EN ACORDEÓN. En `HallazgosAcordeon` el cuerpo inline queda gateado a la
//       variante «hallazgo» (`{open && !esCapitulo && f.cuerpo && (`), el capítulo abierto se monta
//       dentro de `<Modal abierto={filaAbierta !== null}>` con título, sub y cuerpo, y no quedan ni el
//       «↑ Cerrar» de capítulo ni el CSS del cuerpo inline (`.hall.cap .hall-body`, `.hall-end`,
//       `.hall-close`) ni el giro del disco (`.hall.cap.open .chev`). La fila conserva el foco.
//   2 · EL HASH ABRE. Al montar, si `location.hash` coincide con el `anchorId` de una fila con cuerpo,
//       se abre su pop-up y se mide. Las once filas siguen llevando su ancla (`cap-…` / `cap-str-…`).
//   3 · MEDIR DISPARA EN LA APERTURA, en los tres caminos: el clic de la fila, la apertura externa
//       (`abrir`) y el hash. `medir` sigue emitiendo `informe_capitulo_abierto` una vez por fila.
//   4 · useAncho MIDE AL MONTAR Y CORRIGE: `useLayoutEffect` + `getBoundingClientRect().width` +
//       ResizeObserver; los cuatro gráficos dibujan `W` desde el ancho medido con 600 solo de
//       referencia y escriben `width={W}` en el SVG. La medición viva (que el width del SVG dentro de
//       la hoja abierta sea el del cuerpo y no 600) la hace la sonda:
//         node --import tsx scripts/eval/golden/mudanza-capitulos-sonda.ts --base http://localhost:3007
//   5 · EL PDF NO SE MUEVE: las dos carpetas `documento/` no importan nada de la superficie mudada
//       (hallazgos/, CapitulosInversion*, useAncho ni los gráficos que lo usan). El diff contra master
//       de esas carpetas va en el reporte del goal, no acá: un hash pineado se pudre con el primer
//       cambio legítimo del PDF.
//   6 · LAS DOS COLAS: «A qué precio cerrar» es el título del capítulo en las dos modalidades, y el
//       punto positivo de la curva de diez años (`.ca-pt.pos`) va en tinta, sin `--doc-good`.
//
// Verificado EN ROJO por mutación (scratchpad mutar15.py).
// Corre solo: node --import tsx scripts/eval/golden/mudanza-capitulos-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[^]*?\*\/\}/g, "").replace(/\/\*[^]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
/** Del `export function X(` a su `\n}\n`, sin comentarios. */
const funcion = (s: string, nombre: string) => {
  const i = s.indexOf(`export function ${nombre}(`);
  if (i < 0) return "";
  const j = s.indexOf("\n}\n", i);
  return j > i ? s.slice(i, j) : "";
};
/** El cuerpo del `useEffect` que contiene la marca. */
const efecto = (s: string, marca: string) => {
  const m = s.indexOf(marca);
  if (m < 0) return "";
  const ini = s.lastIndexOf("useEffect(() => {", m);
  const fin = s.indexOf("\n  }, [", m);
  return ini >= 0 && fin > ini ? s.slice(ini, fin) : "";
};

const ACORDEON = "src/components/analysis/hallazgos/HallazgosAcordeon.tsx";
const PORTADA = "src/components/analysis/portada/PortadaInforme.tsx";
const LTR = "src/components/analysis/CapitulosInversion.tsx";
const STR = "src/components/analysis/str/CapitulosInversionStr.tsx";
const DOCUMENTOS = ["src/app/analisis/[id]/documento", "src/app/analisis/renta-corta/[id]/documento"];
const GRAFICOS = ["PatrimonioBarras", "SeriePlusvalia", "CurvaFlujoAnual", "BarraApiladaB"];

export function runMudanzaCapitulosTier(): { hard: number } {
  fallas.length = 0;
  const A = sinComentarios(leer(ACORDEON));
  const comp = funcion(A, "HallazgosAcordeon");
  if (!comp) F("no se encuentra `export function HallazgosAcordeon(`");
  const P = sinComentarios(leer(PORTADA));

  // ── 1 · ningún capítulo en acordeón ──
  if (!/\{open && !esCapitulo && f\.cuerpo && \(/.test(comp)) F("1 · el cuerpo inline no está gateado a la variante «hallazgo»");
  if (!/<Modal\s+abierto=\{filaAbierta !== null\}/.test(comp)) F("1 · el capítulo abierto no se monta dentro del Modal");
  if (!/titulo=\{filaAbierta\?\.pregunta \?\? ""\}/.test(comp)) F("1 · el Modal no lleva el título de la fila");
  if (!/\{filaAbierta\.valor\}/.test(comp) || !/\{filaAbierta\.ksub && /.test(comp)) F("1 · el sub del Modal no lleva la cifra apellidada y su ksub");
  if (!/>\s*\{filaAbierta\?\.cuerpo\}\s*<\/Modal>/.test(comp)) F("1 · el cuerpo de la fila no es el hijo del Modal");
  if (!/const filaAbierta = esCapitulo \? \(filas\.find\(\(f\) => f\.id === abierta\) \?\? null\) : null;/.test(comp)) F("1 · filaAbierta no sale del estado `abierta` en la variante capítulo");
  if (/hall-close|hall-end/.test(comp)) F("1 · queda el «↑ Cerrar» de capítulo en el JSX");
  if (/\.hall\.cap \.hall-body\{|\.hall-end\{|\.hall-close\{/.test(A + P)) F("1 · queda CSS del cuerpo inline de capítulo");
  if (/\.hall\.cap\.open/.test(P)) F("1 · el disco sigue girando al abrir (.hall.cap.open): el «›» lleva a algo, no se despliega");
  if (!/\.hall-head:focus-visible/.test(A)) F("1 · .hall-head perdió su :focus-visible");
  if (!/aria-haspopup=\{esCapitulo \? "dialog" : undefined\}/.test(comp)) F("1 · la fila de capítulo no declara que abre un diálogo");

  // ── 2 · el hash abre ──
  const hash = efecto(comp, "window.location.hash");
  if (!hash) F("2 · no hay efecto que lea location.hash");
  else {
    if (!/if \(!esCapitulo \|\| typeof window === "undefined"\) return;/.test(hash)) F("2 · el hash abre también en la variante «hallazgo» o rompe en SSR");
    if (!/filas\.findIndex\(\(f\) => f\.anchorId === hash\)/.test(hash)) F("2 · el hash no se compara con el anchorId de la fila");
    if (!/if \(!fila \|\| !fila\.cuerpo\) return;\s*setAbierta\(fila\.id\);\s*medir\(fila, i\);/.test(hash)) F("2 · el hash no abre la fila (setAbierta) o no mide");
    const deps = comp.slice(comp.indexOf(hash) + hash.length, comp.indexOf(hash) + hash.length + 40);
    if (!/^\n  \}, \[\]\);/.test(deps)) F("2 · el efecto del hash no corre solo al montar (deps ≠ [])");
  }
  for (const [p, n, pref] of [[LTR, 5, "anchorCapitulo("], [STR, 6, "anchorCapituloStr("]] as const) {
    const k = (sinComentarios(leer(p)).match(new RegExp(`anchorId: ${pref.replace("(", "\\(")}"[a-z]+"\\)`, "g")) ?? []).length;
    if (k !== n) F(`2 · ${p} declara ${k} anclas de capítulo, se esperaban ${n}`);
  }

  // ── 3 · medir dispara en la apertura ──
  if (!/if \(esCapitulo\) \{\s*setAbierta\(fila\.id\);\s*medir\(fila, indice\);\s*return;\s*\}/.test(comp)) F("3 · el clic de la fila de capítulo no abre o no mide");
  const externo = efecto(comp, "if (!abrir) return;");
  if (!externo) F("3 · no hay efecto de apertura externa");
  else if (!/setAbierta\(fila\.id\);\s*medir\(fila, i\);\s*if \(esCapitulo\) return;/.test(externo)) F("3 · la apertura externa no abre, no mide o sigue scrolleando en capítulo");
  if (!/const name = esCapitulo \? "informe_capitulo_abierto" : "informe_hallazgo_abierto";/.test(comp)) F("3 · medir ya no emite informe_capitulo_abierto");
  if (!/if \(medidas\.current\.has\(fila\.id\)\) return;/.test(comp)) F("3 · medir dejó de ser una vez por fila");

  // ── 4 · useAncho mide al montar y corrige ──
  const ua = sinComentarios(leer("src/components/analysis/shared/useAncho.ts"));
  if (!/useLayoutEffect\(\(\) => \{/.test(ua) || !/el\.getBoundingClientRect\(\)\.width \|\| null/.test(ua)) F("4 · useAncho no mide al montar con getBoundingClientRect");
  if (!/new ResizeObserver\(medir\)/.test(ua)) F("4 · useAncho no corrige con ResizeObserver");
  for (const g of GRAFICOS) {
    const s = sinComentarios(leer(`src/components/analysis/shared/${g}.tsx`));
    if (!/const \[ref, ancho\] = useAncho<HTMLDivElement>\(\);/.test(s)) F(`4 · ${g} no usa useAncho`);
    if (!/ref=\{ref\}/.test(s)) F(`4 · ${g} no cuelga la ref del contenedor`);
    if (g !== "BarraApiladaB") {
      if (!/const W = Math\.max\(280, Math\.round\(ancho \?\? 600\)\)/.test(s)) F(`4 · ${g} no dibuja W desde el ancho medido (600 solo de referencia)`);
      if (!/<svg[^>]*width=\{W\}/.test(s)) F(`4 · ${g} no escribe width={W} en el SVG`);
    }
  }

  // ── 5 · el PDF no se mueve: frontera de imports ──
  const PROHIBIDO = new RegExp(`hallazgos/|CapitulosInversion|useAncho|shared/(${GRAFICOS.join("|")}|CurvaAnios)|from "@/components/analysis/shared"`);
  for (const dir of DOCUMENTOS) {
    for (const f of readdirSync(join(RAIZ, dir))) {
      if (!/\.tsx?$/.test(f)) continue;
      const imports = leer(`${dir}/${f}`).split("\n").filter((l) => /^import /.test(l));
      for (const l of imports) if (PROHIBIDO.test(l)) F(`5 · ${dir}/${f} importa de la superficie mudada: ${l.trim().slice(0, 90)}`);
    }
  }

  // ── 6 · las dos colas ──
  for (const p of [LTR, STR]) {
    const s = sinComentarios(leer(p));
    if (!/pregunta: "A qué precio cerrar",/.test(s)) F(`6 · ${p} no titula «A qué precio cerrar»`);
    if (/pregunta: "Cómo lo pagas",/.test(s)) F(`6 · ${p} sigue titulando «Cómo lo pagas»`);
  }
  const T = leer("src/components/analysis/shared/TokensShared.tsx");
  const pos = (T.match(/\.ca-pt\.pos\{([^}]*)\}/) ?? [])[1] ?? "";
  if (!pos) F("6 · no existe la regla .ca-pt.pos");
  else if (/--doc-good|--doc-warn/.test(pos) || !/background:var\(--doc-tx\)/.test(pos)) F(`6 · el punto positivo de la curva de diez años no va en tinta: «${pos}»`);

  if (fallas.length) {
    console.log(`\n  ✗ MUDANZA-CAPÍTULOS · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ MUDANZA-CAPÍTULOS · los once en el pop-up, hash y apertura externa abren, medir dispara, useAncho mide al montar, PDF sin imports mudados, título y tinta");
  }
  return { hard: fallas.length };
}

if (require.main === module) process.exit(runMudanzaCapitulosTier().hard ? 1 : 0);
