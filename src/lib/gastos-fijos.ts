/**
 * Gastos fijos — lectura y prorrateo a mes.
 *
 * LA PERIODICIDAD SE GUARDA, EL PRORRATEO SE CALCULA. La tabla conserva lo que
 * realmente se paga y cuándo (Haulmer se paga una vez al año, $322.822 + IVA);
 * dividir por 12 al escribir dejaría en la base un número que nadie factura y
 * que habría que revertir para conciliar contra la boleta real.
 *
 * Misma doctrina que `costo-ia.ts` con las tarifas y que `comision-flow.ts` con
 * la comisión: se persiste el hecho, se deriva la lectura. Si mañana el dólar
 * cambia o el IVA cambia, todo el histórico se recalcula solo.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { USD_CLP } from "@/lib/costo-ia";

/** IVA chileno. Solo se aplica a las filas marcadas `mas_iva`. */
const IVA = 0.19;

export type Periodicidad = "mensual" | "anual";
export type TratoIva = "mas_iva" | "exento" | "incluido";

/** Fila cruda de `gastos_fijos`. */
export interface GastoFijoRow {
  id: string;
  nombre: string;
  categoria: string | null;
  monto: number;
  moneda: string | null;
  periodicidad: string | null;
  iva: string | null;
  vigente_desde: string | null;
  vigente_hasta: string | null;
  nota: string | null;
}

/** Un gasto ya resuelto a pesos por mes, conservando el dato original. */
export interface GastoFijoMensual {
  id: string;
  nombre: string;
  categoria: string;
  nota: string | null;
  /** Monto tal como se paga, en su moneda y periodicidad. */
  montoOriginal: number;
  moneda: string;
  periodicidad: Periodicidad;
  iva: TratoIva;
  /** Equivalente mensual en CLP, con IVA e conversión ya aplicados. */
  mensualClp: number;
}

export const COLUMNAS_GASTOS_FIJOS =
  "id, nombre, categoria, monto, moneda, periodicidad, iva, vigente_desde, vigente_hasta, nota";

/** El monto con IVA cuando la fila lo declara aparte. */
function conIva(monto: number, trato: TratoIva): number {
  return trato === "mas_iva" ? monto * (1 + IVA) : monto;
}

/** Convierte a CLP. Solo USD tiene conversión definida; otra moneda se deja pasar
 *  tal cual antes que inventar un tipo de cambio. */
function aClp(monto: number, moneda: string): number {
  return moneda === "USD" ? monto * USD_CLP : monto;
}

/** Resuelve UNA fila a su equivalente mensual en CLP. Función pura. */
export function prorratearMensual(row: GastoFijoRow): GastoFijoMensual {
  const periodicidad: Periodicidad = row.periodicidad === "anual" ? "anual" : "mensual";
  const iva = (["mas_iva", "exento", "incluido"] as const).includes(row.iva as TratoIva)
    ? (row.iva as TratoIva)
    : "exento";
  const moneda = row.moneda ?? "CLP";

  const bruto = conIva(row.monto, iva);
  const mensual = periodicidad === "anual" ? bruto / 12 : bruto;

  return {
    id: row.id,
    nombre: row.nombre,
    categoria: row.categoria ?? "otros",
    nota: row.nota,
    montoOriginal: row.monto,
    moneda,
    periodicidad,
    iva,
    mensualClp: Math.round(aClp(mensual, moneda)),
  };
}

/** Vigencia a una fecha dada (por defecto hoy). Un gasto dado de baja no suma. */
function vigente(row: GastoFijoRow, hoy: string): boolean {
  if (row.vigente_desde && row.vigente_desde > hoy) return false;
  if (row.vigente_hasta && row.vigente_hasta < hoy) return false;
  return true;
}

export interface ResumenGastosFijos {
  items: GastoFijoMensual[];
  /** Total mensual en CLP. */
  totalMensual: number;
  /** true cuando la tabla no existe todavía o está vacía. */
  sinDato: boolean;
}

/**
 * Lee los gastos vigentes y los devuelve prorrateados, mayor primero.
 *
 * Si la tabla no existe (el SQL todavía no se corrió) devuelve `sinDato: true`
 * en vez de romper — mismo criterio que `metrics-daily.ts`.
 */
export async function leerGastosFijos(
  sb: SupabaseClient,
  hoy = new Date().toISOString().slice(0, 10),
): Promise<ResumenGastosFijos> {
  const { data, error } = await sb.from("gastos_fijos").select(COLUMNAS_GASTOS_FIJOS);

  if (error) {
    if (!["PGRST205", "42P01"].includes(error.code)) {
      console.error("[gastos_fijos] query error:", error);
    }
    return { items: [], totalMensual: 0, sinDato: true };
  }

  const items = ((data ?? []) as GastoFijoRow[])
    .filter((r) => vigente(r, hoy))
    .map(prorratearMensual)
    .sort((a, b) => b.mensualClp - a.mensualClp);

  return {
    items,
    totalMensual: items.reduce((s, g) => s + g.mensualClp, 0),
    sinDato: items.length === 0,
  };
}
