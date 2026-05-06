-- Add welcome_credit_used flag to user_credits
-- Tracking del primer análisis gratis (welcome credit) por usuario registrado.
-- Backlog #3 — fix cobro de créditos: TODOS los análisis cobran 1 crédito;
-- el primer análisis del registrado se cubre con el welcome (gratis).
ALTER TABLE user_credits
ADD COLUMN IF NOT EXISTS welcome_credit_used BOOLEAN DEFAULT false;

-- Backfill usuarios existentes: asumir welcome gastado.
-- Justificación: cualquier user con análisis pre-existentes ya consumió el
-- equivalente al welcome cuando el flujo era gratis (LTR sin cobro). Sin
-- este backfill, todos los users existentes obtendrían 1 análisis premium
-- gratis post-deploy, lo cual no es lo deseado.
UPDATE user_credits
SET welcome_credit_used = true
WHERE user_id IN (
  SELECT DISTINCT user_id
  FROM analisis
  WHERE user_id IS NOT NULL
);

-- ─── AMBAS prepayment (Backlog #3 cont.) ──────────────────
-- Permite cobrar 1 crédito UNA vez antes de los 2 POSTs (LTR + STR) y que
-- ambos endpoints validen+claim contra la misma fila de payments.
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS consumed_by_analysis_id UUID REFERENCES analisis(id);

-- Índice parcial: lookup rápido de charges no-consumidos durante validación.
CREATE INDEX IF NOT EXISTS idx_payments_charge_unconsumed
ON payments(commerce_order)
WHERE consumed_at IS NULL AND status = 'paid';

-- Permitir product='analysis_charge' (cobro pre-análisis sin Flow involucrado).
-- El CHECK original sólo aceptaba pro/pack3/subscription.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_product_check;
ALTER TABLE payments ADD CONSTRAINT payments_product_check
  CHECK (product IN ('pro', 'pack3', 'subscription', 'analysis_charge'));
