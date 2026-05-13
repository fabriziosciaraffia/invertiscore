-- Columna `methodology_version` en tabla `analisis`.
--
-- Marca con qué generación de la metodología fue calculado el análisis.
-- Permite preservar análisis legacy con sus thresholds y veredictos originales
-- mientras los análisis nuevos adoptan la metodología post-Commit E.
--
--   v1 = pre-Commit E (default actual)
--   v2 = post-Commit E.1 (thresholds unificados 70/45 LTR+STR · sin fallback
--                          score 50 · sin divergencia franco vs motor · sin
--                          veredicto RECONSIDERA — fundido en AJUSTA)
--
-- Backfill: todos los análisis existentes quedan como v1. El motor escribirá
-- 'v2' explícito al crear análisis nuevos a partir de E.1.

ALTER TABLE public.analisis
  ADD COLUMN IF NOT EXISTS methodology_version text NOT NULL DEFAULT 'v1';

ALTER TABLE public.analisis
  DROP CONSTRAINT IF EXISTS analisis_methodology_version_check;
ALTER TABLE public.analisis
  ADD CONSTRAINT analisis_methodology_version_check
  CHECK (methodology_version IN ('v1', 'v2'));
