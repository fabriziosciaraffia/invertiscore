-- Índices de precio de vivienda base 100 (números índice) — tabla CRUDA, separada
-- a propósito de plusvalia_fuentes_raw.
--
-- POR QUÉ UNA TABLA APARTE Y NO UNA COLUMNA `unidad` EN LA EXISTENTE:
-- plusvalia_fuentes_raw guarda UF/m² y alimenta la cascada y el generador. Un
-- índice base 100 no es conmensurable con UF/m²: promediarlos o compararlos da
-- un número sin significado. Una columna `unidad` sería una instrucción
-- prohibitiva — cada consumidor futuro tendría que acordarse de filtrar, y el
-- que se olvide falla EN SILENCIO. Con dos tablas la mezcla es imposible.
--
-- Fuente al importar (scripts/data/importar-clapes-realdata.ts):
--   clapes_realdata  Índice Inmobiliario CLAPES UC – Real Data. Trimestral,
--                    2007q1=100. Transacciones del CBR en UF (variación REAL,
--                    ya descontada la inflación) con modelos hedónicos. Casas y
--                    deptos por separado; 1 índice RM + 4 zonales.
--                    https://clapesuc.cl/indicadores/indice-inmobiliario-clapes-uc-real-data
--
-- ÁMBITO ZONAL, NO COMUNAL: las 4 zonas de CLAPES son agregados de varias
-- comunas (p.ej. Centro-Norte incluye Santiago). No hay mapeo comuna→zona acá:
-- si algún día se necesita, se declara explícito, no se adivina.
--
-- SIN CONSUMIDOR TODAVÍA: esta serie entra como insumo crudo. Nadie la lee en
-- runtime. No toca la cascada de plusvalía ni el generador.

CREATE TABLE IF NOT EXISTS public.plusvalia_indices_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente text NOT NULL CHECK (fuente IN ('clapes_realdata')),
  ambito text NOT NULL CHECK (ambito IN ('RM','Oriente','Centro-Norte','Sur-Poniente','Sur-Oriente')),
  tipologia text NOT NULL CHECK (tipologia IN ('deptos','casas')),
  periodo text NOT NULL CHECK (periodo ~ '^[0-9]{4}-Q[1-4]$'),
  valor_indice numeric NOT NULL CHECK (valor_indice > 0),
  base text NOT NULL,
  metodologia text,
  nota text,
  importado_en timestamptz NOT NULL DEFAULT now(),
  batch_id text NOT NULL,
  -- Incluye tipologia y ambito: sin ellas, casas pisaría deptos y una zona
  -- pisaría otra, en silencio, vía el upsert del importador.
  UNIQUE (fuente, ambito, tipologia, periodo)
);

-- Append-only en la práctica (el importador upsertea sobre la UNIQUE por
-- idempotencia); sin RLS pública: solo service_role la toca.
ALTER TABLE public.plusvalia_indices_raw ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_plusvalia_indices_ambito_periodo
  ON public.plusvalia_indices_raw (ambito, tipologia, periodo);
