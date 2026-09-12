// ─────────────────────────────────────────────────────────────────────────────
// «HAY SALIDA, Y ES ÉSTA» — la fuente única de las ocho superficies (10-sep-2026)
//
// El motor sabe desde `bece47c1` que 179 filas del parque son estructurales Y tienen
// salida moviendo pie y plazo. Nadie leía ese campo, así que ocho lugares del informe
// seguían afirmando lo contrario — el peor, el pop-up: «la brecha no está en cómo estás
// mirando este depto, está en el depto», a dos clics del bloque que muestra la salida.
// Una contradicción dentro de la misma página destruye la confianza en las dos mitades.
//
// Este módulo existe para que esa rama se lea de UN lugar. Ocho `if` con la misma
// condición escrita ocho veces vuelven a divergir; ya divergieron una vez.
//
// ⚠ LA CONDICIÓN LLEVA LAS DOS MITADES, y omitir la primera es un desastre silencioso:
// `sinSalida` es `esEstructural && !alcanzable`, así que en una fila NORMAL —donde algo
// cruza solo— `sinSalida` también es `false`. Preguntar solo por `sinSalida === false`
// manda a las filas sanas por la rama de la salida combinada. Medido mientras se escribía
// esto: 778 filas contra las 179 reales.
//
// VOCABULARIO: nada de «palanca», «vía», «por sí sola», «brecha» ni «supuesto» en lo que
// sale de acá. Son palabras nuestras. El lector dice «cambio», «por separado», «a la vez».
// ─────────────────────────────────────────────────────────────────────────────

import type { HallazgoDistanciaVeredicto } from "./types";

export interface SalidaPorMix {
  /** Lo que hay que mover, en palabras del lector: «el pie en 30% y el plazo en 30 años». */
  movimiento: string;
  /** El gerundio para rematar una frase: «moviendo dos cosas a la vez» · «subiendo el pie». */
  remate: string;
  /** El descuento que ADEMÁS pide, en % positivo, o null si no pide ninguno. */
  descuentoPct: number | null;
  /** Plata propia extra el día uno, en UF. */
  costoDiaUnoUF: number;
  /** Qué dimensiones mueve: el copy STR dice «lo tuyo —pie y plazo—» / «—el pie—». */
  mueve: ("pie" | "plazo")[];
}

/** Lo que el hallazgo STR necesita para decidir la combinación: el tipo mínimo, para que el
 *  builder pueda preguntarlo ANTES de armar el valor completo. */
export type ValorParaSalidaStr = Pick<HallazgoDistanciaVeredicto["valor"], "esEstructural" | "veredictoBase" | "mixPalancas" | "mixPalancasHastaComprar">;

const pct1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

/**
 * ¿Este caso tiene salida combinando, aunque ningún cambio por separado alcance?
 *
 * `null` en los tres casos en que el informe NO puede afirmar que la hay:
 *   · la fila no es estructural — hay una salida más simple y ya se cuenta en otro lado;
 *   · `sinSalida` dice que no la hay;
 *   · `sinSalida` está AUSENTE, o sea que nadie lo midió. Ahí se conserva el texto viejo,
 *     que es lo que esa fila viene publicando: no se cambia una afirmación infundada por
 *     otra igual de infundada. Hoy son 0 filas del parque, pero el borde se escribe igual.
 */
export function salidaPorMix(v: HallazgoDistanciaVeredicto["valor"]): SalidaPorMix | null {
  if (!v.esEstructural) return null;
  if (typeof v.sinSalida !== "boolean" || v.sinSalida) return null;
  const m = v.mixPalancas;
  if (!m || !m.dentroDelAlcance) return null;
  return desdeMix(m);
}

/**
 * STR: LA FUENTE DE LA CARD (12-sep-2026 · v19). El motor STR emite DOS combinaciones —
 * `mixPalancas` al escalón y, desde BUSCAR OTRA, `mixPalancasHastaComprar`— y la card de §5
 * (`lo-que-haria-yo.ts`) lee en BUSCAR solo el camino a Comprar: el mix al escalón no se
 * dibuja. El prompt y el guard leen de ACÁ, no de `salidaPorMix`, para que la prosa nombre
 * exactamente la salida que el lector tiene al lado. Medido: 7 filas AJUSTA con salida por
 * esta fuente; 9 BUSCAR con combinación solo al escalón, que van por `mixAlEscalonStr`.
 */
