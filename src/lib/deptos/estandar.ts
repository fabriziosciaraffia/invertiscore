// EL FINANCIAMIENTO POR DEFECTO DE TODO EL SITIO (30-oct-2026, decisión de Fabrizio): pie 20 %, 30 años y la tasa del
// motor (config.tasa_hipotecaria). UNA SOLA CONSTANTE PARA EL PLAZO: la leen el número único de «convienen», la vista global
// de /explorar y sus Filtros, /deptos y su respuesta, el pop-up de «Analizar este», el wizard de la puerta A, el perfil con
// que nace una cuenta nueva por cualquier puerta, y el semanal y la selección diaria de quien no eligió plazo (el elegido a
// mano o el de su último informe se conserva: perfil-busqueda.ts). Antes (16-oct-2026) el estándar de /deptos era 25 años.
// Sin dependencias: el cliente lo lee sin cargar el motor.
export const PIE_POR_DEFECTO = 20;
export const PLAZO_POR_DEFECTO = 30;
/** Los nombres de siempre de /deptos, Explorar y la guía: los mismos valores. */
export const PIE_DEPTOS = PIE_POR_DEFECTO;
export const PLAZO_DEPTOS = PLAZO_POR_DEFECTO;
/** Los dos pies que evalúa la noche: el estándar y el de la alternativa «con qué pie sí». */
export const PIES_DEPTOS = [20, 30] as const;
/** El plazo de las columnas `*_20_25` / `*_30_25` de avisos_evaluados: el mismo aviso a 25 años, que la noche sigue
 *  llenando porque 25 es una opción de Filtros. NO es el plazo por defecto: las columnas llevan el número en el nombre. */
export const PLAZO_COLUMNAS_25 = 25;

/** LA TASA QUE SE PUEDE ELEGIR (30-oct-2026, goal «la tasa editable en Filtros»): de 3,0 % a 6,0 %, de a 0,25. Fuera de la
 *  lista es «la de hoy» (null): la del motor, `config.tasa_hipotecaria`, que la sigue cuando se actualiza. Elegir «La de hoy»
 *  guarda null, nunca el número del día. */
export const TASAS_ELEGIBLES: readonly number[] = Array.from({ length: 13 }, (_, i) => 3 + i * 0.25);
export const esTasaElegible = (t: unknown): t is number => typeof t === "number" && TASAS_ELEGIBLES.includes(t);
/** Una tasa que llega de afuera (la URL, un cuerpo JSON): la de la lista o null (la de hoy). */
export const tasaElegidaDe = (t: unknown): number | null => {
  const n = typeof t === "string" && t.trim() !== "" ? Number(t) : t;
  return esTasaElegible(n) ? n : null;
};
