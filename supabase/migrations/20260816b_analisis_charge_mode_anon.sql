-- Cap anónimo (F2-2) · PARTE 2 — descubierta por el E2E real, no por el audit:
-- `charge_mode` tiene un CHECK constraint aplicado directo en Supabase (no hay
-- migración de charge_mode en el repo), y no admite 'anon_cap'. El INSERT
-- anónimo rebota con 23514 (`analisis_charge_mode_check`).
--
-- Valores legales hoy, por los escritores del código:
--   · /api/analisis y /short-term escriben el mode de ensureCreditCharged:
--     'welcome' | 'paid' | 'subscription' | 'admin'
--   · /api/analisis/locked no la escribe → NULL
-- Se recrea con ese universo + 'anon_cap'.
--
-- VERIFICACIÓN PREVIA (leer el catálogo antes de tocar, doctrina del repo):
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'analisis_charge_mode_check';
-- Si la definición real difiere del universo de arriba, ajustar la lista de
-- abajo para que sea la existente + 'anon_cap' — nunca menos valores.

ALTER TABLE public.analisis
  DROP CONSTRAINT IF EXISTS analisis_charge_mode_check;

ALTER TABLE public.analisis
  ADD CONSTRAINT analisis_charge_mode_check
  CHECK (
    charge_mode IS NULL
    OR charge_mode IN ('welcome', 'paid', 'subscription', 'admin', 'anon_cap')
  );
