// Hallazgo tipado de PATRIMONIO (a 10 años) para LTR — motor determinístico. 9º hallazgo
// y el tercero SOLO-LECTURA (tras TIR y sensibilidad). Espejo estructural de
// `tir-hallazgo.ts`: envuelve números que el motor YA calcula (exitScenario.gananciaNeta y
// exitScenario.totalAportado), NO los recalcula. Es LA MISMA fuente que el drawer largoPlazo
// narra ("los UF X que recibes al vender" / "las UF Y que aportaste") y que el waterfall
// totaliza — cero recompute paralelo (D1, lección drift).
//
// PATRIMONIO = gananciaNeta = valorVenta − saldoCrédito − comisión de venta = lo que te
// queda en el bolsillo al liquidar a 10 años (incluye lo amortizado, neto de deuda y
// comisión). APORTADO = totalAportado = todo lo que pusiste (pie + cierre + corretaje si es
// usado + los aportes mensuales que el arriendo no cubrió). El MULTIPLICADOR = patrimonio /
// aportado (= 1 + porcentajeGananciaSobreTotal/100) da la dirección:
//   < 1  → adverso INAPELABLE: terminas con menos de lo que pusiste.
//   [1,2) → borde: terminas con más, pero el margen es acotado.
//   ≥ 2  → favorable: el patrimonio supera con holgura lo aportado.
//
// SOLO-LECTURA: decisividad 0 fija. El patrimonio es el resultado-stock integrador
// (plusvalía + amortización + flujo aportado + venta) sin un driver único que
// calcDecisividades pueda neutralizar; por eso NO entra al ranking. magnitudContinua
// (|mult−1|/2) solo desempata el sort entre pares de igual decisividad (E4).
//
// ANTI-COLISIÓN (D5): la fraseCanonica NO nombra instrumentos (depósito/fondo — esa
// comparación es del bloque "Vs. otro instrumento" del drawer y la dirección del TIR) ni
// recita la ganancia-neta verbatim del veredicto del drawer. Dice magnitud + multiplicador;
// el drawer explica de dónde sale.
//
// GUARD: null si totalAportado ≤ 0 o gananciaNeta no finita (pirámide N−1 — típico de filas
// legacy sin totalAportado en el exit persistido).

import type { HallazgoPatrimonio } from "./types";

// Cortes de clasificación (Fase 0, calibrados sobre el corpus: BUSCAR OTRA p50 1,10 · AJUSTA
// p50 1,98 · COMPRAR p50 3,55). Bajo 1 terminas con menos de lo aportado (adverso); entre 1 y
// 2 el margen es acotado (borde); sobre 2 doblaste o más lo puesto (favorable). La dirección-
// máquina es binaria: adversa solo bajo el corte adverso, favorable en borde y favorable.
export const PATR_CORTE_ADVERSO = 1;    // < 1× ⇒ adverso (terminas con menos de lo que pusiste)
export const PATR_CORTE_FAVORABLE = 2;  // ≥ 2× ⇒ favorable (patrimonio dobla lo aportado)

// Banda de normalización de magnitudContinua (|mult−1|/banda saturado a 1). 2×: mantiene
// discriminable el rango p05–p95 ≈ 0,9–4 sin clipping temprano. Solo desempate secundario
// del sort entre pares de igual decisividad (E4).
export const PATR_BANDA_MAGNITUD = 2;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
// Multiplicador con coma chilena, 1 decimal: 0,69 → "0,7" · 2,5 → "2,5".
const fmtMult = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
// UF entera con separador de miles chileno: 4617 → "4.617".
const fmtUF = (clp: number, valorUF: number) =>
  valorUF > 0 ? Math.round(clp / valorUF).toLocaleString("es-CL") : "0";

/**
 * Construye el proto-hallazgo de PATRIMONIO reusando exitScenario.gananciaNeta y
 * exitScenario.totalAportado (no los recalcula). SOLO-LECTURA: decisividad 0 fija;
 * magnitudContinua = |mult−1|/2 (desempate del sort).
 *
 * Devuelve null si el aportado no es positivo o el patrimonio no es finito (pirámide N−1).
 *
 * La fraseCanonica es la línea determinística del motor (sin LLM); la IA NO la narra (solo-
 * lectura, vive en pirámide + drawer). Voz: tuteo neutro chileno. Los montos van en UF (D1),
 * fijados al sembrar con `valorUF` — el toggle CLP/UF reformatea el KPI del card, no el body.
 */
