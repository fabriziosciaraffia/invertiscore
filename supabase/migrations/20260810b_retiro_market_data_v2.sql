-- ─────────────────────────────────────────────────────────────────────────
-- Retiro de `market_data_v2` — el segundo fantasma.
--
-- La creó el bloque inicial de 20260315_postgis_scraped_properties.sql
-- ("datos de mercado Banco Central") y NUNCA tuvo escritor ni lector: cero
-- referencias en el código desde entonces, 0 filas verificadas el 2026-08-09
-- (sonda read-only, rama limpieza-market-data). El pull real de UF/tasa
-- escribe en `config` vía /api/data/update-market — esta tabla quedó como
-- cascarón del diseño original.
--
-- (La `market_data` v1, hermana de este fantasma, nunca llegó a existir:
-- verificado por PGRST205 en la misma sonda. No hay DROP que hacer ahí; su
-- historia vive en el header de 20260306_create_market_data.sql.)
--
-- Mismo patrón que 20260810_retiro_market_stats.sql: checks de catálogo
-- ADENTRO — aborta con detalle si algo llegó a colgar de ella.
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  dep_count integer;
  dep_detail text;
  filas integer;
BEGIN
  IF to_regclass('public.market_data_v2') IS NULL THEN
    RAISE NOTICE 'market_data_v2 ya no existe — nada que dropear.';
    RETURN;
  END IF;

  -- Guard de contenido: se diagnosticó VACÍA. Si alguien escribió después,
  -- abortar y mirar antes de borrar datos que no conocemos.
  EXECUTE 'SELECT count(*) FROM public.market_data_v2' INTO filas;
  IF filas > 0 THEN
    RAISE EXCEPTION 'ABORT: market_data_v2 tiene % fila(s) — se diagnosticó vacía; revisar antes de dropear.', filas;
  END IF;

  SELECT count(*), string_agg(DISTINCT dependent.relname, ', ')
    INTO dep_count, dep_detail
  FROM pg_depend d
  JOIN pg_rewrite r ON r.oid = d.objid
  JOIN pg_class dependent ON dependent.oid = r.ev_class
  WHERE d.refobjid = 'public.market_data_v2'::regclass
    AND dependent.oid <> 'public.market_data_v2'::regclass;
  IF dep_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % vista(s) dependen de market_data_v2: %', dep_count, dep_detail;
  END IF;

  SELECT count(*), string_agg(conrelid::regclass::text || '.' || conname, ', ')
    INTO dep_count, dep_detail
  FROM pg_constraint
  WHERE confrelid = 'public.market_data_v2'::regclass;
  IF dep_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % FK(s) referencian market_data_v2: %', dep_count, dep_detail;
  END IF;

  DROP TABLE public.market_data_v2;
  RAISE NOTICE 'market_data_v2 dropeada (0 filas, sin lectores desde su creación).';
END $$;
