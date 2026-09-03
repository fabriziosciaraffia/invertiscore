// Backtest del reel 2: la misma plata puesta en 2015 en tres destinos, hasta 2025.
//
//   node --import tsx scripts/data/backtest-reel2.ts
//
// Caso: depto 1D1B de 40 m² en la comuna de Santiago, comprado el 1-ene-2015 al
// promedio GfK del año (52,8 UF/m²), pie 20% + gastos de cierre según el motor,
// crédito en UF. Contra: (2) Fondo A (cuota Habitat, SP) y (3) depósito reajustable
// (TIP BCCh), recibiendo la MISMA plata: el aporte inicial y cada peso extra que el
// dueño del depto tuvo que poner cuando el flujo fue negativo.
//
// TODO EN UF — regla registrada: jamás mezclar nominal y real. El motor corre en
// "micro-UF" (ufClp = 1e6): el precio entra en UF y cada "peso" del motor vale
// 1e-6 UF, así que sus redondeos a entero quedan en el sexto decimal. La cuota del
// Fondo A (CLP nominal) se convierte a UF con la UF oficial SII de la misma fecha.
//
// El backtest LLAMA las funciones reales del motor — calcFlujoDesglose,
// getMantencionRate, calcProjections (para el saldo del crédito), calcExitScenario
// (liquidación con comisión de venta y la misma aritmética del informe) y runAnalysis
// (inversión inicial con gastos de cierre). No reimplementa ninguna fórmula.

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import {
  calcFlujoDesglose,
  calcExitScenario,
  calcProjections,
  runAnalysis,
} from "../../src/lib/analysis";
// Backtest histórico (reel 2): conserva la tabla legacy a propósito — reproduce
// la aritmética con la que se corrió; no es un consumidor del modelo vigente.
import { getMantencionRateLegacy as getMantencionRate } from "../../src/lib/modelo-costos";
import { calcIRR } from "../../src/lib/finance/irr";
import type { AnalisisInput, YearProjection } from "../../src/lib/types";
import { GFK_SERIE, PLUSVALIA_ESTIMADO_2025 } from "../../src/lib/plusvalia-estimado.gen";

const DIR = __dirname;
const SALIDA = join(DIR, "../../tools/reels/data/dataset-backtest-2015-2025.json");

// ─── Parámetros del caso ─────────────────────────────────────────────────────

/** 1e6: el motor corre en micro-UF. */
const UF_CLP = 1e6;
/** Promedio GfK comuna Santiago 2015 — coincide con GFK_SERIE por construcción. */
const UFM2_COMPRA = 52.8;
/**
 * Capital redondo de la serie de reels: el caso se diseña desde el capital (500 UF de
 * bolsillo) hacia el depto, no al revés. Precio 2.000 UF con pie 20% = 400; el aporte
 * inicial REAL que arroja el motor (pie + cierre + puesta a punto) es 496,82 UF — se
 * declara aparte y NO se fuerza a 500 (decisión de Fabrizio, lectura 1: las tres
 * carreras corren con 496,82 exactas y el hook redondea honesto hacia arriba).
 */
const CAPITAL_REDONDO_UF = 500;
const PRECIO_UF = 2000;
/** La superficie RESULTA del ancla de precio: 2.000 / 52,8 ≈ 37,9 m² (1D1B mediano). */
const M2 = PRECIO_UF / UFM2_COMPRA;
const PIE_PCT = 20;

/**
 * Tasa promedio 2015 de colocación vivienda reajustable en UF, BCCh (cuadro T5224).
 * Verificada 28-ago-2026 contra BDE BCCh (vistazo manual de Fabrizio).
 */
const TASA_HIPOTECARIA_2015_UF = 3.68;

/** SUPUESTOS DEL CASO — no vienen de fuente, están declarados para ajustarse. */
const PLAZO_CREDITO_ANOS = 25;
const GGCC_UF_MES = 2.0;
const CONTRIBUCIONES_UF_TRIM = 1.2;
const ANTIGUEDAD_COMPRA = 5;

const ANIOS = Array.from({ length: 11 }, (_, i) => 2015 + i);

