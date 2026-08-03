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
 * Modelo del micro-check CATCH-ROOT-A (detección de fabricación de zona):
 * clasificación binaria sí/no, así que va con haiku — barato y rápido, y en la
 * Fase 2 se llama varias veces por el loop de regeneración.
 *
 * Vive acá y no suelto en ai-generation.ts porque es el segundo modelo que el
 * producto usa en producción: quien migre `CLAUDE_MODEL` tiene que ver este al
 * lado, no descubrirlo por un grep.
 *
 * Consecuencia para la medición de consumo: sus tokens NO se suman a las
 * columnas ai_*_tokens del análisis (tarifa distinta a la de CLAUDE_MODEL; ver
 * `acumularLlamadaSinTokens` en src/lib/ai-usage.ts).
 */
export const MICRO_CHECK_MODEL = "claude-haiku-4-5-20251001";
