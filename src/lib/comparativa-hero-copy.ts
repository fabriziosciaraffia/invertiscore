// ─────────────────────────────────────────────────────────────────────────
// Copy motor-templated del veredicto comparativo — módulo PURO server-safe.
//
// Se extrajo de HeroComparativa.tsx ("use client", constantes privadas) para que
// la vista documento comparativa (server component) use EXACTAMENTE el mismo
// texto que la web: label del veredicto, subtítulo, posición de Franco, la barra
// de segmentos y el banner de fragilidad. Fuente única: el hero y el documento
// importan de acá.
//
// Nada de esto es prosa IA: son 4 variantes fijas por estado, afirmables sin
// `comparativaAI` (Plan C — el documento queda completo aunque la IA sea null).
// ─────────────────────────────────────────────────────────────────────────

import type { RecomendacionModalidadAmbas } from "@/lib/types";

export type EstadoComparativa = "larga" | "corta" | "fragil" | "parejas";

/** `fragil` manda: cortocircuita antes que la recomendación de 3 estados. */
export function resolverEstado(reco: RecomendacionModalidadAmbas, fragil: boolean): EstadoComparativa {
  if (fragil) return "fragil";
  if (reco === "LTR_PREFERIDO") return "larga";
  if (reco === "STR_VENTAJA_CLARA") return "corta";
  return "parejas";
}

export const VERDICT_LABEL: Record<EstadoComparativa, string> = {
  larga: "RENTA LARGA",
  corta: "RENTA CORTA",
  fragil: "VENTAJA FRÁGIL",
  parejas: "PAREJAS",
};

export const SUB: Record<EstadoComparativa, string> = {
  larga: "Renta larga es la jugada acá; el corto no paga su esfuerzo.",
  corta: "Renta corta paga el esfuerzo acá: rinde más y el margen aguanta.",
  fragil: "El corto rinde más en caja, pero con un margen que no aguanta un mal mes.",
  parejas: "Las dos rinden casi igual; lo que decide es cuánto tiempo quieres dedicarle.",
};

export const FRANCO_POS: Record<EstadoComparativa, string> = {
  larga: "Renta larga es la jugada sólida acá. Airbnb te pide más plata de entrada, más horas cada semana y más estómago para la estacionalidad, para terminar con el mismo patrimonio y menos caja en el bolsillo. Si el tiempo no te sobra, ni lo mires: el número no paga el esfuerzo.",
  corta: "Renta corta paga el esfuerzo en este depto: rinde más que la larga y el margen aguanta un traspié. Si puedes poner las 8-12 horas a la semana, o aceptar la comisión de un administrador, es la mejor jugada. La ventaja es real, no de papel.",
  fragil: "El corto gana, pero por un pelo. La pregunta no es cuál rinde más — es si aguantas un mes flojo sin que la ventaja se dé vuelta. Si vas a operar Airbnb tú, con un colchón de reserva, tiene sentido probar. Si no, la larga te deja dormir tranquilo por casi la misma plata.",
  parejas: "Las dos rinden casi lo mismo, así que la plata no decide: decide tu tiempo. Si buscas algo pasivo, renta larga. Si te entusiasma operar y tienes las horas, el corto no te va a rendir menos. No hay respuesta equivocada acá, hay preferencia.",
};

export const SEGMENT_ORDER: EstadoComparativa[] = ["larga", "parejas", "fragil", "corta"];

export const SEGMENT_SHORT: Record<EstadoComparativa, string> = {
  larga: "Larga",
  parejas: "Parejas",
  fragil: "Frágil",
  corta: "Corta",
};

export const SEGMENT_POS: Record<EstadoComparativa, number> = {
  larga: 12.5,
  parejas: 37.5,
  fragil: 62.5,
  corta: 87.5,
};

/** Banner que solo aparece cuando `fragil` (variante D del anexo del contrato). */
export const FRAGIL_BANNER = {
  kicker: "Margen frágil",
  cuerpo:
    "El corto empata costos recién cuando factura casi todo lo que rinde la zona. Una temporada floja o una caída de ocupación se come la ventaja — por eso la damos como decisión pareja, no como clara.",
};