// ─── Insumos ─────────────────────────────────────────────────────────────────

type FilaInsumo = { serie: string; clave: string; fecha: string; valor: number };

function leerCsv(nombre: string): string[][] {
  return readFileSync(join(DIR, nombre), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(","));
}

const insumos: FilaInsumo[] = leerCsv("backtest-insumos-oficiales.csv")
  .slice(1)
  .map(([serie, clave, fecha, valor]) => ({ serie, clave, fecha, valor: Number(valor) }));

const cuotaMes = (afp: string, anio: number, mes: number): number => {
  const pref = `${anio}-${String(mes).padStart(2, "0")}`;
  const f = insumos.find((i) => i.serie === "cuota" && i.clave === afp && i.fecha.startsWith(pref));
  if (!f) throw new Error(`sin cuota ${afp} ${pref}`);
  return f.valor;
};
const ufMes = (anio: number, mes: number): number => {
  const pref = `${anio}-${String(mes).padStart(2, "0")}`;
  const f = insumos.find((i) => i.serie === "uf_mes" && i.fecha.startsWith(pref));
  if (!f) throw new Error(`sin UF mensual ${pref}`);
  return f.valor;
};
const cuotaDic = (afp: string, anio: number): number => {
  const f = insumos.find((i) => i.serie === "cuota" && i.clave === afp && i.fecha.startsWith(`${anio}-12`));
  if (!f) throw new Error(`sin cuota ${afp} dic-${anio}`);
  return f.valor;
};
const ufDic = (anio: number): number => {
  const f = insumos.find((i) => i.serie === "uf_dic" && i.fecha.startsWith(`${anio}`));
  if (!f) throw new Error(`sin UF dic-${anio}`);
  return f.valor;
};
const tasaDeposito = (anio: number): number => {
  const f = insumos.find((i) => i.serie === "deposito" && i.fecha === String(anio));
  if (!f) throw new Error(`sin tasa depósito ${anio}`);
  return f.valor / 100;
};

// Arriendo y vacancia del CSV candidato (Fase 0.5, OK de Fabrizio), con GUARDA: los
// valores aprobados van acá rotulados; si el CSV cambió, el backtest revienta en vez
// de correr sobre una serie distinta de la decidida.
const ARRIENDO_APROBADO: Record<number, number> = {
  2015: 0.276, 2016: 0.279, 2017: 0.285, 2018: 0.29, 2019: 0.295, 2020: 0.26,
  2021: 0.249, 2022: 0.287, 2023: 0.283, 2024: 0.266, 2025: 0.265,
};
const VACANCIA_APROBADA: Record<number, number> = {
  2015: 4.5, 2016: 4.5, 2017: 4.5, 2018: 4.5, 2019: 4.5, 2020: 5.0,
  2021: 3.5, 2022: 2.0, 2023: 2.0, 2024: 2.0, 2025: 2.0,
};

const candidato = leerCsv("backtest-arriendo-vacancia.candidato.csv").slice(1);
for (const anio of ANIOS) {
  const arr = candidato.find((r) => r[0] === "arriendo_comuna_stgo" && Number(r[1]) === anio);
  const vac = candidato.find((r) => r[0] === "vacancia" && Number(r[1]) === anio);
  if (!arr || !vac) throw new Error(`CSV candidato: falta ${anio}`);
  if (Number(arr[2]) !== ARRIENDO_APROBADO[anio]) {
    throw new Error(`arriendo ${anio}: CSV=${arr[2]} ≠ aprobado=${ARRIENDO_APROBADO[anio]} — la serie cambió respecto de la decisión de Fase 0.5`);
  }
  if (Number(vac[2]) !== VACANCIA_APROBADA[anio]) {
    throw new Error(`vacancia ${anio}: CSV=${vac[2]} ≠ aprobada=${VACANCIA_APROBADA[anio]}`);
  }
}

