-- Add welcome_email_sent flag to user_credits.
-- Desacopla el envío del welcome email de la existencia de la fila en
-- user_credits. Antes, "no existe fila = usuario nuevo" era el proxy para
-- decidir si enviar el welcome, pero complete-onboarding/route.ts y access.ts
-- crean la fila antes de que el cliente llamara a check-welcome, así que el
-- email dejaba de enviarse. Ahora la fuente de verdad es esta columna.
ALTER TABLE user_credits
ADD COLUMN IF NOT EXISTS welcome_email_sent BOOLEAN NOT NULL DEFAULT false;

-- Backfill usuarios existentes: asumir welcome ya enviado.
-- Cualquier user con fila pre-existente ya pasó por el flujo anterior (recibió
-- el welcome o ya está onboardeado). Sin este backfill, todos los users
-- existentes recibirían un welcome email en su próximo ingreso al dashboard.
UPDATE user_credits
SET welcome_email_sent = true;
