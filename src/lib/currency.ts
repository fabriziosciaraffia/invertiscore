/**
 * Centralized currency formatting utilities for CLP/UF toggle.
 * UF_CLP should be passed in from the server-fetched value.
 */

export function formatCLP(value: number): string {
  return "$" + Math.round(value).toLocaleString("es-CL");
}

export function formatUF(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) {
    return "UF " + Math.round(rounded).toLocaleString("es-CL");
  }
  const [int, dec] = rounded.toFixed(1).split(".");
  return "UF " + Number(int).toLocaleString("es-CL") + "," + dec;
}

export function formatCurrency(
  value: number,
  currency: "CLP" | "UF",
  ufValue: number
): string {
  if (currency === "UF") {
    return formatUF(value / ufValue);
  }
  return formatCLP(value);
}

export function formatAxisCurrency(
  value: number,
  currency: "CLP" | "UF",
  ufValue: number
): string {
  if (currency === "UF") {
    const uf = value / ufValue;
    if (Math.abs(uf) >= 1_000) return "UF " + (uf / 1_000).toFixed(0) + "K";
    if (Math.abs(uf) >= 100) return "UF " + Math.round(uf);
    if (Math.abs(uf) >= 1) return "UF " + uf.toFixed(1);
    return "UF " + uf.toFixed(2);
  }
  if (Math.abs(value) >= 1_000_000) return "$" + (value / 1_000_000).toFixed(1) + "M";
  if (Math.abs(value) >= 1_000) return "$" + Math.round(value / 1_000) + "K";
  return "$" + Math.round(value);
}

/**
 * Convert embedded CLP amounts in text (e.g. from AI analysis) to UF.
 * Handles patterns like "$420.000", "-$416.788".
 */
export function convertTextCurrency(
  text: string,
  currency: "CLP" | "UF",
  ufValue: number
): string {
  if (currency === "CLP") return text;
  return text.replace(/-?\$[\d.]+/g, (match) => {
    const isNeg = match.startsWith("-");
    const numStr = match.replace("-", "").replace("$", "").replace(/\./g, "");
    const num = parseInt(numStr, 10);
    if (isNaN(num) || num === 0) return match;
    return (isNeg ? "-" : "") + formatUF(num / ufValue);
  });
}
