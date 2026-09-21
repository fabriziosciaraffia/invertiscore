/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================================
// GOLDEN · «TU FLUJO MENSUAL» LTR (capítulo II) — catch-test (21-sep-2026). 0 tokens, sin base.
// ============================================================================
// El capítulo II de LTR dejó de ser `DrawerCostoMensual` embebido y pasó a ser capítulo, como
// STR (contrato docs/wireframes/rediseno-informe/capitulo-ii-flujo-ltr.html). Se reusa casi
// todo de STR; este tier fija LO NUEVO por modalidad, que vive en `src/lib/flujo-mensual-ltr.ts`:
//
//   1. EL RÓTULO DEL MES: «en un mes promedio del año 1, a precios de hoy» (no «estabilizado»:
//      LTR no tiene ramp-up). Fijado como constante y CABLEADO en el sub del bloque y en la
//      fila del total del capítulo.
//   2. LA SERIE ÷ MESES OPERATIVOS, diez años, sin años sin operación. Fixtures sintéticos:
//      un año parcial de 8 meses tiene que dar flujoAnual ÷ 8 (÷12 mostraría el 67%), los
//      años pre-entrega no entran, y de 20 años se dibujan 10.
//   3. EL MES VACÍO COMO CIERRE: `cierreMesVacioLtr` nombra la cifra de `calcMesVacio` y los
//      tres términos (cuota completa, gastos comunes enteros, contribuciones del mes), y el
//      capítulo llama a `calcMesVacio` y se lo pasa (acotado al cuerpo del capítulo II).
//   + el pie del gráfico dice hacia dónde va la serie según los datos (baja / sube), no una
//     frase fija, y solo nombra las bandas de mantención cuando no hay provisión declarada.
//   + CABLEADO: `CapitulosInversion.tsx` ya no importa `DrawerCostoMensual` y `AnalysisDrawer`
//     ya no lo exporta.
//
// VERIFICADO EN ROJO (21-sep-2026), mutando y devolviendo cada línea:
//   · el rótulo cambiado a «mes estabilizado» → cae 1.
//   · `rotuloMesLtr` ignorando la pre-entrega (siempre «año 1») → cae 1.
//   · la serie con `/ 12` en vez de `/ p.meses` → cae 2.
//   · el cierre interpolando `p.cuota` donde va `p.mesVacio` → cae 3.
//
// Corre dentro del QUICK y standalone:
//   node --import tsx scripts/eval/golden/flujo-ltr-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROTULO_MES_LTR, SUB_TOTAL_MES_LTR, rotuloMesLtr, HORIZONTE_CURVA_ANIOS, serieFlujoMensualPorAnioLtr, descomposicionFlujoLtr, pieCurvaFlujoLtr, cierreMesVacioLtr } from "../../../src/lib/flujo-mensual-ltr";
import { calcMesVacio } from "../../../src/lib/analysis";
import type { YearProjection } from "../../../src/lib/types";

const fallas: string[] = [];
const F = (m: string) => fallas.push(m);
const RAIZ = join(__dirname, "../../../");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const texto = (segs: { t: string }[]) => segs.map((s) => s.t).join("");
const money = (n: number) => "$" + Math.round(Math.abs(n)).toLocaleString("es-CL");

function anio(a: number, meses: number, flujoMes: number, extra: Partial<YearProjection> = {}): YearProjection {
  return { anio: a, arriendoMensual: 500000, flujoAnual: flujoMes * meses, flujoAcumulado: 0, valorPropiedad: 0, saldoCredito: 0, patrimonioNeto: 0, mesesOperativos: meses, ...extra } as YearProjection;
}

