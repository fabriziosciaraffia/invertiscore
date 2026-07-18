-- Fase D — desbloqueo ("unlock") del INFORME ÍNTEGRO de los hijos de un par AMBAS.
--
-- Contexto: el comparativo (/analisis/comparativa) sigue igual — el crédito lo
-- compra íntegro y el share lo muestra completo (canal viral). is_premium NO se
-- toca. Lo NUEVO es aditivo y vive SOLO en los HIJOS (LTR + STR): mientras el
-- grupo no esté desbloqueado, los hijos renderizan un RESUMEN (Variante A) con
-- CTA de unlock. El unlock es un cobro one-off (~50% del precio vigente) que
-- abre AMBOS hijos de una — un solo unlock por `ambas_group_id` (el producto es
-- la comparación; cobrar por lado mataría el descuento).
--
-- Semántica:
--   ambas_unlocked_at = NULL          → hijos en resumen (owner sin unlock).
--   ambas_unlocked_at = <timestamptz> → grupo desbloqueado: hijos íntegros.
--
-- Fuente de verdad del COBRO: la fila `payments` con product='unlock' (audit
-- inmutable). Esta columna es la marca denormalizada por fila para gatear el
-- render sin un join por request — se flipea en payments/confirm sobre AMBAS
-- filas del grupo (guarda .is('ambas_unlocked_at', null) = idempotente ante
-- reenvío de webhook). Espejo exacto del patrón is_premium / pending_payment.
--
-- FrancoMensual (suscriptor activo / is_unlimited) ve íntegro SIN necesidad de
-- esta marca — el gate de render lo resuelve por tier, no por columna.

ALTER TABLE public.analisis
  ADD COLUMN IF NOT EXISTS ambas_unlocked_at timestamptz DEFAULT NULL;

-- Índice parcial para el flip por grupo en confirm (UPDATE ... WHERE
-- ambas_group_id = <uuid> AND ambas_unlocked_at IS NULL). Solo filas de un grupo
-- aún bloqueadas — las sueltas y las ya desbloqueadas no entran.
CREATE INDEX IF NOT EXISTS idx_analisis_ambas_unlock_pending
  ON public.analisis (ambas_group_id)
  WHERE ambas_group_id IS NOT NULL AND ambas_unlocked_at IS NULL;
