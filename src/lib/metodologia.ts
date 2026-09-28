// ─────────────────────────────────────────────────────────────────────────────
// LO QUE /metodologia DICE DEL MOTOR — leído del motor (27-sep-2026)
//
// Decisión de Fabrizio: la página se simplifica a tres cosas —qué mide Franco, de dónde salen
// los datos y qué no hace—, sin fórmulas ni pesos (el detalle vive en «Cómo se calcula», dentro
// del informe). Y lo que afirme del motor tiene que ser cierto hoy y leerse del motor donde se
// pueda. Acá está esa parte: la página la dibuja y el tier METODOLOGÍA la vigila.
//
//   · Qué entra al puntaje: las CLAVES de `PESOS_SCORE_LTR` / `PESOS_SCORE_STR`, en palabras.
//     Nunca los pesos. Si el motor suma o saca una dimensión, `tsc` exige su rótulo acá.
//   · Las reglas por encima del puntaje: las cláusulas de `no-cierra-copy.ts`, las mismas que
//     dice el informe cuando un gate decide.
//   · El filtro del descuento: `AJUSTAR_DESCUENTO_MAX_PCT`.
//   · El horizonte: `HORIZONTE_SALIDA_ANIOS` (renta larga), que el tier exige igual al de renta
//     corta.
//   · La plusvalía proyectada: `PLUSVALIA_PROYECCION_ANUAL`.
// ─────────────────────────────────────────────────────────────────────────────

import { PESOS_SCORE_LTR, PESOS_SCORE_STR } from "./score-retorno";
import { REGLAS_LTR, REGLAS_STR } from "./no-cierra-copy";
import { AJUSTAR_DESCUENTO_MAX_PCT } from "./ajustar-sin-camino";
import { HORIZONTE_SALIDA_ANIOS } from "./analysis";
import { PLUSVALIA_PROYECCION_ANUAL } from "./plusvalia-proyeccion";

export const HORIZONTE = HORIZONTE_SALIDA_ANIOS;
export const DESCUENTO_MAX_PCT = AJUSTAR_DESCUENTO_MAX_PCT;
export const PLUSVALIA_PCT = Math.round(PLUSVALIA_PROYECCION_ANUAL * 1000) / 10;

/** Qué entra al puntaje en renta larga: una frase por dimensión del motor, sin su peso. */
export const DIMENSIONES_LTR: Record<keyof typeof PESOS_SCORE_LTR, string> = {
  rentabilidad: "Rentabilidad: lo que renta el arriendo sobre el precio.",
  flujoCaja: "Flujo mensual: lo que te queda o pones cada mes, después de la cuota y los gastos.",
  cashOnCash: "Lo que rinde tu plata: el flujo de un año contra lo que pusiste de tu bolsillo.",
  tir: `El resultado a ${HORIZONTE} años: lo que rinde tu plata sumando el arriendo y la venta.`,
  plusvalia: "Plusvalía: la historia de precios de la comuna, el metro cerca y la antigüedad del depto.",
  eficiencia: "Precio de entrada: cuánto pagas por metro y cuánto renta, contra los deptos de su zona.",
};

/** Qué entra al puntaje en renta corta. */
export const DIMENSIONES_STR: Record<keyof typeof PESOS_SCORE_STR, string> = {
  rentabilidad: "Rentabilidad: lo que factura en el año sobre el precio.",
  sostenibilidad: "Sostenibilidad: si el ingreso cubre la cuota y los gastos, y cuánto margen deja contra lo que factura la zona.",
  factibilidad: "Demanda de la zona: cuánto se arrienda por día lo que hay alrededor.",
  cashOnCash: "Lo que rinde tu plata: el flujo de un año contra lo que pusiste de tu bolsillo.",
  tir: `El resultado a ${HORIZONTE} años: lo que rinde tu plata sumando el ingreso y la venta.`,
};

/** Las reglas que pasan por encima del puntaje, con las palabras del informe. */
export const REGLAS = {
  ltrABuscarOtra: REGLAS_LTR.aBuscarOtra,
  ltrDeComprarAAjustar: REGLAS_LTR.deComprarAAjustar,
  strABuscarOtra: REGLAS_STR.aBuscarOtra,
  filtroDescuento: `Si el camino más fácil a Comprar pide más de ${DESCUENTO_MAX_PCT}% de descuento, o no hay camino, el veredicto es Buscar otro: un Ajustar tiene que poder llegar.`,
};
