// ─────────────────────────────────────────────────────────────────────────────
// EL INTERRUPTOR DE LA PROSA IA DEL INFORME (25-sep-2026)
//
// Decisión de Fabrizio: la IA salió de lo que el usuario ve en el informe LTR y STR (el titular lo
// escribe el motor, `titular-motor.ts`), y la maquinaria que la genera se retira por partes. Esta
// es la primera: la generación se APAGA sin borrar código, detrás de este interruptor.
//
// Apaga los cuatro disparadores que quedaban en producción —crear LTR (`api/analisis`), crear STR
// (`api/analisis/short-term`), post-pago (`api/payments/confirm`) y el cron
// `precalentar-prosa`— y la generación de la comparativa AMBAS (`api/analisis/comparativa/ai`).
//
// Mismo contrato que `OPENFACTURA_ENABLED`: prende SOLO con el valor exacto "true"; sin la
// variable, o con cualquier otro valor, la generación no corre. Reversible desde el dashboard de
// Vercel sin deploy. Lo fija el tier RETIRO-IA del golden.
// ─────────────────────────────────────────────────────────────────────────────

/** ¿Se genera prosa IA del informe? Apagado salvo `PROSA_IA_ENABLED === "true"`. */
export function prosaIaActiva(): boolean {
  return process.env.PROSA_IA_ENABLED === "true";
}
