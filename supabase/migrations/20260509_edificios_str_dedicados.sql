-- Edificios STR dedicados: tabla curada para excluir del benchmark de comparables.
-- Llenada manualmente con candidatos + validada vía AirROI (clusters de host_id).
--
-- Usa PostGIS (ya habilitado en 20260315_postgis_scraped_properties.sql) para
-- consistencia con scraped_properties.

CREATE TABLE IF NOT EXISTS public.edificios_str_dedicados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificación
  nombre_edificio text NOT NULL,
  operador_esperado text NOT NULL,
  comuna text NOT NULL,
  direccion_aproximada text,

  -- Geolocalización (lat/lng aproximadas; geog se auto-genera vía trigger)
  lat numeric(10, 7),
  lng numeric(10, 7),
  geog geography(Point, 4326),
  radio_match_metros int NOT NULL DEFAULT 100,

  -- Datos validados desde AirROI
  host_id_airroi text[],
  host_names_airroi text[],
  unidades_detectadas int DEFAULT 0,
  professional_management boolean,

  -- Clasificación
  tipo text NOT NULL DEFAULT 'candidato'
    CHECK (tipo IN ('candidato', 'dedicado_100', 'mixto_alto', 'mixto_bajo', 'descartado')),

  -- Workflow de verificación
  verificado boolean NOT NULL DEFAULT false,
  fecha_validacion timestamptz,
  fuente text NOT NULL DEFAULT 'manual'
    CHECK (fuente IN ('manual', 'reporte_usuario', 'inferencia_validada')),
  notas text,

  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice espacial PostGIS (consistente con scraped_properties)
CREATE INDEX IF NOT EXISTS idx_edificios_str_geog
  ON public.edificios_str_dedicados USING gist (geog);

-- Índice por verificación + tipo (filtrado en endpoint STR)
CREATE INDEX IF NOT EXISTS idx_edificios_str_verificados
  ON public.edificios_str_dedicados (verificado, tipo)
  WHERE verificado = true AND tipo IN ('dedicado_100', 'mixto_alto');

-- RLS
ALTER TABLE public.edificios_str_dedicados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON public.edificios_str_dedicados;
CREATE POLICY "service_role_all" ON public.edificios_str_dedicados
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "authenticated_read" ON public.edificios_str_dedicados;
CREATE POLICY "authenticated_read" ON public.edificios_str_dedicados
  FOR SELECT USING (auth.role() = 'authenticated');

-- Trigger: auto-poblar geog desde lat/lng
CREATE OR REPLACE FUNCTION sync_edificios_str_geog()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geog = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_edificios_str_geog ON public.edificios_str_dedicados;
CREATE TRIGGER trigger_sync_edificios_str_geog
  BEFORE INSERT OR UPDATE OF lat, lng ON public.edificios_str_dedicados
  FOR EACH ROW EXECUTE FUNCTION sync_edificios_str_geog();

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION update_updated_at_edificios_str()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_edificios_str_updated_at ON public.edificios_str_dedicados;
CREATE TRIGGER trigger_update_edificios_str_updated_at
  BEFORE UPDATE ON public.edificios_str_dedicados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_edificios_str();
