// ─────────────────────────────────────────────────────────────────────────────
// LA CARD DE BUSCAR OTRA: LA CAUSA Y LA DISTANCIA A COMPRAR (24-sep-2026)
//
// Decisión de Fabrizio: si el veredicto es Buscar otra, no hay combinación que ofrecer —la
// lógica del producto es que Comprar es el objetivo y un camino que solo llega a Ajustar no le
// sirve a nadie—. La card dice POR QUÉ no conviene y A QUÉ DISTANCIA queda Comprar, para que se
// vea que está fuera de alcance. Sin botón y sin pop-up.
//
// LA CAUSA, dos fuentes:
//  · si un filtro (gate) decidió el veredicto, las cláusulas que ya existen
//    (`describirMotivosLTR` / `describirMotivosSTR`), abiertas con «No conviene»;
//  · si lo decidió la banda del score —ningún filtro saltó—, las frases aprobadas el 24-sep
//    («no cierra por varias cosas juntas»), con las cifras que el informe ya muestra: cuánto del
//    arriendo pones de tu bolsillo, cuánto pagas sobre la mediana, cuánto más tendría que
//    facturar. Sin arriendo declarado, lo dice.
//
// LA DISTANCIA: lo que el motor ya mide hacia COMPRAR —la palanca sola más chica, o el mínimo
// fuera del tope—, cerrado con «y eso es muy difícil». Cuando ni con el precio 70% más bajo
// llega (el rango que prueba el motor), se dice así.
// ─────────────────────────────────────────────────────────────────────────────

import type { HallazgoDistanciaVeredicto } from "./types";
import { describirMotivosLTR, describirMotivosSTR } from "./no-cierra-copy";
import type { BrazoSTR } from "./engines/short-term-score";
import { BANDA_TOPE_ARGUMENTOS_PCT } from "./banda-esfuerzo";
import { distanciaPorDescuento } from "./ajustar-sin-camino";

const pct = (n: number) => `${(Math.round(Math.abs(n) * 10) / 10).toString().replace(".", ",")}%`;
const pctEntero = (n: number) => `${Math.round(Math.abs(n))}%`;

/** Junta cláusulas: una sola va con «No conviene:», varias con «por varias cosas juntas». */
function juntar(clausulas: string[]): string {
  if (clausulas.length === 1) return `No conviene: ${clausulas[0]}.`;
  const cuerpo = clausulas.length === 2 ? `${clausulas[0]}, y además ${clausulas[1]}` : `${clausulas.slice(0, -1).join("; ")}, y además ${clausulas[clausulas.length - 1]}`;
  return `No conviene por varias cosas juntas: ${cuerpo}.`;
}

export function causaBuscarOtraLtr(p: {
  brazosGate1Activos: readonly string[];
  arriendoCLP: number;
  flujoMensualCLP: number;
  /** % sobre la mediana de la comuna (positivo = caro). null sin mediana confiable. */
  desviacionPct: number | null;
}): string {
  const m = describirMotivosLTR(p.brazosGate1Activos, false);
  if (m) return juntar(m.lecturas);
  if (!(p.arriendoCLP > 0)) return "No conviene: no declaraste arriendo, y sin ingreso no hay con qué pagar la cuota.";
  const partes: string[] = [];
  if (p.flujoMensualCLP < 0) partes.push(`pones de tu bolsillo cada mes el ${pctEntero((-p.flujoMensualCLP / p.arriendoCLP) * 100)} de lo que te pagan de arriendo`);
  if (p.desviacionPct != null && p.desviacionPct > 10) partes.push(`pagas el metro ${pctEntero(p.desviacionPct)} sobre la mediana`);
  if (partes.length === 0) return "No conviene: los números no cierran a este precio.";
  if (partes.length === 1) return `No conviene: ${partes[0]}.`;
  return `No conviene por varias cosas juntas: ${partes[0]}, y ${partes[1]}.`;
}

export function causaBuscarOtraStr(p: {
  motivos: readonly BrazoSTR[];
  flujoMensualCLP: number;
  /** Break-even como % de lo que factura la zona (127 = tendría que facturar 27% más). */
  breakEvenPctDelMercado: number | null;
}): string {
  const m = describirMotivosSTR(p.motivos);
  if (m) return juntar(m.lecturas);
  const partes: string[] = [];
  if (p.flujoMensualCLP < 0) partes.push("pones plata de tu bolsillo cada mes");
  if (p.breakEvenPctDelMercado != null && p.breakEvenPctDelMercado > 100) {
    partes.push(`${partes.length ? "para dejar de hacerlo " : ""}tendría que facturar un ${pctEntero(p.breakEvenPctDelMercado - 100)} más de lo que rinde la zona`);
  }
  if (partes.length === 0) return "No conviene arrendarlo por día: los números no cierran a este precio.";
  if (partes.length === 1) return `No conviene: ${partes[0]}.`;
  return `No conviene por varias cosas juntas: ${partes[0]}, y ${partes[1]}.`;
}

/** Hasta dónde prueba el motor bajando el precio (`DIST_EXT_PRECIO_MIN`, LTR y STR: −70%). */
export const DISTANCIA_PRECIO_EXPLORADA_PCT = 70;

/**
 * A qué distancia queda Comprar. `null` solo sin hallazgo de distancia (o sin arriendo, donde
 * la distancia no significa nada: lo dice la causa).
 */
export function distanciaBuscarOtra(v: HallazgoDistanciaVeredicto["valor"] | null | undefined, modalidad: "ltr" | "str"): string | null {
  if (!v) return null;
  // EL FILTRO DEL DESCUENTO (25-sep-2026): si el Buscar otro lo decidió que el camino más fácil a
  // Comprar pide más de 20%, la distancia es ESA combinación —la que decidió el veredicto—, no la
  // palanca sola. Decisión de Fabrizio: «Aun con pie de 30% y crédito a 30 años, llegar a Comprar
  // pediría un 20,4% menos de precio, y eso es muy difícil.»
  if (v.porDescuento) return distanciaPorDescuento(v.porDescuento);
  const solas = (Array.isArray(v.palancasHastaComprar) ? v.palancasHastaComprar : [])
    .filter((l) => l.palanca === "precio" || l.palanca === "arriendo" || l.palanca === "adr")
    .sort((a, b) => Math.abs(a.deltaPct) - Math.abs(b.deltaPct));
  const x = solas[0] ?? v.deltaMinimoComprarFueraDeTope ?? null;
  if (!x) return `Llegar a Comprar pediría más de un ${DISTANCIA_PRECIO_EXPLORADA_PCT}% menos de precio, y eso es muy difícil.`;
  const que = x.palanca === "precio" ? "menos de precio" : `más de ${x.palanca === "adr" || modalidad === "str" ? "tarifa por noche" : "arriendo"}`;
  // «Y ESO ES MUY DIFÍCIL» SOLO SOBRE LA BANDA DIFÍCIL. Un Buscar otra que lo decidió un filtro
  // puede quedar a pocos puntos de Comprar, y ahí la coletilla sería falsa.
  const cola = Math.abs(x.deltaPct) > BANDA_TOPE_ARGUMENTOS_PCT ? ", y eso es muy difícil" : "";
  return `Llegar a Comprar pediría un ${pct(x.deltaPct)} ${que}${cola}.`;
}
