// ─────────────────────────────────────────────────────────────────────────────
// Parser y formateador numérico chileno — fuente única
//
// Módulo PURO: sin red, sin DB, sin imports. Se puede cargar y correr directo
// con tsx (ver `scripts/test-numero-cl.ts`).
//
// INFRA SIN CONSUMIDORES TODAVÍA. Nace para reemplazar, en una fase posterior,
// a las cuatro implementaciones que hoy conviven:
//   · `parseNum`            (wizardV3State.ts) — el punto es SIEMPRE miles
//   · `parseDecimalLocale`  (wizardV3State.ts) — el punto es SIEMPRE decimal
//   · dos duplicados literales de `parseNum` en /analisis/nuevo y
//     /analisis/renta-corta
// Las dos primeras leen el MISMO carácter con significados opuestos, así que
// "1.500" vale 1500 en el campo precio y 1,5 en el campo superficie. Los ocho
// filtros de entrada del wizard tapan eso borrando el separador "equivocado" en
// silencio: "4,5" entra como 45. Todos los errores conocidos son ×10.
//
// QUÉ RESUELVE ESTE MÓDULO Y QUÉ NO
// ─────────────────────────────────
// Resuelve la LECTURA de un string ya tipeado. No es un filtro de teclas ni un
// validador de rango — eso último es `plausibilidad.ts`, que sigue siendo la
// red dura del borde. Acá un input imposible devuelve `null`, no un número
// plausible pero equivocado: la decisión de qué hacer con el `null` (bloquear,
// avisar, dejar el campo como estaba) es del consumidor.
//
// NUNCA devuelve NaN ni 0 de fallback. El 0 de fallback es justamente lo que
// hace que un campo vacío se lea como "el usuario declaró cero" — el mismo bug
// que `numOrNaN` corrigió en el guard.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decimales admitidos por el campo. El tope de 2 no es arbitrario: es lo que
 * mantiene la desambiguación cerrada. Con 3 decimales, "1.500" sería a la vez
 * un miles válido (1500) y un decimal válido (1,5) y no habría regla —
 * posicional ni de ninguna clase— capaz de elegir sin adivinar.
 */
export type Decimales = 0 | 1 | 2;

/**
 * Lee un número escrito por una persona en Chile.
 *
 * REGLA DE DESAMBIGUACIÓN — determinística y POSICIONAL, no heurística. Nunca
 * mira QUÉ carácter es el separador, solo DÓNDE está y cuántos dígitos lo
 * siguen. De ahí sale gratis que también lea el formato gringo ("1,234.56").
 *
 *   1. El último separador es DECIMAL si le siguen 1 o 2 dígitos.
 *   2. Si le siguen exactamente 3 dígitos, es MILES.
 *   3. Todo separador que no sea el último es siempre MILES.
 *   4. Si el valor trae más decimales que los declarados, devuelve `null`. No
 *      trunca en silencio: truncar es exactamente el bug que este módulo viene
 *      a matar.
 *   5. Vacío, sin dígitos o malformado → `null`.
 *
 * Sobre la regla 2: el enunciado original la condicionaba a que fuera el ÚNICO
 * separador del string. Se generalizó a todo separador final seguido de 3
 * dígitos porque "1.234.567" —que tiene dos— tiene que dar 1234567, y con la
 * condición de unicidad caía en la regla 1, daba 1234,567 y moría en la regla 4.
 * La generalización es consistente con la regla 3: si los separadores previos
 * son de miles, el último con 3 dígitos también lo es.
 *
 * Cuando hay algún separador de MILES, el agrupamiento tiene que estar bien
 * formado (primer grupo de 1-3 dígitos, los siguientes de exactamente 3). Eso
 * es lo que hace que "12.34.567" o "1234.567" den `null` en vez de un número
 * inventado. La validación NO corre si no hay separador de miles, porque si no
 * "4297,4" —cuatro dígitos enteros seguidos— se rechazaría sin motivo.
 *
 * @param input  texto crudo del campo. Se le hace trim; admite signo inicial.
 * @param decimales  cuántos decimales acepta ESE campo.
 * @returns el número, o `null` si no se puede leer sin adivinar.
 */
