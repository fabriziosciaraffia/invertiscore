// ============================================================================
// LAS GLOSAS DE LOS INDICADORES — el texto del ⓘ (decisión de Fabrizio, 23-sep-2026)
// ============================================================================
// Los indicadores usan su nombre de mercado —cap rate, cash on cash, TIR— en cada aparición,
// sin cursiva, y cada aparición lleva un ⓘ que explica en fácil qué mide, sobre qué y por qué
// importa. Tres frases como máximo y sin fórmulas: la fórmula vive en «Cómo se calcula».
// Las cifras de referencia se leen de la constante del motor, nunca se escriben a mano.
// Mockup aprobado: docs/wireframes/rediseno-informe/info-indicadores.html.
// ============================================================================

import { TIR_LIMITE_PCT } from "./tir-limite";
import { SCORE_CORTE_AJUSTA, SCORE_CORTE_COMPRAR } from "./score-cortes";
import { etiquetaVeredicto } from "./veredicto-etiqueta";

export type GlosaId = "capRateBruto" | "capRateNeto" | "capRateStr" | "cashOnCash" | "tir" | "cobertura" | "equilibrio" | "multiplicador" | "francoScore";

export type Glosa = { nombre: string; texto: string };

export const GLOSAS: Record<GlosaId, Glosa> = {
  capRateBruto: {
    nombre: "Cap rate bruto",
    texto:
      "Cuánto renta el depto en un año, comparado con lo que cuesta, antes de pagar cualquier gasto. Es la cifra para compararlo con otros de la comuna, pero se queda corta: todavía no descuenta gastos, vacancia ni gestión.",
  },
  capRateNeto: {
    nombre: "Cap rate neto",
    texto:
      "Cuánto renta el depto en un año, comparado con lo que cuesta, ya descontado lo que cuesta mantenerlo, los meses sin arrendatario y la gestión. No mira el crédito: mide el depto como negocio, lo compres con deuda o sin ella.",
  },
  capRateStr: {
    nombre: "Cap rate",
    texto:
      "Cuánto deja el depto en un año arrendado por noche, comparado con lo que cuesta, después de la comisión y de los gastos de operarlo. No mira el crédito: mide el depto como negocio.",
  },
  cashOnCash: {
    nombre: "Cash on cash",
    texto:
      "Cuánto te devuelve el depto cada año por cada peso que pusiste de tu bolsillo al comprar. Este sí mira el crédito: si la cuota se come el arriendo, sale negativo, y significa que todavía estás poniendo plata. No cuenta lo que el depto gana de valor.",
  },
  tir: {
    nombre: "TIR",
    texto: `La rentabilidad anual de toda la operación en diez años: lo que pones al comprar, lo que entra o sale cada mes y lo que te queda al vender. Es la cifra para comparar el depto con otra inversión. Con crédito de por medio, bajo ${TIR_LIMITE_PCT}% al año suele convenir otra cosa.`,
  },
  cobertura: {
    nombre: "Cobertura de cuota",
    texto: "Cuánto del dividendo alcanza a pagar el arriendo. Sobre 1× el arriendo cubre la cuota entera; bajo 1×, la diferencia la pones tú cada mes.",
  },
  equilibrio: {
    nombre: "Punto de equilibrio",
    texto:
      "Cuánto tienes que facturar, comparado con lo que factura un depto típico de la zona, para no poner plata cada mes. Bajo 100% te alcanza con menos que el promedio; sobre 100% tienes que operar mejor que la mayoría.",
  },
  multiplicador: {
    nombre: "Multiplicador",
    texto: "Cuántas veces recuperas lo que pusiste si vendes el año diez. ×1 es recuperar lo mismo; bajo ×1, pierdes parte de lo que pusiste.",
  },
  francoScore: {
    nombre: "Franco Score",
    texto: `Una nota de 1 a 100 que junta en una cifra lo que renta el depto, lo que te cuesta cada mes, lo que te devuelve la plata que pusiste y lo que puede ganar de valor. Desde ${SCORE_CORTE_COMPRAR} el veredicto es ${etiquetaVeredicto("COMPRAR")}; desde ${SCORE_CORTE_AJUSTA}, ${etiquetaVeredicto("AJUSTA SUPUESTOS")}; bajo ${SCORE_CORTE_AJUSTA}, ${etiquetaVeredicto("BUSCAR OTRA")}. Algunas señales graves, como un flujo mensual muy negativo, bajan el veredicto aunque la nota dé para más.`,
  },
};

/** En STR la cobertura mira lo que deja la renta corta, no «el arriendo». */
export const GLOSA_COBERTURA_STR: Glosa = {
  nombre: "Cobertura de cuota",
  texto: "Cuánto del dividendo alcanza a pagar lo que deja la renta corta. Sobre 1× cubre la cuota entera; bajo 1×, la diferencia la pones tú cada mes.",
};

/** El rótulo del cap rate por modalidad: STR tiene UNO solo, sin «neto» ni «por día». */
export function rotuloCapRate(modalidad: "LTR" | "STR", base: "bruta" | "neta" = "neta"): string {
  if (modalidad === "STR") return GLOSAS.capRateStr.nombre;
  return base === "bruta" ? GLOSAS.capRateBruto.nombre : GLOSAS.capRateNeto.nombre;
}

/** La glosa que corresponde a ese rótulo. */
export function glosaCapRate(modalidad: "LTR" | "STR", base: "bruta" | "neta" = "neta"): GlosaId {
  if (modalidad === "STR") return "capRateStr";
  return base === "bruta" ? "capRateBruto" : "capRateNeto";
}
