-- Add is_premium flag to analisis table
ALTER TABLE analisis ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE;
