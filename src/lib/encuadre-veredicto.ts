// ============================================================================
// ENCUADRE POR VEREDICTO — la pirámide entera acompaña al veredicto (§1.12.8)
// ============================================================================
// Dos censos consecutivos marcaron el mismo patrón: el veredicto está degradado,
// el hero ya explica por qué (la glosa de gates funciona), y las cards siguen
// celebrando. El caso testigo `04dafb00` es el extremo medido: BUSCAR OTRA con
// ONCE cards "A favor" y CERO adversas — el único informe del parque en esa
// situación. La lección de §1.12.8 en una línea: glosar el gate es necesario y
// no es suficiente.
//
// POR QUÉ PASA
// ────────────
// `direccion` es propiedad LOCAL del hallazgo: cada builder la decide con su
// propio corte (cap rate ≥ referencia ⇒ favorable) y NINGUNO recibe el veredicto
// — solo los de `distancia_veredicto`, y porque su hallazgo trata sobre él. Una
// card puede ser correcta en aislamiento y engañosa en conjunto: la TIR es 10,8%
// y esa TIR no salva el caso.
//
// QUÉ HACE ESTE MÓDULO
// ────────────────────
// Generaliza el patrón que ya vivía en `ConsueloFlujo` (flujo-mensual-hallazgo):
// con el veredicto YA derivado, el motor reencuadra la presentación de los
// hallazgos favorables que dicen decidir. NO toca el dato, NO toca la dirección
// ni el badge, NO agrega superficie de UI: la cláusula viaja dentro de la misma
// `fraseCanonica` que la card ya renderiza, así que llega sola a card, drawer,
// PDF y a la prosa que la cita.
//
// A QUIÉN SE LE PONE
// ──────────────────
// Solo a los favorables con `decisividad > 0` — los que reclaman peso en la
// decisión. Los de decisividad 0 son contexto de lectura y no afirman decidir;
// ponerles la cláusula sería ruido en once cards en vez de foco en las que
// importan. El `titular` NO se toca: es la línea de 6-12 palabras del hero y la
// cláusula lo desbordaría.
// ============================================================================

import type { Hallazgo } from "./types";

type VeredictoLike = string;

/**
 * Cláusula de subordinación por veredicto. Texto fijo (no interpolado) para que
 * la idempotencia se resuelva por inclusión, sin tener que agregar un campo
 * marcador a las 15 interfaces del union `Hallazgo`.
 */
export const CLAUSULA_NO_DECIDE: Readonly<Record<string, string>> = {
  "BUSCAR OTRA": "Es una ventaja real, pero no es lo que decide acá: el veredicto no cambia por esto.",
  "AJUSTA SUPUESTOS": "Suma a favor, pero por sí solo no alcanza para mover el veredicto.",
};

/** ¿Este hallazgo ya lleva la cláusula? (idempotencia por inclusión). */
export function tieneEncuadre(frase: string): boolean {
  return Object.values(CLAUSULA_NO_DECIDE).some((c) => frase.includes(c));
}

/**
 * Reencuadra los favorables que dicen decidir cuando el veredicto está
 * degradado. No-op con COMPRAR y con veredictos desconocidos.
 *
 * Devuelve un array nuevo; los hallazgos no tocados se devuelven por referencia.
 */
export function aplicarEncuadreVeredicto<T extends Hallazgo>(
  hallazgos: T[],
  veredicto: VeredictoLike,
): T[] {
  const clausula = CLAUSULA_NO_DECIDE[veredicto];
  if (!clausula) return hallazgos;
  return hallazgos.map((h) => {
    if (h.direccion !== "favorable") return h;
    if (!(typeof h.decisividad === "number" && h.decisividad > 0)) return h;
    const frase = typeof h.fraseCanonica === "string" ? h.fraseCanonica : "";
    if (!frase || tieneEncuadre(frase)) return h;
    return { ...h, fraseCanonica: `${frase.replace(/\s+$/, "")} ${clausula}` };
  });
}