// Valor de mercado del depto: serie GfK REAL de la comuna (la misma del producto),
// no una tasa de plusvalía proyectada. Valor al cierre del año Y = promedio GfK del
// año Y; el año de compra vale lo que se pagó.
const serieUfM2: Record<number, number> = {};
{
  const s = GFK_SERIE["Santiago"];
  s.valores.forEach((v, i) => { serieUfM2[s.desde + i] = v; });
  serieUfM2[2025] = PLUSVALIA_ESTIMADO_2025["Santiago"].ufM2;
  if (serieUfM2[2015] !== UFM2_COMPRA) {
    throw new Error(`GfK Santiago 2015 = ${serieUfM2[2015]} ≠ ancla de compra ${UFM2_COMPRA}`);
  }
}

// ─── Motor: caso, métricas y saldo del crédito ───────────────────────────────

const ASOF = new Date(2015, 0, 1);

const input: AnalisisInput = {
  nombre: "Backtest reel 2 — Santiago 2015", comuna: "Santiago", ciudad: "Santiago",
  tipo: "departamento", dormitorios: 1, banos: 1, superficie: M2, superficieTotal: M2,
  antiguedad: ANTIGUEDAD_COMPRA, enConstruccion: false, piso: 5,
  estacionamiento: "no", precioEstacionamiento: 0, bodega: false,
  estadoVenta: "inmediata", cuotasPie: 0, montoCuota: 0,
  precio: PRECIO_UF, piePct: PIE_PCT, plazoCredito: PLAZO_CREDITO_ANOS,
  tasaInteres: TASA_HIPOTECARIA_2015_UF,
  gastos: GGCC_UF_MES * UF_CLP, contribuciones: CONTRIBUCIONES_UF_TRIM * UF_CLP,
  provisionMantencion: 0, tipoRenta: "larga",
  arriendo: Math.round(ARRIENDO_APROBADO[2015] * M2 * UF_CLP),
  arriendoEstacionamiento: 0, arriendoBodega: 0,
  vacanciaMeses: (VACANCIA_APROBADA[2015] * 12) / 100,
} as AnalisisInput;

const resultado = runAnalysis(input, UF_CLP, undefined, ASOF);
const metrics = resultado.metrics;

// Saldo del crédito por el motor. GUARDA pedida por Fabrizio: el saldo no puede
// depender de la plusvalía — se corre calcProjections con dos tasas distintas y se
// exige identidad. Si divergen, el truco dejó de ser válido y esto revienta.
const proyA = calcProjections({ input, metrics, ufClp: UF_CLP, asOf: ASOF, plazoVenta: 11, plusvaliaAnual: 0.03 });
const proyB = calcProjections({ input, metrics, ufClp: UF_CLP, asOf: ASOF, plazoVenta: 11, plusvaliaAnual: 0.07 });
for (let i = 0; i < 11; i++) {
  if (proyA[i].saldoCredito !== proyB[i].saldoCredito) {
    throw new Error(`saldoCredito año ${i + 1} depende de la plusvalía (${proyA[i].saldoCredito} ≠ ${proyB[i].saldoCredito}) — el supuesto del backtest se rompió`);
  }
}

// ─── El caso como función de los supuestos discutibles (GGCC y contribuciones) ──
// El caso principal usa los valores declarados arriba; la mini-sensibilidad corre la
// MISMA maquinaria con otros supuestos y reporta solo el año del cruce. La regla de
// "misma plata" se respeta dentro de cada celda: si el flujo cambia, cambian también
// los aportes que reciben el fondo y el depósito.

// Pie + gastos de cierre + CapEx puesta a punto, exactamente como lo cuenta el motor
// (el mismo `inversionInicial` que usa el exit del informe). No depende de GGCC.
const aporteInicialUF = resultado.exitScenario.inversionInicial / UF_CLP;

type Carrera = {
  proyecciones: YearProjection[];
  flujosAnualesUF: number[];
  aportesUF: Record<number, number>;
  deptoUF: number[];
  fondoHabitatUF: number[];
  fondoCuprumUF: number[];
  depositoUF: number[];
  cruce: number | null;
};

