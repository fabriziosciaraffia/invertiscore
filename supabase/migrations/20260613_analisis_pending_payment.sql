-- Flag de "análisis creado pero pendiente de pago" (flujo LTR bloqueado pre-pago).
-- Una fila con pending_payment=true se computó (motor gratis) pero NO se cobró
-- crédito ni se desbloqueó (is_premium=false, sin IA). Se oculta de "Mis análisis"
-- hasta que confirm la desbloquee tras el pago (pending_payment=false + is_premium=true).
ALTER TABLE analisis ADD COLUMN IF NOT EXISTS pending_payment BOOLEAN NOT NULL DEFAULT FALSE;
