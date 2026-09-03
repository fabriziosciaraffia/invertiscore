-- `methodology_version` admite 'v3' — modelo de costos recalibrado (sep-2026).
--
--   v3 = mantención en UF/m²·año por tramo de antigüedad con techo del 6% del
--        arriendo (antes % del precio) · CapEx de puesta a punto en rango
--        [min, max] con el punto medio como cifra que corre el caso (antes curva
--        1,5 → 9,0 UF/m²) · reset post-CapEx de la antigüedad efectiva para
--        mantención. Gate en src/lib/modelo-costos.ts.
--
-- El motor lee la versión desde input_data.methodologyVersion (estampada al
-- crear); esta columna es su espejo para consultas y auditoría. Los análisis
-- existentes quedan en v1/v2 y recomputan con las tablas legacy.
--
-- ⚠️ APLICAR EN SQL EDITOR ANTES DEL MERGE. Las tres rutas de creación
-- (/api/analisis, /api/analisis/locked, pipeline STR) escriben 'v3' en la
-- columna a partir del commit que acompaña esta migración: si el código se
-- despliega sin ella, el INSERT viola el CHECK y la creación de análisis falla.

ALTER TABLE public.analisis
  DROP CONSTRAINT IF EXISTS analisis_methodology_version_check;
ALTER TABLE public.analisis
  ADD CONSTRAINT analisis_methodology_version_check
  CHECK (methodology_version IN ('v1', 'v2', 'v3'));