function correrCaso(ggccUfMes: number, contribucionesUfTrim: number): Carrera {
  const proyecciones: YearProjection[] = [];
  const flujosAnualesUF: number[] = [];
  let flujoAcumulado = 0;

  ANIOS.forEach((anio, idx) => {
    const n = idx + 1;
    const arriendoMes = Math.round(ARRIENDO_APROBADO[anio] * M2 * UF_CLP);
    const vacanciaMeses = (VACANCIA_APROBADA[anio] * 12) / 100;
    // Mantención por el motor. Convención de calcProjections: en el año n el inmueble
    // ya cumplió antiguedad + n (el año 1 de un depto de 5 años se mantiene como uno
    // de 6 — cruza la banda 0,5% → 0,8%).
    const mantencion = Math.round((PRECIO_UF * UF_CLP * getMantencionRate(ANTIGUEDAD_COMPRA + n)) / 12);
    const flujoMes = calcFlujoDesglose({
      arriendo: arriendoMes,
      // En UF el dividendo es constante — no se aplica INFLACION_UF, que es nominal.
      dividendo: metrics.dividendo,
      ggcc: Math.round(ggccUfMes * UF_CLP),
      contribuciones: Math.round(contribucionesUfTrim * UF_CLP),
      mantencion,
      vacanciaMeses,
      usaAdministrador: false,
    });
    const flujoAnual = flujoMes.flujoNeto * 12;
    flujoAcumulado += flujoAnual;
    flujosAnualesUF.push(flujoAnual / UF_CLP);
    const valorPropiedad = Math.round(serieUfM2[anio] * M2 * UF_CLP);
    const saldoCredito = proyA[idx].saldoCredito;
    proyecciones.push({
      anio: n,
      arriendoMensual: arriendoMes,
      flujoAnual: Math.round(flujoAnual),
      flujoAcumulado: Math.round(flujoAcumulado),
      valorPropiedad,
      saldoCredito,
      patrimonioNeto: valorPropiedad - saldoCredito,
    });
  });

  // Carrera 1: depto, liquidación por el motor año a año.
  const deptoUF = ANIOS.map((_, idx) => calcExitScenario(input, metrics, proyecciones, idx + 1).retornoTotal / UF_CLP);

  // Aportes extra: cada año con flujo negativo, el dueño puso la diferencia.
  const aportesUF: Record<number, number> = {};
  ANIOS.forEach((anio, idx) => {
    aportesUF[anio] = flujosAnualesUF[idx] < 0 ? -flujosAnualesUF[idx] : 0;
  });

  // Carrera 2: Fondo A. El aporte extra de un año con flujo negativo ocurre MES A MES
  // (es el déficit mensual del dueño), así que cada doceavo compra cuota al valor del
  // fin de ese mes, convertido a UF con la UF de la misma fecha. Para eso se capturó
  // la serie mensual. El aporte inicial va a cuota del 31-dic-2014 (compra 1-ene-2015).
  const carreraFondo = (afp: string): number[] => {
    const cuotaUFDic = (anio: number) => cuotaDic(afp, anio) / ufDic(anio);
    let unidades = aporteInicialUF / cuotaUFDic(2014);
    const serie: number[] = [];
    ANIOS.forEach((anio, idx) => {
      const deficitMensualUF = flujosAnualesUF[idx] < 0 ? -flujosAnualesUF[idx] / 12 : 0;
      if (deficitMensualUF > 0) {
        for (let mes = 1; mes <= 12; mes++) {
          const cuotaUF = cuotaMes(afp, anio, mes) / ufMes(anio, mes);
          unidades += deficitMensualUF / cuotaUF;
        }
      }
      serie.push(unidades * cuotaUFDic(anio));
    });
    return serie;
  };
  const fondoHabitatUF = carreraFondo("HABITAT");
  const fondoCuprumUF = carreraFondo("CUPRUM");

  // Carrera 3: depósito UF, renovación anual a la tasa BCCh del año. El aporte del
  // año entra al cierre (un depósito no recibe doceavos a mitad de renovación sin
  // partir el instrumento; simplificación declarada, conservadora contra el depósito).
  const depositoUF: number[] = [];
  let w = aporteInicialUF;
  for (const anio of ANIOS) {
    w = w * (1 + tasaDeposito(anio)) + aportesUF[anio];
    depositoUF.push(w);
  }

  const cruce = ANIOS.find((_, i) => deptoUF[i] >= fondoHabitatUF[i]) ?? null;
  return { proyecciones, flujosAnualesUF, aportesUF, deptoUF, fondoHabitatUF, fondoCuprumUF, depositoUF, cruce };
}

