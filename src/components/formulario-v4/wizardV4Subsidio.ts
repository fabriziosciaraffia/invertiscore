// Subsidio a la Tasa (Ley 21.748, ampliada por la Ley 21.836) — helpers v4. Reusa
// la fuente de verdad (lib/constants/subsidio): vivienda nueva en primera venta
// dentro del techo vigente, 0,6 pp de referencia. El aviso anticipado usa un
// margen calibrable sobre la estimación interna de valor (NUNCA se muestra el
// número al usuario — regla de copy dura).

import {
  REBAJA_SUBSIDIO,
  TECHO_UF_SUBSIDIO,
  CONDICION_SUBSIDIO,
  LEY_SUBSIDIO,
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

/**
 * Tasa con subsidio que el wizard OFRECE, dada la tasa de mercado real: la rebaja mínima (0,6 pp)
 * exacta, a dos decimales. 4,04 − 0,6 = 3,44, no 3,40.
 *
 * Hasta el 27-sep-2026 era `calcTasaConSubsidio`, que redondea a UN decimal y así prometía 0,64 pp
 * de rebaja con una tasa de 4,04 —justo lo que el copy dice que Franco no hace: «esta es la
 * mínima»—. El motor sigue usando `calcTasaConSubsidio` para su compuerta `aplicado` (tasa
 * ingresada ≤ subsidiada + 0,2): cambiarla ahí movería esa compuerta en análisis ya hechos, y la
 * tolerancia de 0,2 absorbe la diferencia (3,44 ≤ 3,4 + 0,2).
 */
export function tasaConSubsidioV4(tasaMercado: number): number {
  return Math.round((tasaMercado - REBAJA_SUBSIDIO) * 100) / 100;
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

// ── UN USADO NUNCA QUEDA CON LA TASA DEL SUBSIDIO (08-oct-2026) ─────────────────────────────────
// Hasta acá el resumen cambiaba el tipo o el precio y dejaba la tasa como estaba: un nuevo de UF
// 5.500 con la opción «Con subsidio» (3,44%) pasado a usado se iba al motor con 3,44%, mientras la
// nota decía «volví la tasa a mercado». Ahora el cambio sale de acá con su parche entero.

/** El texto de la tasa como lo escribe el wizard (dos decimales, coma). */
const tasaTexto = (t: number) => t.toFixed(2).replace(".", ",");

/**
 * ¿La tasa de estas respuestas es la que el wizard dio por el subsidio? Es la de la opción «Con
 * subsidio» —o una estimada que la compuerta del motor reconoce como tal—; una pre-aprobada es un
 * dato de la persona y no se toca. No mira si el depto califica: sirve justo cuando deja de hacerlo.
 */
export function tasaEsDelSubsidio(a: WizardV4Answers, tasaMercado: number): boolean {
  if (a.tasaModo === "preaprobada" || !(tasaMercado > 0)) return false;
  const tasa = leerNum(a.tasaInteres, DEC.tasa);
  return tasa > 0 && aplicaSubsidio(tasa, calcTasaConSubsidio(tasaMercado));
}

export type CambioConSubsidio = {
  /** El parche COMPLETO: el cambio pedido y, si el depto sale del subsidio con su tasa, la de mercado. */
  patch: Partial<WizardV4Answers>;
  /** Lo que se le dice en «Cómo lo financias», o null si la calificación no cambió. */
  nota: string | null;
};

/**
 * Un cambio del resumen que puede sacar o meter al depto en el subsidio: el tipo o el precio. Si
 * sale y la tasa era la del subsidio, la tasa vuelve a la de mercado (estimada) y la nota lo dice
 * con la cifra; si entra, la nota ofrece revisar la tasa y no la toca.
 */
export function cambioConSubsidio(
  a: WizardV4Answers,
  cambio: Partial<WizardV4Answers>,
  tasaMercado: number,
  motivo: "tipo" | "precio",
): CambioConSubsidio {
  const despues = { ...a, ...cambio };
  const antes = calificaSubsidioV4(a);
  const ahora = calificaSubsidioV4(despues);
  if (ahora) {
    if (antes) return { patch: cambio, nota: null };
    const quien = motivo === "tipo" ? "Este tipo" : "Con ese precio";
    return { patch: cambio, nota: `${quien} puede entrar al subsidio a la tasa (${LEY_SUBSIDIO}), que es para ${CONDICION_SUBSIDIO}. Revisa la opción en la tasa.` };
  }
  const vuelve = tasaEsDelSubsidio(a, tasaMercado);
  if (!antes && !vuelve) return { patch: cambio, nota: null };
  const quien = motivo === "tipo" ? "Un usado no entra" : "Con ese precio ya no entra";
  const sale = `${quien} al subsidio a la tasa (${LEY_SUBSIDIO}), que es para ${CONDICION_SUBSIDIO}`;
  return vuelve
    ? { patch: { ...cambio, tasaModo: "estimada", tasaInteres: tasaTexto(tasaMercado) }, nota: `${sale}: volví la tasa a mercado, ${tasaTexto(tasaMercado)}%.` }
    : { patch: cambio, nota: `${sale}. Tu tasa no cambia.` };
}
