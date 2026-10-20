// ─────────────────────────────────────────────────────────────────────────────
// QUÉ AVISO DE VENTA ES PLAUSIBLE, Y CUÁNDO DOS SON EL MISMO — una sola regla para la evaluación de la noche
// (`avisosEvaluables`, depurar.ts) y para las páginas de comuna (comunas-seo.ts).
//
// Hasta el 20-oct-2026 las páginas de comuna no la aplicaban: en el 2D de Puente Alto entraban 9 avisos de UF 607 a
// 1.093 (menos de UF 20/m²) que la noche descarta, la mediana caía a UF 1.214 contra UF 1.990 de la evaluación y la
// comuna quedaba primera del ranking por eso (decisión de Fabrizio: el mismo filtro en las dos). Lo fija el tier
// COMUNAS-DISENO, y AVISOS prueba que la noche siga descartando lo mismo.
// ─────────────────────────────────────────────────────────────────────────────

export const PRECIO_UF_MIN = 700;
export const PRECIO_UF_MAX = 60000;
export const UF_M2_MIN = 20;
export const UF_M2_MAX = 300;

/** ¿El precio, y su precio por m², están en el rango de lo que se publica de verdad? */
export function ventaPlausible(precioUF: number, m2: number): boolean {
  if (!(precioUF > 0 && m2 > 0)) return false;
  const ufm2 = precioUF / m2;
  return precioUF >= PRECIO_UF_MIN && precioUF <= PRECIO_UF_MAX && ufm2 >= UF_M2_MIN && ufm2 <= UF_M2_MAX;
}

/** Dos avisos con esta misma clave son el mismo depto publicado dos veces. */
export function claveAviso(a: {
  comuna: string;
  m2: number;
  dormitorios: number | null;
  banos: number | null;
  precioUF: number;
  lat: number | null;
  lng: number | null;
}): string {
  return [a.comuna, Math.round(a.m2), a.dormitorios, a.banos, Math.round(a.precioUF), Number(a.lat).toFixed(3), Number(a.lng).toFixed(3)].join("|");
}