// Caso principal: los supuestos declarados.
const caso = correrCaso(GGCC_UF_MES, CONTRIBUCIONES_UF_TRIM);
const { proyecciones, aportesUF, deptoUF, fondoHabitatUF, fondoCuprumUF, depositoUF } = caso;

// Verificación de coherencia contra el flujo normal del producto: el año 1 del
// backtest usa el mismo arriendo/vacancia que el input, así que el flujo anual debe
// coincidir con el que calcProjections (la ruta del informe) produce para el año 1.
const flujoInforme = proyA[0].flujoAnual;
const flujoBacktest = proyecciones[0].flujoAnual;
const divergenciaAno1 = Math.abs(flujoInforme - flujoBacktest) / UF_CLP;
if (divergenciaAno1 > 0.01) {
  throw new Error(`coherencia año 1: informe=${flujoInforme / UF_CLP} UF ≠ backtest=${flujoBacktest / UF_CLP} UF`);
}

// Mini-sensibilidad del año del cruce: GGCC × contribuciones, solo el cruce por celda.
const GRILLA_GGCC = [1.5, 2.0, 2.5];
const GRILLA_CONTRIB = [0.6, 1.2];
const sensibilidadCruce = GRILLA_GGCC.map((g) =>
  GRILLA_CONTRIB.map((c) => ({ ggcc: g, contrib: c, cruce: correrCaso(g, c).cruce })),
).flat();

// ─── Series mensuales (para la animación del reel) ──────────────────────────
//
// La MISMA aritmética validada de las carreras, muestreada al fin de cada mes. El
// depto NO lleva serie mensual: no existe el dato (GfK es anual) y la suavización es
// visual, se hace en el reel.

const MESES = ANIOS.flatMap((anio) => Array.from({ length: 12 }, (_, m) => ({ anio, mes: m + 1 })));
const etiquetaMes = (x: { anio: number; mes: number }) => `${x.anio}-${String(x.mes).padStart(2, "0")}`;

// Fondo A mensual: unidades acumuladas con los mismos dozavos del backtest anual,
// valuadas a la cuota UF del fin de cada mes.
function fondoMensual(afp: string): number[] {
  const cuotaUFDicBase = cuotaDic(afp, 2014) / ufDic(2014);
  let unidades = aporteInicialUF / cuotaUFDicBase;
  return MESES.map(({ anio, mes }) => {
    const idx = anio - 2015;
    const deficitMensualUF = caso.flujosAnualesUF[idx] < 0 ? -caso.flujosAnualesUF[idx] / 12 : 0;
    const cuotaUF = cuotaMes(afp, anio, mes) / ufMes(anio, mes);
    unidades += deficitMensualUF / cuotaUF;
    return unidades * cuotaUF;
  });
}
const fondoAMensual = fondoMensual("HABITAT");

// Depósito mensual: la tasa anual del año en curso capitaliza como equivalente
// mensual compuesto; el aporte del año entra al cierre, igual que en el anual.
const depositoMensual: number[] = [];
{
  let w = aporteInicialUF;
  for (const { anio, mes } of MESES) {
    w *= Math.pow(1 + tasaDeposito(anio), 1 / 12);
    if (mes === 12) w += aportesUF[anio];
    depositoMensual.push(w);
  }
}

