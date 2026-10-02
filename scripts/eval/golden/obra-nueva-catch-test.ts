// ============================================================================
// GOLDEN · OBRA-NUEVA (02-oct-2026) — catch-test
// ============================================================================
//   Obra nueva en el motor (decisiones de Fabrizio, ACTAS-obra-nueva.md):
//   1 · SIN CASTIGO POR ESPERAR: la entrega futura no resta puntaje.
//   2 · EL PIE EN CUOTAS EN LA TIR: anual, la primera al firmar, cada una en el año en que se paga; al contado
//       el vector es el de siempre. Las cuotas: de 1 a 60.
//   3 · LAS CUOTAS CON EL DIVIDENDO: el motor emite cuántas caen después de la entrega y el capítulo del flujo
//       lo dice («Durante N meses pagas también $X de cuota.»), con entrega futura o inmediata.
//   4 · EL WIZARD: las cuotas en el paso de la entrega, con entrega futura o inmediata; por defecto hasta la
//       entrega (tope 60) o al contado; el payload las lleva.
//   5 · EL ARRIENDO SUGERIDO DE LO NUEVO +3%: en el wizard y en los avisos; el que escribe la persona, no.
//   6 · LA FRASE DEL RIESGO: con entrega futura, la línea aprobada después de la portada, sin cifras.
//   7 · LA VERSIÓN DE EVALUACIÓN sube (r3): el cron reevalúa los avisos.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/obra-nueva-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dimensionesScoreLtr, runAnalysis } from "../../../src/lib/analysis";
import { GOLDEN_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";
import {
  FRASE_RIESGO_ENTREGA, MAX_CUOTAS_PIE, PREMIO_ARRIENDO_NUEVO, arriendoSugeridoObraNueva, cuotasConDividendo, cuotasDelAnio,
  cuotasPieValidas, cuotasPorDefecto, lineaCuotasConDividendo,
} from "../../../src/lib/obra-nueva";
import { cuotasDelWizard } from "../../../src/components/formulario-v4/helpers-wizard";
import { REVISION_EVALUACION } from "../../../src/lib/avisos/evaluar-aviso";

const RAIZ = join(__dirname, "..", "..", "..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");
const sinComentarios = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n]*$/gm, "$1");

function tirDe(r: any): number | null {
  const t = r?.exitScenario?.tir;
  if (typeof t === "number") return t;
  return t && typeof t.valor === "number" ? t.valor : null;
}

