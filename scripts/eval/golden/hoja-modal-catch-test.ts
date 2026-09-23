// ─────────────────────────────────────────────────────────────────────────────
// TIER HOJA-MODAL (23-sep-2026) · el `Modal` de vocabulario.tsx con DOS FORMAS por ancho, según
// el mockup aprobado (docs/wireframes/rediseno-informe/hoja-mobile.html).
//
// Reglas:
//   1 · BAJO 768 ES HOJA, SOBRE 768 ES MODAL. El corte del CSS (`@media (max-width: Npx)`) es el
//       mismo número que `HOJA_MAX_ANCHO_PX`, que es el que lee `matchMedia` para los gestos: si se
//       separan, el CSS dibuja una forma y el JS se comporta como la otra. Dentro del corte la hoja
//       pega abajo (`align-items:flex-end`), deja `HOJA_VELO_PX` de velo (`calc(100dvh - 56px)`),
//       radio solo arriba y el cuerpo es el único scroll con `overscroll-behavior:contain` y 20 px
//       laterales. Fuera del corte el panel sigue en `max-width:720px`.
//   2 · EL BODY QUEDA BLOQUEADO mientras está abierto (`position:fixed` en body, `top:-y`) y el
//       scroll VUELVE a la posición de apertura al cerrar (`scrollTo` en el cleanup, sin el smooth).
//   3 · EL HISTORIAL SE CONSUME: al abrir la hoja se empuja un estado, `popstate` cierra, y cerrar
//       por otra vía hace `history.back()` solo si el estado sigue arriba y no fue consumido.
//       ACTA 23-sep-2026 (el ⓘ apila una hoja sobre otra): el historial y Esc ya no los escucha
//       cada `Modal` —con dos abiertas, un Esc o un atrás cerraba las dos— sino la PILA
//       (`src/lib/hoja-pila.ts`), que lo hace una vez para todas y solo cierra la de arriba. Acá
//       se fija el CABLEADO del Modal a la pila; la conducta de la pila (empujar, consumir, que
//       el atrás de la de arriba no llegue a la de abajo) la ejercita `info-indicadores-catch-test`
//       sobre la función pura.
//   4 · EL ARRASTRE, sobre la función pura: desde la cabecera cierra pasado el umbral; desde el
//       cuerpo solo en el tope; sin umbral no cierra; hacia arriba nunca.
//   5 · LOS CUATRO CONSUMIDORES NO SE TOCAN: siguen montando `<Modal abierto onClose titulo>` con
//       la misma interfaz (PosicionFranco ×2, ModalCalculoBase, ZonaStrSection).
//
// Verificado EN ROJO por mutación (scratchpad mutar14.py).
// Corre solo: node --import tsx scripts/eval/golden/hoja-modal-catch-test.ts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HOJA_MAX_ANCHO_PX,
  HOJA_VELO_PX,
  HOJA_UMBRAL_CIERRE_PX,
  arrastreSigueAlDedo,
  debeCerrarPorArrastre,
} from "../../../src/components/analysis/hallazgos/vocabulario";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[^]*?\*\/\}/g, "").replace(/\/\*[^]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
/** El cuerpo de una función exportada, sin comentarios: del `export function X(` a su `\n}\n`. */
const funcion = (s: string, nombre: string) => {
  const i = s.indexOf(`export function ${nombre}(`);
  if (i < 0) return "";
  const j = s.indexOf("\n}\n", i);
  return j > i ? s.slice(i, j) : "";
};
/** El bloque `@media (max-width: Npx){ … }` que contiene una marca, con llaves balanceadas. */
const bloqueMedia = (css: string, marca: string) => {
  const m = css.indexOf(marca);
  if (m < 0) return { corte: NaN, cuerpo: "" };
  const ini = css.lastIndexOf("@media (max-width:", m);
  if (ini < 0) return { corte: NaN, cuerpo: "" };
  const corte = Number((css.slice(ini, ini + 40).match(/max-width:\s*(\d+)px/) ?? [])[1]);
  const abre = css.indexOf("{", ini);
  let prof = 0;
  for (let k = abre; k < css.length; k++) {
    if (css[k] === "{") prof++;
    else if (css[k] === "}" && --prof === 0) return { corte, cuerpo: css.slice(abre + 1, k) };
  }
  return { corte, cuerpo: "" };
};
/** El CSS sin ningún bloque @media (llaves balanceadas): lo que rige fuera de todo corte. */
const sinMedia = (css: string) => {
  let out = css;
  for (let i = out.indexOf("@media"); i >= 0; i = out.indexOf("@media")) {
    const abre = out.indexOf("{", i);
    let prof = 0;
    let fin = out.length;
    for (let k = abre; k < out.length; k++) {
      if (out[k] === "{") prof++;
      else if (out[k] === "}" && --prof === 0) { fin = k + 1; break; }
    }
    out = out.slice(0, i) + out.slice(fin);
  }
  return out;
};
const regla = (css: string, selector: string) => {
  const i = css.indexOf(selector + "{");
  if (i < 0) return "";
  const j = css.indexOf("}", i);
  return css.slice(i + selector.length + 1, j).replace(/\s+/g, "");
};

export function runHojaModalTier(): { hard: number } {
  fallas.length = 0;
  const V = sinComentarios(leer("src/components/analysis/hallazgos/vocabulario.tsx"));
  const A = sinComentarios(leer("src/components/analysis/hallazgos/HallazgosAcordeon.tsx"));
  const modal = funcion(V, "Modal");
  if (!modal) F("no se encuentra `export function Modal(` en vocabulario.tsx");

  // ── 1 · dos formas por ancho ──
  const hoja = bloqueMedia(A, ".v-modal-overlay[role=\"dialog\"] .v-modal{");
  if (!hoja.cuerpo) F("1 · no hay bloque @media (max-width) con la regla de la hoja");
  if (hoja.corte !== HOJA_MAX_ANCHO_PX) F(`1 · el corte del CSS (${hoja.corte}) ≠ HOJA_MAX_ANCHO_PX (${HOJA_MAX_ANCHO_PX})`);
  if (!new RegExp(`\\(max-width: \\$\\{HOJA_MAX_ANCHO_PX\\}px\\)`).test(modal.length ? V : "")) F("1 · matchMedia no lee HOJA_MAX_ANCHO_PX");
  const rHoja = regla(hoja.cuerpo, ".v-modal-overlay[role=\"dialog\"] .v-modal");
  if (!rHoja.includes(`height:calc(100dvh-${HOJA_VELO_PX}px)`)) F(`1 · la hoja no mide calc(100dvh - ${HOJA_VELO_PX}px)`);
  if (!rHoja.includes("border-radius:18px18px00")) F("1 · la hoja no tiene radio solo arriba (18px 18px 0 0)");
  if (!rHoja.includes("flex-direction:column")) F("1 · la hoja no es columna (cabecera fija + cuerpo)");
  if (!regla(hoja.cuerpo, ".v-modal-overlay").includes("align-items:flex-end")) F("1 · el overlay no pega la hoja abajo");
  const rCuerpo = regla(hoja.cuerpo, ".v-modal-cuerpo");
  if (!rCuerpo.includes("overscroll-behavior:contain")) F("1 · el cuerpo de la hoja no contiene el overscroll");
  if (!rCuerpo.includes("overflow-y:auto")) F("1 · el cuerpo de la hoja no es el scroll");
  if (!/padding:\d+px20px/.test(rCuerpo)) F("1 · el cuerpo de la hoja no tiene 20 px laterales");
  if (!regla(hoja.cuerpo, ".v-modal-head").includes("flex:none")) F("1 · la cabecera de la hoja no queda fija (flex:none)");
  // fuera del corte: el panel de 720, con su scroll propio (como estaba)
  const fueraMedia = sinMedia(A);
  const rPanel = regla(fueraMedia, ".v-modal");
  if (!rPanel.includes("max-width:720px")) F("1 · sobre el corte el panel ya no es de 720");
  if (!rPanel.includes("overflow-y:auto")) F("1 · sobre el corte el panel ya no scrollea entero (como estaba)");
  if (!regla(fueraMedia, ".v-modal-asa").includes("display:none")) F("1 · el asa se ve en escritorio");
  // el JSX monta las tres piezas
  for (const cls of ["v-modal-asa", "v-modal-head", "v-modal-cuerpo"]) if (!modal.includes(`className="${cls}"`)) F(`1 · el Modal no renderiza .${cls}`);

  // ── 2 · body bloqueado y scroll restaurado ──
  if (!/body\.style\.position = "fixed"/.test(modal)) F("2 · el body no queda fijo con el modal abierto");
  if (!/body\.style\.top = `-\$\{y\}px`/.test(modal)) F("2 · el body fijo no compensa el scroll (top:-y)");
  if (!/return \(\) => \{[^]*?body\.style\.position = previo\.position/.test(modal)) F("2 · el cleanup no restaura el body");
  if (!/return \(\) => \{[^]*?window\.scrollTo\(\{ top: y, left: 0, behavior: "instant" \}\)/.test(modal)) F("2 · el cleanup no devuelve el scroll a la posición de apertura, instantáneo");
  if (!/html\.style\.scrollBehavior = "auto"[^]*?window\.scrollTo/.test(modal)) F("2 · el scrollTo de vuelta corre con el smooth de html puesto");

  // ── 3 · historial ──
  // La hoja entra a la pila con historial solo cuando es hoja (en escritorio no ocupa entradas).
  if (!/const id = pila\.apilar\(\(\) => onCloseRef\.current\(\), \{ conHistorial: esHoja \}\);/.test(modal)) F("3 · el Modal no entra a la pila (o entra con historial también en escritorio)");
  // Cerrar por cualquier vía la saca de la pila, que consume su entrada: en los dos retornos del efecto.
  if ((modal.match(/pila\.desapilar\(id\)/g) ?? []).length < 2) F("3 · cerrar no saca a la hoja de la pila en los dos caminos (primer nivel y apilada)");
  // Y ya no escucha por su cuenta: un listener propio de popstate o de Esc es el doble cierre.
  if (/addEventListener\("popstate"/.test(modal) || /addEventListener\("keydown"/.test(modal)) F("3 · el Modal volvió a escuchar popstate / keydown por su cuenta: con dos abiertas cierran las dos");
  if (/history\.(pushState|back)\(/.test(modal)) F("3 · el Modal toca el historial directo, sin la pila");

  // ── 4 · el arrastre, sobre la función pura ──
  const U = HOJA_UMBRAL_CIERRE_PX;
  const casos: Array<[Parameters<typeof debeCerrarPorArrastre>[0], boolean, string]> = [
    [{ dy: U + 30, origen: "cabecera", scrollTop: 400 }, true, "cabecera a media lectura, pasado el umbral: cierra"],
    [{ dy: U + 30, origen: "cuerpo", scrollTop: 400 }, false, "cuerpo a media lectura: no cierra (es scroll)"],
    [{ dy: U + 30, origen: "cuerpo", scrollTop: 0 }, true, "cuerpo en el tope, pasado el umbral: cierra"],
    [{ dy: U, origen: "cuerpo", scrollTop: 0 }, true, "justo en el umbral: cierra"],
    [{ dy: U - 1, origen: "cabecera", scrollTop: 0 }, false, "un píxel bajo el umbral: no cierra"],
    [{ dy: -200, origen: "cabecera", scrollTop: 0 }, false, "hacia arriba: nunca cierra"],
  ];
  for (const [arg, esperado, nombre] of casos) if (debeCerrarPorArrastre(arg) !== esperado) F(`4 · ${nombre} (${JSON.stringify(arg)})`);
  if (arrastreSigueAlDedo("cuerpo", 1)) F("4 · el cuerpo con 1 px de scroll sigue al dedo (tendría que scrollear)");
  if (!arrastreSigueAlDedo("cabecera", 999)) F("4 · la cabecera no sigue al dedo con el cuerpo scrolleado");
  if (!/debeCerrarPorArrastre\(\{ dy, origen, scrollTop: cuerpo\.scrollTop \}\)\) onCloseRef\.current\(\)/.test(modal)) F("4 · el touchend no decide con debeCerrarPorArrastre");
  if (!/addEventListener\("touchmove", onMove, \{ passive: false \}\)/.test(modal)) F("4 · touchmove pasivo: no puede frenar el scroll mientras la hoja sigue al dedo");
  if (!/if \(!abierto \|\| !esHoja\) return;\s*const hoja = hojaRef\.current/.test(modal)) F("4 · el arrastre corre también en escritorio");

  // ── 5 · los cuatro consumidores, intactos ──
  const consumidores: Array<[string, number]> = [
    ["src/components/analysis/shared/PosicionFranco.tsx", 2],
    ["src/components/analysis/shared/ModalCalculoBase.tsx", 1],
    ["src/components/analysis/str/ZonaStrSection.tsx", 1],
  ];
  for (const [p, n] of consumidores) {
    const c = sinComentarios(leer(p));
    const k = (c.match(/<Modal abierto=\{[^}]+\} onClose=\{[^}]+\} titulo=\{?[^\n]*?\}?/g) ?? []).length;
    if (k !== n) F(`5 · ${p} monta ${k} <Modal abierto onClose titulo>, se esperaban ${n}`);
  }

  if (fallas.length) {
    console.log(`\n  ✗ HOJA-MODAL · ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     · ${f}`);
  } else {
    console.log("  ✓ HOJA-MODAL · dos formas por ancho, body bloqueado, historial consumido, arrastre y consumidores");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runHojaModalTier();
  process.exit(hard ? 1 : 0);
}
