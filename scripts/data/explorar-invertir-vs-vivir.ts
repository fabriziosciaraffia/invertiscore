// EXPLORACIÓN (no produce reel): comprar para invertir vs comprar para vivir.
//
//   node --import tsx scripts/data/explorar-invertir-vs-vivir.ts
//
// Pregunta: con el MISMO depto y el MISMO crédito, ¿cuánto rinde de menos arrendarlo
// que vivirlo? El caso es idéntico al del Reel 2 (depto 2.000 UF en la comuna de
// Santiago, compra 1-ene-2015, capital 496,82 UF, crédito 25 años al 3,68% UF, serie
// GfK real y los arriendos/vacancia rotulados de la Fase 0.5).
//
// LOS DOS PERFILES
//
// Inversionista — la línea `depto` del dataset del Reel 2. Arrienda el depto y arrienda
// para él un equivalente en la misma comuna: el arriendo que cobra y el que paga se
// cancelan, pero él sí carga las fricciones del rentista (vacancia, GGCC del mes vacío,
// corretaje, recambio, administración).
//
// Habitante — mismo depto, mismo crédito, lo vive. Su retorno implícito es el arriendo
// que NO paga, íntegro y sin descuentos de rentista.
//
// EL GGCC DE LOS MESES OCUPADOS NO ENTRA EN NINGUNO DE LOS DOS, a propósito: en el
// caso del inversionista lo paga su arrendatario, y él paga el equivalente como
// arrendatario del depto donde vive; en el caso del habitante lo paga él sobre el
// suyo. Son el mismo monto sobre deptos equivalentes de la misma comuna, así que se
// cancelan igual que el arriendo. Lo que NO se cancela es el GGCC del mes vacío, que
// solo el inversionista paga — y por eso sí aparece en la descomposición.
//
// CONSTRUCCIÓN DEL HABITANTE, sin reimplementar nada: se toma el desglose que el motor
// ya calculó para el inversionista y se le DEVUELVEN los términos de fricción que le
// cobró. El resultado es, término a término, `arriendo − dividendo − contribuciones −
// mantención`, y la descomposición de la brecha queda exacta por construcción.
//
// IMPUESTOS: exención DFL-2 asumida para AMBOS perfiles (sin impuesto a la renta sobre
// el arriendo del inversionista, sin impuesto a la ganancia de capital en la venta).
// Es el mismo supuesto del Reel 2 y se declara acá porque en este cuadro sería la
// asimetría más probable entre los dos perfiles si no aplicara.

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  calcFlujoDesglose,
  calcExitScenario,
  calcProjections,
  getMantencionRate,
  runAnalysis,
} from "../../src/lib/analysis";
import { calcIRR } from "../../src/lib/finance/irr";
import type { AnalisisInput, YearProjection } from "../../src/lib/types";
import { GFK_SERIE, PLUSVALIA_ESTIMADO_2025 } from "../../src/lib/plusvalia-estimado.gen";

const DIR = __dirname;
const DATASET = join(DIR, "../../tools/reels/data/dataset-backtest-2015-2025.json");
const SALIDA = join(DIR, "exploracion-invertir-vs-vivir.json");

// ─── Espejo del caso del Reel 2 ──────────────────────────────────────────────
// Estas constantes replican `backtest-reel2.ts`, que no se toca. El espejo no se
// cree por fe: más abajo se recomputa la serie del inversionista y se exige que
// coincida con la publicada en el dataset. Si el espejo se desviara, revienta.
const UF_CLP = 1e6;
const UFM2_COMPRA = 52.8;
const PRECIO_UF = 2000;
const M2 = PRECIO_UF / UFM2_COMPRA;
const PIE_PCT = 20;
const TASA_HIPOTECARIA_2015_UF = 3.68;
const PLAZO_CREDITO_ANOS = 25;
const GGCC_UF_MES = 2.0;
const CONTRIBUCIONES_UF_TRIM = 1.2;
const ANTIGUEDAD_COMPRA = 5;

const ARRIENDO_APROBADO: Record<number, number> = {
  2015: 0.276, 2016: 0.279, 2017: 0.285, 2018: 0.29, 2019: 0.295, 2020: 0.26,
  2021: 0.249, 2022: 0.287, 2023: 0.283, 2024: 0.266, 2025: 0.265,
};
const VACANCIA_APROBADA: Record<number, number> = {
  2015: 4.5, 2016: 4.5, 2017: 4.5, 2018: 4.5, 2019: 4.5, 2020: 5.0,
  2021: 3.5, 2022: 2.0, 2023: 2.0, 2024: 2.0, 2025: 2.0,
};

