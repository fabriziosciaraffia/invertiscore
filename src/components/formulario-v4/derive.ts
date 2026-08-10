// Derivaciones puras del wizard v4 (precio, pie normalizado, cuota). Reusa los
// FORMATEADORES y la fórmula de dividendo de v3 (funciones puras, estables) —
// no se reinventan.
//
// El PARSEO ya no viene de v3. `parseNum` y `parseDecimalLocale` leen el punto
// con significados opuestos (miles vs decimal), y esa ambigüedad es justo lo que
// la migración a `NumericInput` cierra: v4 lee todo con `parseNumeroCL`, una
// sola regla, con la precisión que declara `DEC` para cada campo.
//
// v3 y v1 siguen con los suyos: no se tocan en esta fase.

import { calcDividendo, fmtCLP, fmtUF } from "@/components/formulario-v3/wizardV3State";
import { parseNumeroCL, type Decimales } from "@/lib/numero-cl";
import { DEC, decPie, type PieUnidad, type WizardV4Answers } from "./wizardV4Nodes";

export { fmtCLP, fmtUF };

/**
 * Lectura numérica del wizard. Devuelve 0 cuando el texto no se puede leer.
 *
 * El 0 conserva el contrato de los call-sites, que preguntan `> 0` para decidir
 * si el campo está listo. Antes un texto ambiguo devolvía un número plausible y
 * equivocado y el wizard dejaba seguir; ahora devuelve 0 y el Continuar queda
 * bloqueado, que es lo que corresponde. Quien necesite distinguir "vacío" de
 * "ilegible" usa `parseNumeroCL` directo — `NumericInput` ya lo hace.
 */
export function leerNum(texto: string | undefined, decimales: Decimales): number {
  return parseNumeroCL(texto ?? "", decimales) ?? 0;
}

/**
 * ¿El texto nuevo cambia el VALOR respecto del anterior?
 *
 * Los campos del resumen commitean en blur, y el blur ocurre igual cuando el
 * usuario solo miró el campo y salió con un click o con Tab. Sin esta pregunta,
 * ese paseo se registraba como edición y con eso: marcaba el tag "corregido por
 * ti" sobre un número que puso Franco, emitía `wizard4_edit_from_summary` a
 * PostHog, borraba la nota de cascada de la card y —en arriendo, tarifa,
 * ocupación y tasa— forzaba el modo a "corregir", que en el dry-run saca a esa
 * variable del set de sensibles.
 *
 * Se comparan valores PARSEADOS, no textos: "820000" y "820.000" son el mismo
 * arriendo, y reescribir el formato no es corregir. Con la misma precisión de
 * campo que usa el input, así que 5 y 5,0 tampoco difieren donde `DEC` dice 0.
 *
 * Ojo con el 0 de `leerNum`: cubre el vacío y el ilegible por igual. La
 * consecuencia buscada es que escribir basura sobre un campo vacío no cuente
 * como edición; borrar un campo que tenía valor SÍ cuenta, porque ahí el valor
 * cambió de verdad.
 *
 * Vive acá, fuera del componente, porque el repo no tiene runner de React: es la
 * única forma de que los tests corran este código y no una réplica.
 */
export function esEdicionReal(
  nuevo: string,
  previo: string,
  decimales: Decimales,
): boolean {
  return leerNum(nuevo, decimales) !== leerNum(previo, decimales);
}

/** Concordancia singular/plural de "dormitorio(s)". */
export function dormLabel(n: number): string {
  return `${n} ${n === 1 ? "dormitorio" : "dormitorios"}`;
}

/** Precio en UF (0 si vacío/ inválido). */
export function precioUF(a: WizardV4Answers): number {
  return leerNum(a.precio, DEC.precioUF);
}

/** Superficie útil en m² (0 si vacía/ inválida). */
export function superficieM2(a: WizardV4Answers): number {
  return leerNum(a.superficieUtil, DEC.superficie);
}

/** Tasa anual % (default de mercado si no hay). */
export function tasaPct(a: WizardV4Answers, fallback = 4.72): number {
  const t = leerNum(a.tasaInteres, DEC.tasa);
  return t > 0 ? t : fallback;
}

/** Plazo en años. */
export function plazoAnios(a: WizardV4Answers): number {
  return Number(a.plazoCredito) || 25;
}

/**
 * Pie normalizado a % del precio, desde la unidad en que lo escribió el usuario
 * ($ / UF / %). Necesita el precio (UF) y la UF del día para convertir CLP.
 * Devuelve 0 si falta info.
 */
export function piePct(a: WizardV4Answers, ufCLP: number): number {
  // La unidad por defecto es "%" (coincide con el display inicial de PieScreen);
  // sin este default, un pie escrito antes de tocar el toggle se interpretaba
  // como CLP y daba piePct≈0.
  const unit = a.pieUnidad ?? "pct";
  const monto = leerNum(a.pieMonto, decPie(unit));
  const pUF = precioUF(a);
  if (monto <= 0) return 0;
  if (unit === "pct") return Math.min(monto, 100);
  if (pUF <= 0 || ufCLP <= 0) return 0;
  const pieEnUF = unit === "uf" ? monto : monto / ufCLP;
  return Math.min((pieEnUF / pUF) * 100, 100);
}

/**
 * Factor multiplicativo para reexpresar el pie entre unidades ($ / UF / %).
 * Es lo que corre el toggle de unidad de PieScreen junto a `convertirUnidad`
 * (fix pie-cero: el toggle convierte el monto, ya no lo vacía).
 *
 * `null` cuando falta la base de conversión (precio en UF, o UF del día para
 * pesos): sin base no se convierte — el llamador conserva el valor y la unidad
 * anteriores en vez de inventar o borrar. Vive acá, no en el componente, para
 * que los tests ejerciten este código y no una réplica.
 */
