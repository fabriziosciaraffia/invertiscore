// ─────────────────────────────────────────────────────────────────────────────
// LA CIFRA DE COMPARABLES — fuente única (25-sep-2026)
//
// Cuántos avisos usa el motor como comparables: los de `scraped_properties` ACTIVOS, con precio y
// superficie, de venta y de arriendo. Es la población de la que salen las medianas y el cap rate
// de referencia (`comuna-stats.ts`, `capref-comuna-query.ts`); contar los inactivos sería prometer
// comparables que no entran en la comparación.
//
// Todo texto público que cite la cifra —landing, metadatos, FAQ, correos, onboarding— la lee de
// acá. Ninguno la escribe a mano: lo fija el tier CIFRA-COMPARABLES del golden.
//
// DOS FORMAS, UN NÚMERO (27-sep-2026, decisión de Fabrizio): con signo cuando la cifra va sola y
// grande («+40.000»), y «más de 40.000» dentro de una frase. Las dos salen del mismo piso,
// redondeado hacia abajo a decenas de miles: nunca prometen más de lo medido.
//
// Se actualiza a mano, midiendo:
//   select count(*) from scraped_properties
//   where is_active and precio > 0 and superficie_m2 > 0;
// ─────────────────────────────────────────────────────────────────────────────

/** Avisos activos con precio y superficie (venta + arriendo), medidos el 25-sep-2026. */
export const COMPARABLES_MEDIDOS = 41_976;

/** El piso: lo medido redondeado HACIA ABAJO a decenas de miles (40.000). */
export const COMPARABLES_PISO = Math.floor(COMPARABLES_MEDIDOS / 10_000) * 10_000;

/** Miles con punto, sin depender del ICU del proceso: 40000 → «40.000». */
const conPuntos = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** La cifra sola y grande, con signo: «+40.000». */
export const COMPARABLES_CIFRA = `+${conPuntos(COMPARABLES_PISO)}`;

/** La cifra dentro de una frase: «más de 40.000». */
export const COMPARABLES_TEXTO = `más de ${conPuntos(COMPARABLES_PISO)}`;
