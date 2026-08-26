-- Base multi-fuente de precios UF/m² de departamentos por comuna (F0 plusvalía).
-- Tabla CRUDA: forensics y trazabilidad. NUNCA se lee en runtime — el motor
-- consume el módulo generado src/lib/plusvalia-estimado.gen.ts (F0) y, cuando
-- exista, la tabla derivada plusvalia_estimado (F2+). Diseño aprobado en el
-- audit audit-backtest-comuna-data-b3e0c8 (cascada GFK → A&C → DEFAULT).
--
-- Fuentes al importar (scripts/data/importar-plusvalia-fuentes.ts):
--   gfk         serie anual 2015-2024 (15 comunas + PROMEDIO GS) + 2024/2025. Deptos nuevos, oferta.
--   incoin      trimestral 2024-Q4 → 2025-Q4, 36 comunas RM en 3 zonas. Zonas
--               oriente/periferia mezclan casas+deptos (tipologia lo declara).
--   colliers    asking trimestral, Vitacura/Las Condes/La Florida + PROMEDIO GS.
--   cchc        1 agregado GS.
--   arenas_cayo migración de la constante PLUSVALIA_HISTORICA (2 puntos por
--               comuna: 2014 y 2024, 27 comunas).
-- Metodologías NO empalmables entre fuentes (verificado: -7%/+15% mismo
-- trimestre GFK vs INCOIN). La reconciliación vive en la derivada, nunca acá.
--
-- periodo normalizado: '2024' (anual) | '2025-Q1' (trimestre).
-- comuna: 'PROMEDIO GS' es sentinel de agregado — excluir de agregaciones por comuna.

CREATE TABLE IF NOT EXISTS public.plusvalia_fuentes_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente text NOT NULL CHECK (fuente IN ('gfk','incoin','colliers','cchc','arenas_cayo','franco_scraped')),
  comuna text NOT NULL,
  zona_incoin text,
  periodo text NOT NULL CHECK (periodo ~ '^[0-9]{4}(-Q[1-4])?$'),
  uf_m2 numeric NOT NULL CHECK (uf_m2 > 0),
  tipologia text NOT NULL CHECK (tipologia IN ('deptos_nuevos','mixto_casas_deptos','asking','deptos_mix','usados_scraped')),
  metodologia text,
  nota text,
  importado_en timestamptz NOT NULL DEFAULT now(),
  batch_id text NOT NULL,
  UNIQUE (fuente, comuna, periodo)
);

-- Append-only en la práctica (el importador upsertea sobre la UNIQUE por
-- idempotencia); sin RLS pública: solo service_role la toca.
ALTER TABLE public.plusvalia_fuentes_raw ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_plusvalia_raw_comuna_periodo
  ON public.plusvalia_fuentes_raw (comuna, periodo);
