-- Phase 2.39 · Modelo de créditos = ledger (variante B) + columnas de plan.
-- Sin ejecutar todavía: revisar antes de correr contra Supabase.
-- pro/pack3/subscription se deprecan (no se venden más) pero se conservan en el
-- historial y en el CHECK. credits (contador en user_credits) se mantiene por
-- ahora; 2.4 migra las lecturas al ledger.

-- 1 · Tabla ledger
CREATE TABLE IF NOT EXISTS credit_grants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      INT  NOT NULL,
  remaining   INT  NOT NULL,
  source      TEXT NOT NULL,        -- 'welcome'|'single'|'plan10_mensual'|'plan10_annual'|...
  payment_id  UUID REFERENCES payments(id),   -- NULL para grants no transaccionales
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,          -- NULL = no expira; paid grants = granted_at + 1 año
  consumed    BOOLEAN NOT NULL DEFAULT false,
  CHECK (remaining >= 0 AND remaining <= amount)
);
-- FIFO sobre lotes vivos
CREATE INDEX IF NOT EXISTS idx_credit_grants_live
  ON credit_grants (user_id, expires_at) WHERE remaining > 0;

-- 2 · Columnas de plan en user_credits (credits se mantiene por ahora; 2.4 migra lecturas)
ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS active_plan          TEXT,    -- 'single'|'plan10'|'plan50'|'unlimited'|NULL
  ADD COLUMN IF NOT EXISTS billing_period       TEXT,    -- 'monthly'|'annual'|NULL
  ADD COLUMN IF NOT EXISTS is_unlimited         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- 3 · Ampliar CHECK de payments.product (sumar nuevos, conservar viejos por historial)
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_product_check;
ALTER TABLE payments ADD CONSTRAINT payments_product_check CHECK (product IN (
  'pro','pack3','subscription','analysis_charge',
  'single','plan10_mensual','plan10_annual','plan50_mensual','plan50_annual',
  'unlimited_mensual','unlimited_annual'
));

-- 4 · RLS en credit_grants (mismo patrón del proyecto)
ALTER TABLE credit_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_grants_select_own ON credit_grants
  FOR SELECT USING (auth.uid() = user_id);
-- INSERT/UPDATE solo vía service_role (server). Sin policy de insert para usuarios.
