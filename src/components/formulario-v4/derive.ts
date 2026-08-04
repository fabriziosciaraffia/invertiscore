// Derivaciones puras del wizard v4 (precio, pie normalizado, cuota). Reusa los
// helpers de parseo/formato y la fórmula de dividendo de v3 (funciones puras,
// estables) — no se reinventan.

import {
  calcDividendo,
  fmtCLP,
  fmtUF,
  parseDecimalLocale,
  parseNum,
} from "@/components/formulario-v3/wizardV3State";
import type { WizardV4Answers } from "./wizardV4Nodes";

export { fmtCLP, fmtUF, parseNum, parseDecimalLocale };

/** Concordancia singular/plural de "dormitorio(s)". */
export function dormLabel(n: number): string {
  return `${n} ${n === 1 ? "dormitorio" : "dormitorios"}`;
}

/** Precio en UF (0 si vacío/ inválido). */
export function precioUF(a: WizardV4Answers): number {
  return parseNum(a.precio ?? "");
}

/** Tasa anual % (default de mercado si no hay). */
export function tasaPct(a: WizardV4Answers, fallback = 4.72): number {
  const t = parseDecimalLocale(a.tasaInteres ?? "");
  return t > 0 ? t : fallback;
}

/** Plazo en años. */
export function plazoAnios(a: WizardV4Answers): number {
  return Number(a.plazoCredito) || 25;
}

/**
 * Pie normalizado a % del precio, desde la unidad en que lo escribió el usuario
 * ($ / UF / %). Necesita el precio (UF) y la UF del día para convertir CLP.
 * Devuelve 0 si falta info.
 */
export function piePct(a: WizardV4Answers, ufCLP: number): number {
  // La unidad por defecto es "%" (coincide con el display inicial de PieScreen);
  // sin este default, un pie escrito antes de tocar el toggle se interpretaba
  // como CLP y daba piePct≈0.
  const unit = a.pieUnidad ?? "pct";
  const monto = unit === "pct" ? parseDecimalLocale(a.pieMonto ?? "") : parseNum(a.pieMonto ?? "");
  const pUF = precioUF(a);
  if (monto <= 0) return 0;
  if (unit === "pct") return Math.min(monto, 100);
  if (pUF <= 0 || ufCLP <= 0) return 0;
  const pieEnUF = unit === "uf" ? monto : monto / ufCLP;
  return Math.min((pieEnUF / pUF) * 100, 100);
}

/** Pie en UF a partir de la unidad escrita. */
export function pieUF(a: WizardV4Answers, ufCLP: number): number {
  const pUF = precioUF(a);
  const pct = piePct(a, ufCLP);
  return (pUF * pct) / 100;
}

/** Pie en CLP. */
export function pieCLP(a: WizardV4Answers, ufCLP: number): number {
  return Math.round(pieUF(a, ufCLP) * ufCLP);
}

/** Cuota (dividendo) mensual estimada en CLP, o 0 si falta info. */
export function cuotaCLP(a: WizardV4Answers, ufCLP: number): number {
  const pUF = precioUF(a);
  const pct = piePct(a, ufCLP);
  if (pUF <= 0 || ufCLP <= 0) return 0;
  return calcDividendo(pUF, pct, plazoAnios(a), tasaPct(a), ufCLP);
}

/** Metros a texto legible: 800 → "800 m", 1500 → "1,5 km". */
function fmtRadio(m: number): string {
  return m < 1000 ? `${m} m` : `${String(m / 1000).replace(".", ",")} km`;
}

/**
 * Procedencia del arriendo sugerido, para la línea de fuente. Vive acá porque la
 * declaran DOS pantallas (arr en el Acto 3 y el resumen); tenerla duplicada ya
 * costó una vez: las dos decían "mediana de N arriendos comparables publicados en
 * la zona" mirando solo el tamaño de la muestra, así que un número traído de la
 * comuna entera —y de una tabla congelada cuatro meses— se presentaba con el mismo
 * aval que los comparables medidos por radio.
 *
 * El nivel manda (`fuente`, que declara el endpoint); el n solo modula el caveat.
 */
export function fuenteArriendoLine(
  fuente: "radio" | "comuna" | "sin-dato",
  n: number,
  radio: number | null,
): string {
  if (fuente === "sin-dato" || n <= 0) {
    return "sin arriendos publicados cerca para comparar — el valor lo pones tú";
  }
  if (fuente === "comuna") {
    return `mediana de ${n} arriendos de la comuna completa — no de la zona del depto`;
  }
  const donde = radio ? `a menos de ${fmtRadio(radio)} de la dirección` : "en la zona";
  return n >= 10
    ? `mediana de ${n} arriendos publicados ${donde}`
    : `mediana de solo ${n} ${n === 1 ? "arriendo publicado" : "arriendos publicados"} ${donde} — muestra chica, ajústalo si conoces el arriendo real`;
}
