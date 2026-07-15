-- Fix: el FK payments.consumed_by_analysis_id → analisis(id) se creó sin
-- cláusula ON DELETE (migración 20260505), lo que defaulta a NO ACTION
-- (restrictivo). Efecto: cualquier análisis referenciado por una fila de
-- `payments` como "consumido por" NO se podía borrar (error 23503).
--
-- Lo destapó el delete group-aware de AMBAS: el flujo crédito/welcome crea una
-- fila payments (charge, intent=both) cuyo consumed_by_analysis_id apunta al
-- hijo LTR. Borrar el par (una sola sentencia sobre las dos filas) violaba el
-- FK → fallaba entero y NINGUNA fila se borraba.
--
-- Fix: ON DELETE SET NULL (mismo patrón que operadores_str_reportados.analisis_id,
-- migración 20260510). El `payments` es un registro financiero que sobrevive al
-- análisis: al borrar el análisis se anula el puntero, NO se borra el pago
-- (CASCADE sería incorrecto — perdería historial de cobros/boletas).

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_consumed_by_analysis_id_fkey;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_consumed_by_analysis_id_fkey
  FOREIGN KEY (consumed_by_analysis_id)
  REFERENCES public.analisis(id)
  ON DELETE SET NULL;
