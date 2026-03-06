import type {
  AnalisisInput,
  AnalysisMetrics,
  MonthlyCashflow,
  YearProjection,
  ExitScenario,
  RefinanceScenario,
  SensitivityRow,
  Desglose,
  FullAnalysisResult,
} from "./types";

const UF_CLP = 38800;
const PLUSVALIA_ANUAL = 0.04;
const ARRIENDO_INFLACION = 0.035;
const GGCC_INFLACION = 0.03;
const COMISION_VENTA = 0.02;

// =========================================
// Helpers
// =========================================

function calcDividendo(creditoCLP: number, tasaAnual: number, plazoAnos: number): number {
  if (creditoCLP <= 0) return 0;
  const tasaMensual = tasaAnual / 100 / 12;
  const n = plazoAnos * 12;
  if (tasaMensual === 0) return Math.round(creditoCLP / n);
  return Math.round((creditoCLP * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n)));
}

function saldoCredito(creditoInicial: number, tasaAnual: number, plazoAnos: number, mesActual: number): number {
  const tasaMensual = tasaAnual / 100 / 12;
  const n = plazoAnos * 12;
  if (tasaMensual === 0) return creditoInicial * (1 - mesActual / n);
  const dividendo = (creditoInicial * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n));
  return creditoInicial * Math.pow(1 + tasaMensual, mesActual) -
    dividendo * ((Math.pow(1 + tasaMensual, mesActual) - 1) / tasaMensual);
}

function calcTIR(flujos: number[], guess: number = 0.1): number {
  let rate = guess;
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let i = 0; i < flujos.length; i++) {
      npv += flujos[i] / Math.pow(1 + rate, i);
      dnpv -= (i * flujos[i]) / Math.pow(1 + rate, i + 1);
    }
    if (Math.abs(npv) < 1) break;
    if (dnpv === 0) break;
    rate -= npv / dnpv;
    if (rate < -0.99) rate = -0.5;
    if (rate > 10) rate = 1;
  }
  return rate;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

// =========================================
// Ingreso mensual
// =========================================

function calcPisoAjuste(piso: number): number {
  // Pisos altos get premium on rent, low floors get discount
  if (piso >= 10) return 0.04; // +4%
  if (piso >= 7) return 0.02; // +2%
  if (piso >= 4) return 0; // neutral
  if (piso >= 2) return -0.02; // -2%
  if (piso === 1) return -0.04; // -4% (ground floor)
  return 0;
}

function calcIngresoMensual(input: AnalisisInput): number {
  if (input.tipoRenta === "corta") {
    const ingresoBruto = input.tarifaNoche * 30 * (input.ocupacionPct / 100);
    const comision = ingresoBruto * (input.comisionPlataforma / 100);
    // Assume ~10 stays/month at 3 nights average
    const estadias = (30 * (input.ocupacionPct / 100)) / 3;
    const limpieza = input.costoLimpieza * estadias;
    return Math.round(ingresoBruto - comision - limpieza);
  }

  let arriendo = input.arriendo;

  // Piso adjustment (only if arriendo wasn't already manually adjusted)
  if (input.piso > 0) {
    arriendo = Math.round(arriendo * (1 + calcPisoAjuste(input.piso)));
  }

  return arriendo;
}

// =========================================
// Core Metrics
// =========================================

