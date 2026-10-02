// ============================================================================
// GOLDEN · OBRA-NUEVA (02-oct-2026) — catch-test
// ============================================================================
//   Obra nueva en el motor (decisiones de Fabrizio, ACTAS-obra-nueva.md):
//   1 · SIN CASTIGO POR ESPERAR: la entrega futura no resta puntaje.
//   2 · EL PIE EN CUOTAS EN LA TIR: anual, la primera al firmar, cada una en el año en que se paga; al contado
//       el vector es el de siempre. Las cuotas: de 1 a 60.
//   3 · LAS CUOTAS CON EL DIVIDENDO: el motor emite cuántas caen después de la entrega (entrega futura o inmediata).
//   4 · EL WIZARD: las cuotas en el paso de la entrega, con entrega futura o inmediata; por defecto hasta la
//       entrega (tope 60) o al contado; el payload las lleva.
//   5 · EL ARRIENDO SUGERIDO DE LO NUEVO +3%: en el wizard y en los avisos; el que escribe la persona, no. Y la
//       procedencia lo dice («…, más 3% por ser nuevo») en el wizard y en el informe (marca `premioNuevoPct`).
//   6 · LA FRASE DEL RIESGO: con entrega futura, la línea aprobada después de la portada, sin cifras.
//   7 · LA VERSIÓN DE EVALUACIÓN sube (r3): el cron reevalúa los avisos.
//   8 · LAS CUOTAS SE VEN: si hay cuotas, la portada, el gráfico desde hoy con los tramos («Hasta la entrega»,
//       «Cuota del pie + dividendo», «Después»), «Te queda», «Qué significa» y «Esto es lo que pesa» las muestran.
//
// Verificado EN ROJO por mutación (acta al pie). Corre dentro del QUICK.
// Solo:  node --import tsx scripts/eval/golden/obra-nueva-catch-test.ts
// ============================================================================
import { readFileSync } from "node:fs";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TramosCuotas } from "../../../src/components/analysis/shared/TramosCuotas";
import { join } from "node:path";
import { dimensionesScoreLtr, runAnalysis } from "../../../src/lib/analysis";
import { GOLDEN_SEEDS, GOLDEN_UF, GOLDEN_ASOF } from "./seeds";
import {
  FRASE_RIESGO_ENTREGA, MAX_CUOTAS_PIE, PREMIO_ARRIENDO_NUEVO, arriendoSugeridoObraNueva, cuotasConDividendo, cuotasDelAnio,
  cuotasPieValidas, cuotasPorDefecto, cuotasSeVen, tramosCuotas, fraseCuotasPortada, cierreCuotas, filaPesaCuotas, TE_QUEDA_DESPUES_CUOTAS,
  type PieEnCuotas, type SegCuotas,
} from "../../../src/lib/obra-nueva";
import { cuotasDelWizard } from "../../../src/components/formulario-v4/helpers-wizard";
import { REVISION_EVALUACION } from "../../../src/lib/avisos/evaluar-aviso";
import { fuenteArriendoLine } from "../../../src/components/formulario-v4/derive";
import { respaldoArriendo } from "../../../src/lib/arriendo-referencia";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;
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

  // 8 · LAS CUOTAS SE VEN (02-oct-2026, Fabrizio tras mirar los dos informes): la portada, el gráfico desde hoy
  //     con los tramos con nombre, «Te queda», «Qué significa» y «Esto es lo que pesa».
  {
    const fut = correr({ ...nuevo, estadoVenta: "futura", fechaEntrega: fecha, cuotasPie: 36 }).metrics.pieEnCuotas as PieEnCuotas;
    const inm = correr({ ...nuevo, estadoVenta: "inmediata", fechaEntrega: undefined, cuotasPie: 12 }).metrics.pieEnCuotas as PieEnCuotas;
    if (!fut || (fut.mesesAntesEntrega ?? 0) < 24 || (fut.mesesAntesEntrega ?? 0) > 26 || fut.flujoDespuesCLP == null || (fut.mesesAntesEntrega ?? 0) + fut.mesesConDividendo !== 36) F(`8 · el motor no emite los tramos (antes ${fut?.mesesAntesEntrega}, juntas ${fut?.mesesConDividendo})`);
    if (!inm || inm.mesesAntesEntrega !== 0 || inm.mesesConDividendo !== 11) F("8 · con entrega inmediata hay tramo antes de la entrega");
  }
  const m$ = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
  const texto = (s: SegCuotas[]) => s.map((x) => x.t).join("");
  const nunoa: PieEnCuotas = { cuotas: 12, montoCuotaCLP: 2943637, mesesConDividendo: 11, mesesAntesEntrega: 0, flujoDespuesCLP: -97736 };
  const condes: PieEnCuotas = { cuotas: 36, montoCuotaCLP: 1346314, mesesConDividendo: 9, mesesAntesEntrega: 27, flujoDespuesCLP: 262318 };
  if (cuotasSeVen({ cuotas: 1, montoCuotaCLP: 0, mesesConDividendo: 0 }) || !cuotasSeVen(nunoa) || !cuotasSeVen(condes)) F("8 · cuotasSeVen no distingue al contado");
  {
    const tn = tramosCuotas(nunoa), tc = tramosCuotas(condes);
    if (tn.map((x) => x.nombre).join("|") !== "Cuota del pie + dividendo|Después" || tn[0].valorCLP !== -97736 - 2943637 || tn[0].meses !== 11) F("8 · los tramos con entrega inmediata no son «Cuota del pie + dividendo» y «Después»");
    if (tc.map((x) => x.nombre).join("|") !== "Hasta la entrega|Cuota del pie + dividendo|Después" || tc[0].valorCLP !== -1346314 || tc[0].meses !== 27 || tc[1].valorCLP !== 262318 - 1346314 || tc[2].meses !== null) F("8 · los tramos con entrega futura no son los tres con sus montos y meses");
    const html = renderToStaticMarkup(createElement(TramosCuotas, { tramos: tc, money: m$ }));
    for (const n of ["Hasta la entrega", "Cuota del pie + dividendo", "Después", "27 meses", "9 meses", "−$1.346.314", "+$262.318"]) if (!html.includes(n)) F(`8 · el gráfico no muestra «${n}»`);
    for (const n of ["27 meses", "9 meses", "en adelante"]) if (!html.includes(`<div class="tc-meses">${n}</div>`)) F(`8 · el gráfico no rotula los meses del tramo («${n}»)`);
    for (const n of ["Hasta la entrega", "Cuota del pie + dividendo", "Después"]) if (!html.includes(`<div class="tc-nom">${n}</div>`)) F(`8 · el gráfico no rotula el tramo «${n}»`);
    if ((html.match(/tc-bar neg/g) ?? []).length !== 2 || (html.match(/tc-val neg/g) ?? []).length !== 2 || /<svg|<text/.test(html)) F("8 · el gráfico no pinta en rojo lo que queda bajo el cero (o pone texto en un SVG)");
  }
  if (texto(fraseCuotasPortada(nunoa, m$)) !== "Los primeros 11 meses pones $2.943.637 más; después, pones $97.736 de tu bolsillo al mes.") F(`8 · la portada con entrega inmediata no es la aprobada: «${texto(fraseCuotasPortada(nunoa, m$))}»`);
  if (texto(fraseCuotasPortada(condes, m$)) !== "Hasta la entrega pagas $1.346.314 al mes, sin arriendo; después, 9 meses pones $1.083.996 de tu bolsillo, y luego te quedan $262.318 al mes.") F(`8 · la portada con entrega futura no es la aprobada: «${texto(fraseCuotasPortada(condes, m$))}»`);
  if (texto(cierreCuotas(condes, m$)) !== "Hasta la entrega pagas $1.346.314 al mes, sin arriendo. Durante 9 meses, la cuota del pie se junta con el dividendo: pones $1.083.996 de tu bolsillo cada mes. ") F(`8 · «Qué significa» no suma las cuotas: «${texto(cierreCuotas(condes, m$))}»`);
  if (!fraseCuotasPortada(condes, m$).some((s) => s.monto && s.rojo && s.t === "$1.083.996")) F("8 · lo que sale de tu bolsillo no va en rojo en la portada");
  if (filaPesaCuotas(condes).frase !== "El pie en 36 cuotas: 27 sin arriendo y 9 junto al dividendo" || filaPesaCuotas(nunoa).frase !== "El pie en 12 cuotas: 11 junto al dividendo") F("8 · la fila de «Esto es lo que pesa» no dice los meses de las cuotas");
  const capi = sinComentarios(leer("src/components/analysis/CapitulosInversion.tsx"));
  if (!/const pieCuotas = cuotasSeVen\(m\.pieEnCuotas\) \? m\.pieEnCuotas : null;/.test(capi) || !/\{pieCuotas && \([\s\S]{0,200}<VSub>Lo que queda cada mes, desde hoy<\/VSub>\s*<TramosCuotas tramos=\{tramosCuotas\(pieCuotas\)\} money=\{money\} \/>/.test(capi)) F("8 · el gráfico «Lo que queda cada mes» no parte hoy con los tramos cuando hay cuotas");
  if (!/sub=\{cuotasJuntas \? `\$\{rotulo\.total\} · \$\{TE_QUEDA_DESPUES_CUOTAS\}` : rotulo\.total\}/.test(capi) || TE_QUEDA_DESPUES_CUOTAS !== "después de terminar las cuotas del pie") F("8 · «Te queda» no dice que es después de terminar las cuotas del pie");
  if (!/<VCierre titulo="Qué significa">\s*\{pieCuotas && <span data-obra-nueva="cierre-cuotas">\{pinta\(cierreCuotas\(pieCuotas, money\)/.test(capi)) F("8 · «Qué significa» no suma las cuotas del pie");
  const port = sinComentarios(leer("src/components/analysis/portada/PortadaInforme.tsx"));
  const grid8 = sinComentarios(leer("src/components/analysis/SubjectCardGrid.tsx"));
  if (!/\{cuotas && cuotas\.length > 0 && \(\s*<p className="doc-keyfig doc-keyfig-cuotas" data-obra-nueva="portada-cuotas">/.test(port) || !/s\.monto \? "doc-keyfig-fig" : "doc-keyfig-cap"/.test(port)) F("8 · la portada no dice las cuotas con el mismo peso que el flujo");
  if (!/const cuotasPortada = pieEnCuotas \? fraseCuotasPortada\(pieEnCuotas, moneyCuotas\) : null;/.test(grid8) || !/cuotas=\{cuotasPortada\}/.test(grid8) || !/cuotasSeVen\(results\?\.metrics\?\.pieEnCuotas\)/.test(grid8)) F("8 · la portada no recibe la frase de las cuotas del motor");
  if (!/cuotas=\{filaCuotas\}/.test(grid8) || !/data-obra-nueva="pesa-cuotas"/.test(sinComentarios(leer("src/components/analysis/PrincipalesHallazgos.tsx")))) F("8 · «Esto es lo que pesa» no tiene la línea de las cuotas");

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

  // 5b · la procedencia lo dice: «mediana de N arriendos …, más 3% por ser nuevo», en el wizard y en el informe
  if (!/más 3% por ser nuevo/.test(fuenteArriendoLine("radio", 38, 1500, null, true)) || /por ser nuevo/.test(fuenteArriendoLine("radio", 38, 1500, null, false))) F("5 · la línea de fuente del wizard no dice el +3% de lo nuevo (o lo dice en un usado)");
  {
    const conMarca = respaldoArriendo({ zonaRadio: { arriendoPromedio: 1501740, sampleSizeArriendo: 38, radioMetros: 1500, arriendoFuente: "radio", premioNuevoPct: 3 } }, 1501740);
    const sinMarca = respaldoArriendo({ zonaRadio: { arriendoPromedio: 1458000, sampleSizeArriendo: 38, radioMetros: 1500, arriendoFuente: "radio" } }, 1458000);
    if (!/más 3% por ser nuevo/.test(conMarca.texto) || /por ser nuevo/.test(sinMarca.texto)) F(`5 · el informe no dice que la referencia trae el +3% (${conMarca.texto})`);
  }
  if (!/premioNuevoPct: a\.tipoPropiedad === "nuevo" \? Math\.round\(PREMIO_ARRIENDO_NUEVO \* 100\) : undefined,/.test(pay)) F("5 · el payload no marca que la referencia de lo nuevo trae el +3%");

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
//   Y la procedencia (5b): O21 la fuente del wizard sin el +3% · O22 el respaldo del informe sin el +3% · O23 el
//   payload sin la marca · O24 el resolver la ignora: 4/4 en rojo. Total 24/24.
//   §8 las cuotas se ven (02-oct-2026): T1/T2 el motor sin los tramos · T3 el tramo junto al dividendo sin la cuota ·
//   T4 el gráfico sin rojo · T5 sin los meses del tramo (salió VERDE la primera vez: «27 meses» estaba también en el
//   aria-label; el chequeo pasó a leer el rótulo visible y quedó ROJO) · T6 la curva vieja sin los tramos · T7 «Te
//   queda» sin el aviso · T8 «Qué significa» sin las cuotas · T9/T10 la portada sin la frase o en chico · T11/T12 las
//   frases sin el «después» o sin «hasta la entrega» · T13 sin la fila de «Esto es lo que pesa» · T14 se ven al
//   contado · T15 lo de tu bolsillo sin rojo · T16 el gráfico sin el nombre del tramo: 16/16. La línea chica de §3
//   (O10) se fue con su chequeo: la reemplazan los tramos y el cierre.
