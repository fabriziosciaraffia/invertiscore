// ─────────────────────────────────────────────────────────────────────────────
// LAS PREGUNTAS FRECUENTES DE INVIERTE CON FRANCO (quinta entrega, 18-nov-2026; lámina 2.1-preguntas-frecuentes). Son las
// propias del recorrido del comprador, no las generales del sitio (`faq-data.ts`). Viven SOLO acá: hoy las abre la firma, en la
// ventana de documentos; después, la cuenta. Los textos son los de la lámina, tal como están escritos.
// ─────────────────────────────────────────────────────────────────────────────

export interface PreguntaInvierte {
  pregunta: string;
  respuesta: string;
}

export const TITULO_PREGUNTAS_INVIERTE = "Preguntas frecuentes";

export const PREGUNTAS_INVIERTE: readonly PreguntaInvierte[] = [
  { pregunta: "¿Cuánto cobra Franco?", respuesta: "En deptos usados, 2 % + IVA del precio de compra, solo si compras un depto que Franco te presentó. En deptos nuevos no pagas: lo paga la inmobiliaria." },
  { pregunta: "¿Cuándo se paga?", respuesta: "Al firmar la escritura de compraventa. Antes de eso no pagas nada." },
  { pregunta: "¿Qué estoy firmando?", respuesta: "Una orden: le encargas a Franco presentarte deptos y acompañarte en la compra. No te obliga a comprar ni tiene costo." },
  { pregunta: "¿Por qué varios deptos y no solo el que elegí?", respuesta: "Porque se elige mejor comparando. Partimos por el tuyo y te mostramos otros que convienen y te alcanzan." },
  { pregunta: "¿Y el corredor del depto?", respuesta: "Trabaja para el vendedor y le cobra a él. Franco trabaja para ti: las visitas y las ofertas se coordinan a través de Franco." },
  { pregunta: "¿Franco me va a decir que no?", respuesta: "Sí. Si un depto deja de convenir, por el precio o por lo que aparezca en la visita, te lo decimos aunque perdamos la venta." },
  { pregunta: "¿Puedo salirme?", respuesta: "Cuando quieras. La orden dura doce meses y sigue cubriendo, hasta doce meses después, los deptos que ya te presentamos." },
];
