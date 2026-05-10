-- Tabla de captura: operadores STR mencionados por usuarios en el form.
-- Calibración v1 — alimenta curaduría futura sin gastar AirROI calls.
--
-- El endpoint /api/analisis/short-term inserta acá cuando el usuario marca
-- tipo_edificio="dedicado" Y llena el campo opcional operador_nombre.

CREATE TABLE IF NOT EXISTS public.operadores_str_reportados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analisis_id uuid REFERENCES public.analisis(id) ON DELETE SET NULL,

  operador_nombre text NOT NULL,
  direccion_aproximada text,
  comuna text,
  lat numeric(10, 7),
  lng numeric(10, 7),

  reportado_por_usuario_id uuid,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operadores_str_nombre
  ON public.operadores_str_reportados (lower(operador_nombre));

CREATE INDEX IF NOT EXISTS idx_operadores_str_comuna
  ON public.operadores_str_reportados (comuna);

ALTER TABLE public.operadores_str_reportados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operadores_str_service_role_all" ON public.operadores_str_reportados;
CREATE POLICY "operadores_str_service_role_all" ON public.operadores_str_reportados
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "operadores_str_authenticated_insert" ON public.operadores_str_reportados;
CREATE POLICY "operadores_str_authenticated_insert" ON public.operadores_str_reportados
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "operadores_str_authenticated_read_own" ON public.operadores_str_reportados;
CREATE POLICY "operadores_str_authenticated_read_own" ON public.operadores_str_reportados
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND reportado_por_usuario_id = auth.uid())
  );