export function salidaPorMixStr(v: ValorParaSalidaStr): SalidaPorMix | null {
  if (!v.esEstructural) return null;
  const m = v.veredictoBase === "BUSCAR OTRA" && v.mixPalancasHastaComprar !== undefined ? v.mixPalancasHastaComprar : v.mixPalancas;
  if (!m || !m.dentroDelAlcance || m.redundanteConPalancaSola) return null;
  return desdeMix(m);
}

/**
 * STR desde BUSCAR OTRA: la combinación que llega al ESCALÓN (AJUSTA SUPUESTOS) cuando no hay
 * una a Comprar. La card no la muestra, pero el motor la tiene: la prosa no puede decir «no
 * hay forma» y tampoco prometer Comprar. `null` fuera de ese caso exacto.
 */
export function mixAlEscalonStr(v: ValorParaSalidaStr): SalidaPorMix | null {
  if (!v.esEstructural || v.veredictoBase !== "BUSCAR OTRA") return null;
  if (salidaPorMixStr(v)) return null;
  const m = v.mixPalancas;
  if (!m || !m.dentroDelAlcance || m.redundanteConPalancaSola) return null;
  return desdeMix(m);
}

function desdeMix(m: NonNullable<HallazgoDistanciaVeredicto["valor"]["mixPalancas"]>): SalidaPorMix | null {
  const partes: string[] = [];
  if (m.piePctDelta !== 0) partes.push(`el pie en ${pct1(m.piePct)}%`);
  if (m.plazoAniosDelta !== 0) partes.push(`el plazo en ${m.plazoAnios} años`);
  if (partes.length === 0) return null;

  const descuentoPct = m.sinDescuento ? null : Math.abs(m.descuentoPct);
  // «Dos a la vez» tiene que ser VERDAD: medido en el parque, 128 de las 179 mueven pie y
  // plazo, 47 solo el pie y 4 solo el plazo. Con una sola dimensión el descuento cuenta
  // como la segunda cosa —el precio también se mueve—; sin descuento, se nombra la única.
  const remate =
    partes.length >= 2 || descuentoPct !== null
      ? "moviendo dos cosas a la vez"
      : m.piePctDelta !== 0
        ? "subiendo el pie"
        : "estirando el plazo";

  const mueve: ("pie" | "plazo")[] = [];
  if (m.piePctDelta !== 0) mueve.push("pie");
  if (m.plazoAniosDelta !== 0) mueve.push("plazo");
  return { movimiento: partes.join(" y "), remate, descuentoPct, costoDiaUnoUF: m.costoDiaUnoUF, mueve };
}

// ── EL COPY STR (12-sep-2026 · «la fraseCanonica estructural STR deja de negar el mix») ──
// Cinco superficies STR seguían diciendo «no hay forma» en las 16 filas con combinación. Las
// que son neutrales de modalidad —cierrePopupSalida, tituloCardSalida, lineaMiniSalida— se
// reutilizan tal cual; estas son las que LTR no tiene: el cierre de la fraseCanonica, el
// escalón desde BUSCAR (la combinación llega a Ajusta supuestos, no a Comprar) y el pie del
// PDF STR, que en LTR nombra dos condiciones que renta corta no tiene.

/** «pie y plazo» · «el pie» · «el plazo»: lo tuyo, lo que se mueve sin pedirle nada a nadie. */
export function loTuyo(s: SalidaPorMix): string {
  return s.mueve.length >= 2 ? "pie y plazo" : s.mueve[0] === "plazo" ? "el plazo" : "el pie";
}

/** El cierre de la fraseCanonica STR con combinación. `escalon` = a dónde llega cuando NO es
 *  Comprar («Ajusta supuestos», desde BUSCAR); null = llega a Comprar. Lee el descuento como el
 *  prompt lee `descuentoQueAdemásPide`: con descuento se dice; sin descuento, la forma corta. */
