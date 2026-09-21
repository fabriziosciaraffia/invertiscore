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
const DRAWER = join(__dirname, "..", "..", "..", "src", "components", "ui", "AnalysisDrawer.tsx");
const src = readFileSync(DRAWER, "utf-8");

// El cierre determinista del capítulo II: las dos ramas (flujo negativo y positivo).
const cierres = src.match(/Un mes sin arrendatario son \$\{[^}]+\}/g) ?? [];
if (cierres.length !== 2) F(`2 · se esperaban 2 cierres «Un mes sin arrendatario son …», hay ${cierres.length}`);
for (const c of cierres) {
  if (!/\$\{fmt\(mesVacio\)\}/.test(c)) F(`2 · un cierre no usa mesVacio: «${c}»`);
  if (/desglose\.dividendo/.test(c)) F(`2 · un cierre sigue usando desglose.dividendo (el bug de 14,9%): «${c}»`);
}
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
const mIni = /function DrawerCostoMensual\b/.exec(src);
// El cierre del cuerpo es la SIGUIENTE función de nivel superior, sea cual sea: hasta el
// 21-sep-2026 era `DrawerNegociacion`, que se retiró con el rediseño de «Cómo lo pagas»,
// y un marcador con nombre propio deja el guard sin medir el día que ese nombre se va.
const resto = mIni ? src.slice(mIni.index + 1) : "";
const mFin = /^(?:export )?function \w+/m.exec(resto);
const ini = mIni ? mIni.index : -1;
const fin = mIni && mFin ? mIni.index + 1 + mFin.index : -1;
if (ini === -1 || fin === -1 || fin <= ini) {
  F("2 · no se pudo acotar el cuerpo de DrawerCostoMensual: el extractor no midió nada");
} else {
  const cuerpo = src.slice(ini, fin);
  if (!/calcMesVacio\(/.test(cuerpo)) {
    F("2 · DrawerCostoMensual dejó de llamar a calcMesVacio: el cierre del capítulo II estaría recalculando el mes vacío por su cuenta");
  }
}

/** Tier para el runner: cada invariante roto es una falla dura. */
export function runMesVacioTier(): { hard: number } {
  console.log("\n─── TIER MES VACÍO (el escenario en plata lo pone el motor · analysis.ts, 0 tokens) ───");
  if (fallas.length === 0) {
    console.log(`  ✓ VERDE — aritmética (dividendo + GGCC completo + contribuciones) y las dos ramas del cierre la usan`);
  } else {
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runMesVacioTier();
  process.exit(hard ? 1 : 0);
}
