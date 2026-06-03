-- Política de past_due · período de gracia tras un cargo recurrente fallido.
-- Sin ejecutar todavía: revisar antes de correr contra Supabase (SQL Editor).
-- Posterior a 20260602_next_monthly_grant_at.sql (columna independiente).
--
-- grace_ends_at = deadline de gracia para suscripciones en past_due. Se setea
-- = now + 7 días cuando falla un cargo recurrente (Flow status 3/4, en
-- payment-callback). Durante la gracia (now < grace_ends_at) el usuario MANTIENE
-- acceso (free pass / gasto de grants). Un cargo exitoso dentro de la gracia
-- vuelve a 'active' y la limpia (NULL). El cron expire-grace pasa la sub a
-- 'cancelled' (+ is_unlimited=false) cuando vence (now >= grace_ends_at). NULL en
-- cualquier otro estado (active/none/cancelled). Separada de subscription_ends_at
-- (fin de ciclo anual del cron 2.8) para no mezclar conceptos.

ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ;
