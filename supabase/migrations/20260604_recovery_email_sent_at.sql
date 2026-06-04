-- Recuperación de carrito abandonado (ruta A · compra única) · flag anti-spam.
-- Sin ejecutar todavía: revisar antes de correr contra Supabase (SQL Editor).
--
-- recovery_email_sent_at = timestamp del email de recuperación de carrito
-- abandonado; NULL = no enviado. El cron abandoned-checkout detecta filas
-- payments status='pending' con created_at viejo y, tras enviar el email vía
-- Resend, setea esta columna para NO reenviar (idempotencia del cron: una sola
-- recuperación por intento). NULL en todas las filas existentes.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS recovery_email_sent_at TIMESTAMPTZ;
