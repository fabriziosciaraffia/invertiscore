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

/**
 * CUÁNTO TARDA UN ANÁLISIS, UNA SOLA CIFRA MEDIDA (05-nov-2026, auditoría de promesas parte 3). El sitio decía «en 30
 * segundos», «en 2 minutos» y «en menos de un minuto». Medido en `analisis.pipeline_timing.submit.total_ms`, últimos 30
 * días: renta larga mediana 2,5 s, máximo 7,2 s (34 informes); renta corta mediana 8,3 s, máximo 10,9 s (8). Cubre los dos.
 */
export const SEGUNDOS_ANALISIS_TOPE = 15;
export const TIEMPO_ANALISIS = `en menos de ${SEGUNDOS_ANALISIS_TOPE} segundos`;

/**
 * EL CONTEO VIVO (05-nov-2026, auditoría de promesas parte 3): la cifra pública ya no es esta constante medida a mano, sino el
 * conteo de la base, leído cada hora (comparables-vivos.ts). La constante queda solo de respaldo si la consulta falla.
 * EL PISO, A MILES (05-nov-2026): el conteo vivo dio 39.950; a decenas de miles habría dicho «+30.000» (y saltado entre
 * 30 y 40 mil de una noche a otra). A miles dice «+39.000»: sigue sin prometer más de lo medido.
 */
export function pisoComparables(n: number): number {
  return Math.floor(n / 1000) * 1000;
}

/** Miles con punto, sin depender del ICU del proceso: 40000 → «40.000». */
const conPuntos = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** La cifra sola y grande, con signo: «+39.000». */
export const cifraComparables = (n: number) => `+${conPuntos(pisoComparables(n))}`;
/** La cifra dentro de una frase: «más de 39.000». */
export const textoComparables = (n: number) => `más de ${conPuntos(pisoComparables(n))}`;

/** El respaldo (la medición a mano del 25-sep-2026), solo si el conteo vivo no responde. */
export const COMPARABLES_PISO = pisoComparables(COMPARABLES_MEDIDOS);
export const COMPARABLES_CIFRA = cifraComparables(COMPARABLES_MEDIDOS);
export const COMPARABLES_TEXTO = textoComparables(COMPARABLES_MEDIDOS);
