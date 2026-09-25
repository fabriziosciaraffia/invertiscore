// ─────────────────────────────────────────────────────────────────────────────
// LA CIFRA DE COMPARABLES — fuente única (25-sep-2026)
//
// Cuántos avisos usa el motor como comparables: los de `scraped_properties` ACTIVOS, con precio y
// superficie, de venta y de arriendo. Es la población de la que salen las medianas y el cap rate
// de referencia (`comuna-stats.ts`, `capref-comuna-query.ts`); contar los inactivos sería prometer
// comparables que no entran en la comparación.
//
// Todo texto público que cite la cifra —landing, metadatos, FAQ, correos, onboarding— lee
// `COMPARABLES_TEXTO`. Ninguno la escribe a mano: lo fija el tier CIFRA-COMPARABLES del golden.
//
// Se actualiza a mano, midiendo:
//   select count(*) from scraped_properties
//   where is_active and precio > 0 and superficie_m2 > 0;
// ─────────────────────────────────────────────────────────────────────────────

/** Avisos activos con precio y superficie (venta + arriendo), medidos el 25-sep-2026. */
export const COMPARABLES_MEDIDOS = 41_976;

/** La cifra redondeada HACIA ABAJO a decenas de miles, para el copy: «más de 40 mil». */
export const COMPARABLES_TEXTO = `más de ${Math.floor(COMPARABLES_MEDIDOS / 10_000) * 10} mil`;
