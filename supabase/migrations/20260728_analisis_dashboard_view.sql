-- Vista aplanada `analisis_dashboard` + RPC `dashboard_stats` — Dashboard v2 (1/3).
--
-- PROBLEMA. El dashboard hace `select("*")` sobre `analisis` y trae los jsonb
-- `results` + `input_data` de TODAS las filas del usuario (215 y subiendo) solo
-- para pintar 9 columnas. Eso ni escala ni permite ordenar por métricas: flujo,
-- cap rate y multiplicador viven dentro del jsonb, invisibles para SQL.
--
-- SOLUCIÓN. Una vista que proyecta las columnas top-level + extrae del jsonb los
-- 4 números que la tabla del archivo necesita. La página pasa a pedir una
-- proyección chica, paginada, con ORDER BY y WHERE server-side.
--
-- ═══ UNIDADES — ojo acá ═══════════════════════════════════════════════════════
-- `cap_rate` NO viene con la misma unidad en los dos motores:
--   · LTR  `results.metrics.capRate`              → YA es porcentaje (4.2 = 4,2%)
--          (analysis.ts:290 → (noi/precioCLP)*100)
--   · STR  `results.escenarios.base.capRate`      → es FRACCIÓN (0.042 = 4,2%)
--          (dashboard-client.tsx:92 lo multiplica por 100 al renderizar)
-- La vista homogeniza a PORCENTAJE. Sin esto, ordenar la columna mezcla escalas
-- y produce un ranking falso (una fila STR de 6,2% se ordenaría como 0,062).
--
-- ═══ PARIDAD CON EL READ-PATH TS ══════════════════════════════════════════════
-- Cada expresión de abajo es espejo literal de lo que hoy hace
-- `dashboard-client.tsx` (getMetrics / getAnyVerdict / getSTRScore). Si el TS
-- cambia, esta vista cambia con él. Los fallbacks legacy están replicados a
-- propósito para que los conteos de la vista calcen con los de la UI actual.
--
-- Se aplica MANUALMENTE en el SQL Editor de Supabase. Idempotente.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0 · pg_trgm (búsqueda por dirección). Degrada con NOTICE si no está permitida:
--     sin la extensión el WHERE ILIKE '%…%' sigue funcionando, solo sin índice.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  RAISE NOTICE 'pg_trgm disponible: los índices trigram se crean.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm NO disponible (%). La búsqueda cae a ILIKE sin índice.', SQLERRM;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · Helpers inmutables
-- ─────────────────────────────────────────────────────────────────────────────

