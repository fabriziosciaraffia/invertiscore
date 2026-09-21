// ============================================================================
// GOLDEN · el mes vacío, en plata — catch-test (v21.1 · 09-sep-2026). 0 tokens.
// ============================================================================
// Reemplaza a A-PC2.vacancia, que exigía el escenario en la PROSA y se retiró con
// acta: desde v21 lo garantiza el MOTOR en el 100% de los informes LTR, porque el
// cierre del capítulo II lo dice determinista y ocupa la caja que antes llenaba la
// prosa de `costoMensual`. La cobertura sube — todas las filas y siempre, en vez de
// tres seeds de pie 0 y solo si el modelo se acordó.
//
// Fija DOS cosas:
//
//   1. LA ARITMÉTICA (`calcMesVacio`): dividendo + gastos comunes COMPLETOS +
//      contribuciones del mes. La trampa que este test existe para cazar es usar la
//      PRORRATA de gastos comunes (`ggccVacancia` del desglose, que es ggcc × meses de
//      vacancia ÷ 12): es la cifra correcta para el flujo promedio y la incorrecta para
//      este escenario, porque el mes que el depto está vacío los gastos los paga el
//      dueño enteros. Con la prorrata la frase SUBESTIMA el golpe, que es lo contrario
//      de lo que el escenario existe para mostrar. Fue el defecto real: 14,9% corto en
//      producción hasta este goal.
//
//   2. QUE LA FRASE LA USE. El cierre del capítulo II tiene que nombrar el mes sin
//      arrendatario y tiene que interpolar `mesVacio` — no `desglose.dividendo`, que es
//      exactamente el bug que había. Se verifica sobre el FUENTE, igual que el
//      catch-test de etiquetas: es lo que permite cazarlo sin montar React.
//
// Corre dentro del QUICK del runner (tier "mes-vacio") y standalone:
//   node --import tsx scripts/eval/golden/mes-vacio-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcFlujoDesglose, calcMesVacio } from "../../../src/lib/analysis";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);

// ── 1 · la aritmética ───────────────────────────────────────────────────────
// Caso real: 7710a017 (Providencia). Dividendo $978.290 · GGCC $90.000/mes ·
// contribuciones $242.205 trimestrales. Un mes vacío = 978.290 + 90.000 + 80.735.
const CASO = { dividendo: 978_290, ggcc: 90_000, contribuciones: 242_205 };
const ESPERADO = 1_149_025;

const mv = calcMesVacio(CASO);
if (mv !== ESPERADO) F(`1 · calcMesVacio dio ${mv}, se esperaba ${ESPERADO} (dividendo + GGCC completo + contribuciones/3)`);

// El dividendo solo —el bug que había— tiene que ser MENOR: si alguien "simplifica"
// la función a devolver el dividendo, esto lo caza.
if (mv <= CASO.dividendo) F(`1 · el mes vacío (${mv}) no supera al dividendo solo (${CASO.dividendo}): faltan gastos comunes y/o contribuciones`);

// La PRORRATA de gastos comunes no sirve acá. Con 0,6 meses de vacancia la prorrata es
// $4.500 y el completo $90.000: si la aritmética usara la prorrata, el resultado caería
// $85.500. Se compara contra el desglose real para que la trampa quede fijada por
// construcción y no por un número escrito a mano.
const desglose = calcFlujoDesglose({
  arriendo: 960_000, dividendo: CASO.dividendo, ggcc: CASO.ggcc,
  contribuciones: CASO.contribuciones, mantencion: 91_669, vacanciaMeses: 0.6,
});
const conProrrata = Math.round(CASO.dividendo + desglose.ggccVacancia + desglose.contribucionesMes);
if (desglose.ggccVacancia >= CASO.ggcc) F("1 · el fixture perdió sentido: la prorrata de GGCC debía ser menor que el GGCC completo");
if (mv <= conProrrata) F(`1 · calcMesVacio (${mv}) no supera a la versión con GGCC prorrateado (${conProrrata}): está usando la prorrata`);

// Contribuciones trimestrales → mes. Mismo /3 que `contribucionesMes` del desglose.
if (calcMesVacio({ dividendo: 0, ggcc: 0, contribuciones: 300 }) !== 100) F("1 · las contribuciones no se están mensualizando (/3)");

