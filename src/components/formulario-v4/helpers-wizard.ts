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
