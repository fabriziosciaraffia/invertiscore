-- Créditos · UNIQUE parcial en credit_grants(payment_id).
--
-- Cierra la ventana TOCTOU del grant: dos procesos (el webhook payment-callback y el
-- cron reconcile-subscriptions) procesando el MISMO cobro recurrente en milisegundos
-- podían insertar dos lotes para el mismo payment_id (processSubscriptionCharge chequea
-- "¿ya hay grant para este payment_id?" y luego inserta — sin atomicidad). El UNIQUE
-- hace que el 2º INSERT choque 23505 → grantCredits lo trata como dedup benigno.
--
-- PARCIAL (WHERE payment_id IS NOT NULL): los grants no-transaccionales tienen
-- payment_id NULL — el cron monthly-grants otorga los meses 2-12 de los planes ANUALES
-- llamando grantCredits sin paymentId. Esos NO deben quedar constrainidos (habría varios
-- por usuario). Mismo patrón que uq_documentos_tributarios_payment_vivo.
--
-- Idempotente (IF NOT EXISTS): ya aplicado en prod vía SQL Editor; este archivo es para
-- reproducibilidad del esquema en el repo.

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_grants_payment_id
  ON credit_grants (payment_id)
  WHERE payment_id IS NOT NULL;