export function parseNumeroCL(input: string, decimales: Decimales): number | null {
  if (typeof input !== "string") return null;

  const limpio = input.trim();
  if (limpio === "") return null;

  // Signo. Se separa antes de mirar los dígitos para que "-" pelado caiga en la
  // regla 5 (sin dígitos) y no en un parse a -0.
  const negativo = limpio[0] === "-";
  const cuerpo = negativo || limpio[0] === "+" ? limpio.slice(1) : limpio;

  // Solo dígitos y separadores: nada de "$", "UF", espacios internos ni letras.
  // Limpiar prefijos de moneda es trabajo del consumidor, no de acá.
  if (!/^[\d.,]+$/.test(cuerpo)) return null;
  if (!/\d/.test(cuerpo)) return null; // regla 5: "," "." "-" "+"

  const posiciones: number[] = [];
  for (let i = 0; i < cuerpo.length; i++) {
    const c = cuerpo[i];
    if (c === "." || c === ",") posiciones.push(i);
  }

  // Dígitos que siguen al ÚLTIMO separador. Son todos dígitos por construcción:
  // después del último separador ya no hay separadores, y el charset está
  // validado arriba.
  const ultima = posiciones.length > 0 ? posiciones[posiciones.length - 1] : -1;
  const cola = ultima >= 0 ? cuerpo.slice(ultima + 1) : "";

  let ultimaEsDecimal: boolean;
  if (posiciones.length === 0) {
    ultimaEsDecimal = false;
  } else if (cola.length === 1 || cola.length === 2) {
    ultimaEsDecimal = true; // regla 1
  } else if (cola.length === 3) {
    ultimaEsDecimal = false; // regla 2
  } else if (cola.length === 0) {
    // Separador colgando ("4,"): el usuario está a mitad de tipeo. Parte
    // decimal vacía, no es un error.
    ultimaEsDecimal = true;
  } else {
    // 4+ dígitos: no es grupo de miles válido, y como decimal excedería el tope
    // de 2 de todas formas. Un solo camino, `null`.
    return null;
  }

  const enteroTxt = ultimaEsDecimal ? cuerpo.slice(0, ultima) : cuerpo;
  const fraccionTxt = ultimaEsDecimal ? cola : "";

  // Agrupamiento de miles (regla 3). `split` sobre ambos separadores: la regla
  // es posicional, así que "1.234.567" y "1,234,567" se validan igual.
  const grupos = enteroTxt.split(/[.,]/);
  if (grupos.length > 1) {
    if (grupos[0].length < 1 || grupos[0].length > 3) return null;
    for (let i = 1; i < grupos.length; i++) {
      if (grupos[i].length !== 3) return null;
    }
  }
  const digitosEnteros = grupos.join("");

  // Regla 4 sobre los decimales SIGNIFICATIVOS: "4,50" con un campo de 1 decimal
  // es 4,5 y se acepta. Lo que se rechaza es perder información, no un cero
  // decorativo que el propio `formatNumeroCL` pudo haber escrito.
  const fraccionSignificativa = fraccionTxt.replace(/0+$/, "");
  if (fraccionSignificativa.length > decimales) return null;

  const valor = Number(`${digitosEnteros || "0"}.${fraccionTxt || "0"}`);
  if (!Number.isFinite(valor)) return null;
  if (valor === 0) return 0; // normaliza el -0 (Object.is(-0, 0) es false)
  return negativo ? -valor : valor;
}

/**
 * Escribe un número en formato chileno: miles con punto, decimales con coma.
 *
 * Los decimales son FIJOS — `formatNumeroCL(4.5, 2)` da "4,50". Rellenar en vez
 * de recortar es lo que hace el ida y vuelta estable: la coma queda siempre
 * escrita, así que al re-parsear no hay nada que desambiguar.
 *
 * Agrupa a mano en vez de usar `toLocaleString("es-CL")` a propósito: este es el
 * módulo que DEFINE el formato, y no puede depender de qué datos de ICU traiga
 * el runtime. Es también la razón por la que no importa nada.
 *
 * Los valores no finitos salen como "—", igual que `formatearNumero` en
 * `plausibilidad.ts` — no se inventa una convención nueva.
 */
export function formatNumeroCL(valor: number, decimales: Decimales): string {
  if (!Number.isFinite(valor)) return "—";

  const fijo = Math.abs(valor).toFixed(decimales);
  const [entero, fraccion] = fijo.split(".");
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cuerpo = fraccion ? `${conMiles},${fraccion}` : conMiles;

  // El signo se pone solo si sobrevive al redondeo: -0,004 con 0 decimales es
  // "0", nunca "-0".
  return valor < 0 && Number(fijo) !== 0 ? `-${cuerpo}` : cuerpo;
}