// GUARDA diciembre-vs-anual: el muestreo mensual no puede contar otra historia que la
// serie anual ya publicada. Fondo A comparte hasta el orden de las sumas => exige 0
// (tolerancia de punto flotante); el depósito compone por mes => tolera 0,1 UF.
ANIOS.forEach((anio, i) => {
  const iDic = i * 12 + 11;
  const dFondo = Math.abs(fondoAMensual[iDic] - fondoHabitatUF[i]);
  if (dFondo > 1e-6) {
    throw new Error(`serie mensual Fondo A ${anio}: dic=${fondoAMensual[iDic]} ≠ anual=${fondoHabitatUF[i]} (Δ ${dFondo} UF)`);
  }
  const dDep = Math.abs(depositoMensual[iDic] - depositoUF[i]);
  if (dDep > 0.1) {
    throw new Error(`serie mensual depósito ${anio}: dic=${depositoMensual[iDic]} ≠ anual=${depositoUF[i]} (Δ ${dDep.toFixed(4)} UF)`);
  }
});

// ─── Reel 2 final: depto sin crédito, TIR y ganancia neta ───
//
// CONTRAFACTUAL ILUSTRATIVO, no carrera real: las mismas 496,82 UF compran AL CONTADO
// una fracción del mismo depto (misma plusvalía GfK, mismos arriendos, gastos y
// vacancia, misma liquidación por el motor), prorrateada para que ambas líneas partan
// del mismo punto. Nadie compra un cuarto de depto — la línea existe para aislar el
// efecto del crédito, y así se declara en meta.

const inputSinCredito: AnalisisInput = { ...input, piePct: 100 };
const resSC = runAnalysis(inputSinCredito, UF_CLP, undefined, ASOF);
const metricsSC = resSC.metrics;
if (metricsSC.dividendo !== 0) {
  throw new Error(`sin crédito con dividendo ${metricsSC.dividendo} — pie 100% no está siendo contado`);
}
// Fracción del inmueble que el capital compra al contado, con los MISMOS costos
// proporcionales del motor (precio + cierre + puesta a punto).
const inversionContadoFullUF = resSC.exitScenario.inversionInicial / UF_CLP;
const FRACCION_CONTADO = aporteInicialUF / inversionContadoFullUF;

// Proyecciones del depto completo sin crédito: mismo valor GfK, flujo sin dividendo.
const proyeccionesSC: YearProjection[] = [];
const flujosAnualesSCUF: number[] = [];
{
  let acum = 0;
  ANIOS.forEach((anio, idx) => {
    const n = idx + 1;
    const arriendoMes = Math.round(ARRIENDO_APROBADO[anio] * M2 * UF_CLP);
    const vacanciaMeses = (VACANCIA_APROBADA[anio] * 12) / 100;
    const mantencion = Math.round((PRECIO_UF * UF_CLP * getMantencionRate(ANTIGUEDAD_COMPRA + n)) / 12);
    const flujoMes = calcFlujoDesglose({
      arriendo: arriendoMes,
      dividendo: metricsSC.dividendo, // 0, verificado arriba
      ggcc: input.gastos,
      contribuciones: input.contribuciones,
      mantencion,
      vacanciaMeses,
      usaAdministrador: false,
    });
    const flujoAnual = flujoMes.flujoNeto * 12;
    acum += flujoAnual;
    flujosAnualesSCUF.push(flujoAnual / UF_CLP);
    const valorPropiedad = Math.round(serieUfM2[anio] * M2 * UF_CLP);
    proyeccionesSC.push({
      anio: n,
      arriendoMensual: arriendoMes,
      flujoAnual: Math.round(flujoAnual),
      flujoAcumulado: Math.round(acum),
      valorPropiedad,
      saldoCredito: 0,
      patrimonioNeto: valorPropiedad,
    });
  });
}

// Liquidación por el motor sobre el depto completo, prorrateada — todos los términos
// del exit (valor, comisión de venta, flujos) son lineales en la fracción.
const deptoSinCreditoUF: number[] = ANIOS.map(
  (_, idx) => (calcExitScenario(inputSinCredito, metricsSC, proyeccionesSC, idx + 1).retornoTotal / UF_CLP) * FRACCION_CONTADO,
);

// Plata aportada acumulada (la punteada del reel): inicial + extras al cierre de cada
// año con flujo negativo.
const plataAportadaUF: number[] = [];
{
  let acum = aporteInicialUF;
  ANIOS.forEach((anio) => {
    acum += aportesUF[anio];
    plataAportadaUF.push(acum);
  });
}
const totalAportadoUF = plataAportadaUF[plataAportadaUF.length - 1];

