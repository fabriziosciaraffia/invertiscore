// ============================================================================
// PLAN C · Apertura determinística de la prosa comparativa (Fase C)
// ============================================================================
// Espejo del patrón LTR (ai-generation.ts §PLAN C, fraseCanonica del #1 hallazgo):
// el MOTOR escribe la primera oración de la prosa "Cuál te conviene"; la IA solo
// escribe la continuación (los 3 movimientos). Se antepone post-LLM para que el
// diferencial que MÁS manda lidere sin depender de la obediencia del modelo.
//
// La `fraseCanonica` comparativa es DISTINTA de dos textos que ya viven en la
// superficie y que NO debe duplicar:
//   · `finding.titular` — terso, decisional, va en el TOP-3 del hero (HeroComparativa).
//   · hero `SUB`/`FRANCO_POS` — el veredicto y la posición de Franco, ya en el ACTO 1.
// Por eso la apertura NARRA LA DIMENSIÓN que separa a las dos modalidades (caja o
// margen), como pivote hacia "para quién es cada una" — no re-emite el veredicto ni
// recita KPIs de card. Coherente con los 4 estados por construcción: el orden de la
// pirámide lo fija la banda, así que el #1 diferencial ya apunta al lado correcto.
// ============================================================================

import type { BandaComparativa } from "./engines/str-universo-santiago";

// El builder solo necesita el id + lado del #1 diferencial y la banda; se mantiene
// desacoplado de FindingComparativa para poder invocarse desde el golden con un
// snapshot mínimo.
export interface AperturaCtx {
  topId: string;              // id del finding #1 (flujo | breakeven | …)
  topLado: "ltr" | "str" | "neutro";
  banda: BandaComparativa;
}

// Voz: tuteo neutro chileno (§2.1). Cifra-free: la aritmética vive en las cards.
// Cada rama cierra con un pivote hacia "quién" para que el movimiento 01 continúe
// natural. 1-2 oraciones.
export function buildAperturaComparativa(ctx: AperturaCtx): string {
  const { banda, topId, topLado } = ctx;

  // Rama frágil: el #1 es el break-even; el insight es el MARGEN, no el monto.
  if (banda === "STR_FRAGIL") {
    return "El corto te rinde más en caja que la larga, pero con un margen tan justo que un mal mes se lo come. La ventaja existe; lo que no sobra es colchón para sostenerla, y de ahí sale la pregunta de si esta jugada es para ti.";
  }

  if (banda === "LTR_PREFERIDO") {
    return "Puestas las dos lado a lado, terminan en casi el mismo patrimonio pero por caminos muy distintos en plata, horas y estómago —y en este depto la renta larga es la que menos te exige. Lo que queda por resolver no es cuál rinde más, sino para quién es cada una.";
  }

  if (banda === "STR_VENTAJA_CLARA") {
    return "Puestas las dos lado a lado, la renta corta es la que más te deja en caja mes a mes y su margen aguanta un traspié: acá el esfuerzo extra sí se paga. Lo que falta por resolver no es cuál rinde más, sino si estás hecho para operarla.";
  }

  // INDIFERENTE (PAREJAS)
  // El #1 suele ser flujo, pero la diferencia es chica: el eje decisional se corre al tiempo.
  void topId;
  void topLado;
  return "Puestas las dos lado a lado, rinden casi lo mismo, así que la plata no es la que decide: lo hace cuánto tiempo estás dispuesto a ponerle a la operación. La pregunta deja de ser cuál conviene y pasa a ser cuál va contigo.";
}

// Word count de la apertura (para el presupuesto dinámico de la continuación, §PLAN C).
export function aperturaWordCount(apertura: string): number {
  return apertura.trim() ? apertura.trim().split(/\s+/).filter(Boolean).length : 0;
}
