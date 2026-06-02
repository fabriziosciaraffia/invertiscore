-- Phase 2.8 · Idempotencia del cron de renovación mensual (planes ANUALES).
-- Sin ejecutar todavía: revisar antes de correr contra Supabase (SQL Editor).
--
-- next_monthly_grant_at = fecha del PRÓXIMO lote mensual debido para planes
-- anuales. NULL para mensuales/unlimited (no aplica). El cron recorre las
-- suscripciones anuales activas (billing_period='annual', is_unlimited=false),
-- y mientras next_monthly_grant_at <= now() y < subscription_ends_at: otorga
-- `capacity` créditos (grantCredits) y avanza esta fecha +1 mes (loop catch-up
-- si el cron se saltó corridas). register-callback la setea = subscription_start
-- + 1 mes al activar el anual (el mes 1 lo otorga el propio register-callback).

ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS next_monthly_grant_at TIMESTAMPTZ;
