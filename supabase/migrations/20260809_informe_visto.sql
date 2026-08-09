-- ─────────────────────────────────────────────────────────────────────────
-- Goal B — evento informe_visto + person property test_account.
-- Aditiva: dos RPCs, cero columnas nuevas (informe_visible_at ya existe desde
-- 20260808_pipeline_timing.sql). El cliente llama ambas fail-soft: si esta
-- migración no está aplicada, las llamadas fallan en silencio.
-- ─────────────────────────────────────────────────────────────────────────

-- Primer view del informe (veredicto visible en pantalla). NULL-only por
-- construcción: re-visitas tocan 0 filas. SECURITY INVOKER → RLS decide
-- (el owner escribe; un viewer compartido no matchea la policy y no pasa nada).
-- now() del server: consistente con created_at y pipeline_timing para deltas.
CREATE OR REPLACE FUNCTION marcar_informe_visible(p_analysis_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
AS $$
  UPDATE analisis
  SET informe_visible_at = now()
  WHERE id = p_analysis_id
    AND informe_visible_at IS NULL;
$$;

REVOKE ALL ON FUNCTION marcar_informe_visible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION marcar_informe_visible(uuid) TO authenticated, service_role;

-- ¿El usuario logueado es cuenta interna? Misma fuente de verdad que el panel
-- admin (public.test_accounts) — no una segunda lista. SECURITY DEFINER porque
-- test_accounts no es legible por usuarios; solo expone el booleano propio.
CREATE OR REPLACE FUNCTION es_test_account()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM test_accounts WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION es_test_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION es_test_account() TO authenticated;
