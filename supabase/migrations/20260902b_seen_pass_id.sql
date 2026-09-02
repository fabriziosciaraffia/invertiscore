-- ─────────────────────────────────────────────────────────────────────────────
-- seen_pass_id: qué pase del backfill/refresco vio la fila por última vez.
-- Aplicar A MANO en el SQL Editor, ANTES de la primera corrida del backfill
-- (/api/data/backfill-toctoc): la ruta escribe la columna en cada upsert y sin
-- ella el upsert falla entero.
--
-- PARA QUÉ. El refresco semanal (Fase C) desactiva lo que la fuente ya no lista:
--   is_active = false WHERE source = 'toctoc' AND type IN ('venta','arriendo')
--     AND coalesce(condicion,'usado') = 'usado' AND is_active
--     AND seen_pass_id IS DISTINCT FROM '<pase recién completado>'
-- Medido el 02-sep-2026: de 24.645 arriendos activos solo 5.381 seguían
-- publicados; de 28.029 ventas usadas, 10.042. Nada desactivaba.
--
-- OJO NULL: las filas que escribe el scrape-properties diario no llevan pase
-- (NULL). Por eso la desactivación compara con IS DISTINCT FROM y no con <>:
-- `NULL <> 'x'` es NULL y las dejaría vivas para siempre (misma trampa que el
-- cron expire-grace, ver CLAUDE.md).
--
-- Índice parcial sobre activas: la desactivación y el conteo del dry-run
-- filtran exactamente por (source, is_active, seen_pass_id).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE scraped_properties
  ADD COLUMN IF NOT EXISTS seen_pass_id text;

COMMENT ON COLUMN scraped_properties.seen_pass_id IS
  'Id del pase de backfill/refresco (/api/data/backfill-toctoc) que vio la fila por última vez. NULL = la escribió otro job.';

CREATE INDEX IF NOT EXISTS idx_scraped_seen_pass_activas
  ON scraped_properties (source, seen_pass_id)
  WHERE is_active = true;
