-- ─────────────────────────────────────────────────────────────────────────
-- Retiro de `market_stats` — la tabla huérfana y su escritor.
--
-- POR QUÉ MUERE (diagnóstico 2026-08-09, rama catch-silenciosos-market-stats):
--  · Cero lectores vivos: el nivel 2 del wizard (sugerencia de arriendo) se
--    retiró el 2026-08-04 (ciclo cadena-arriendo-sin-relleno) y el nivel 3
--    (seed) también. Solo quedaba el escritor, escribiendo para nadie.
--  · El escritor (calculateMarketStats, retirado en este mismo commit) tenía
--    4 vicios: SELECT sin .range() → procesaba 1.000 de 56.790 propiedades
--    activas (1,8%); upsert con dormitorios NULL que INSERTA en vez de
--    actualizar → 58 de 71 grupos duplicados (Santiago|venta ×32 copias);
--    ruta solo-POST (los cron de Vercel hacen GET); y mezcla CLP/UF sin
--    convertir en venta.
--  · Contenido 100% derivado de `scraped_properties` (recomputable si algún
--    día hiciera falta) con ~87% de filas duplicadas: no hay dato primario
--    que perder. Congelada desde 2026-03-24.
--
-- DROP y no archivo: mismo precedente que el arriendo de referencia — un
-- número plausible ocupando el lugar de uno real es peor que la ausencia.
--
-- El DO-block de abajo verifica ANTES de dropear que nada del catálogo cuelga
-- de la tabla (vistas/reglas vía pg_depend, FKs entrantes vía pg_constraint).
-- Si algo apareció desde el diagnóstico, la migración ABORTA con el detalle
-- en vez de arrastrarlo con un CASCADE ciego. Las policies RLS propias de la
-- tabla mueren con ella (comportamiento estándar de DROP TABLE).
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  dep_count integer;
  dep_detail text;
BEGIN
  -- Nada que hacer si ya no existe (migración re-ejecutable).
  IF to_regclass('public.market_stats') IS NULL THEN
    RAISE NOTICE 'market_stats ya no existe — nada que dropear.';
    RETURN;
  END IF;

  -- Vistas u otras relaciones que dependan de la tabla (via rewrite rules).
  SELECT count(*), string_agg(DISTINCT dependent.relname, ', ')
    INTO dep_count, dep_detail
  FROM pg_depend d
  JOIN pg_rewrite r ON r.oid = d.objid
  JOIN pg_class dependent ON dependent.oid = r.ev_class
  WHERE d.refobjid = 'public.market_stats'::regclass
    AND dependent.oid <> 'public.market_stats'::regclass;
  IF dep_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % vista(s) dependen de market_stats: %', dep_count, dep_detail;
  END IF;

  -- FKs de OTRAS tablas apuntando acá.
  SELECT count(*), string_agg(conrelid::regclass::text || '.' || conname, ', ')
    INTO dep_count, dep_detail
  FROM pg_constraint
  WHERE confrelid = 'public.market_stats'::regclass;
  IF dep_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % FK(s) referencian market_stats: %', dep_count, dep_detail;
  END IF;

  DROP TABLE public.market_stats;
  RAISE NOTICE 'market_stats dropeada (1.771 filas derivadas, congeladas 2026-03-24).';
END $$;
