-- Historial de precios PUBLICADOS de los avisos de `scraped_properties` (24-sep-2026).
--
-- POR QUÉ. Cada pasada del scraper sobrescribe `precio`, así que no queda registro de cuánto bajó
-- un aviso antes de salir del listado. Ese dato es el piso medible del margen de negociación: no es
-- el precio de cierre (eso es CBR / SII F2890, que no tenemos), pero es lo único que podemos empezar
-- a juntar hoy sin terceros.
--
-- SOLO CAMBIOS, NO CADA OBSERVACIÓN. Guardar una fila por aviso y por pasada son ~5 millones de
-- filas al año (~500 MB, más que la base entera hoy). Con solo los cambios la tabla crece al ritmo
-- de las rebajas reales, que se miden después de las dos primeras pasadas.
--
-- UN TRIGGER Y NO CÓDIGO EN LAS RUTAS. Escriben en `scraped_properties` cinco rutas (backfill-toctoc,
-- scrape-properties, scrape-nuevos, scrape-unidades-nuevas, bulk-import). El upsert de PostgREST
-- (merge-duplicates) dispara el UPDATE, así que el trigger las cubre a todas sin tocar ninguna, y una
-- ruta nueva no puede olvidarse de registrar.
--
-- «Última vez visto» ya existe: `scraped_at` (en venta usada y arriendo; ojo, el pase de unidades de
-- obra nueva no lo refresca). El historial no lo duplica.
--
-- LECTURA: solo el service role (RLS encendido, SIN políticas — mismo patrón que
-- `plusvalia_indices_raw`). Un cliente anónimo recibe cero filas sin error.

CREATE TABLE IF NOT EXISTS public.scraped_properties_precios (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.scraped_properties(id) ON DELETE CASCADE,
  precio NUMERIC NOT NULL,
  moneda TEXT,
  visto_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 'semilla' = el precio que había al crear la tabla · 'alta' = aviso nuevo · 'cambio' = el precio o la moneda cambiaron
  origen TEXT NOT NULL CHECK (origen IN ('semilla', 'alta', 'cambio'))
);

CREATE INDEX IF NOT EXISTS idx_scraped_properties_precios_prop_fecha
  ON public.scraped_properties_precios (property_id, visto_en);

ALTER TABLE public.scraped_properties_precios ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.registrar_precio_aviso()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.precio IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.scraped_properties_precios (property_id, precio, moneda, origen)
  VALUES (NEW.id, NEW.precio, NEW.moneda, CASE WHEN TG_OP = 'INSERT' THEN 'alta' ELSE 'cambio' END);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_precio_alta ON public.scraped_properties;
CREATE TRIGGER trigger_precio_alta
  AFTER INSERT ON public.scraped_properties
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_precio_aviso();

-- Solo cuando el valor cambia de verdad: el upsert reescribe `precio` en cada pasada con el mismo
-- número, y sin este WHEN la tabla sería una fila por observación.
DROP TRIGGER IF EXISTS trigger_precio_cambio ON public.scraped_properties;
CREATE TRIGGER trigger_precio_cambio
  AFTER UPDATE OF precio, moneda ON public.scraped_properties
  FOR EACH ROW
  WHEN (OLD.precio IS DISTINCT FROM NEW.precio OR OLD.moneda IS DISTINCT FROM NEW.moneda)
  EXECUTE FUNCTION public.registrar_precio_aviso();

-- SEMILLA: el precio vigente de cada aviso, fechado en su última vez visto. Idempotente: no vuelve a
-- sembrar un aviso que ya tiene historial.
INSERT INTO public.scraped_properties_precios (property_id, precio, moneda, visto_en, origen)
SELECT sp.id, sp.precio, sp.moneda, COALESCE(sp.scraped_at, sp.created_at, NOW()), 'semilla'
FROM public.scraped_properties sp
WHERE sp.precio IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.scraped_properties_precios h WHERE h.property_id = sp.id);
