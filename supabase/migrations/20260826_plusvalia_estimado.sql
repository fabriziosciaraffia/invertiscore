-- Tabla DERIVADA del estimado de plusvalía por comuna (F2).
-- Fuente canónica versionada: el generador (scripts/data/generar-plusvalia-estimado.ts)
-- la lee en BUILD TIME para emitir src/lib/plusvalia-estimado.gen.ts — en runtime
-- nadie consulta esta tabla ni la cruda (plusvalia_fuentes_raw, forensics).
--
-- Método aprobado (26-ago-2026) para anio=2025:
--   est2025 = GFK_Q1_2025(comuna) × (promedio de los 4 trimestres INCOIN 2025
--   de la comuna / INCOIN Q1 2025 de la comuna). Delta RELATIVO intra-fuente
--   (nunca se mezclan niveles entre fuentes). Banda: ± max(|Δincoin − ΔGS_gfk|,
--   2 puntos porcentuales). Guardas que DEGRADAN a sin-estimado (no se escribe
--   fila): |Δincoin Q1→Q4| > 8%, o estimado fuera de ±10% del anual GFK 2024.
--   Cero relleno con promedio GS.
-- 2026 NO se escribe por comuna hasta tener al menos un trimestre observado
-- por comuna de ese año.
--
-- Versionado: nunca UPDATE de cifras — una corrección o una fuente nueva
-- inserta version+1 con vigente=true y apaga (vigente=false) la anterior.
-- Las cifras ya citadas en informes siguen auditables por su versión.

CREATE TABLE IF NOT EXISTS public.plusvalia_estimado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comuna text NOT NULL,
  anio int NOT NULL CHECK (anio BETWEEN 2014 AND 2100),
  -- UF/m² estimado del año (promedio anual, misma base que la serie GFK).
  uf_m2 numeric NOT NULL CHECK (uf_m2 > 0),
  banda_min numeric NOT NULL CHECK (banda_min > 0),
  banda_max numeric NOT NULL CHECK (banda_max > 0),
  -- Fuentes que componen el estimado, en orden de rol (ancla primero).
  fuentes text[] NOT NULL,
  -- Texto de método LEGIBLE TAL CUAL por la página de metodología: describe
  -- ancla, deflactor, banda, guardas y caveats (p.ej. zona INCOIN mixta
  -- casas+deptos, efecto IVA/beneficios tributarios sobre precios de lista).
  metodo text NOT NULL,
  version int NOT NULL CHECK (version >= 1),
  vigente_desde date NOT NULL,
  vigente boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (banda_min <= uf_m2 AND uf_m2 <= banda_max),
  UNIQUE (comuna, anio, version)
);

-- A lo más UNA versión vigente por (comuna, anio).
CREATE UNIQUE INDEX IF NOT EXISTS idx_plusvalia_estimado_vigente
  ON public.plusvalia_estimado (comuna, anio) WHERE vigente;

-- Sin policies: solo service_role escribe (job del estimado) y lee (generador).
ALTER TABLE public.plusvalia_estimado ENABLE ROW LEVEL SECURITY;
