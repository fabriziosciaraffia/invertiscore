// ─────────────────────────────────────────────────────────────────────────────
// Obra nueva en el motor (02-oct-2026, decisiones de Fabrizio tras la FASE 0). Fuente única de:
//   · EL ARRIENDO DE LO NUEVO: el sugerido sube 3% (medido +3%, IC +1% a +5%; el tope que fijó Fabrizio es
//     5%). Solo el SUGERIDO —el que sale de los comparables de la zona—, nunca el que escribe la persona.
//   · EL PIE EN CUOTAS: de 1 («al contado») a 60, con entrega futura o inmediata. La primera cuota se paga
//     al firmar (mes 0) y las demás mes a mes; la TIR (anual) descuenta cada una en el año en que se paga.
//     Las que caen después de la entrega se pagan junto al dividendo, y el flujo lo dice.
//   · EL RIESGO DE LA ESPERA: ya no resta puntaje. El informe con entrega futura lo dice en una línea, sin
//     escenarios ni cálculo de tasa.
// Puro: lo prueba el tier OBRA-NUEVA.
// ─────────────────────────────────────────────────────────────────────────────

export const PREMIO_ARRIENDO_NUEVO = 0.03;
export const MAX_CUOTAS_PIE = 60;

export const FRASE_RIESGO_ENTREGA = "Tu crédito se firma en la entrega: si la tasa sube en la espera, estos números cambian.";

/** El arriendo SUGERIDO para un depto: con obra nueva, 3% más que los comparables de la zona. */
export function arriendoSugeridoObraNueva(monto: number | null | undefined, condicion: string | null | undefined): number | null {
  if (monto == null || !Number.isFinite(monto) || monto <= 0) return monto ?? null;
  return condicion === "nuevo" ? Math.round(monto * (1 + PREMIO_ARRIENDO_NUEVO)) : monto;
}

/** Las cuotas del pie, entero entre 1 y 60 (1 = al contado). */
export function cuotasPieValidas(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v < 1) return 1;
  return Math.min(MAX_CUOTAS_PIE, v);
}

/** Las cuotas por defecto: con entrega futura, hasta la entrega (tope 60); con entrega inmediata, al contado. */
export function cuotasPorDefecto(futura: boolean, mesesHastaEntrega: number): number {
  return futura ? cuotasPieValidas(mesesHastaEntrega) : 1;
}

/** Cuántas cuotas caen después de la entrega (la k-ésima se paga en el mes k, k = 0…n−1; el arriendo y el
 *  dividendo corren desde el mes siguiente a la entrega). */
export function cuotasConDividendo(cuotas: number, mesesHastaEntrega: number): number {
  const n = cuotasPieValidas(cuotas);
  return Math.max(0, n - 1 - Math.max(0, Math.round(mesesHastaEntrega)));
}

/** El monto de las cuotas que se pagan en el año `i` (0 = primer año, meses 1–12) de la TIR. La del mes 0 va
 *  en el momento cero, con los gastos de cierre. */
export function cuotasDelAnio(i: number, cuotas: number, montoCuota: number): number {
  const n = cuotasPieValidas(cuotas);
  if (n <= 1) return 0;
  const desde = i * 12 + 1, hasta = i * 12 + 12;
  const k = Math.max(0, Math.min(hasta, n - 1) - desde + 1);
  return k * montoCuota;
}

/** «Durante 22 meses pagas también $698.750 de cuota.» */
export function lineaCuotasConDividendo(meses: number, monto: string): string {
  return meses === 1 ? `Durante 1 mes pagas también ${monto} de cuota.` : `Durante ${meses} meses pagas también ${monto} de cuota.`;
}
