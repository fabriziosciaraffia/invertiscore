-- Tres análisis por $19.990 para quien tiene cuenta (13-oct-2026, decisión de Fabrizio; src/lib/tres-analisis.ts):
-- sumar 'tres_analisis' al CHECK de payments.product. Sin esto el INSERT de payments/create viola la restricción y
-- la compra no arranca (lo que le pasó a 'unlock' en 20260719).
--
-- Reconstruye la lista vigente leída del catálogo el 13-oct-2026 (pg_constraint: los 12 valores de 20260719) +
-- 'tres_analisis'. Aditivo: no quita valores. Idempotente (DROP IF EXISTS).

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_product_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_product_check CHECK (product IN (
  'pro','pack3','subscription','analysis_charge',
  'single','plan10_mensual','plan10_annual','plan50_mensual','plan50_annual',
  'unlimited_mensual','unlimited_annual',
  'unlock',
  'tres_analisis'
));
