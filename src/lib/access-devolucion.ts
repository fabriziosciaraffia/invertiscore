// ─────────────────────────────────────────────────────────────────────────────
// CÓMO SE DESHACE UN COBRO (04-nov-2026, auditoría de promesas parte 1: «nunca queda un crédito gastado sin informe»).
// Módulo PURO: el tipo y el mapeo los usan el candado de «Analizar este» (guia/analizar-una-vez.ts, sin Supabase) y
// access.ts › devolverCobro, que hace la devolución. Lo fija el tier DATOS-Y-PLATA.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cómo se deshace un cobro (04-nov-2026, auditoría de promesas): de dónde salió el crédito. El ilimitado no consume
 * (nada que devolver); la bienvenida se devuelve apagando la marca; un lote, sumándole 1; el contador viejo, también.
 */
export type Devolucion =
  | { tipo: "nada" }
  | { tipo: "bienvenida" }
  | { tipo: "lote"; loteId: string }
  | { tipo: "legacy" }
  /** Cuando no se sabe de qué lote salió (un cobro de otra solicitud, del que solo quedó el `charge_mode`): un crédito
   *  nuevo, sin vencimiento, con fuente `devolucion_cobro`. */
  | { tipo: "credito-nuevo" };

/** La devolución de un cobro del que solo se guardó el modo (guia_analisis / semanal_str_analisis › charge_mode). */
export function devolucionDesdeModo(mode: string | null | undefined): Devolucion {
  if (mode === "welcome") return { tipo: "bienvenida" };
  if (mode === "paid") return { tipo: "credito-nuevo" };
  return { tipo: "nada" };
}

/** La fuente del crédito que devuelve un cobro sin lote conocido (credit_grants.source). */
export const FUENTE_DEVOLUCION_COBRO = "devolucion_cobro";
