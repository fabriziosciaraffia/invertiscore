-- ═══════════════════════════════════════════════════════════════════════════
-- analisis.ai_cache_creation_tokens — la sexta columna de consumo
--
-- CORRER A MANO en el SQL editor de Supabase. NO es una migración: las otras
-- cinco columnas (ai_input_tokens, ai_output_tokens, ai_cache_read_tokens,
-- ai_calls, ai_model) también se crearon así.
--
-- Por qué hace falta: `usage` de la API de Anthropic trae CUATRO contadores de
-- tokens, no tres. Faltaba el de ESCRITURA de caché:
--
--     prompt total = input_tokens + cache_creation_input_tokens + cache_read_input_tokens
--
-- Y para el costo la diferencia no es menor: una LECTURA de caché cuesta ~0,1×
-- el input normal, pero una ESCRITURA cuesta 1,25× (2× con TTL de una hora).
-- Sin esta columna, el costo queda subestimado justo cuando el prompt caching
-- esté encendido.
--
-- Hoy el repo no usa caching (ni un `cache_control` en src/), así que la columna
-- se va a llenar de ceros por ahora. Se agrega igual para que el día que se
-- active no haya que rellenar filas viejas a mano ni convivir con un período
-- ciego en los números.
--
-- Sin DEFAULT y nullable, igual que las otras cinco: NULL significa "este
-- análisis es anterior a la medición", que es distinto de "consumió 0 tokens".
-- Las 670 filas existentes quedan en NULL a propósito — su consumo real no es
-- reconstruible y no se inventa.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.analisis
  add column if not exists ai_cache_creation_tokens bigint;

comment on column public.analisis.ai_cache_creation_tokens is
  'Tokens escritos a la caché de prompts (usage.cache_creation_input_tokens), acumulado entre regeneraciones. NULL = análisis anterior a la medición.';


-- ───────────────────────────────────────────────────────────────────────────
-- Comprobación
-- ───────────────────────────────────────────────────────────────────────────
-- Las seis columnas presentes:
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'analisis'
--    and column_name like 'ai\_%'
--  order by column_name;
--
-- Consumo y llamadas de los análisis que ya midieron (después del deploy):
-- select id, created_at, ai_model, ai_calls,
--        ai_input_tokens, ai_output_tokens,
--        ai_cache_read_tokens, ai_cache_creation_tokens,
--        -- El prompt completo es la SUMA de los tres de entrada: usar solo
--        -- ai_input_tokens subestima cuando hay caching.
--        coalesce(ai_input_tokens,0) + coalesce(ai_cache_read_tokens,0)
--          + coalesce(ai_cache_creation_tokens,0) as prompt_total
--   from public.analisis
--  where ai_calls is not null
--  order by created_at desc
--  limit 20;