function calcMetrics(input: AnalisisInput): AnalysisMetrics {
  // Add optional parking price to total
  let precioTotal = input.precio;
  if (input.estacionamiento === "opcional" && input.precioEstacionamiento > 0) {
    precioTotal += input.precioEstacionamiento;
  }

  const precioCLP = precioTotal * UF_CLP;
  const piePct = input.piePct / 100;
  const pieCLP = precioCLP * piePct;
  const creditoCLP = precioCLP * (1 - piePct);
  const dividendo = calcDividendo(creditoCLP, input.tasaInteres, input.plazoCredito);
  const precioM2 = input.superficie > 0 ? precioTotal / input.superficie : 0;

  let ingresoMensual = calcIngresoMensual(input);

  // Add estacionamiento/bodega income premium for renta larga
  if (input.tipoRenta === "larga") {
    const isPremium = COMUNAS_PREMIUM.some((c) => input.comuna.toLowerCase().includes(c));
    if (input.estacionamiento === "si") {
      ingresoMensual += isPremium ? 50000 : 35000;
    }
    if (input.bodega) {
      ingresoMensual += 15000;
    }
  }
  const contribucionesMes = Math.round(input.contribuciones / 3);
  const mantencion = input.provisionMantencion || Math.round((precioCLP * 0.01) / 12);
  const vacanciaMensual = input.tipoRenta === "larga"
    ? Math.round((input.arriendo * input.vacanciaMeses) / 12)
    : 0;
  const corretajeMensual = input.tipoRenta === "larga"
    ? Math.round((input.arriendo * 0.5) / 24)
    : 0;
  const serviciosBasicos = input.tipoRenta === "corta" ? input.serviciosBasicos : 0;

  const egresosMensuales = dividendo + input.gastos + contribucionesMes + mantencion + vacanciaMensual + corretajeMensual + serviciosBasicos;
  const flujoNetoMensual = ingresoMensual - egresosMensuales;

  // NOI = renta - gastos operacionales (sin dividendo)
  const noi = (ingresoMensual - input.gastos - contribucionesMes - mantencion - vacanciaMensual) * 12;

  const rentaAnual = ingresoMensual * 12;
  const gastosAnuales = (input.gastos + contribucionesMes + mantencion + vacanciaMensual + corretajeMensual + serviciosBasicos) * 12;

  const yieldBruto = precioCLP > 0 ? (rentaAnual / precioCLP) * 100 : 0;
  const yieldNeto = precioCLP > 0 ? ((rentaAnual - gastosAnuales) / precioCLP) * 100 : 0;
  const capRate = precioCLP > 0 ? (noi / precioCLP) * 100 : 0;
  const cashOnCash = pieCLP > 0 ? ((flujoNetoMensual * 12) / pieCLP) * 100 : 0;
  const mesesPaybackPie = flujoNetoMensual > 0 ? Math.round(pieCLP / flujoNetoMensual) : 999;

  return {
    yieldBruto: Math.round(yieldBruto * 100) / 100,
    yieldNeto: Math.round(yieldNeto * 100) / 100,
    capRate: Math.round(capRate * 100) / 100,
    cashOnCash: Math.round(cashOnCash * 100) / 100,
    precioM2: Math.round(precioM2 * 10) / 10,
    mesesPaybackPie: mesesPaybackPie,
    dividendo,
    flujoNetoMensual,
    noi,
    pieCLP,
    precioCLP,
    ingresoMensual,
    egresosMensuales,
  };
}

// =========================================
// Cashflow Year 1 (month by month)
// =========================================

