-- Fase D — sumar 'unlock' al CHECK de payments.product.
--
-- Contexto/post-mortem: el commit 94a00ab ("intent 'unlock' aditivo") agregó el
-- valor 'unlock' en flow-products.ts + los paths create/confirm, pero NO incluyó
-- la migración de constraint correspondiente. El único .sql de Fase D fue
-- f0dbad7 (columna ambas_unlocked_at). Como el E2E reportado nunca corrió contra
-- la DB real, el hueco recién se detectó en QA (checkpoint 2): el INSERT en
-- payments con product='unlock' violaba payments_product_check.
--
-- Este ALTER reconstruye la lista real vigente (11 valores del último migration
-- que la tocó, 20260530) + 'unlock'. Aditivo: no quita valores. Idempotente
-- (DROP IF EXISTS). Ya corrido manualmente en el SQL Editor de Supabase; este
-- archivo lo deja versionado para que la migración quede en el repo.

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_product_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_product_check CHECK (product IN (
  'pro','pack3','subscription','analysis_charge',
  'single','plan10_mensual','plan10_annual','plan50_mensual','plan50_annual',
  'unlimited_mensual','unlimited_annual',
  'unlock'
));
