-- ─────────────────────────────────────────────────────────────────────────
-- Prosa de Franco por comuna (páginas /comunas/[slug])
--
-- La lee el render; la escribe SOLO el script de generación
-- (scripts/data/generar-prosa-comunas.ts). Una fila por comuna: se genera UNA
-- vez y se persiste junto al SNAPSHOT de los números que narró, mismo patrón
-- que `mediana_comuna_snapshot` en `analisis`.
--
-- POR QUÉ EL SNAPSHOT VIVE ACÁ. La prosa cita cifras concretas ("faltan
-- $367.836", "el 4D está a 1,4%"). Los números de la comuna se recalculan solos
-- cada 24h desde el scraping, así que sin la foto de lo que la prosa narró no
-- hay forma de saber si sigue diciendo la verdad. Con la foto, el generador
-- compara y regenera solo lo que se movió. El caso testigo: Providencia dio
-- vuelta su veredicto en cuatro días — el 4D pasó de faltarle $23.418 a
-- sobrarle $99.734. Una prosa de esa semana quedaría afirmando lo contrario.
--
-- NUNCA se corrige sola ni se oculta: el render publica lo que hay y el
-- generador marca lo que hay que rehacer.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.comuna_prosa (
  -- Slug del roster (src/lib/data/comunas-roster.ts). Una fila por comuna.
  slug text PRIMARY KEY,
  -- Nombre canónico con acentos, para trazar la fila sin cruzar con el roster.
  comuna text NOT NULL,
  -- El párrafo. 4-6 frases, 70-110 palabras (analysis-voice-franco §2.6).
  prosa text NOT NULL CHECK (length(prosa) BETWEEN 200 AND 1400),
  -- Foto de los números que la prosa narró: tipologías (n, arriendo, venta,
  -- dividendo, brecha, cubre, precio de equilibrio) + supuestos de crédito.
  -- Contra esto se mide el drift.
  snapshot jsonb NOT NULL,
  -- Versión del prompt que la generó. Un bump obliga a regenerar el parque.
  prompt_version int NOT NULL CHECK (prompt_version >= 1),
  -- Modelo que la escribió, para auditar cambios de calidad entre lotes.
  modelo text NOT NULL,
  generada_en timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.comuna_prosa IS
  'Párrafo de Franco por comuna + snapshot de las cifras que narró. Escribe solo el generador; el render lee.';
COMMENT ON COLUMN public.comuna_prosa.snapshot IS
  'Cifras narradas al momento de generar. El generador compara contra los números vivos para decidir qué regenerar.';

-- Sin policies: la página es pública pero se sirve desde el server (service_role
-- / anon con RLS cerrada), igual que el resto de la data de comunas. Nadie
-- escribe desde el cliente.
ALTER TABLE public.comuna_prosa ENABLE ROW LEVEL SECURITY;

-- Lectura pública: la prosa se publica en una página abierta, no hay nada que
-- proteger, y así el render funciona con la clave anon sin excepciones.
DROP POLICY IF EXISTS "comuna_prosa lectura publica" ON public.comuna_prosa;
CREATE POLICY "comuna_prosa lectura publica"
  ON public.comuna_prosa FOR SELECT
  USING (true);
