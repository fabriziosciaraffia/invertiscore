-- Panel admin · Fase 2 · Acción 4 — procedencia del flag is_unlimited.
--
-- SIN EJECUTAR: la aplica Fabrizio desde el SQL Editor. Idempotente.
--
-- EL PROBLEMA. is_unlimited es un booleano pelado: indistinguible entre "lo puso
-- Flow al activar una suscripción ilimitada" y "lo puso un admin a mano". Y el
-- cron expire-grace apaga el flag en dos barridos:
--   1. subscription_status='past_due' con la gracia vencida.
--   2. subscription_status='cancelled' + is_unlimited=true + ciclo vencido.
-- O sea que encender el toggle a mano sobre un EX-SUSCRIPTOR (status 'cancelled'
-- con subscription_ends_at en el pasado, que es el caso más típico para dar
-- cortesía) se apagaba solo a las 08:00 del día siguiente, sin dejar rastro más
-- que un contador en los logs. Un toggle que se revierte de madrugada es peor
-- que no tener toggle.
--
-- LA COLUMNA. unlimited_source declara de dónde viene el flag, y el cron pasa a
-- excluir el origen manual. Nullable a propósito: NULL = "sin ilimitado" o
-- "ilimitado de origen desconocido" (filas viejas que el backfill no alcance).
ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS unlimited_source TEXT;

-- CHECK aparte del ADD COLUMN para que la migración sea re-corrible: ADD COLUMN
-- IF NOT EXISTS no vuelve a aplicar el CHECK si la columna ya existía.
ALTER TABLE user_credits
  DROP CONSTRAINT IF EXISTS user_credits_unlimited_source_check;
ALTER TABLE user_credits
  ADD CONSTRAINT user_credits_unlimited_source_check
  CHECK (unlimited_source IS NULL OR unlimited_source IN ('subscription', 'manual'));

-- BACKFILL. Todo ilimitado que existe HOY viene de una suscripción: el
-- otorgamiento manual no existía hasta esta acción. Marcarlos como
-- 'subscription' mantiene el comportamiento del cron intacto para ellos — que
-- es exactamente lo que se quiere: el fix no debe cambiar nada de lo que ya
-- estaba andando.
-- Condicionado a unlimited_source IS NULL para que re-correr no pise nada.
UPDATE user_credits
SET unlimited_source = 'subscription'
WHERE is_unlimited = true
  AND unlimited_source IS NULL;

COMMENT ON COLUMN user_credits.unlimited_source IS
  'Procedencia de is_unlimited: subscription (Flow/setPlanFields) | manual (toggle de /admin). El cron expire-grace NO apaga los manual. NULL = sin ilimitado.';