// ─── TIR anual exacta, aportes en sus fechas (mensual → anualizada) ───
//
// Flujos reales del inversionista: t0 el aporte inicial; cada mes el flujo neto (los
// años deficitarios son salidas mensuales, las mismas fechas en que el backtest las
// aporta); al mes final se suma la liquidación NETA de comisión (equity), no el
// retornoTotal, porque los flujos ya viajaron mes a mes. Solver: calcIRR del motor.
function tirAnual(flujosMensualesUF: number[]): number {
  const r = calcIRR(flujosMensualesUF);
  if (!r.ok) throw new Error(`TIR sin solución: ${r.reason}`);
  return (Math.pow(1 + r.rate, 12) - 1) * 100;
}

const exitFinal = calcExitScenario(input, metrics, proyecciones, ANIOS.length);
const exitFinalSC = calcExitScenario(inputSinCredito, metricsSC, proyeccionesSC, ANIOS.length);

const flujosDepto: number[] = [-aporteInicialUF];
const flujosSC: number[] = [-aporteInicialUF];
ANIOS.forEach((_, idx) => {
  for (let m = 1; m <= 12; m++) {
    flujosDepto.push(caso.flujosAnualesUF[idx] / 12);
    flujosSC.push((flujosAnualesSCUF[idx] / 12) * FRACCION_CONTADO);
  }
});
flujosDepto[flujosDepto.length - 1] += exitFinal.equityCLP / UF_CLP;
flujosSC[flujosSC.length - 1] += (exitFinalSC.equityCLP / UF_CLP) * FRACCION_CONTADO;

const tirDeptoPct = Math.round(tirAnual(flujosDepto) * 10) / 10;
const tirSinCreditoPct = Math.round(tirAnual(flujosSC) * 10) / 10;

// GUARDA: la tesis del reel es que el crédito amplifica. Si el motor dice lo
// contrario, el reel no se publica con este caso — revienta con ambas cifras.
if (tirDeptoPct <= tirSinCreditoPct) {
  throw new Error(`la palanca no amplifica: TIR con crédito ${tirDeptoPct}% ≤ sin crédito ${tirSinCreditoPct}%`);
}

// Ganancia neta del depto con crédito: patrimonio final menos TODO lo aportado.
const gananciaNetaUF = Math.round((deptoUF[deptoUF.length - 1] - totalAportadoUF) * 10) / 10;

// ─── Resultados ─────────────────────────────────────────────────────────────

const r1 = (x: number) => Math.round(x * 10) / 10;
const cruce = ANIOS.find((_, i) => deptoUF[i] >= fondoHabitatUF[i]) ?? null;
const divergenciaCuprum = Math.max(...ANIOS.map((_, i) => Math.abs(fondoHabitatUF[i] - fondoCuprumUF[i]) / fondoHabitatUF[i])) * 100;