const ANIOS = Array.from({ length: 11 }, (_, i) => 2015 + i);
const ASOF = new Date(2015, 0, 1);

const dataset = JSON.parse(readFileSync(DATASET, "utf8")) as {
  meta: { aporteInicialUF: number; tir: { deptoPct: number } };
  anios: number[];
  series: { depto: number[] };
};

const serieUfM2: Record<number, number> = {};
{
  const s = GFK_SERIE["Santiago"];
  s.valores.forEach((v, i) => { serieUfM2[s.desde + i] = v; });
  serieUfM2[2025] = PLUSVALIA_ESTIMADO_2025["Santiago"].ufM2;
  if (serieUfM2[2015] !== UFM2_COMPRA) {
    throw new Error(`GfK Santiago 2015 = ${serieUfM2[2015]} ≠ ancla de compra ${UFM2_COMPRA}`);
  }
}

const input: AnalisisInput = {
  nombre: "Exploración invertir vs vivir — Santiago 2015", comuna: "Santiago", ciudad: "Santiago",
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
const aporteInicialUF = resultado.exitScenario.inversionInicial / UF_CLP;

// El saldo del crédito sale del motor y es idéntico para los dos perfiles: mismo
// crédito, misma amortización. La plusvalía no lo mueve (guarda del Reel 2).
const proyMotor = calcProjections({
  input, metrics, ufClp: UF_CLP, asOf: ASOF, plazoVenta: 11, plusvaliaAnual: 0.03,
});

// ─── Un año de flujo, para los dos perfiles a la vez ─────────────────────────

type Friccion = {
  vacanciaArriendo: number;
  ggccMesVacio: number;
  corretaje: number;
  recambio: number;
  administracion: number;
};

type AnioFlujo = {
  inversionistaUF: number;
  habitanteUF: number;
  friccionUF: Friccion;
};

/**
 * @param vacanciaPctFija si se pasa, reemplaza la serie de vacancia aprobada (sirve a
 *        la sensibilidad). El habitante NO depende de este parámetro: su flujo no
 *        tiene término de vacancia.
 */
function flujoDelAnio(anio: number, n: number, vacanciaPctFija?: number): AnioFlujo {
  const arriendoMes = Math.round(ARRIENDO_APROBADO[anio] * M2 * UF_CLP);
  const vacanciaPct = vacanciaPctFija ?? VACANCIA_APROBADA[anio];
  const vacanciaMeses = (vacanciaPct * 12) / 100;
  // Convención del motor: en el año n el inmueble ya cumplió antiguedad + n.
  const mantencion = Math.round((PRECIO_UF * UF_CLP * getMantencionRate(ANTIGUEDAD_COMPRA + n)) / 12);

  const d = calcFlujoDesglose({
    arriendo: arriendoMes,
    dividendo: metrics.dividendo, // en UF el dividendo es constante
    ggcc: input.gastos,
    contribuciones: input.contribuciones,
    mantencion,
    vacanciaMeses,
    usaAdministrador: false,
  });

  // Las fricciones que el motor le cobró al rentista y que el habitante no tiene.
  const friccionMes: Friccion = {
    vacanciaArriendo: d.vacanciaProrrata,
    ggccMesVacio: d.ggccVacancia,
    corretaje: d.corretajeProrrata,
    recambio: d.recambio,
    administracion: d.administracion,
  };
  const friccionTotalMes =
    friccionMes.vacanciaArriendo + friccionMes.ggccMesVacio +
    friccionMes.corretaje + friccionMes.recambio + friccionMes.administracion;

  // El habitante es el rentista SIN sus fricciones. Devolverlas término a término
  // deja exactamente `arriendo − dividendo − contribuciones − mantención`.
  const habitanteMes = d.flujoNeto + friccionTotalMes;

  return {
    inversionistaUF: (d.flujoNeto * 12) / UF_CLP,
    habitanteUF: (habitanteMes * 12) / UF_CLP,
    friccionUF: {
      vacanciaArriendo: (friccionMes.vacanciaArriendo * 12) / UF_CLP,
      ggccMesVacio: (friccionMes.ggccMesVacio * 12) / UF_CLP,
      corretaje: (friccionMes.corretaje * 12) / UF_CLP,
      recambio: (friccionMes.recambio * 12) / UF_CLP,
      administracion: (friccionMes.administracion * 12) / UF_CLP,
    },
  };
}

// ─── Un perfil completo: patrimonio anual y TIR ──────────────────────────────

type Perfil = { patrimonioUF: number[]; tirPct: number; flujosAnualesUF: number[] };

function correrPerfil(flujoAnualUF: (anio: number, n: number) => number): Perfil {
  const proyecciones: YearProjection[] = [];
  const flujosAnualesUF: number[] = [];
  let acumulado = 0;

  ANIOS.forEach((anio, idx) => {
    const n = idx + 1;
    const flujoAnual = flujoAnualUF(anio, n) * UF_CLP;
    acumulado += flujoAnual;
    flujosAnualesUF.push(flujoAnual / UF_CLP);
    const valorPropiedad = Math.round(serieUfM2[anio] * M2 * UF_CLP);
    proyecciones.push({
      anio: n,
      arriendoMensual: Math.round(ARRIENDO_APROBADO[anio] * M2 * UF_CLP),
      flujoAnual: Math.round(flujoAnual),
      flujoAcumulado: Math.round(acumulado),
      valorPropiedad,
      saldoCredito: proyMotor[idx].saldoCredito,
      patrimonioNeto: valorPropiedad - proyMotor[idx].saldoCredito,
    });
  });

  // Patrimonio neto si liquida cada año, por el motor (valor − deuda − comisión de
  // venta + flujos acumulados). Idéntica aritmética que el informe.
  const patrimonioUF = ANIOS.map(
    (_, idx) => calcExitScenario(input, metrics, proyecciones, idx + 1).retornoTotal / UF_CLP,
  );

  // TIR anual exacta: t0 el aporte, cada mes su doceavo de flujo, y al último mes la
  // liquidación NETA de comisión (el equity), porque los flujos ya viajaron mes a mes.
  const exitFinal = calcExitScenario(input, metrics, proyecciones, ANIOS.length);
  const flujos: number[] = [-aporteInicialUF];
  flujosAnualesUF.forEach((f) => {
    for (let m = 0; m < 12; m++) flujos.push(f / 12);
  });
  flujos[flujos.length - 1] += exitFinal.equityCLP / UF_CLP;
  const r = calcIRR(flujos);
  if (!r.ok) throw new Error(`TIR sin solución: ${r.reason}`);

  return {
    patrimonioUF,
    tirPct: Math.round((Math.pow(1 + r.rate, 12) - 1) * 1000) / 10,
    flujosAnualesUF,
  };
}

const inversionista = correrPerfil((anio, n) => flujoDelAnio(anio, n).inversionistaUF);
const habitante = correrPerfil((anio, n) => flujoDelAnio(anio, n).habitanteUF);

// ─── GUARDA: el espejo reproduce la línea publicada del Reel 2 ───────────────
const r1 = (x: number) => Math.round(x * 10) / 10;
ANIOS.forEach((anio, idx) => {
  const mio = r1(inversionista.patrimonioUF[idx]);
  const publicado = dataset.series.depto[idx];
  if (mio !== publicado) {
    throw new Error(
      `espejo del caso roto en ${anio}: inversionista recomputado ${mio} UF ≠ ${publicado} UF publicado en el dataset del Reel 2`,
    );
  }
});
if (r1(aporteInicialUF) !== r1(dataset.meta.aporteInicialUF)) {
  throw new Error(`aporte inicial ${aporteInicialUF} ≠ ${dataset.meta.aporteInicialUF} del dataset`);
}
if (inversionista.tirPct !== dataset.meta.tir.deptoPct) {
  throw new Error(`TIR del inversionista ${inversionista.tirPct}% ≠ ${dataset.meta.tir.deptoPct}% del dataset`);
}

// ─── GUARDA: el habitante tiene que ganar ────────────────────────────────────
const brechaTirPuntos = Math.round((habitante.tirPct - inversionista.tirPct) * 10) / 10;
const brechaFinalUF = habitante.patrimonioUF[10] - inversionista.patrimonioUF[10];
if (brechaTirPuntos <= 0 || brechaFinalUF <= 0) {
  throw new Error(
    `el habitante NO gana (TIR ${habitante.tirPct}% vs ${inversionista.tirPct}%, patrimonio ${r1(brechaFinalUF)} UF) — revisar la construcción antes de creerlo`,
  );
}

// ─── Descomposición de la brecha, acumulada a 11 años ────────────────────────
const acumFriccion: Friccion = {
  vacanciaArriendo: 0, ggccMesVacio: 0, corretaje: 0, recambio: 0, administracion: 0,
};
ANIOS.forEach((anio, idx) => {
  const f = flujoDelAnio(anio, idx + 1).friccionUF;
  acumFriccion.vacanciaArriendo += f.vacanciaArriendo;
  acumFriccion.ggccMesVacio += f.ggccMesVacio;
  acumFriccion.corretaje += f.corretaje;
  acumFriccion.recambio += f.recambio;
  acumFriccion.administracion += f.administracion;
});
const sumaFriccion =
  acumFriccion.vacanciaArriendo + acumFriccion.ggccMesVacio +
  acumFriccion.corretaje + acumFriccion.recambio + acumFriccion.administracion;

for (const [nombre, valor] of Object.entries(acumFriccion)) {
  if (valor < 0) throw new Error(`componente ${nombre} negativo: ${valor}`);
  if (valor > sumaFriccion + 1e-6) {
    throw new Error(`componente ${nombre} (${valor}) mayor que la brecha total (${sumaFriccion})`);
  }
}
// La brecha de patrimonio es la suma de fricciones (mismo equity, distinto flujo).
if (Math.abs(sumaFriccion - brechaFinalUF) > 0.5) {
  throw new Error(
    `la descomposición no cierra: fricciones ${r1(sumaFriccion)} UF ≠ brecha ${r1(brechaFinalUF)} UF`,
  );
}

// ─── Sensibilidad a la vacancia ──────────────────────────────────────────────
const sensibilidad = [2, 4, 6].map((pct) => {
  const inv = correrPerfil((anio, n) => flujoDelAnio(anio, n, pct).inversionistaUF);
  const hab = correrPerfil((anio, n) => flujoDelAnio(anio, n, pct).habitanteUF);
  return {
    vacanciaPct: pct,
    tirInversionistaPct: inv.tirPct,
    tirHabitantePct: hab.tirPct,
    brechaPuntos: Math.round((hab.tirPct - inv.tirPct) * 10) / 10,
    brechaFinalUF: r1(hab.patrimonioUF[10] - inv.patrimonioUF[10]),
  };
});

// EXTRA, fuera del caso: qué pasaría con administrador. El 7% NO es un supuesto nuevo
// mío — es el default del propio motor (`comisionAdministrador ?? 7`). Se reporta
// aparte porque el caso del Reel 2 corre sin administrador.
const conAdministrador = (() => {
  let acum = 0;
  ANIOS.forEach((anio, idx) => {
    const arriendoMes = Math.round(ARRIENDO_APROBADO[anio] * M2 * UF_CLP);
    const vacanciaMeses = (VACANCIA_APROBADA[anio] * 12) / 100;
    const mantencion = Math.round((PRECIO_UF * UF_CLP * getMantencionRate(ANTIGUEDAD_COMPRA + idx + 1)) / 12);
    const d = calcFlujoDesglose({
      arriendo: arriendoMes, dividendo: metrics.dividendo, ggcc: input.gastos,
      contribuciones: input.contribuciones, mantencion, vacanciaMeses,
      usaAdministrador: true,
    });
    acum += (d.administracion * 12) / UF_CLP;
  });
  return r1(acum);
})();

// ─── Salida ─────────────────────────────────────────────────────────────────

const informe = {
  meta: {
    pregunta: "¿Cuánto rinde de menos comprar para arrendar que comprar para vivir, con el mismo depto y el mismo crédito?",
    caso: `Depto 1D1B de ${M2.toFixed(1)} m² comuna Santiago, compra 1-ene-2015 a ${UFM2_COMPRA} UF/m² (${PRECIO_UF} UF), capital ${r1(aporteInicialUF)} UF, crédito ${PLAZO_CREDITO_ANOS} años al ${TASA_HIPOTECARIA_2015_UF}% UF — idéntico al Reel 2`,
    unidad: "UF",
    supuestos: {
      impuestos: "Exención DFL-2 asumida para AMBOS perfiles: sin impuesto a la renta sobre el arriendo ni a la ganancia de capital.",
      ggccMesesOcupados: "Fuera de los dos flujos: lo paga el arrendatario del inversionista (y él paga el equivalente donde vive) o el habitante sobre el suyo. Se cancela. El GGCC del mes vacío sí entra, solo al inversionista.",
      vivienda: "El inversionista arrienda un equivalente en la misma comuna: el arriendo que cobra y el que paga se cancelan.",
      administrador: "El caso corre SIN administrador (igual que el Reel 2).",
    },
    generadoPor: "scripts/data/explorar-invertir-vs-vivir.ts",
  },
  anios: ANIOS,
  patrimonioUF: {
    inversionista: inversionista.patrimonioUF.map(r1),
    habitante: habitante.patrimonioUF.map(r1),
  },
  tir: {
    inversionistaPct: inversionista.tirPct,
    habitantePct: habitante.tirPct,
    brechaPuntos: brechaTirPuntos,
  },
  brechaFinalUF: r1(brechaFinalUF),
  descomposicionUF: {
    vacanciaArriendo: r1(acumFriccion.vacanciaArriendo),
    ggccMesVacio: r1(acumFriccion.ggccMesVacio),
    corretaje: r1(acumFriccion.corretaje),
    recambio: r1(acumFriccion.recambio),
    administracion: r1(acumFriccion.administracion),
    total: r1(sumaFriccion),
  },
  sensibilidadVacancia: sensibilidad,
  extraNoDelCaso: {
    administracionSiHubieraAdministradorUF: conAdministrador,
    nota: "7% es el default del motor, no un supuesto nuevo. El caso corre sin administrador.",
  },
};

writeFileSync(SALIDA, JSON.stringify(informe, null, 2) + "\n", "utf8");

const pct = (x: number) => `${x.toFixed(1)}%`;
console.log(`Escrito ${SALIDA}\n`);
console.log(`Caso: ${informe.meta.caso}\n`);
console.log("año     inversionista   habitante   brecha");
ANIOS.forEach((anio, i) => {
  const inv = inversionista.patrimonioUF[i];
  const hab = habitante.patrimonioUF[i];
  console.log(
    `${anio}  ${String(r1(inv)).padStart(12)} ${String(r1(hab)).padStart(11)} ${String(r1(hab - inv)).padStart(8)}`,
  );
});
console.log(`\nTIR inversionista: ${pct(inversionista.tirPct)} · habitante: ${pct(habitante.tirPct)} · brecha: ${brechaTirPuntos} puntos`);
console.log(`Brecha de patrimonio a 2025: ${r1(brechaFinalUF)} UF\n`);
console.log("Descomposición de la brecha (UF acumuladas 2015-2025):");
console.log(`  arriendo perdido por vacancia   ${String(r1(acumFriccion.vacanciaArriendo)).padStart(7)}  (${pct((acumFriccion.vacanciaArriendo / sumaFriccion) * 100)})`);
console.log(`  GGCC de los meses vacíos        ${String(r1(acumFriccion.ggccMesVacio)).padStart(7)}  (${pct((acumFriccion.ggccMesVacio / sumaFriccion) * 100)})`);
console.log(`  corretaje de re-arriendo        ${String(r1(acumFriccion.corretaje)).padStart(7)}  (${pct((acumFriccion.corretaje / sumaFriccion) * 100)})`);
console.log(`  recambio entre arrendatarios    ${String(r1(acumFriccion.recambio)).padStart(7)}  (${pct((acumFriccion.recambio / sumaFriccion) * 100)})`);
console.log(`  administración                  ${String(r1(acumFriccion.administracion)).padStart(7)}  (sin administrador en el caso)`);
console.log(`  TOTAL                           ${String(r1(sumaFriccion)).padStart(7)}\n`);
console.log("Sensibilidad a la vacancia:");
sensibilidad.forEach((s) => {
  console.log(`  vacancia ${s.vacanciaPct}%  →  inversionista ${pct(s.tirInversionistaPct)} · habitante ${pct(s.tirHabitantePct)} · brecha ${s.brechaPuntos} puntos / ${s.brechaFinalUF} UF`);
});
console.log(`\nEXTRA (no del caso): con administrador al 7% del motor, la administración sola sumaría ${conAdministrador} UF a la brecha.`);
