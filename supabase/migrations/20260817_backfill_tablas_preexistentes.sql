-- BACKFILL: documenta objetos PRE-EXISTENTES en prod, no aplicar de nuevo.
--
-- Motivo (audit C-1, 16-ago): el repo no contaba la verdad del esquema. Hay
-- tablas y columnas que viven en producción desde antes de que existieran las
-- migraciones versionadas, o que se aplicaron a mano. Mientras el repo no las
-- nombre, cualquiera que reconstruya la base desde `supabase/migrations/`
-- obtiene un esquema distinto al real — y el código falla en runtime, que es
-- exactamente lo que pasó el 16-ago con el CHECK de `charge_mode`: existía solo
-- en la base y el INSERT anónimo rebotó con 23514 recién en el E2E.
--
-- TODO acá es idempotente (IF NOT EXISTS) y refleja el catálogo REAL leído el
-- 17-ago vía el spec OpenAPI de PostgREST con service role. Aplicarlo sobre la
-- base actual es un no-op; su valor es que `git` deje de mentir.
--
-- FUERA DE ESTE ARCHIVO, por honestidad: políticas RLS y triggers NO se pueden
-- leer desde PostgREST, así que no se documentan acá — inventarlos sería
-- reemplazar una mentira por otra. Ver el script de catálogo del reporte C-1
-- (pg_policies / information_schema.triggers) y el archivo hermano
-- 20260817_backfill_rls_triggers.sql, que queda como plantilla a completar con
-- ese output.

-- ── Tablas ───────────────────────────────────────────────────────────────────

-- Cuentas internas del equipo. Es el pilar del filtro "sin cuentas de prueba"
-- del panel admin y de la RPC `es_test_account` (esa sí versionada, en
-- 20260809_informe_visto.sql, que la REFERENCIA sin crearla).
CREATE TABLE IF NOT EXISTS public.test_accounts (
  user_id    UUID PRIMARY KEY,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lista de espera general del producto (distinta de `waitlist_zonas`, que mide
-- demanda por comuna fuera de cobertura).
CREATE TABLE IF NOT EXISTS public.waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  source     TEXT DEFAULT 'landing',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Gastos fijos del negocio (alimenta /admin/finanzas).
CREATE TABLE IF NOT EXISTS public.gastos_fijos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  categoria     TEXT NOT NULL,
  monto         NUMERIC NOT NULL,
  moneda        TEXT NOT NULL DEFAULT 'CLP',
  periodicidad  TEXT NOT NULL,
  iva           TEXT NOT NULL DEFAULT 'exento',
  vigente_desde DATE NOT NULL,
  vigente_hasta DATE,
  nota          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Columnas huérfanas ───────────────────────────────────────────────────────
-- Existen en prod y el código las usa a diario, pero ninguna migración las crea
-- (son anteriores al repo de migraciones).

-- Prosa IA persistida del análisis LTR/STR (columna aparte de `results`: el
-- recompute del motor nunca la toca).
ALTER TABLE public.analisis
  ADD COLUMN IF NOT EXISTS ai_analysis JSONB;

-- Nombre a mostrar del creador en la vista de resultados.
ALTER TABLE public.analisis
  ADD COLUMN IF NOT EXISTS creator_name TEXT;

-- Identificadores de la suscripción en Flow.
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS subscription_id TEXT;

ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS flow_customer_id TEXT;