export function factorPie(
  desde: PieUnidad,
  hasta: PieUnidad,
  pUF: number,
  ufCLP: number,
): number | null {
  if (desde === hasta) return 1;
  const tocaPct = desde === "pct" || hasta === "pct";
  const tocaClp = desde === "clp" || hasta === "clp";
  if ((tocaPct && pUF <= 0) || (tocaClp && ufCLP <= 0)) return null;
  const haciaUF = desde === "pct" ? pUF / 100 : desde === "uf" ? 1 : 1 / ufCLP;
  const desdeUF = hasta === "pct" ? 100 / pUF : hasta === "uf" ? 1 : ufCLP;
  return haciaUF * desdeUF;
}

/** Pie en UF a partir de la unidad escrita. */
export function pieUF(a: WizardV4Answers, ufCLP: number): number {
  const pUF = precioUF(a);
  const pct = piePct(a, ufCLP);
  return (pUF * pct) / 100;
}

/** Pie en CLP. */
export function pieCLP(a: WizardV4Answers, ufCLP: number): number {
  return Math.round(pieUF(a, ufCLP) * ufCLP);
}

/** Cuota (dividendo) mensual estimada en CLP, o 0 si falta info. */
export function cuotaCLP(a: WizardV4Answers, ufCLP: number): number {
  const pUF = precioUF(a);
  const pct = piePct(a, ufCLP);
  if (pUF <= 0 || ufCLP <= 0) return 0;
  return calcDividendo(pUF, pct, plazoAnios(a), tasaPct(a), ufCLP);
}

/** Metros a texto legible: 800 → "800 m", 1500 → "1,5 km". */
function fmtRadio(m: number): string {
  return m < 1000 ? `${m} m` : `${String(m / 1000).replace(".", ",")} km`;
}

/**
 * Procedencia del arriendo sugerido, para la línea de fuente. Vive acá porque la
 * declaran DOS pantallas (arr en el Acto 3 y el resumen); tenerla duplicada ya
 * costó una vez: las dos decían "mediana de N arriendos comparables publicados en
 * la zona" mirando solo el tamaño de la muestra, así que un número traído de la
 * comuna entera —y de una tabla congelada cuatro meses— se presentaba con el mismo
 * aval que los comparables medidos por radio.
 *
 * El nivel manda (`fuente`, que declara el endpoint); el n solo modula el caveat.
 */
export function fuenteArriendoLine(
  fuente: "radio" | "comuna" | "sin-dato",
  n: number,
  radio: number | null,
): string {
  if (fuente === "sin-dato" || n <= 0) {
    return "sin arriendos publicados cerca para comparar — el valor lo pones tú";
  }
  if (fuente === "comuna") {
    return `mediana de ${n} arriendos de la comuna completa — no de la zona del depto`;
  }
  const donde = radio ? `a menos de ${fmtRadio(radio)} de la dirección` : "en la zona";
  return n >= 10
    ? `mediana de ${n} arriendos publicados ${donde}`
    : `mediana de solo ${n} ${n === 1 ? "arriendo publicado" : "arriendos publicados"} ${donde} — muestra chica, ajústalo si conoces el arriendo real`;
}

/**
 * La misma procedencia, comprimida para verse SIN abrir el editor.
 *
 * EXCEPCIÓN JUSTIFICADA A R7. La regla del resumen es que la fuente aparece solo
 * con el editor abierto (ver `FieldShell`), y sigue vigente para los otros 20
 * campos. El arriendo es la excepción, con un criterio que hay que poder cumplir
 * para pedir otra:
 *
 *   la procedencia se muestra en reposo SOLO cuando cambia entre análisis.
 *
 * El arriendo lo cumple: su valor sale de una medición cuya muestra y radio
 * varían en cada dirección —29 comparables a 750 m en un caso, 4 a 2 km en otro,
 * ninguno en el tercero—, así que el número no significa lo mismo de un análisis
 * a otro y esconderlo detrás de un click esconde justo lo que cambia. Los demás
 * campos NO lo cumplen: contribuciones sale siempre de la fórmula SII, vacancia y
 * GGCC son defaults de mercado, el resto lo escribe el usuario. Su procedencia es
 * la misma frase todas las veces, y ahí R7 tiene razón.
 *
 * Quien quiera sumar un campo a la excepción tiene que pasar ese filtro primero.
 *
 * `null` = no hay nada que decir (no debería ocurrir con el arriendo; el estado
 * sin dato tiene su propia frase).
 */
export function procedenciaArriendoCorta(
  fuente: "radio" | "comuna" | "sin-dato",
  n: number,
  radio: number | null,
  /** La sugerencia de Franco, para contrastarla cuando el usuario puso otra. */
  sugerido: number | null,
  /** El usuario reemplazó la sugerencia por un valor propio. */
  corregido: boolean,
): string | null {
  if (fuente === "sin-dato" || n <= 0) return "sin arriendos publicados cerca para comparar";

  const donde = fuente === "comuna"
    ? "de la comuna"
    : radio ? `a ${fmtRadio(radio)}` : "en la zona";
  const base = `${n} ${n === 1 ? "arriendo" : "arriendos"} ${donde}`;

  // Con el valor corregido, la línea deja de ser la ficha del número mostrado y
  // pasa a ser la distancia contra el mercado. Es la misma tensión que el informe
  // va a nombrar después: mejor verla antes de generarlo que como sorpresa.
  if (corregido && sugerido && sugerido > 0) return `${base} marcan ${fmtCLP(sugerido)}`;

  return n >= 10 ? base : `solo ${base} — muestra chica`;
}
