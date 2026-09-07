-- ─────────────────────────────────────────────────────────────────────────────
-- 20260907_candado_generacion.sql · Goal #3 (07-sep-2026)
-- Candado de regeneración de prosa: UNA generación por fila a la vez, entre
-- instancias. Reemplaza los tres `Map` en memoria de las rutas LTR/STR/AMBAS,
-- que no veían al waitUntil del submit, al webhook de Flow ni al cron
-- precalentar-prosa (medido: 4 dobles prosas pagadas en pipeline_timing).
--
-- Lo toma y suelta SOLO src/lib/candado-generacion.ts, con service-role:
--   UPDATE public.analisis
--     SET generating_since = $ahora, generating_kind = $kind          -- 'ltr' | 'str' | 'ambas'
--   WHERE id = $id
--     AND (generating_since IS NULL OR generating_since < $ahora - interval '10 min')
--   RETURNING id;                                                      -- 0 filas ⇒ otro lo tiene
-- La liberación pone NULL en ambas columnas SOLO si generating_since sigue
-- siendo la marca que escribió ese proceso. TTL 10 min: un proceso muerto
-- (maxDuration 300 s) libera solo. Un UPDATE de una fila es atómico en Postgres:
-- el segundo concurrente re-evalúa el WHERE tras el commit del primero.
--
-- Aplicar en el SQL Editor (Fabrizio). Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.analisis
  ADD COLUMN IF NOT EXISTS generating_since timestamptz NULL,
  ADD COLUMN IF NOT EXISTS generating_kind  text        NULL;

COMMENT ON COLUMN public.analisis.generating_since IS
  'Candado de regeneración de prosa (goal #3): marca de la toma. NULL = libre; vencida a los 10 min. Solo la escribe src/lib/candado-generacion.ts.';
COMMENT ON COLUMN public.analisis.generating_kind IS
  'Qué generación tiene el candado: ltr | str | ambas. Informativo; el candado es por fila.';

-- El candado se toma y suelta por id (PK): no necesita índice. Este parcial es
-- solo para mirar cuántas filas están generando ahora mismo; casi siempre está
-- vacío, así que cuesta nada.
CREATE INDEX IF NOT EXISTS analisis_generating_since_idx
  ON public.analisis (generating_since)
  WHERE generating_since IS NOT NULL;