-- Cast seguro de un valor jsonb a numeric. Devuelve NULL si el nodo falta o no
-- es un número — nunca tira. (Sin esto, una fila legacy con un string donde el
-- motor hoy escribe un número rompería la vista entera.)
CREATE OR REPLACE FUNCTION public.franco_jsonb_num(j jsonb)
RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN j IS NULL OR jsonb_typeof(j) <> 'number' THEN NULL
    ELSE (j #>> '{}')::numeric
  END;
$$;

-- Espejo SQL de `normalizeLegacyVerdict()` (src/lib/types.ts:793). Devuelve NULL
-- para strings no reconocibles, igual que el TS.
--
-- NOTA DE ALCANCE: el goal pide el veredicto CRUDO en la vista y la
-- normalización en el read-path TS. La vista expone AMBOS: `veredicto` (crudo,
-- para que el TS siga siendo la autoridad de display) y `veredicto_norm` (solo
-- para filtrar y contar server-side). Sin la columna normalizada, filtrar
-- «COMPRAR» en SQL perdería las filas legacy que dicen «VIABLE», y los
-- contadores de los chips saldrían fragmentados.
CREATE OR REPLACE FUNCTION public.franco_normalize_verdict(raw text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE upper(btrim(coalesce(raw, '')))
    WHEN 'COMPRAR'                   THEN 'COMPRAR'
    WHEN 'VIABLE'                    THEN 'COMPRAR'
    WHEN 'AJUSTA SUPUESTOS'          THEN 'AJUSTA SUPUESTOS'
    WHEN 'AJUSTA EL PRECIO'          THEN 'AJUSTA SUPUESTOS'
    WHEN 'AJUSTA ESTRATEGIA'         THEN 'AJUSTA SUPUESTOS'
    WHEN 'RECONSIDERA LA ESTRUCTURA' THEN 'AJUSTA SUPUESTOS'
    WHEN 'BUSCAR OTRA'               THEN 'BUSCAR OTRA'
    WHEN 'NO RECOMENDADO'            THEN 'BUSCAR OTRA'
    ELSE NULL
  END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · Vista
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.analisis_dashboard;

CREATE VIEW public.analisis_dashboard
WITH (security_invoker = true)   -- la vista respeta la RLS del caller, no la del owner
AS
SELECT
  f.*,
  -- ── Veredictos de la UNIDAD ───────────────────────────────────────────────
  -- Un par AMBAS matchea el filtro de veredicto si CUALQUIERA de sus dos lados
  -- lo tiene (espejo de `itemVerdicts()` en dashboard-client). Como la lista
  -- pagina UNA fila por unidad (la del lado 'ltr'), esa fila tiene que cargar
  -- también el veredicto de su hermano.
  --
  -- Tres booleanos y no un array: el operador de contención de PostgREST sobre
  -- text[] obliga a serializar valores con espacios («AJUSTA SUPUESTOS») dentro
  -- de `cs.{…}`, y eso es frágil entre versiones del cliente. Con booleanos el
  -- filtro es un `eq` trivial.
  --
  -- El PARTITION BY lleva `user_id` a propósito: sin él, todas las filas con
  -- ambas_group_id NULL caerían en una sola partición gigante y Postgres no
  -- podría bajar el `WHERE user_id = …` por debajo de la window function
  -- (= seq scan de la tabla entera en cada consulta).
  bool_or(f.veredicto_norm = 'COMPRAR')          OVER w AS u_comprar,
  bool_or(f.veredicto_norm = 'AJUSTA SUPUESTOS') OVER w AS u_ajusta,
  bool_or(f.veredicto_norm = 'BUSCAR OTRA')      OVER w AS u_buscar
FROM (
SELECT
  a.id,
  a.user_id,
  a.nombre,
  a.direccion,
  a.comuna,
  a.tipo_analisis,
  a.ambas_group_id,
  a.ambas_role,
  a.dormitorios,
  a.banos,
  a.superficie,
  a.precio,
  a.score,
  a.created_at,
  a.is_premium,
  a.pending_payment,

  -- ── Score efectivo ────────────────────────────────────────────────────────
  -- STR guarda su score en results.francoScore.score; la columna `score` puede
  -- quedar en 0 (espejo de getSTRScore + su fallback a str.score).
  CASE
    WHEN a.tipo_analisis = 'short-term'
      THEN COALESCE(
        public.franco_jsonb_num(a.results -> 'francoScore' -> 'score')::int,
        a.score
      )
    ELSE a.score
  END AS score_efectivo,

  -- ── Flujo mensual (CLP) ───────────────────────────────────────────────────
  -- LTR: metrics.flujoNetoMensual · STR: escenarios.base.flujoCajaMensual.
  -- Fallback legacy SOLO en LTR sin `metrics` — espejo exacto de getMetrics(),
  -- que en ese caso calcula arriendo − gastos − contribuciones.
  CASE
    WHEN a.tipo_analisis = 'short-term'
      THEN COALESCE(
        public.franco_jsonb_num(a.results -> 'escenarios' -> 'base' -> 'flujoCajaMensual'),
        0
      )
    WHEN jsonb_typeof(a.results -> 'metrics') = 'object'
      THEN COALESCE(public.franco_jsonb_num(a.results -> 'metrics' -> 'flujoNetoMensual'), 0)
    ELSE (a.arriendo - a.gastos - a.contribuciones)::numeric
  END AS flujo,

  -- ── Cap rate (PORCENTAJE en ambas modalidades — ver cabecera) ─────────────
  -- NULL cuando la fila no trae el dato: la UI muestra «—», no un 0 falso.
  CASE
    WHEN a.tipo_analisis = 'short-term'
      THEN public.franco_jsonb_num(a.results -> 'escenarios' -> 'base' -> 'capRate') * 100
    ELSE public.franco_jsonb_num(a.results -> 'metrics' -> 'capRate')
  END AS cap_rate,

  -- ── Multiplicador de capital (×) — mismo campo en los dos motores ────────
  public.franco_jsonb_num(a.results -> 'exitScenario' -> 'multiplicadorCapital') AS multiplicador,

  -- ── Veredicto CRUDO (sin normalizar) ─────────────────────────────────────
  -- Precedencia espejo del read-path: STR mira francoScore.veredicto primero
  -- (getSTRVerdict); LTR usa readVeredicto() → veredicto ‖ francoVerdict ‖
  -- engineSignal.
  CASE
    WHEN a.tipo_analisis = 'short-term'
      THEN COALESCE(
        a.results -> 'francoScore' ->> 'veredicto',
        a.results ->> 'veredicto'
      )
    ELSE COALESCE(
      a.results ->> 'veredicto',
      a.results ->> 'francoVerdict',
      a.results ->> 'engineSignal'
    )
  END AS veredicto,

  -- ── Veredicto NORMALIZADO (solo para filtrar/contar) ─────────────────────
  -- Incluye los fallbacks que hoy aplica la UI y que difieren por modalidad:
  --   · STR  → getSTRVerdict: si no normaliza, cae a 'BUSCAR OTRA' (sin score).
  --   · LTR  → getVerdict: si no normaliza, cae por score (70 / 45 / 0).
  CASE
    WHEN a.tipo_analisis = 'short-term'
      THEN COALESCE(
        public.franco_normalize_verdict(COALESCE(
          a.results -> 'francoScore' ->> 'veredicto',
          a.results ->> 'veredicto'
        )),
        'BUSCAR OTRA'
      )
    ELSE COALESCE(
      public.franco_normalize_verdict(COALESCE(
        a.results ->> 'veredicto',
        a.results ->> 'francoVerdict',
        a.results ->> 'engineSignal'
      )),
      CASE
        WHEN a.score >= 70 THEN 'COMPRAR'
        WHEN a.score >= 45 THEN 'AJUSTA SUPUESTOS'
        ELSE 'BUSCAR OTRA'
      END
    )
  END AS veredicto_norm,

  -- ── ¿Esta fila REPRESENTA a su unidad? ───────────────────────────────────
  -- La lista pagina unidades, no filas: un par AMBAS son dos filas que la UI
  -- muestra como UNA card. Se elige el lado 'ltr' como representante. Columna
  -- y no un `or()` del cliente: encadenar dos `or=` en PostgREST es terreno
  -- resbaloso, y `not.eq.str` descartaría las filas sueltas (ambas_role NULL).
  (a.ambas_group_id IS NULL OR a.ambas_role = 'ltr') AS es_unidad

FROM public.analisis a
) f
WINDOW w AS (PARTITION BY f.user_id, COALESCE(f.ambas_group_id, f.id));

COMMENT ON VIEW public.analisis_dashboard IS
  'Proyección plana de `analisis` para el dashboard v2: columnas top-level + flujo/cap_rate/multiplicador/veredicto extraídos del jsonb `results`. cap_rate SIEMPRE en porcentaje (el motor STR lo guarda como fracción y la vista lo normaliza). Espejo del read-path de dashboard-client.tsx.';

GRANT SELECT ON public.analisis_dashboard TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 · Índices (sobre la TABLA base — una vista no se indexa)
-- ─────────────────────────────────────────────────────────────────────────────

-- Listado por defecto: las filas del usuario, más recientes primero.
-- (Ya existe idx_analisis_user_tipo_created (user_id, tipo_analisis, created_at);
--  este cubre el caso sin filtro de modalidad, que es el default.)
CREATE INDEX IF NOT EXISTS idx_analisis_user_created
  ON public.analisis (user_id, created_at DESC);

-- Búsqueda por texto. Trigram permite que `ILIKE '%pedro%'` use índice; sin
-- pg_trgm el DO de más arriba avisa y estas creaciones se saltan solas.
--
-- El operator class se califica con el esquema real de la extensión: en Supabase
-- pg_trgm suele vivir en `extensions`, no en `public`, y `gin_trgm_ops` a secas
-- no resuelve si ese esquema no está en el search_path de la sesión.
DO $$
DECLARE
  ext_schema text;
BEGIN
  SELECT n.nspname INTO ext_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_trgm';

  IF ext_schema IS NULL THEN
    RAISE NOTICE 'Sin pg_trgm: no se crean índices trigram (ILIKE hace seq scan sobre las filas del usuario).';
  ELSE
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_analisis_direccion_trgm ON public.analisis USING gin (direccion %I.gin_trgm_ops)',
      ext_schema);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_analisis_comuna_trgm ON public.analisis USING gin (comuna %I.gin_trgm_ops)',
      ext_schema);
    -- `nombre` es lo que la UI muestra cuando direccion es NULL → se busca igual.
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_analisis_nombre_trgm ON public.analisis USING gin (nombre %I.gin_trgm_ops)',
      ext_schema);
    RAISE NOTICE 'Índices trigram creados (pg_trgm en esquema %).', ext_schema;
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 · RPC de stats — una sola llamada para la franja del dashboard
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Unidad de conteo = lo que la UI llama «un análisis»: un par AMBAS son DOS
-- filas que cuentan como UNA (espejo de buildDisplayItems). Para el par se toma
-- el mejor score y el mejor flujo de los dos lados, igual que summaryData.
--
-- Los conteos por veredicto SÍ cuentan los dos lados de un AMBAS (deduplicados
-- si coinciden) — espejo de `new Set(itemVerdicts(i))` en verdictCounts.
--
-- «Flujo positivo» usa flujo >= 0, el mismo predicado que la UI hoy.
DROP FUNCTION IF EXISTS public.dashboard_stats(uuid);