const dataset = {
  meta: {
    titulo: "La misma plata, tres destinos: 2015–2025",
    caso: `Depto 1D1B de ${M2.toFixed(1)} m² comuna Santiago, compra 1-ene-2015 a ${UFM2_COMPRA} UF/m² (${PRECIO_UF} UF), pie ${PIE_PCT}% + cierre y puesta a punto del motor, crédito ${PLAZO_CREDITO_ANOS} años al ${TASA_HIPOTECARIA_2015_UF}% UF`,
    unidad: "UF",
    /** El hook habla de capital redondo; el gráfico usa el aporte real del motor. */
    capitalRedondoUF: CAPITAL_REDONDO_UF,
    aporteInicialUF: Math.round(aporteInicialUF * 100) / 100,
    aportesExtraUF: Object.fromEntries(ANIOS.filter((a) => aportesUF[a] > 0).map((a) => [a, r1(aportesUF[a])])),
    supuestosDeclarados: {
      plazoCreditoAnos: PLAZO_CREDITO_ANOS,
      ggccUfMes: GGCC_UF_MES,
      contribucionesUfTrim: CONTRIBUCIONES_UF_TRIM,
      antiguedadCompra: ANTIGUEDAD_COMPRA,
      arriendoVacancia: "serie Fase 0.5 con rótulos por tramo (backtest-arriendo-vacancia.candidato.csv)",
    },
    fuente: "Fuente: elaboración propia en base a datos públicos de GfK/NielsenIQ, Superintendencia de Pensiones, Banco Central de Chile, INE y Observatorio de Arriendo UC.",
    /** TIR anual exacta (flujos mensuales en sus fechas, liquidación al cierre). */
    tir: { deptoPct: tirDeptoPct, deptoSinCreditoPct: tirSinCreditoPct },
    /** Patrimonio final del depto con crédito menos todo lo aportado. */
    gananciaNetaUF,
    totalAportadoUF: r1(totalAportadoUF),
    /** deptoSinCredito es CONTRAFACTUAL ILUSTRATIVO: las mismas UF al contado compran
     *  una fracción del mismo inmueble (misma serie GfK, arriendos, gastos, vacancia
     *  y liquidación del motor). Aísla el efecto del crédito; no es carrera real. */
    fraccionContado: Math.round(FRACCION_CONTADO * 10000) / 10000,
    generadoPor: "scripts/data/backtest-reel2.ts",
  },
  anios: ANIOS,
  series: {
    depto: deptoUF.map(r1),
    deptoSinCredito: deptoSinCreditoUF.map(r1),
    plataAportada: plataAportadaUF.map(r1),
    fondoA: fondoHabitatUF.map(r1),
    deposito: depositoUF.map(r1),
  },
  cruceDeptoSuperaFondoA: cruce,
  sensibilidadCruce,
  seriesMensuales: {
    meses: MESES.map(etiquetaMes),
    fondoA: fondoAMensual.map(r1),
    deposito: depositoMensual.map(r1),
  },
  control: {
    fondoACuprum: fondoCuprumUF.map(r1),
    divergenciaMaxHabitatCuprumPct: Math.round(divergenciaCuprum * 100) / 100,
    coherenciaAno1UF: { informe: r1(flujoInforme / UF_CLP), backtest: r1(flujoBacktest / UF_CLP) },
  },
};

mkdirSync(dirname(SALIDA), { recursive: true });
writeFileSync(SALIDA, JSON.stringify(dataset, null, 2) + "\n", "utf8");

console.log(`Escrito ${SALIDA}`);
console.log(`aporte inicial: ${r1(aporteInicialUF)} UF · aportes extra: ${ANIOS.map((a) => `${a}:${r1(aportesUF[a])}`).join(" ")}`);
console.log(`año      depto    fondoA  depósito`);
ANIOS.forEach((a, i) => console.log(`${a}  ${String(r1(deptoUF[i])).padStart(8)} ${String(r1(fondoHabitatUF[i])).padStart(8)} ${String(r1(depositoUF[i])).padStart(8)}`));
console.log(`cruce (depto ≥ fondo A): ${cruce ?? "no ocurre en la ventana"}`);
console.log(`sensibilidad del cruce (GGCC × contrib): ${sensibilidadCruce.map((c) => `[${c.ggcc}/${c.contrib}→${c.cruce}]`).join(" ")}`);
console.log(`divergencia máx Habitat vs Cuprum: ${dataset.control.divergenciaMaxHabitatCuprumPct}%`);
console.log(`coherencia año 1 (flujo anual UF): informe=${dataset.control.coherenciaAno1UF.informe} backtest=${dataset.control.coherenciaAno1UF.backtest}`);
console.log(`sin crédito: fracción ${(FRACCION_CONTADO * 100).toFixed(2)}% · serie ${deptoSinCreditoUF.map(r1).join(" ")}`);
console.log(`TIR: con crédito ${tirDeptoPct}% · sin crédito ${tirSinCreditoPct}%`);
console.log(`ganancia neta depto: ${gananciaNetaUF} UF (aportado ${r1(totalAportadoUF)} UF)`);
