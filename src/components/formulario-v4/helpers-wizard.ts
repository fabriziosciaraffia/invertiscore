import { cuotasPieValidas, cuotasPorDefecto } from "@/lib/obra-nueva";
import type { Antiguedad } from "./wizardV4Nodes";
// Utilidades del wizard que sobrevivieron al v3 (25-sep-2026). Vivían en
// `formulario-v3/wizardV3State.ts`, junto con el estado del wizard v3 (`/analisis/nuevo-v2`), que se
// borró con su ruta. El v4 usa estas cinco: formato de montos, antigüedad por tramo, dividendo y
// meses hasta la entrega.

export function fmtCLP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

export function fmtUF(n: number, decimals = 0): string {
  const rounded = decimals > 0
    ? Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals)
    : Math.round(n);
  return "UF " + rounded.toLocaleString("es-CL");
}

export function antiguedadToNumber(val: string): number {
  switch (val) {
    case "0-2": return 1;
    case "3-5": return 4;
    case "6-10": return 8;
    case "11-20": return 15;
    case "20+": return 25;
    // "" (no elegido) y cualquier otro → fallback 5. El gate del paso 1 impide
    // que un usado avance con "", así que en la práctica no llega vacío.
    default: return 5;
  }
}

/** La banda del wizard en la que caen unos años conocidos (la misma escala que antiguedadToNumber). */
export function bandaDeAnios(anios: number): Antiguedad {
  return anios <= 2 ? "0-2" : anios <= 5 ? "3-5" : anios <= 10 ? "6-10" : anios <= 20 ? "11-20" : "20+";
}

/**
 * LOS AÑOS DE UN USADO PARA EL MOTOR (03-nov-2026, goal «la edad del edificio»). Con la edad real (la ficha del aviso o otro
 * aviso del edificio), esa edad, sin pasarla por la banda: un edificio de 1951 entra con 75 años y usa el tramo de más de 25
 * de la mantención y de la puesta a punto. La banda manda cuando la persona elige: si cambia la banda en el wizard y ya no
 * es la de la edad real, la edad real deja de valer. Sin edad real, el número de la banda (antiguedadToNumber).
 */
export function aniosDelUsado(a: { antiguedad?: Antiguedad; antiguedadAnios?: number }): number {
  const real = a.antiguedadAnios;
  if (typeof real === "number" && Number.isInteger(real) && real >= 0 && bandaDeAnios(real) === a.antiguedad) return real;
  return antiguedadToNumber(a.antiguedad ?? "");
}

export function calcDividendo(precioUF: number, piePct: number, plazoAnos: number, tasaAnual: number, ufClp: number) {
  const credito = precioUF * (1 - piePct / 100) * ufClp;
  if (credito <= 0) return 0;
  const tasaMensual = tasaAnual / 100 / 12;
  const n = plazoAnos * 12;
  if (tasaMensual === 0) return Math.round(credito / n);
  return Math.round((credito * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n)));
}

export function mesesHastaEntrega(mes: string, anio: string): number {
  if (!mes || !anio) return 0;
  const now = new Date();
  const entrega = new Date(Number(anio), Number(mes) - 1);
  return Math.max(1, Math.round((entrega.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
}

/** Las cuotas del pie del wizard (02-oct-2026): la respuesta, o el defecto —hasta la entrega (tope 60) con
 *  entrega futura, al contado con entrega inmediata—. Solo tiene sentido en obra nueva. */
export function cuotasDelWizard(a: { estadoVenta?: string; fechaEntregaMes?: string; fechaEntregaAnio?: string; cuotasPie?: string }): number {
  if (a.cuotasPie) return cuotasPieValidas(a.cuotasPie);
  const futura = a.estadoVenta === "futura";
  return cuotasPorDefecto(futura, futura ? mesesHastaEntrega(a.fechaEntregaMes ?? "", a.fechaEntregaAnio ?? "") : 0);
}
