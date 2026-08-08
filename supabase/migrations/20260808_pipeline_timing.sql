-- ─────────────────────────────────────────────────────────────────────────
-- Instrumentación de timing por fase del pipeline de generación (Goal A).
-- Aditiva: columnas NULL + una RPC. Cero impacto sobre el código existente
-- (el código viejo ignora las columnas; el nuevo escribe fail-soft y tolera
-- que esta migración aún no esté aplicada).
--
-- Shape de `pipeline_timing` (contrato en src/lib/pipeline-timing.ts):
--   { "v": 1,
--     "submit": { recibido_at, ruta, auth_ms, uf_ms, cobro_ms, mediana_ms,
--                 airroi_ms, airroi_cache, motor_ms, insert_ms, total_ms },
--     "generaciones": [ { tipo, trigger, inicio_at, fin_at, total_ms,
--                         resultado, prompt_version, prep_ms, llamadas:[...] } ] }
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE analisis ADD COLUMN IF NOT EXISTS pipeline_timing jsonb;

-- Timestamp de "informe visible": lo escribirá el evento client-side del Goal B
-- (primer render del informe en pantalla). Este goal SOLO crea la columna;
-- ningún flujo server la escribe todavía.
ALTER TABLE analisis ADD COLUMN IF NOT EXISTS informe_visible_at timestamptz;

-- Merge atómico de timing. p_submit reemplaza el bloque 'submit'; p_generacion
-- se APENDEA al array 'generaciones'. El UPDATE toma lock de fila, así que dos
-- generaciones concurrentes (background + fallback-60s, el caso a cuantificar)
-- se serializan sin pisarse — un read-modify-write en TS perdería una.
CREATE OR REPLACE FUNCTION registrar_pipeline_timing(
  p_analysis_id uuid,
  p_submit jsonb DEFAULT NULL,
  p_generacion jsonb DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
  UPDATE analisis
  SET pipeline_timing =
    (CASE
      WHEN p_generacion IS NOT NULL THEN
        jsonb_set(
          COALESCE(pipeline_timing, '{"v":1}'::jsonb),
          '{generaciones}',
          COALESCE(pipeline_timing->'generaciones', '[]'::jsonb) || jsonb_build_array(p_generacion)
        )
      ELSE COALESCE(pipeline_timing, '{"v":1}'::jsonb)
    END)
    || (CASE
      WHEN p_submit IS NOT NULL THEN jsonb_build_object('submit', p_submit)
      ELSE '{}'::jsonb
    END)
  WHERE id = p_analysis_id;
$$;

-- SECURITY INVOKER: el UPDATE respeta RLS — cada usuario solo escribe timing en
-- sus propias filas; los flujos con service role pasan igual. Sin grant a anon.
GRANT EXECUTE ON FUNCTION registrar_pipeline_timing(uuid, jsonb, jsonb)
  TO authenticated, service_role;