export function cierreFraseCanonicaStr(s: SalidaPorMix, escalon: string | null): string {
  const tuyo = `Con lo tuyo —${loTuyo(s)}—`;
  if (escalon) return `${tuyo}${s.descuentoPct === null ? "" : ` y un descuento de ${pct1(s.descuentoPct)}%`} llega a ${escalon}, no a Comprar.`;
  return s.descuentoPct === null ? `${tuyo} sí llega a Comprar.` : `${tuyo} y un descuento de ${pct1(s.descuentoPct)}% llega a Comprar.`;
}

/** El cierre del pop-up STR desde BUSCAR cuando la combinación llega solo al escalón. A Comprar
 *  se usa `cierrePopupSalida`, el de LTR, que no nombra modalidad. */
export function cierrePopupEscalonStr(s: SalidaPorMix, escalon: string): { marca: string; resto: string } {
  const marca = `Ningún cambio por separado alcanza. ${s.remate[0].toUpperCase()}${s.remate.slice(1)}, llega a ${escalon}.`;
  const resto = `Con ${s.movimiento}${s.descuentoPct === null ? "" : `, y un ${pct1(s.descuentoPct)}% de descuento`}, deja de ser un no, pero no llega a Comprar. Lo que cuesta es plata tuya el día uno.`;
  return { marca, resto };
}

/** El pie del PDF STR (bloque «por qué no cierra»). */
export function pieDocumentoSalidaStr(s: SalidaPorMix, escalon: string | null): string {
  const con = `con ${s.movimiento}${s.descuentoPct === null ? "" : `, y un ${pct1(s.descuentoPct)}% de descuento`}`;
  return `Y no es cuestión de afinar un supuesto: ningún cambio por separado lo lleva a Comprar, pero ${con}${escalon ? ` llega a ${escalon}, no a Comprar` : ", sí"}. Lo que pide es plata tuya el día uno.`;
}

// ── EL COPY DE CADA SUPERFICIE ───────────────────────────────────────────────
// Vive acá, y no repartido en los componentes, por dos razones: se testea sin montar
// JSX, y la familia se lee junta — que es la única forma de que ocho lugares digan lo
// mismo con la misma voz.

/** A · el cierre del pop-up. `marca` va resaltada, igual que la frase que reemplaza. */
export function cierrePopupSalida(s: SalidaPorMix): { marca: string; resto: string } {
  const marca = `Ningún cambio por separado alcanza. ${s.remate[0].toUpperCase()}${s.remate.slice(1)}, sí.`;
  const resto =
    s.descuentoPct === null
      ? `Con ${s.movimiento} el veredicto cambia sin pedirle un peso al vendedor. Lo que cuesta no es negociación: es plata tuya el día uno.`
      : `Con ${s.movimiento}, y un ${pct1(s.descuentoPct)}% de descuento, el veredicto cambia. La mayor parte no se negocia: es plata tuya el día uno.`;
  return { marca, resto };
}

/** C · el título de la finding card. */
export function tituloCardSalida(s: SalidaPorMix): string {
  return `Ningún cambio por separado alcanza. ${s.remate[0].toUpperCase()}${s.remate.slice(1)}, sí.`;
}

/** C · la línea bajo el KPI de la card: qué mover, en concreto. */
export function ksubCardSalida(s: SalidaPorMix): string {
  return s.descuentoPct === null
    ? `${s.movimiento} · sin pedir descuento`
    : `${s.movimiento} · y un ${pct1(s.descuentoPct)}% de descuento`;
}

/** D · la línea corta de comparativa, share y PDF de ambas. */
export function lineaMiniSalida(s: SalidaPorMix, veredictoBase: string): string {
  return `Ningún cambio por separado lo mueve de ${veredictoBase}: con ${s.movimiento}, sí.`;
}

/** E · el subtítulo del capítulo de negociación. El plan existe; no pasa por el vendedor. */
export const SUBTITULO_PLAN_SALIDA = "El plan no pasa por el vendedor";

/** G · el pie del PDF LTR. */
export function pieDocumentoSalida(s: SalidaPorMix): string {
  return `Cumplir las dos es condición necesaria para un Comprar, y ningún cambio por separado alcanza — pero con ${s.movimiento}, sí. No es cuestión de afinar un número: lo que pide es plata tuya el día uno.`;
}
