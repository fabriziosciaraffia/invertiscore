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
