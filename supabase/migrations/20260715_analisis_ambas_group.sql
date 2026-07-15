-- Enlace de subordinación AMBAS: las dos filas `analisis` (LTR + STR) creadas
-- por un análisis "Ambas" comparten un `ambas_group_id` y llevan su rol.
--
-- Decisión de producto: AMBAS = producto único. 1 crédito compra UN informe
-- (el comparativo). Las filas hijas LTR/STR existen como respaldo navegable
-- DESDE el comparativo, NO como análisis independientes en "Mis análisis".
--
-- Semántica:
--   ambas_group_id = NULL  → análisis suelto (comportamiento actual intacto).
--   ambas_group_id = <uuid> compartido por AMBAS filas del par.
--   ambas_role     = 'ltr' | 'str' → qué lado del par es la fila.
--
-- El group_id nace con el par en los flujos de creación AMBAS (crédito/welcome
-- y locked/pagado). Las filas históricas se backfillean en un paso de datos
-- aparte (F6) — quirúrgico, solo los pares verificados.

ALTER TABLE public.analisis
  ADD COLUMN IF NOT EXISTS ambas_group_id uuid DEFAULT NULL;

ALTER TABLE public.analisis
  ADD COLUMN IF NOT EXISTS ambas_role text DEFAULT NULL;

ALTER TABLE public.analisis
  DROP CONSTRAINT IF EXISTS analisis_ambas_role_check;
ALTER TABLE public.analisis
  ADD CONSTRAINT analisis_ambas_role_check
  CHECK (ambas_role IS NULL OR ambas_role IN ('ltr', 'str'));

-- Índice para agrupar el par (dashboard) y resolver el hermano (páginas hijas).
-- Parcial: solo las filas que pertenecen a un grupo — las sueltas (NULL) no
-- entran al índice.
CREATE INDEX IF NOT EXISTS idx_analisis_ambas_group_id
  ON public.analisis (ambas_group_id)
  WHERE ambas_group_id IS NOT NULL;
