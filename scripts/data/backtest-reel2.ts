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
  getMantencionRate,
  runAnalysis,
} from "../../src/lib/analysis";
import type { AnalisisInput, YearProjection } from "../../src/lib/types";
import { GFK_SERIE, PLUSVALIA_ESTIMADO_2025 } from "../../src/lib/plusvalia-estimado.gen";

const DIR = __dirname;
const SALIDA = join(DIR, "../../tools/reels/data/dataset-backtest-2015-2025.json");

// ─── Parámetros del caso ─────────────────────────────────────────────────────

/** 1e6: el motor corre en micro-UF. */
const UF_CLP = 1e6;
const M2 = 40;
/** Promedio GfK comuna Santiago 2015 — coincide con GFK_SERIE por construcción. */
const UFM2_COMPRA = 52.8;
const PRECIO_UF = UFM2_COMPRA * M2; // 2.112 UF
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
    throw new Error(`GfK Santiago 2015 = ${serieUfM2[2015]} ≠ precio de compra ${UFM2_COMPRA}`);
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
const { proyecciones, flujosAnualesUF, aportesUF, deptoUF, fondoHabitatUF, fondoCuprumUF, depositoUF } = caso;

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

// ─── Resultados ─────────────────────────────────────────────────────────────

const r1 = (x: number) => Math.round(x * 10) / 10;
const cruce = ANIOS.find((_, i) => deptoUF[i] >= fondoHabitatUF[i]) ?? null;
const divergenciaCuprum = Math.max(...ANIOS.map((_, i) => Math.abs(fondoHabitatUF[i] - fondoCuprumUF[i]) / fondoHabitatUF[i])) * 100;

const dataset = {
  meta: {
    titulo: "La misma plata, tres destinos: 2015–2025",
    caso: `Depto 1D1B ${M2} m² comuna Santiago, compra 1-ene-2015 a ${UFM2_COMPRA} UF/m² (${PRECIO_UF} UF), pie ${PIE_PCT}% + gastos de cierre del motor, crédito ${PLAZO_CREDITO_ANOS} años al ${TASA_HIPOTECARIA_2015_UF}% UF`,
    unidad: "UF",
    aporteInicialUF: r1(aporteInicialUF),
    aportesExtraUF: Object.fromEntries(ANIOS.filter((a) => aportesUF[a] > 0).map((a) => [a, r1(aportesUF[a])])),
    supuestosDeclarados: {
      plazoCreditoAnos: PLAZO_CREDITO_ANOS,
      ggccUfMes: GGCC_UF_MES,
      contribucionesUfTrim: CONTRIBUCIONES_UF_TRIM,
      antiguedadCompra: ANTIGUEDAD_COMPRA,
      arriendoVacancia: "serie Fase 0.5 con rótulos por tramo (backtest-arriendo-vacancia.candidato.csv)",
    },
    fuente: "Fuente: elaboración propia en base a datos públicos de GfK/NielsenIQ, Superintendencia de Pensiones, Banco Central de Chile, INE y Observatorio de Arriendo UC.",
    generadoPor: "scripts/data/backtest-reel2.ts",
  },
  anios: ANIOS,
  series: {
    depto: deptoUF.map(r1),
    fondoA: fondoHabitatUF.map(r1),
    deposito: depositoUF.map(r1),
  },
  cruceDeptoSuperaFondoA: cruce,
  sensibilidadCruce,
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
