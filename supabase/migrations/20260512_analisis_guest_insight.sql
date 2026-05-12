-- Commit 2c · 2026-05-12 — Guest Insight para STR.
--
-- Columna jsonb que cachea el resultado del endpoint
-- /api/analisis/short-term/[id]/guest-insight. Estructura definida en
-- src/app/api/analisis/short-term/[id]/guest-insight/route.ts como
-- GuestInsightResponse.
--
-- Paralelo a `zone_insight` (LTR) — usa el mismo patrón:
--   • write best-effort en el endpoint; si falla, swallow.
--   • cache-first: si la columna tiene valor, lo retorna sin regenerar.
--   • regenerate via ?regenerate=true en el endpoint.
--
-- Sin RLS adicional (hereda de la tabla analisis). Sin backfill — análisis
-- legacy no tienen este insight; se genera on-demand al abrir el drawer.

ALTER TABLE analisis
  ADD COLUMN IF NOT EXISTS guest_insight jsonb;

COMMENT ON COLUMN analisis.guest_insight IS
  'Insight de tipo de huésped esperado para análisis STR. Cache del endpoint guest-insight. Estructura: { perfil: { dominante, secundarios, poisRelevantes }, insight: { headline, perfilDominante, recomendacionesHabilitacion, estacionalidadEsperada, cajaAccionable } }';