export function runObraNuevaTier(): { hard: number } {
  const fallas: string[] = [];
  const F = (m: string) => fallas.push(m);
  console.log("\n─── TIER OBRA-NUEVA (cuotas, sin castigo por esperar, +3% de arriendo · 0 tokens) ───");

  // Un depto de obra nueva sobre la seed GS-1, con entrega a 24 meses del asOf del golden.
  const base: any = { ...GOLDEN_SEEDS.find((s) => s.key === "GS-1")!.input };
  const mediana = GOLDEN_SEEDS.find((s) => s.key === "GS-1")!.mediana;
  const ent = new Date(GOLDEN_ASOF.getFullYear(), GOLDEN_ASOF.getMonth() + 24, 1);
  const fecha = `${ent.getFullYear()}-${String(ent.getMonth() + 1).padStart(2, "0")}`;
  const nuevo = { ...base, esNuevo: true, enConstruccion: true, antiguedad: 0, incluyeCorretajeInicial: false };
  const correr = (x: any) => runAnalysis(x, GOLDEN_UF, mediana, GOLDEN_ASOF) as any;

  // 1 · sin castigo por esperar
  const an = sinComentarios(leer("src/lib/analysis.ts"));
  if (/Math\.round\(mesesEspera \/ 6\)|score -= penalty/.test(an)) F("1 · vuelve el castigo por esperar");
  {
    // El castigo vivía en el puntaje: con las MISMAS métricas y la MISMA TIR, la entrega futura a 24 meses y la
    // inmediata tienen que dar el mismo puntaje.
    const r = correr({ ...nuevo, estadoVenta: "inmediata", cuotasPie: 1 });
    const fut = dimensionesScoreLtr({ ...nuevo, estadoVenta: "futura", fechaEntrega: fecha }, r.metrics, GOLDEN_UF, GOLDEN_ASOF, undefined, 8);
    const inm = dimensionesScoreLtr({ ...nuevo, estadoVenta: "inmediata" }, r.metrics, GOLDEN_UF, GOLDEN_ASOF, undefined, 8);
    if (fut.score !== inm.score) F(`1 · esperar la entrega resta puntaje (${inm.score} → ${fut.score})`);
  }

  // 2 · las cuotas: validación, defecto y reparto por año
  if (MAX_CUOTAS_PIE !== 60) F("2 · el tope de cuotas no es 60");
  if (cuotasPieValidas(0) !== 1 || cuotasPieValidas(61) !== 60 || cuotasPieValidas(2.6) !== 3 || cuotasPieValidas("x") !== 1) F("2 · las cuotas no se acotan a 1–60");
  if (cuotasPorDefecto(true, 26) !== 26 || cuotasPorDefecto(true, 80) !== 60 || cuotasPorDefecto(false, 26) !== 1) F("2 · el defecto no es «hasta la entrega» (tope 60) o «al contado»");
  {
    const n = 30, m = 1000;
    let suma = 0;
    for (let i = 0; i < 10; i++) suma += cuotasDelAnio(i, n, m);
    if (suma !== (n - 1) * m || cuotasDelAnio(0, n, m) !== 12 * m || cuotasDelAnio(2, n, m) !== 5 * m || cuotasDelAnio(3, n, m) !== 0 || cuotasDelAnio(0, 1, m) !== 0) F("2 · las cuotas no caen en el año en que se pagan (la primera al firmar)");
  }
  {
    const contado = correr({ ...nuevo, estadoVenta: "futura", fechaEntrega: fecha, cuotasPie: 1 });
    const legacy = correr({ ...nuevo, estadoVenta: "futura", fechaEntrega: fecha, cuotasPie: 0 });
    const enCuotas = correr({ ...nuevo, estadoVenta: "futura", fechaEntrega: fecha, cuotasPie: 24 });
    const t1 = tirDe(contado), t0 = tirDe(legacy), t2 = tirDe(enCuotas);
    if (t1 == null || t2 == null || t0 == null) F("2 · sin TIR en el caso de prueba");
    else {
      if (Math.abs(t1 - t0) > 1e-9) F(`2 · al contado la TIR no es la de siempre (${t1} vs ${t0})`);
      if (!(t2 > t1 + 0.2)) F(`2 · el pie en 24 cuotas no sube la TIR (${t1.toFixed(2)} → ${t2.toFixed(2)})`);
    }
    if (enCuotas.metrics.pieEnCuotas?.cuotas !== 24) F("2 · el motor no emite las cuotas del pie");
  }
  if (!/cuotasDelAnio\(i, nCuotas, montoCuota\)/.test(an) || !/-\(inversionInicial - \(nCuotas > 1 \? metrics\.pieCLP - montoCuota : 0\)\)/.test(an)) F("2 · la TIR no descuenta las cuotas en su año");

  // 3 · las cuotas con el dividendo
  if (cuotasConDividendo(30, 24) !== 5 || cuotasConDividendo(24, 24) !== 0 || cuotasConDividendo(12, 0) !== 11 || cuotasConDividendo(1, 0) !== 0) F("3 · no se cuentan bien las cuotas que caen con el dividendo");
  {
    const fut = correr({ ...nuevo, estadoVenta: "futura", fechaEntrega: fecha, cuotasPie: 30 });
    const inm = correr({ ...nuevo, estadoVenta: "inmediata", fechaEntrega: undefined, cuotasPie: 12 });
    if (fut.metrics.pieEnCuotas?.mesesConDividendo !== 30 - 1 - 24 && fut.metrics.pieEnCuotas?.mesesConDividendo !== 30 - 1 - 23 && fut.metrics.pieEnCuotas?.mesesConDividendo !== 30 - 1 - 25) F(`3 · con entrega a 24 meses y 30 cuotas no caen ~5 con el dividendo (${fut.metrics.pieEnCuotas?.mesesConDividendo})`);
    if (inm.metrics.pieEnCuotas?.mesesConDividendo !== 11) F(`3 · con entrega inmediata y 12 cuotas no caen 11 con el dividendo (${inm.metrics.pieEnCuotas?.mesesConDividendo})`);
    const contado = correr({ ...nuevo, estadoVenta: "inmediata", fechaEntrega: undefined, cuotasPie: 1 });
    if (contado.metrics.pieEnCuotas) F("3 · al contado el motor dice que hay cuotas");
  }
  if (lineaCuotasConDividendo(22, "$698.750") !== "Durante 22 meses pagas también $698.750 de cuota." || lineaCuotasConDividendo(1, "$1") !== "Durante 1 mes pagas también $1 de cuota.") F("3 · la línea del flujo no es la aprobada");
  const cap = sinComentarios(leer("src/components/analysis/CapitulosInversion.tsx"));
  if (!/\{m\.pieEnCuotas && m\.pieEnCuotas\.mesesConDividendo > 0 && \(\s*<p className="doc-reparto" data-obra-nueva="cuotas-con-dividendo">\s*\{lineaCuotasConDividendo\(m\.pieEnCuotas\.mesesConDividendo, money\(m\.pieEnCuotas\.montoCuotaCLP\)\)\}/.test(cap)) F("3 · el capítulo del flujo no dice las cuotas que corren con el dividendo (o no las lee del motor)");

  // 4 · el wizard
  if (cuotasDelWizard({ estadoVenta: "inmediata" }) !== 1) F("4 · con entrega inmediata el defecto no es al contado");
  if (cuotasDelWizard({ estadoVenta: "futura", cuotasPie: "48" }) !== 48 || cuotasDelWizard({ estadoVenta: "inmediata", cuotasPie: "12" }) !== 12 || cuotasDelWizard({ estadoVenta: "futura", cuotasPie: "99" }) !== 60) F("4 · la respuesta de cuotas no manda (o no se acota)");
  const hoy = new Date();
  const enDos = new Date(hoy.getFullYear(), hoy.getMonth() + 26, 1);
  const dw = cuotasDelWizard({ estadoVenta: "futura", fechaEntregaMes: String(enDos.getMonth() + 1), fechaEntregaAnio: String(enDos.getFullYear()) });
  if (dw < 24 || dw > 27) F(`4 · con entrega futura el defecto no es hasta la entrega (${dw})`);
  const pant = sinComentarios(leer("src/components/formulario-v4/screensActo1.tsx"));
  if (!/\{\(futura \|\| estado === "inmediata"\) && \(\s*<div className="wz-campo wz-cuotas" data-wz="cuotas-pie">/.test(pant)) F("4 · las cuotas no se preguntan con entrega futura e inmediata en el paso de la entrega");
  if (!/disabled=\{cuotas >= MAX_CUOTAS_PIE\}/.test(pant) || !/cuotas <= 1 \? "Al contado"/.test(pant) || !/¿En cuántas cuotas pagas el pie\?/.test(pant)) F("4 · el stepper no va de «Al contado» a 60");
  const pay = sinComentarios(leer("src/components/formulario-v4/wizardV4Payload.ts"));
  if (!/const cuotasPie = a\.tipoPropiedad === "nuevo" \? cuotasDelWizard\(a\) : 0;/.test(pay)) F("4 · el payload no lleva las cuotas elegidas");

  // 5 · el arriendo sugerido de lo nuevo
  if (PREMIO_ARRIENDO_NUEVO !== 0.03) F("5 · el premio de arriendo de lo nuevo no es 3%");
  if (arriendoSugeridoObraNueva(500000, "nuevo") !== 515000 || arriendoSugeridoObraNueva(500000, "usado") !== 500000 || arriendoSugeridoObraNueva(null, "nuevo") !== null || arriendoSugeridoObraNueva(500000, null) !== 500000) F("5 · el +3% no es solo de lo nuevo");
  const data = sinComentarios(leer("src/components/formulario-v4/useWizardV4Data.ts"));
  if (!/setArriendoSugerido\(typeof arr\?\.arriendo === "number" \? arriendoSugeridoObraNueva\(arr\.arriendo, tipoPropiedad\) : null\)/.test(data)) F("5 · el wizard no sube el sugerido de lo nuevo");
  if (/arriendoSugeridoObraNueva/.test(pay) || !/arriendo: leerNum\(a\.arriendo, DEC\.arriendo\) \|\| ctx\.arriendoSugerido \|\| 0,/.test(pay)) F("5 · el +3% toca el arriendo que escribe la persona");
  if (!/monto: arriendoSugeridoObraNueva\(seg \? seg\.monto : arr\.arriendo, a\.condicion\) \?\? 0,/.test(sinComentarios(leer("src/lib/avisos/evaluar-aviso.ts")))) F("5 · los avisos nuevos no se evalúan con el +3%");

  // 6 · la frase del riesgo
  if (FRASE_RIESGO_ENTREGA !== "Tu crédito se firma en la entrega: si la tasa sube en la espera, estos números cambian.") F("6 · la frase del riesgo no es la aprobada");
  if (/\d/.test(FRASE_RIESGO_ENTREGA)) F("6 · la frase del riesgo lleva cifras");
  const grid = sinComentarios(leer("src/components/analysis/SubjectCardGrid.tsx"));
  if (!/\{results\?\.metrics\?\.preEntrega && \(\s*<SeccionInforme id="riesgo-entrega" tono="paper">\s*<p data-obra-nueva="riesgo-entrega"[^>]*>\s*\{FRASE_RIESGO_ENTREGA\}/.test(grid)) F("6 · el informe con entrega futura no dice la frase del riesgo después de la portada");
  {
    const fut = correr({ ...nuevo, estadoVenta: "futura", fechaEntrega: fecha, cuotasPie: 24 });
    const inm = correr({ ...nuevo, estadoVenta: "inmediata", fechaEntrega: undefined, cuotasPie: 12 });
    if (!fut.metrics.preEntrega || inm.metrics.preEntrega) F("6 · la condición de la frase (preEntrega) no sigue a la entrega futura");
  }

  // 7 · la versión de evaluación
  if (REVISION_EVALUACION !== "r3") F("7 · la versión de evaluación de los avisos no subió: el cron no reevalúa");

  if (fallas.length === 0) console.log("  ✓ OBRA-NUEVA: sin castigo por esperar, cuotas 1–60 en la TIR y en el flujo, el wizard las pregunta con entrega futura e inmediata, +3% solo en el sugerido de lo nuevo, la frase del riesgo y la versión r3");
  for (const f of fallas) console.log(`  ✗ ${f}`);
  return { hard: fallas.length };
}

if (require.main === module) {
  const { hard } = runObraNuevaTier();
  process.exit(hard > 0 ? 1 : 0);
}

// ─── ACTA · verificado EN ROJO por mutación (02-oct-2026) ────────────────────
//   O1 vuelve el castigo · O2 tope 48 · O3 cuotas sin acotar · O4 defecto futura al contado · O5 las cuotas
//   todas al firmar · O6 el pie entero en t0 (doble cuenta) · O7 la cuota del mes 0 en el año 1 · O8 las cuotas
//   con dividendo sin restar la entrega · O9 el motor sin `pieEnCuotas` · O10 el capítulo sin la línea · O11 las
//   cuotas solo con entrega futura · O12 el payload ignora la respuesta · O13 premio 5% · O14 premio a usados ·
//   O15 premio al arriendo escrito · O16 el wizard sin premio · O17 los avisos sin premio · O18 la frase con
//   cifras · O19 el informe sin la frase · O20 la versión sin subir: 20/20 en rojo, restauradas byte a byte.