function calcCashflowYear1(input: AnalisisInput, metrics: AnalysisMetrics): MonthlyCashflow[] {
  const contribucionesMes = Math.round(input.contribuciones / 3);
  const mantencion = input.provisionMantencion || Math.round((metrics.precioCLP * 0.01) / 12);
  const serviciosBasicos = input.tipoRenta === "corta" ? input.serviciosBasicos : 0;

  // Determine months without income (en blanco/verde: until delivery)
  let mesesSinIngreso = 0;
  if (input.estadoVenta !== "inmediata" && input.fechaEntrega) {
    const [anio, mes] = input.fechaEntrega.split("-").map(Number);
    const now = new Date();
    const entrega = new Date(anio, mes - 1);
    mesesSinIngreso = Math.max(0, Math.round((entrega.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    mesesSinIngreso = Math.min(mesesSinIngreso, 12);
  }

  let acumulado = 0;
  const meses: MonthlyCashflow[] = [];

  for (let i = 1; i <= 12; i++) {
    let ingreso = metrics.ingresoMensual;
    let vacanciaGasto = 0;
    let corretajeGasto = 0;
    let divid = metrics.dividendo;

    if (input.estadoVenta !== "inmediata") {
      // En blanco/verde: no income, no dividendo until delivery, only pie installments
      if (i <= mesesSinIngreso) {
        ingreso = 0;
        divid = 0; // No mortgage yet, paying pie installments
      } else if (i === mesesSinIngreso + 1) {
        ingreso = 0; // First month after delivery = vacancia
      } else if (i === mesesSinIngreso + 2 && input.tipoRenta === "larga") {
        corretajeGasto = Math.round(input.arriendo * 0.5);
      }
    } else {
      // Entrega inmediata
      if (i === 1) {
        ingreso = 0; // Mes 1: vacancia
        vacanciaGasto = 0;
      } else if (i === 2 && input.tipoRenta === "larga") {
        corretajeGasto = Math.round(input.arriendo * 0.5);
      }
    }

    const egresoTotal = divid + input.gastos + contribucionesMes + mantencion + vacanciaGasto + corretajeGasto + serviciosBasicos;
    const flujoNeto = ingreso - egresoTotal;
    acumulado += flujoNeto;

    meses.push({
      mes: i,
      ingreso,
      dividendo: divid,
      gastos: input.gastos,
      contribuciones: contribucionesMes,
      mantencion,
      vacancia: vacanciaGasto,
      corretaje: corretajeGasto,
      serviciosBasicos,
      egresoTotal,
      flujoNeto,
      acumulado,
    });
  }

  return meses;
}

// =========================================
// Multi-year Projections
// =========================================

function calcProjections(input: AnalisisInput, metrics: AnalysisMetrics, maxYears: number = 20): YearProjection[] {
  const precioCLP = input.precio * UF_CLP;
  const creditoCLP = precioCLP * (1 - input.piePct / 100);
  const contribucionesMes = Math.round(input.contribuciones / 3);
  const mantencion = input.provisionMantencion || Math.round((precioCLP * 0.01) / 12);
  const serviciosBasicos = input.tipoRenta === "corta" ? input.serviciosBasicos : 0;

  let arriendoActual = metrics.ingresoMensual;
  let gastosActual = input.gastos;
  let valorPropiedad = precioCLP;
  let flujoAcumulado = 0;

  const projections: YearProjection[] = [];

  for (let anio = 1; anio <= maxYears; anio++) {
    const flujoAnual = (arriendoActual - metrics.dividendo - gastosActual - contribucionesMes - mantencion - serviciosBasicos) * 12;
    flujoAcumulado += flujoAnual;
    valorPropiedad *= (1 + PLUSVALIA_ANUAL);
    const saldo = Math.max(0, saldoCredito(creditoCLP, input.tasaInteres, input.plazoCredito, anio * 12));
    const patrimonioNeto = valorPropiedad - saldo;

    projections.push({
      anio,
      arriendoMensual: Math.round(arriendoActual),
      flujoAnual: Math.round(flujoAnual),
      flujoAcumulado: Math.round(flujoAcumulado),
      valorPropiedad: Math.round(valorPropiedad),
      saldoCredito: Math.round(saldo),
      patrimonioNeto: Math.round(patrimonioNeto),
    });

    arriendoActual *= (1 + ARRIENDO_INFLACION);
    gastosActual *= (1 + GGCC_INFLACION);
  }

  return projections;
}

// =========================================
// Exit Scenario
// =========================================

function calcExitScenario(input: AnalisisInput, metrics: AnalysisMetrics, projections: YearProjection[], anios: number = 10): ExitScenario {
  const proy = projections[anios - 1];
  if (!proy) {
    return { anios, valorVenta: 0, saldoCredito: 0, comisionVenta: 0, gananciaNeta: 0, flujoAcumulado: 0, retornoTotal: 0, multiplicadorCapital: 0, tir: 0 };
  }

  const valorVenta = proy.valorPropiedad;
  const comisionVenta = Math.round(valorVenta * COMISION_VENTA);
  const gananciaNeta = valorVenta - proy.saldoCredito - comisionVenta;
  const retornoTotal = proy.flujoAcumulado + gananciaNeta;
  const multiplicadorCapital = metrics.pieCLP > 0 ? Math.round((retornoTotal / metrics.pieCLP) * 100) / 100 : 0;

  // TIR: initial investment negative, annual cashflows, final year includes sale
  const flujos: number[] = [-metrics.pieCLP];
  for (let i = 0; i < anios; i++) {
    let flujo = projections[i].flujoAnual;
    if (i === anios - 1) {
      flujo += valorVenta - proy.saldoCredito - comisionVenta;
    }
    flujos.push(flujo);
  }
  const tir = Math.round(calcTIR(flujos, 0.1) * 10000) / 100;

  return {
    anios,
    valorVenta: Math.round(valorVenta),
    saldoCredito: Math.round(proy.saldoCredito),
    comisionVenta,
    gananciaNeta: Math.round(gananciaNeta),
    flujoAcumulado: proy.flujoAcumulado,
    retornoTotal: Math.round(retornoTotal),
    multiplicadorCapital,
    tir,
  };
}

// =========================================
// Refinance Scenario
// =========================================

function calcRefinanceScenario(input: AnalisisInput, metrics: AnalysisMetrics, projections: YearProjection[], anios: number = 5): RefinanceScenario {
  const proy = projections[Math.min(anios - 1, projections.length - 1)];
  const nuevoAvaluo = proy.valorPropiedad;
  const nuevoCredito = Math.round(nuevoAvaluo * 0.80);
  const capitalLiberado = nuevoCredito - proy.saldoCredito;
  const nuevoDividendo = calcDividendo(nuevoCredito, input.tasaInteres, input.plazoCredito);
  const contribucionesMes = Math.round(input.contribuciones / 3);
  const mantencion = input.provisionMantencion || Math.round((metrics.precioCLP * 0.01) / 12);
  const nuevoFlujoNeto = proy.arriendoMensual - nuevoDividendo - input.gastos - contribucionesMes - mantencion;

  return {
    nuevoAvaluo: Math.round(nuevoAvaluo),
    nuevoCredito,
    capitalLiberado: Math.round(capitalLiberado),
    nuevoDividendo,
    nuevoFlujoNeto: Math.round(nuevoFlujoNeto),
  };
}

// =========================================
// Sensitivity Analysis
// =========================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function calcSensitivity(input: AnalisisInput, baseScore: number, _baseMetrics: AnalysisMetrics): SensitivityRow[] {
  const rows: SensitivityRow[] = [];

  const variations: { variable: string; field: keyof AnalisisInput; delta: number; label: string }[] = [
    { variable: "Tasa interés", field: "tasaInteres", delta: 1, label: "+1%" },
    { variable: "Tasa interés", field: "tasaInteres", delta: -1, label: "-1%" },
    { variable: "Arriendo", field: "arriendo", delta: 0.10, label: "+10%" },
    { variable: "Arriendo", field: "arriendo", delta: -0.10, label: "-10%" },
    { variable: "Vacancia", field: "vacanciaMeses", delta: 1, label: "+1 mes" },
    { variable: "Vacancia", field: "vacanciaMeses", delta: 2, label: "+2 meses" },
  ];

  for (const v of variations) {
    const modified = { ...input };
    if (v.field === "tasaInteres") {
      (modified as Record<string, unknown>)[v.field] = (input[v.field] as number) + v.delta;
    } else if (v.field === "arriendo" || v.field === "tarifaNoche") {
      (modified as Record<string, unknown>)[v.field] = Math.round((input[v.field] as number) * (1 + v.delta));
    } else if (v.field === "vacanciaMeses") {
      (modified as Record<string, unknown>)[v.field] = (input[v.field] as number) + v.delta;
    }

    const newMetrics = calcMetrics(modified);
    const newScore = calcScoreFromMetrics(modified, newMetrics);

    rows.push({
      variable: v.variable,
      variacion: v.label,
      nuevoScore: newScore,
      nuevoFlujo: newMetrics.flujoNetoMensual,
      delta: newScore - baseScore,
    });
  }

  return rows;
}

// =========================================
// Break-even & Max Purchase
// =========================================

function calcBreakEvenTasa(input: AnalisisInput, currentMetrics: AnalysisMetrics): number {
  // If flow is already negative, search downward to find where flow = 0
  // If flow is positive, search upward
  if (currentMetrics.flujoNetoMensual <= 0) {
    // Already negative: search downward from current rate
    for (let tasa = input.tasaInteres; tasa >= 0; tasa -= 0.05) {
      const modified = { ...input, tasaInteres: tasa };
      const m = calcMetrics(modified);
      if (m.flujoNetoMensual >= 0) return Math.round(tasa * 100) / 100;
    }
    return -1; // Flow is negative even at 0% rate
  } else {
    // Positive: search upward for where flow becomes negative
    for (let tasa = input.tasaInteres; tasa <= 15; tasa += 0.05) {
      const modified = { ...input, tasaInteres: tasa };
      const m = calcMetrics(modified);
      if (m.flujoNetoMensual <= 0) return Math.round(tasa * 100) / 100;
    }
    return 15;
  }
}

function calcValorMaximoCompra(input: AnalisisInput, metrics: AnalysisMetrics): number {
  // NOI / target CAP rate = max property value in CLP, then convert to UF
  const targetCapRate = 0.05; // 5% target
  const noi = metrics.noi;
  if (noi <= 0) return 0;
  const maxCLP = noi / targetCapRate;
  return Math.round(maxCLP / UF_CLP);
}

// =========================================
// InvertiScore Calculation
// =========================================

const COMUNAS_PREMIUM = [
  "providencia", "las condes", "vitacura", "lo barnechea", "ñuñoa",
  "la reina", "santiago centro", "viña del mar", "con con",
];

function lerp(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = (value - inMin) / (inMax - inMin);
  return outMin + clamp(t, 0, 1) * (outMax - outMin);
}

function calcScoreFromMetrics(input: AnalisisInput, metrics: AnalysisMetrics): number {
  // Rentabilidad (30%): based on yield bruto calibrated for Chilean market
  // >6% = 90-100, 5-6% = 70-89, 4-5% = 45-65, 3-4% = 25-44, <3% = 0-24
  let rentabilidad: number;
  const yb = metrics.yieldBruto;
  if (yb >= 6) rentabilidad = lerp(yb, 6, 8, 90, 100);
  else if (yb >= 5) rentabilidad = lerp(yb, 5, 6, 70, 89);
  else if (yb >= 4) rentabilidad = lerp(yb, 4, 5, 45, 65);
  else if (yb >= 3) rentabilidad = lerp(yb, 3, 4, 25, 44);
  else rentabilidad = lerp(yb, 0, 3, 0, 24);
  // Yield neto bonus/penalty
  if (metrics.yieldNeto >= 4) rentabilidad = Math.min(100, rentabilidad + 5);
  else if (metrics.yieldNeto < 2) rentabilidad = Math.max(0, rentabilidad - 5);
  rentabilidad = clamp(rentabilidad, 0, 100);

  // Flujo de caja (25%): calibrated for Chilean market with 80% financing at ~4.72%
  // Positive = 80-100, -0 to -200K = 50-79, -200K to -400K = 25-49, -400K to -600K = 10-24, <-600K = 0-9
  let flujoCaja: number;
  const flujo = metrics.flujoNetoMensual;
  if (flujo >= 0) flujoCaja = lerp(flujo, 0, 200000, 80, 100);
  else if (flujo >= -200000) flujoCaja = lerp(flujo, -200000, 0, 50, 79);
  else if (flujo >= -400000) flujoCaja = lerp(flujo, -400000, -200000, 25, 49);
  else if (flujo >= -600000) flujoCaja = lerp(flujo, -600000, -400000, 10, 24);
  else flujoCaja = lerp(flujo, -1000000, -600000, 0, 9);
  flujoCaja = clamp(flujoCaja, 0, 100);

  // Plusvalía (20%): base depends on premium zone
  const isPremium = COMUNAS_PREMIUM.some((c) => input.comuna.toLowerCase().includes(c));
  let plusvalia = isPremium ? 85 : 55;
  const precioM2 = metrics.precioM2;
  // Premium zones: smaller penalty for high price/m2 (they hold value)
  plusvalia += isPremium ? lerp(precioM2, 30, 120, 10, -10) : lerp(precioM2, 30, 100, 15, -15);
  if (input.enConstruccion || input.antiguedad <= 2) plusvalia += 10;
  else if (input.antiguedad >= 3 && input.antiguedad <= 8) plusvalia += 5;
  else if (input.antiguedad > 20) plusvalia -= 15;
  // Piso bonus for plusvalía
  if (input.piso >= 10) plusvalia += 5;
  else if (input.piso <= 2 && input.piso > 0) plusvalia -= 3;
  plusvalia = clamp(plusvalia, 0, 100);

  // Riesgo (15%): vacancy, age, expense ratio
  let riesgo = 60;
  if (input.tipo.toLowerCase().includes("departamento")) riesgo += 8;
  if (input.antiguedad < 10 || input.enConstruccion) riesgo += 8;
  else if (input.antiguedad > 25) riesgo -= 15;
  if (metrics.capRate > 3) riesgo += 8;
  const ratioGastos = metrics.ingresoMensual > 0 ? input.gastos / metrics.ingresoMensual : 1;
  if (ratioGastos < 0.2) riesgo += 5;
  else if (ratioGastos > 0.35) riesgo -= 10;
  if (input.vacanciaMeses > 2) riesgo -= 10;
  riesgo = clamp(riesgo, 0, 100);

  // Ubicación (10%): premium zones get 90+
  let ubicacion = isPremium ? 92 : 55;
  ubicacion = clamp(ubicacion, 0, 100);

  const score = Math.round(
    rentabilidad * 0.30 +
    flujoCaja * 0.25 +
    plusvalia * 0.20 +
    riesgo * 0.15 +
    ubicacion * 0.10
  );

  return clamp(score, 0, 100);
}

function getClasificacion(score: number): { clasificacion: string; color: string } {
  if (score >= 80) return { clasificacion: "Excelente", color: "green" };
  if (score >= 65) return { clasificacion: "Buena", color: "blue" };
  if (score >= 50) return { clasificacion: "Regular", color: "yellow" };
  if (score >= 30) return { clasificacion: "Débil", color: "orange" };
  return { clasificacion: "Evitar", color: "red" };
}

// =========================================
// Pros & Contras
// =========================================

function generatePros(input: AnalisisInput, metrics: AnalysisMetrics): string[] {
  const pros: string[] = [];
  if (metrics.capRate >= 4) pros.push(`CAP rate neto de ${metrics.capRate.toFixed(1)}%, superior al promedio del mercado`);
  if (metrics.yieldBruto >= 5) pros.push(`Yield bruto de ${metrics.yieldBruto.toFixed(1)}%, por sobre el promedio`);
  if (metrics.flujoNetoMensual > 0) pros.push(`Flujo de caja mensual positivo: $${Math.round(metrics.flujoNetoMensual).toLocaleString("es-CL")}`);
  if (metrics.cashOnCash > 5) pros.push(`Retorno sobre pie (cash-on-cash) de ${metrics.cashOnCash.toFixed(1)}%`);
  if (input.enConstruccion || input.antiguedad <= 2) {
    pros.push("Propiedad nueva, menores costos de mantención");
  } else if (input.antiguedad >= 3 && input.antiguedad <= 8) {
    pros.push("Baja antigüedad reduce riesgos de mantención");
  }
  if (COMUNAS_PREMIUM.some((c) => input.comuna.toLowerCase().includes(c))) pros.push("Ubicación con alta demanda de arriendo");
  if (metrics.precioM2 < 50) pros.push(`Precio por m² (${metrics.precioM2.toFixed(1)} UF) bajo respecto al mercado`);
  if (input.bodega) pros.push("Incluye bodega, valor agregado para arriendo");
  if (input.estacionamiento === "si") pros.push("Incluye estacionamiento, mayor atractivo para arrendatarios");
  if (pros.length === 0) pros.push("Propiedad con características estándar para el mercado");
  return pros;
}

function generateContras(input: AnalisisInput, metrics: AnalysisMetrics): string[] {
  const contras: string[] = [];
  if (metrics.capRate < 3.5) contras.push(`CAP rate neto bajo (${metrics.capRate.toFixed(1)}%), rentabilidad ajustada`);
  if (metrics.flujoNetoMensual < 0) contras.push(`Flujo de caja mensual negativo: -$${Math.round(Math.abs(metrics.flujoNetoMensual)).toLocaleString("es-CL")}`);
  if (input.antiguedad > 15) contras.push(`Antigüedad de ${input.antiguedad} años puede requerir mantención significativa`);
  if (input.gastos > metrics.ingresoMensual * 0.25) contras.push("Gastos comunes representan más del 25% del arriendo");
  if (metrics.cashOnCash < 0) contras.push(`Retorno sobre pie negativo (${metrics.cashOnCash.toFixed(1)}%), se pierde dinero mensualmente`);
  if (input.vacanciaMeses >= 2) contras.push(`Alta vacancia estimada (${input.vacanciaMeses} meses/año) impacta la rentabilidad`);
  if (metrics.precioM2 > 80) contras.push(`Precio por m² elevado (${metrics.precioM2.toFixed(1)} UF), menor potencial de plusvalía`);
  if (contras.length === 0) contras.push("Sin riesgos mayores identificados con los datos ingresados");
  return contras;
}

// =========================================
// Main Analysis Function
// =========================================

export { calcMetrics, calcScoreFromMetrics };

export function runAnalysis(input: AnalisisInput): FullAnalysisResult {
  const metrics = calcMetrics(input);
  const cashflowYear1 = calcCashflowYear1(input, metrics);
  const projections = calcProjections(input, metrics, 20);
  const exitScenario = calcExitScenario(input, metrics, projections, 10);
  const refinanceScenario = calcRefinanceScenario(input, metrics, projections, 5);
  const score = calcScoreFromMetrics(input, metrics);
  const sensitivity = calcSensitivity(input, score, metrics);
  const breakEvenTasa = calcBreakEvenTasa(input, metrics);
  const valorMaximoCompra = calcValorMaximoCompra(input, metrics);
  const { clasificacion, color: clasificacionColor } = getClasificacion(score);
  const pros = generatePros(input, metrics);
  const contras = generateContras(input, metrics);

  // Score breakdown by dimension (mirrors calcScoreFromMetrics)
  const isPremium = COMUNAS_PREMIUM.some((c) => input.comuna.toLowerCase().includes(c));

  const yb = metrics.yieldBruto;
  let rentabilidadScore: number;
  if (yb >= 6) rentabilidadScore = lerp(yb, 6, 8, 90, 100);
  else if (yb >= 5) rentabilidadScore = lerp(yb, 5, 6, 70, 89);
  else if (yb >= 4) rentabilidadScore = lerp(yb, 4, 5, 45, 65);
  else if (yb >= 3) rentabilidadScore = lerp(yb, 3, 4, 25, 44);
  else rentabilidadScore = lerp(yb, 0, 3, 0, 24);
  if (metrics.yieldNeto >= 4) rentabilidadScore = Math.min(100, rentabilidadScore + 5);
  else if (metrics.yieldNeto < 2) rentabilidadScore = Math.max(0, rentabilidadScore - 5);

  const flujoVal = metrics.flujoNetoMensual;
  let flujoCajaScore: number;
  if (flujoVal >= 0) flujoCajaScore = lerp(flujoVal, 0, 200000, 80, 100);
  else if (flujoVal >= -200000) flujoCajaScore = lerp(flujoVal, -200000, 0, 50, 79);
  else if (flujoVal >= -400000) flujoCajaScore = lerp(flujoVal, -400000, -200000, 25, 49);
  else if (flujoVal >= -600000) flujoCajaScore = lerp(flujoVal, -600000, -400000, 10, 24);
  else flujoCajaScore = lerp(flujoVal, -1000000, -600000, 0, 9);

  let plusvaliaScore = isPremium ? 85 : 55;
  plusvaliaScore += isPremium ? lerp(metrics.precioM2, 30, 120, 10, -10) : lerp(metrics.precioM2, 30, 100, 15, -15);
  if (input.enConstruccion || input.antiguedad <= 2) plusvaliaScore += 10;
  else if (input.antiguedad >= 3 && input.antiguedad <= 8) plusvaliaScore += 5;
  else if (input.antiguedad > 20) plusvaliaScore -= 15;
  if (input.piso >= 10) plusvaliaScore += 5;
  else if (input.piso <= 2 && input.piso > 0) plusvaliaScore -= 3;

  let riesgoScore = 60;
  if (input.tipo.toLowerCase().includes("departamento")) riesgoScore += 8;
  if (input.antiguedad < 10 || input.enConstruccion) riesgoScore += 8;
  else if (input.antiguedad > 25) riesgoScore -= 15;
  if (metrics.capRate > 3) riesgoScore += 8;
  const ratioGastos = metrics.ingresoMensual > 0 ? input.gastos / metrics.ingresoMensual : 1;
  if (ratioGastos < 0.2) riesgoScore += 5;
  else if (ratioGastos > 0.35) riesgoScore -= 10;

  const ubicacionScore = isPremium ? 92 : 55;

  const desglose: Desglose = {
    rentabilidad: clamp(rentabilidadScore, 0, 100),
    flujoCaja: clamp(flujoCajaScore, 0, 100),
    plusvalia: clamp(plusvaliaScore, 0, 100),
    riesgo: clamp(riesgoScore, 0, 100),
    ubicacion: clamp(ubicacionScore, 0, 100),
  };

  const resumenEjecutivo = `Inversión ${clasificacion.toLowerCase()} con score ${score}/100. ` +
    `Yield neto ${metrics.yieldNeto.toFixed(1)}%, flujo mensual ${metrics.flujoNetoMensual >= 0 ? "+" : ""}$${Math.round(metrics.flujoNetoMensual).toLocaleString("es-CL")}.`;

  const resumen = `Propiedad con yield bruto de ${metrics.yieldBruto.toFixed(1)}% y CAP rate neto de ${metrics.capRate.toFixed(1)}%. ` +
    `El precio por m² es de ${metrics.precioM2.toFixed(1)} UF/m². ` +
    `${metrics.capRate >= 4 ? "La rentabilidad es atractiva, superando el promedio del mercado chileno." : metrics.capRate >= 3 ? "La rentabilidad es aceptable para el mercado actual." : "La rentabilidad está por debajo del promedio, se recomienda negociar el precio o buscar mejores opciones."} ` +
    `${input.enConstruccion || input.antiguedad <= 2 ? "Propiedad nueva, menores riesgos de mantención." : input.antiguedad <= 8 ? "La baja antigüedad reduce riesgos de mantención." : input.antiguedad > 20 ? "La antigüedad elevada puede implicar costos de mantención adicionales." : "La antigüedad es moderada."} ` +
    `Se recomienda verificar gastos comunes históricos y estado de la administración antes de tomar una decisión.`;

  return {
    score: clamp(score, 0, 100),
    clasificacion,
    clasificacionColor,
    resumenEjecutivo,
    desglose,
    metrics,
    cashflowYear1,
    projections,
    exitScenario,
    refinanceScenario,
    sensitivity,
    breakEvenTasa,
    valorMaximoCompra,
    resumen,
    pros,
    contras,
  };
}
