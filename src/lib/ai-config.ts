/**
 * Model id único para TODAS las llamadas a Anthropic en el repo.
 * Cambiar acá = cambiar en todo el producto.
 *
 * Anthropic retira modelos con ~60 días de aviso (cadencia ~60-90 días).
 * Al migrar: confirmar el id vigente en https://docs.claude.com/en/docs/about-claude/models
 * y verificar gotchas de params (temperature/top_p en Opus 4.7+).
 *
 * Historial:
 * - claude-sonnet-4-20250514 → retirado 2026-06-15 → claude-sonnet-4-6
 */
export const CLAUDE_MODEL = "claude-sonnet-4-6";

/**
 * La lectura de documentos de Invierte con Franco (la preaprobación, entrega 3, 19-nov-2026): transcribe banco, monto, vigencia
 * y titular de un PDF o una foto. Va aparte de CLAUDE_MODEL porque es otra tarea (leer un documento, no escribir prosa) y no
 * debe cambiar si cambia el modelo de la prosa, ni al revés. Tarifa en costo-ia.ts.
 */
export const CLAUDE_MODEL_DOCUMENTOS = "claude-opus-5-5";

/**
 * «Lo que ve Franco» (Invierte con Franco, entrega 4 de las láminas del 19-nov-2026): la lectura de las fotos y el texto de una
 * publicación. Lo eligió Fabrizio en la prueba A/B del 19-nov-2026 (Opus 5.5, ~US$0,06 y ~15 s por depto). Tarifa en costo-ia.ts.
 */
export const CLAUDE_MODEL_LECTURA = "claude-opus-5-5";
