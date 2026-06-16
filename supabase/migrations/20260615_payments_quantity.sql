-- Compra de varios créditos en una sola transacción (single con cantidad 1-20).
-- Aditiva y backward-compatible: las filas existentes quedan en quantity = 1.
-- NO aplicada a prod todavía — revisar antes de correr.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