// ── 2 · que la frase la use ─────────────────────────────────────────────────
// DESDE EL 21-sep-2026 EL CIERRE VIVE EN EL CAPÍTULO, NO EN EL DRAWER. `DrawerCostoMensual`
// se retiró (el capítulo II de LTR pasó a ser capítulo, como STR) y el cierre es
// `cierreMesVacioLtr` (src/lib/flujo-mensual-ltr.ts), una sola rama para los dos signos del
// flujo, con la fórmula a la vista. Se mide en dos capas: la función interpola `mesVacio`
// (y no la cuota), y el capítulo se lo pasa desde `calcMesVacio`.
const LIB = join(__dirname, "..", "..", "..", "src", "lib", "flujo-mensual-ltr.ts");
const lib = readFileSync(LIB, "utf-8");
const cierreSrc = (() => {
  const i = lib.indexOf("export function cierreMesVacioLtr");
  return i >= 0 ? lib.slice(i) : "";
})();
if (!cierreSrc) F("2 · no existe cierreMesVacioLtr en flujo-mensual-ltr.ts: el cierre del capítulo II no tiene función");
if (!/Un mes sin arrendatario son /.test(cierreSrc)) F("2 · el cierre no nombra el mes sin arrendatario");
if (!/\{ t: p\.money\(p\.mesVacio\), b: true \}/.test(cierreSrc)) F("2 · la cifra del cierre no es mesVacio (el bug del 14,9% era interpolar la cuota)");
if (!/la cuota completa \(\$\{p\.money\(p\.cuota\)\}\) más los gastos comunes enteros \(\$\{p\.money\(p\.gastosComunes\)\}\) y las contribuciones del mes \(\$\{p\.money\(p\.contribucionesMes\)\}\)/.test(cierreSrc)) F("2 · la fórmula del mes vacío no está a la vista en el cierre");

const CAP = join(__dirname, "..", "..", "..", "src", "components", "analysis", "CapitulosInversion.tsx");
const src = readFileSync(CAP, "utf-8");
// ⛔ ANTES ESTO CONTABA LLAMADAS (`>= 2`) Y SE REESCRIBIÓ EL 17-sep-2026.
// Los dos consumidores eran el cierre del capítulo II y el drawer de estructura; el
// segundo se retiró con `DrawerEstructuraSana`, inalcanzable desde el 5-sep. Bajar el
// umbral a `>= 1` habría dejado un predicado que satisface una llamada EN CUALQUIER
// PARTE del archivo —incluso en un componente nuevo y equivocado—, que es medir la
// presencia y no el cableado. Así que en vez del umbral va el CONSUMIDOR QUE SOBREVIVE,
// nombrado, y acotado a su cuerpo.
// Con FRONTERA: `indexOf("function DrawerCostoMensual")` matchea por prefijo, así que
// renombrar el componente a `DrawerCostoMensualX` dejaba el guard VERDE — el slice seguía
// encontrando cuerpo y el regex seguía calzando. Cazado mutando.
// Acotado al CUERPO DEL CAPÍTULO II (entre su banner y el del III), que es el consumidor que
// sobrevive, nombrado: una llamada en cualquier otra parte del archivo no cuenta.
const ini = src.indexOf("II · TU FLUJO MENSUAL");
const fin = src.indexOf("III · CÓMO LO PAGAS");
if (ini === -1 || fin === -1 || fin <= ini) {
  F("2 · no se pudo acotar el cuerpo del capítulo II en CapitulosInversion.tsx: el extractor no midió nada");
} else {
  const cuerpo = src.slice(ini, fin);
  if (!/calcMesVacio\(\{ dividendo: d\.dividendo, ggcc: gastosComunes, contribuciones: contribTrim \}\)/.test(cuerpo)) {
    F("2 · el capítulo II dejó de calcular el mes vacío con calcMesVacio (gastos comunes ENTEROS, contribuciones trimestrales)");
  }
  if (!/cierreMesVacioLtr\(\{ mesVacio,/.test(cuerpo)) {
    F("2 · el capítulo II no le pasa mesVacio al cierre: estaría recalculando el mes vacío por su cuenta");
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runMesVacioTier(): { hard: number } {
  console.log("\n─── TIER MES VACÍO (el escenario en plata lo pone el motor · analysis.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log(`  ✓ VERDE — aritmética (dividendo + GGCC completo + contribuciones), el cierre la interpola con la fórmula a la vista y el capítulo II se la pasa`);
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runMesVacioTier();
  process.exit(hard ? 1 : 0);
}
