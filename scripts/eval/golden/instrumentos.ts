// ============================================================================
// GOLDEN · A8·D1 — el instrumento comparado en largoPlazo, por su nombre (#11 · 07-sep-2026)
// ============================================================================
// El prompt LTR pide comparar con «un depósito a plazo en UF y/o un fondo mutuo»
// (ai-generation.ts, largoPlazo.contenido) y el user prompt entrega «Depósito a
// plazo (UF+5%)» y «Fondo mutuo (7%)». El matcher exigía literalmente «depósito a
// plazo» o «fondo mutuo», y cobraba una falla dura por gramática cuando el modelo
// nombraba el MISMO instrumento como «depósito en UF al 5%» (GS-PJ k=1 del 07-sep;
// 24 filas del parque lo escriben así, casi siempre junto a «a plazo»).
//
// Formas legítimas (nombran el instrumento): depósito(s) a plazo · depósito(s)
// (a plazo) en UF · depósito(s) UF · fondo(s) mutuo(s).
// Siguen fuera (nombran el género, no el instrumento): «depósito» pelado, «renta
// fija», «instrumento». Aflojar eso es aflojar justo lo que la regla protege: la
// comparación concreta del Ángulo 3, no una categoría.
// ============================================================================

export const RE_INSTRUMENTOS_D1 =
  /(dep[óo]sitos?\s+(?:a\s+plazo|(?:a\s+plazo\s+)?en\s+UF\b|UF\b)|fondos?\s+mutuos?)/i;

/** ¿El texto nombra al menos un instrumento del Ángulo 3 por su nombre? */
export function nombraInstrumento(texto: string): boolean {
  return RE_INSTRUMENTOS_D1.test(texto);
}
