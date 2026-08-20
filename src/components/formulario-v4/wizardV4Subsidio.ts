// Subsidio a la Tasa (Ley 21.748 + ampliación 11-ago-2026) — helpers v4. Reusa
// la fuente de verdad (lib/constants/subsidio): vivienda nueva en primera venta
// dentro del techo vigente, rebaja desde 0,6 pp. El aviso anticipado usa un
// margen calibrable sobre la estimación interna de valor (NUNCA se muestra el
// número al usuario — regla de copy dura).

import {
  TECHO_UF_SUBSIDIO,
  calcTasaConSubsidio,
  calificaSubsidio,
  aplicaSubsidio,
} from "@/lib/constants/subsidio";
import { DEC } from "./wizardV4Nodes";
import { leerNum } from "./derive";
import type { WizardV4Answers } from "./wizardV4Nodes";

/**
 * Margen del aviso anticipado: 10% sobre el techo vigente.
 *
 * DERIVADO A PROPÓSITO. Era el literal 4400 (techo 4.000 + 10%), y cuando el
 * techo subió a 6.000 ese literal habría apagado el aviso anticipado para TODO
 * el tramo nuevo — sin error, sin log, sin que nadie se enterara. El aviso
 * simplemente habría dejado de aparecer.
 *
 * El margen existe porque acá todavía no hay precio: se compara contra una
 * estimación interna (UF/m² de zona × superficie), que puede quedar corta. El
 * 10% es la holgura para no perderse casos que sí van a calificar cuando el
 * usuario ponga el precio real.
 */
// `* 11 / 10` y no `* 1.1`: en binario 6000 * 1.1 da 6600.000000000001, y un
// umbral con cola de flotante es exactamente el tipo de detalle que después
// nadie entiende al leer un log.
export const AVISO_MARGEN_UF = (TECHO_UF_SUBSIDIO * 11) / 10;

export { TECHO_UF_SUBSIDIO, calcTasaConSubsidio };

/**
 * ¿Mostrar el aviso anticipado? tipo=nuevo y la estimación interna de valor
 * (UF/m² zona × superficie) bajo el margen. Solo decide visibilidad — el copy
 * jamás revela el número.
 */
export function avisoSubsidioAplica(a: WizardV4Answers, precioM2UF: number | null): boolean {
  if (a.tipoPropiedad !== "nuevo") return false;
  if (!precioM2UF || precioM2UF <= 0) return false;
  const sup = leerNum(a.superficieUtil, DEC.superficie);
  if (sup <= 0) return false;
  return precioM2UF * sup <= AVISO_MARGEN_UF;
}

/** ¿El precio real + tipo califican al subsidio? (nuevo, dentro del techo). */
export function calificaSubsidioV4(a: WizardV4Answers): boolean {
  return calificaSubsidio(a.tipoPropiedad ?? "", leerNum(a.precio, DEC.precioUF));
}

/** Tasa con subsidio dada la tasa de mercado real (rebaja 0,6pp). */
export function tasaConSubsidioV4(tasaMercado: number): number {
  return calcTasaConSubsidio(tasaMercado);
}

/**
 * ¿La tasa elegida está en nivel subsidiado? Client-side con la tasa de mercado
 * REAL (esquiva el quirk del fallback 4.1 en results.subsidioTasa del motor).
 * Sirve para el rótulo "tasa con subsidio" del resumen.
 */
export function subsidioAplicadoV4(a: WizardV4Answers, tasaMercado: number): boolean {
  if (!calificaSubsidioV4(a)) return false;
  const tasa = leerNum(a.tasaInteres, DEC.tasa);
  if (tasa <= 0) return false;
  return aplicaSubsidio(tasa, calcTasaConSubsidio(tasaMercado));
}