export function buildHallazgoPatrimonio(p: {
  /** exitScenario.gananciaNeta — lo que te queda al vender a 10 años (neto de deuda + comisión). */
  patrimonioCLP: number;
  /** exitScenario.totalAportado — todo lo que pusiste (día 1 + aportes mensuales negativos). */
  aportadoCLP: number;
  /** UF en CLP del análisis — para formatear los montos en UF en la fraseCanonica (D1). */
  valorUF: number;
  /** El aportado incluye corretaje de compra (usado, análisis nuevo). Alimenta la procedencia. */
  incluyeCorretaje: boolean;
  modalidad: "ltr" | "str" | "ambas";
}): HallazgoPatrimonio | null {
  if (!Number.isFinite(p.patrimonioCLP)) return null;
  if (!Number.isFinite(p.aportadoCLP) || p.aportadoCLP <= 0) return null;

  const multiplicadorRaw = p.patrimonioCLP / p.aportadoCLP;
  if (!Number.isFinite(multiplicadorRaw)) return null;
  // Redondeo ANTES de clasificar: findingDisplay reclasifica sobre este mismo
  // valor.multiplicador redondeado, así que el builder debe decidir las bandas sobre él
  // — si no, un caso justo bajo el corte (ej. 1,996) da título favorable (2,00 ≥ 2) pero
  // frase borde (1,996 < 2). Un solo valor de verdad para dirección, magnitud y display.
  const multiplicador = Math.round(multiplicadorRaw * 100) / 100;

  const adverso = multiplicador < PATR_CORTE_ADVERSO;
  const favorableFinito = multiplicador >= PATR_CORTE_FAVORABLE;
  const direccion: "favorable" | "adverso" = adverso ? "adverso" : "favorable";
  const magnitudContinua = clamp01(Math.abs(multiplicador - PATR_CORTE_ADVERSO) / PATR_BANDA_MAGNITUD);

  const P = fmtUF(p.patrimonioCLP, p.valorUF);
  const A = fmtUF(p.aportadoCLP, p.valorUF);
  const M = fmtMult(multiplicador);

  let titular: string;
  let fraseCanonica: string;
  if (adverso) {
    titular = "A 10 años terminas con menos de lo que pusiste.";
    fraseCanonica =
      `A 10 años, después de vender y pagar el crédito y la comisión, tu parte queda en UF ${P} ` +
      `— menos que las UF ${A} que pusiste en total. El multiplicador es ×${M}: ni lo que amortizas ` +
      `ni la plusvalía proyectada alcanzan a devolverte lo que fuiste aportando.`;
  } else if (favorableFinito) {
    titular = "A 10 años tu parte vale bastante más de lo aportado.";
    fraseCanonica =
      `A 10 años, tras vender y saldar el crédito, tu parte vale UF ${P} contra las UF ${A} que ` +
      `aportaste — un multiplicador de ×${M}. El patrimonio supera con holgura lo que fuiste poniendo, ` +
      `apalancado por lo que amortizas del crédito y la plusvalía proyectada.`;
  } else {
    // Borde: [1, 2).
    titular = "A 10 años tu parte vale algo más de lo aportado.";
    fraseCanonica =
      `A 10 años, tras vender y saldar el crédito, tu parte vale UF ${P} contra las UF ${A} que ` +
      `aportaste — un multiplicador de ×${M}. Terminas con más de lo que pusiste, pero el margen es ` +
      `acotado: buena parte de ese resultado depende de que la plusvalía proyectada se cumpla.`;
  }

  return {
    id: "patrimonio",
    tipo: "patrimonio_neto",
    valor: {
      patrimonioCLP: Math.round(p.patrimonioCLP),
      aportadoCLP: Math.round(p.aportadoCLP),
      multiplicador, // ya redondeado a 2 decimales — mismo valor que clasifica dirección y banda

      corteAdverso: PATR_CORTE_ADVERSO,
      corteFavorable: PATR_CORTE_FAVORABLE,
      banda: PATR_BANDA_MAGNITUD,
      incluyeCorretaje: p.incluyeCorretaje,
      modalidad: p.modalidad,
    },
    direccion,
    decisividad: 0, // SOLO-LECTURA — no entra al ranking de decisividad
    magnitudContinua,
    procedencia: {
      base: "Patrimonio a 10 años sobre lo que aportaste, del escenario de venta",
      // media: integra una proyección de venta a 10 años (plusvalía estándar Franco, ver
      // plusvalia-proyeccion.ts), no es un dato firme como el flujo declarado, pero tampoco
      // tan especulativo como para ser baja.
      confianza: "media",
    },
    titular,
    fraseCanonica,
  };
}
