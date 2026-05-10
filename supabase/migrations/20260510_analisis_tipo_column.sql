-- Columna `tipo_analisis` en tabla `analisis`.
--
-- Antes: la diferenciación LTR vs STR vivía SOLO en results.tipoAnalisis
-- (JSON-embedded). Eso impedía queries SQL filtradas eficientes y forzaba
-- a parsear JSON en cada lectura del dashboard.
--
-- Después: columna SQL dedicada con check constraint + índice. Backfill
-- desde el flag JSON existente.

ALTER TABLE public.analisis
  ADD COLUMN IF NOT EXISTS tipo_analisis text NOT NULL DEFAULT 'long-term';

ALTER TABLE public.analisis
  DROP CONSTRAINT IF EXISTS analisis_tipo_analisis_check;
ALTER TABLE public.analisis
  ADD CONSTRAINT analisis_tipo_analisis_check
  CHECK (tipo_analisis IN ('long-term', 'short-term'));

-- Backfill: STR ya creados llevan results.tipoAnalisis === 'short-term'.
-- LTR no tienen flag (default 'long-term' los cubre).
UPDATE public.analisis
SET tipo_analisis = 'short-term'
WHERE results->>'tipoAnalisis' = 'short-term'
  AND tipo_analisis = 'long-term';

CREATE INDEX IF NOT EXISTS idx_analisis_tipo_analisis
  ON public.analisis (tipo_analisis);

CREATE INDEX IF NOT EXISTS idx_analisis_user_tipo_created
  ON public.analisis (user_id, tipo_analisis, created_at DESC);
