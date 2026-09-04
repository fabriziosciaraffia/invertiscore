// ─────────────────────────────────────────────────────────────────────────────
// COMPATIBILIDAD DE LECTURA · results STR persistidos antes del rename revenue → ingreso
// (T0 CONGELADO · 04-sep-2026). Las filas escritas con las claves viejas
// (`revenueAnual`, `breakEvenRevenueAnual`, `revenueZonaMensual`, `percentilRevenue`) se
// leen igual: si falta la clave nueva se copia desde la vieja. No escribe nada en la
// base; el recompute-on-load (que reconstruye desde airbnbRaw) ya emite las nuevas, así
// que esto solo importa cuando el recompute no es posible (filas legacy sin airbnbRaw).
// Los campos de la respuesta de AirROI (`airbnbRaw.revenue`, `percentiles.revenue`) NO se
// tocan: son de la fuente, no del motor.
// ─────────────────────────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ShortTermResult } from "@/lib/engines/short-term-engine";

const copiar = (o: any, vieja: string, nueva: string) => {
  if (o && typeof o === "object" && o[nueva] === undefined && o[vieja] !== undefined) o[nueva] = o[vieja];
};

/** Devuelve el mismo objeto con las claves nuevas presentes (muta en sitio, idempotente). */
export function normalizarResultsStrPersistidos<T extends ShortTermResult | null | undefined>(results: T): T {
  const r = results as any;
  if (!r || typeof r !== "object") return results;
  for (const k of ["conservador", "base", "agresivo"]) copiar(r.escenarios?.[k], "revenueAnual", "ingresoAnual");
  for (const k of ["str_auto", "str_admin"]) copiar(r.comparativa?.[k], "revenueAnual", "ingresoAnual");
  copiar(r, "breakEvenRevenueAnual", "breakEvenIngresoAnual");
  copiar(r.zonaSTR, "revenueZonaMensual", "ingresoZonaMensual");
  copiar(r.zonaSTR, "percentilRevenue", "percentilIngreso");
  if (Array.isArray(r.sensibilidad)) for (const fila of r.sensibilidad) copiar(fila, "revenueAnual", "ingresoAnual");
  return results;
}
