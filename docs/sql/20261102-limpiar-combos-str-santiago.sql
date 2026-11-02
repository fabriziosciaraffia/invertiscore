-- ─────────────────────────────────────────────────────────────────────────────
-- LIMPIEZA PUNTUAL (02-nov-2026, goal «cortes por statement_timeout», Fase 1). Se ejecuta a mano en el SQL Editor.
--
-- El 02-nov-2026 a las 12:30 UTC, Explorar en renta corta (pie 20 %, 30 años) calculó Santiago con la lectura de la zona
-- cortada por timeout (`airbnb_estimates` con `address ilike '%Santiago%'`). Sin zona, cada aviso quedó guardado SIN
-- veredicto en `avisos_evaluados.combos -> 'str-20-30'`, y esa clave vale 24 horas: hasta el 03-nov 12:30 UTC Santiago
-- muestra 0 que convienen en renta corta, sin ningún error. Esto quita la clave SOLO en esas filas: la próxima vez que
-- alguien abra Santiago en renta corta, Explorar las vuelve a calcular.
--
-- Acotado por la marca de tiempo exacta del lote (`at` = 2026-11-02T12:30:16.799Z): si se corre después de que Explorar
-- las recalculó, no toca nada. Las otras claves de `combos` no se tocan.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1 · Cuántas filas toca (el 02-nov-2026 a las 13:00 UTC eran 5.394 de las 5.882 de Santiago con la clave).
select count(*) as filas_a_limpiar
from avisos_evaluados ae
join scraped_properties sp on sp.id = ae.aviso_id
where sp.comuna = 'Santiago'
  and ae.combos ? 'str-20-30'
  and ae.combos -> 'str-20-30' ->> 'v' is null
  and ae.combos -> 'str-20-30' ->> 'at' = '2026-11-02T12:30:16.799Z';

-- 2 · La limpieza. Devuelve cuántas filas cambió (tiene que ser el número de arriba).
with limpiadas as (
  update avisos_evaluados ae
  set combos = ae.combos - 'str-20-30'
  from scraped_properties sp
  where sp.id = ae.aviso_id
    and sp.comuna = 'Santiago'
    and ae.combos ? 'str-20-30'
    and ae.combos -> 'str-20-30' ->> 'v' is null
    and ae.combos -> 'str-20-30' ->> 'at' = '2026-11-02T12:30:16.799Z'
  returning 1
)
select count(*) as filas_limpiadas from limpiadas;