export function runFlujoLtrTier(): { hard: number } {
  fallas.length = 0;
  const cap = leer("src/components/analysis/CapitulosInversion.tsx");
  const ini = cap.indexOf("II · TU FLUJO MENSUAL");
  const fin = cap.indexOf("III · CÓMO LO PAGAS");
  const cuerpo = ini >= 0 && fin > ini ? cap.slice(ini, fin) : "";
  if (!cuerpo) F("0 · no se pudo acotar el cuerpo del capítulo II en CapitulosInversion.tsx: el extractor no midió nada");

  // 1 · el rótulo del mes
  if (ROTULO_MES_LTR !== "Lo que entra y lo que sale en un mes promedio del año 1, a precios de hoy") F(`1 · el rótulo del mes cambió: «${ROTULO_MES_LTR}»`);
  if (SUB_TOTAL_MES_LTR !== "en un mes promedio del año 1, a precios de hoy") F(`1 · el sub del total cambió: «${SUB_TOTAL_MES_LTR}»`);
  if (/estabilizado/.test(ROTULO_MES_LTR)) F("1 · LTR no tiene ramp-up: el rótulo no puede decir «estabilizado»");
  // Con entrega futura el año 1 no tiene arrendatario (77 filas): el rótulo dice «del primer
  // año con arrendatario» en vez de mentir. La función decide; el capítulo la llama con la
  // condición real (el primer punto de la serie no es el año 1).
  const r0 = rotuloMesLtr(false), r1 = rotuloMesLtr(true);
  if (r0.sub !== ROTULO_MES_LTR || r0.total !== SUB_TOTAL_MES_LTR) F("1 · sin pre-entrega el rótulo no es el del año 1");
  if (!/del primer año con arrendatario, a precios de hoy$/.test(r1.sub) || !/^en un mes promedio del primer año con arrendatario, a precios de hoy$/.test(r1.total) || /año 1/.test(r1.sub)) F(`1 · con pre-entrega el rótulo tiene que decir «del primer año con arrendatario» (dio «${r1.sub}»)`);
  if (!/const rotulo = rotuloMesLtr\(\(serie\[0\]\?\.anio \?\? 1\) > 1\)/.test(cuerpo)) F("1 · el capítulo no decide el rótulo con el primer año operativo de la serie");
  if (!/<VSub>\{rotulo\.sub\}<\/VSub>/.test(cuerpo)) F("1 · el capítulo no usa el rótulo del mes en el sub del bloque");
  if (!/sub=\{rotulo\.total\}/.test(cuerpo)) F("1 · la fila del total no lleva el rótulo del mes");

  // 2 · la serie ÷ meses operativos, diez años, sin años sin operación
  const veinte: YearProjection[] = [anio(1, 0, 0), anio(2, 8, -100000), ...Array.from({ length: 18 }, (_, i) => anio(i + 3, 12, -90000 + i * 1000))];
  const s = serieFlujoMensualPorAnioLtr(veinte);
  if (s.length !== HORIZONTE_CURVA_ANIOS) F(`2 · la serie tiene ${s.length} puntos, esperaba ${HORIZONTE_CURVA_ANIOS}`);
  if (s.some((p) => p.anio === 1)) F("2 · entró un año sin meses operativos (pre-entrega)");
  const parcial = s.find((p) => p.anio === 2);
  if (!parcial) F("2 · el año parcial (8 meses) no salió en la serie");
  else if (parcial.flujoMensual !== -100000) F(`2 · el año parcial no divide por sus meses: dio ${parcial.flujoMensual}, esperaba −100.000 (÷12 daría −66.667)`);
  if (s[s.length - 1]?.anio !== 11) F(`2 · el último punto es el año ${s[s.length - 1]?.anio}: no cortó a diez años operativos`);
  if (serieFlujoMensualPorAnioLtr([]).length !== 0 || serieFlujoMensualPorAnioLtr(undefined).length !== 0) F("2 · sin proyecciones la serie no es vacía");
  // fixture con desglose: baja y sube
  const conDesglose = (deltaCuota: number): YearProjection[] =>
    Array.from({ length: 10 }, (_, i) => anio(i + 1, 12, 0, { arriendoAnual: (500000 + i * 10000) * 12, dividendoAnual: (450000 + i * deltaCuota) * 12, gastosOperativosAnual: (60000 + i * 2000) * 12, vacanciaRotacionAnual: (30000 + i * 500) * 12, flujoAnual: ((500000 + i * 10000) - (450000 + i * deltaCuota) - (60000 + i * 2000) - (30000 + i * 500)) * 12 }));
  const baja = descomposicionFlujoLtr(conDesglose(12000));
  const sube = descomposicionFlujoLtr(conDesglose(2000));
  if (!baja || !sube) F("2 · la descomposición no se emitió con desglose completo");
  else {
    if (baja.dArriendo !== 90000 || baja.dCuota !== 108000 || baja.dGastos !== 22500) F(`2 · la descomposición no cuadra: arriendo ${baja.dArriendo} cuota ${baja.dCuota} gastos ${baja.dGastos}`);
    if (baja.cuotaPor100 !== 90) F(`2 · cuota como % del arriendo: ${baja.cuotaPor100}, esperaba 90`);
    const tb = texto(pieCurvaFlujoLtr(baja, { mantencionPorBandas: true, money }));
    const ts = texto(pieCurvaFlujoLtr(sube, { mantencionPorBandas: false, money }));
    if (!/^Cada año deja un poco menos\./.test(tb) || !/crece con la UF sobre una base que ya es el 90% del arriendo/.test(tb) || !/la mantención cambia de banda con la edad/.test(tb)) F(`2 · el pie de la serie que baja (dio «${tb}»)`);
    if (!/^Cada año deja un poco más\./.test(ts) || /cambia de banda/.test(ts)) F(`2 · el pie de la serie que sube, sin bandas con provisión declarada (dio «${ts}»)`);
  }
  if (descomposicionFlujoLtr([anio(1, 12, -1), anio(2, 12, -1)]) !== null) F("2 · sin desglose anual (filas legacy) la descomposición debía ser null");
  if (!/serieFlujoMensualPorAnioLtr\(results\.projections\)/.test(cuerpo) || !/<CurvaAnios puntos=\{puntos\}/.test(cuerpo)) F("2 · el capítulo no dibuja la serie del motor con CurvaAnios");

  // 3 · el mes vacío como cierre, con la fórmula a la vista
  const mv = calcMesVacio({ dividendo: 470691, ggcc: 140000, contribuciones: 74282 });
  const c = texto(cierreMesVacioLtr({ mesVacio: mv, cuota: 470691, gastosComunes: 140000, contribucionesMes: 24761, money }));
  if (!c.startsWith(`Un mes sin arrendatario son ${money(mv)} de tu bolsillo`)) F(`3 · el cierre no abre con la cifra de calcMesVacio (dio «${c.slice(0, 60)}»)`);
  if (!/la cuota completa \(\$470\.691\) más los gastos comunes enteros \(\$140\.000\) y las contribuciones del mes \(\$24\.761\)/.test(c)) F(`3 · la fórmula no está a la vista (dio «${c}»)`);
  if (!/calcMesVacio\(\{ dividendo: d\.dividendo, ggcc: gastosComunes, contribuciones: contribTrim \}\)/.test(cuerpo)) F("3 · el capítulo no calcula el mes vacío con calcMesVacio (gastos comunes ENTEROS, contribuciones trimestrales)");
  if (!/cierreMesVacioLtr\(\{ mesVacio,/.test(cuerpo)) F("3 · el capítulo no pasa mesVacio al cierre");
  if (!/<VCierre titulo="Qué significa">\{pinta\(cierre\)\}<\/VCierre>/.test(cuerpo)) F("3 · el cierre del capítulo no es el mes vacío");
  // sobre el código, no sobre las actas: los comentarios nombran lo que salió
  const codigo = cuerpo.replace(/\/\*[^]*?\*\/|\/\/[^\n]*/g, "");
  if (/¿Tienes .* disponibles/.test(codigo) || /costoMensual/.test(codigo)) F("3 · volvió la pregunta que repetía el total o la caja IA de costoMensual");

  // + cableado
  if (/DrawerCostoMensual/.test(cap.replace(/\/\*[^]*?\*\/|\/\/[^\n]*/g, ""))) F("+ · CapitulosInversion.tsx sigue montando DrawerCostoMensual");
  if (/export function DrawerCostoMensual\b/.test(leer("src/components/ui/AnalysisDrawer.tsx"))) F("+ · AnalysisDrawer.tsx sigue exportando DrawerCostoMensual: el drawer está retirado");

  if (fallas.length) {
    console.log(`   flujo-ltr ✗ ${fallas.length} falla(s):`);
    for (const f of fallas) console.log(`     - ${f}`);
  } else {
    console.log("   flujo-ltr ✓ (rótulo del mes, serie ÷ meses a diez años, pie por datos, mes vacío como cierre, cableado)");
  }
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runFlujoLtrTier();
  process.exit(hard ? 1 : 0);
}