CREATE OR REPLACE FUNCTION public.dashboard_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = public
AS $$
  WITH base AS (
    SELECT *
    FROM public.analisis_dashboard
    WHERE user_id = p_user_id
      AND pending_payment = false
  ),
  -- Una fila por UNIDAD del dashboard (suelto = 1 fila · par AMBAS = 1 unidad).
  unidades AS (
    SELECT
      b.id::text        AS unit_key,
      b.tipo_analisis   AS modalidad,
      b.flujo           AS flujo,
      b.score_efectivo  AS score
    FROM base b
    WHERE b.ambas_group_id IS NULL
    UNION ALL
    SELECT
      b.ambas_group_id::text,
      'ambas',
      max(b.flujo),
      max(b.score_efectivo)
    FROM base b
    WHERE b.ambas_group_id IS NOT NULL
    GROUP BY b.ambas_group_id
  ),
  -- Veredictos por unidad, deduplicados dentro del par AMBAS.
  veredictos AS (
    SELECT DISTINCT
      COALESCE(b.ambas_group_id::text, b.id::text) AS unit_key,
      b.veredicto_norm
    FROM base b
  )
  SELECT jsonb_build_object(
    'total',            (SELECT count(*) FROM unidades),
    'flujo_positivo',   (SELECT count(*) FROM unidades WHERE flujo >= 0),
    'score_promedio',   (SELECT COALESCE(round(avg(score))::int, 0) FROM unidades),
    'por_modalidad', jsonb_build_object(
      'long_term',  (SELECT count(*) FROM unidades WHERE modalidad = 'long-term'),
      'short_term', (SELECT count(*) FROM unidades WHERE modalidad = 'short-term'),
      'ambas',      (SELECT count(*) FROM unidades WHERE modalidad = 'ambas')
    ),
    'por_veredicto', jsonb_build_object(
      'COMPRAR',          (SELECT count(*) FROM veredictos WHERE veredicto_norm = 'COMPRAR'),
      'AJUSTA SUPUESTOS', (SELECT count(*) FROM veredictos WHERE veredicto_norm = 'AJUSTA SUPUESTOS'),
      'BUSCAR OTRA',      (SELECT count(*) FROM veredictos WHERE veredicto_norm = 'BUSCAR OTRA')
    )
  );
$$;

COMMENT ON FUNCTION public.dashboard_stats(uuid) IS
  'Stats de la franja del dashboard en una sola llamada. Cuenta unidades como la UI: un par AMBAS = 1. Excluye pending_payment=true.';

GRANT EXECUTE ON FUNCTION public.dashboard_stats(uuid) TO anon, authenticated;

-- NOTA DE SEGURIDAD. `analisis` tiene hoy la policy «Anyone can read analisis»
-- USING (true) (20260306_analisis_public_read.sql, para compartir análisis por
-- link). La vista es security_invoker y la RPC es SECURITY INVOKER: ninguna de
-- las dos amplía lo que ya se puede leer de la tabla. Si algún día esa policy se
-- restringe, ambas heredan la restricción sin tocarse.
