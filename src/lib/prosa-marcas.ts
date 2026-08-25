// ─────────────────────────────────────────────────────────────────────────────
// Marcas de destacador en prosa IA — fuente única (FASE 2 rediseño Dictamen).
//
// El contrato de prompt marca frases clave con `**…**` (markdown bold). El render
// las pinta con plumón (FASE 4); mientras esa UI no existe, el render actual las
// STRIPEA con `stripMarcas` (render tolerante: la prosa nueva nunca muestra `**`
// crudos, cualquiera sea el orden de deploys). El golden usa `marcasBalanceadas`
// como invariante: los sanitizers del pipeline recortan por ORACIÓN entera
// (PLANC-BUDGET-TRIM, PLANC-DUAL-STRIPPED en LTR; stripCardEcho en STR), así que
// un par que cruce el punto puede quedar mutilado en un `**` impar — el check lo
// caza en generación fresca y el prompt prohíbe marcas que crucen oraciones.
//
// Regla dura: este módulo NO interpreta contenido (no valida "frase completa" ni
// largo del núcleo — eso es del prompt y del juez). Solo cuenta y stripea tokens.
// ─────────────────────────────────────────────────────────────────────────────

/** Cantidad de tokens `**` en el texto. Un par bien formado aporta 2. */
export function contarTokensMarca(texto: string): number {
  return (texto.match(/\*\*/g) ?? []).length;
}

/**
 * true si los tokens `**` del texto están balanceados (cantidad par, incluido 0).
 * No exige que haya marcas: prosa sin `**` es válida.
 */
export function marcasBalanceadas(texto: string): boolean {
  return contarTokensMarca(texto) % 2 === 0;
}

/**
 * Elimina los tokens `**` dejando el texto plano (el contenido marcado queda).
 * Render tolerante FASE 2: cero cambio visual frente a la prosa sin marcas.
 * En FASE 4 el punto de consumo pasa de strip a plumón — mismo módulo.
 * Con tokens desbalanceados igual stripea todos: un `**` huérfano crudo en
 * pantalla es peor que perder el énfasis de esa frase.
 */
export function stripMarcas(texto: string): string {
  return texto.replace(/\*\*/g, "");
}
