-- ─────────────────────────────────────────────────────────────────────────────
-- INVIERTE CON FRANCO · EL RELLENO DE DECODO LEE PRIMERO LOS DEPTOS DE INVIERTE SIN FOTOS (19-nov-2026, decisión de Fabrizio:
-- «Las alternativas se leen por el relleno de Decodo»). PARA QUE LO APLIQUE CLAUDE A PEDIDO DE FABRIZIO; no lo aplica el agente.
--
-- Qué cambia en `relleno_publicadores_candidatos` (cron `relleno-publicadores`, cada 10 minutos, 200 fichas por hora, fusible):
--   · Primero (prioridad -1) los deptos que están en la base de alguien en Invierte con Franco —sus elegidos y las alternativas que
--     Franco le recomendó (`inv_deptos` en 'opcion' o 'elegido')— cuyas fotos, texto y dirección no se leyeron en los últimos 7
--     días (`publicacion_detalle`). Esa rama NO exige que falte el publicador: el relleno ya leyó a casi todos los que convienen y,
--     sin esto, las alternativas nunca tendrían fotos.
--   · Después, igual que hoy: las inscripciones de «Pronto» y los que convienen, solo si les falta el publicador.
--   · Los mismos resguardos de hoy para todas: sin despublicados y sin una lectura del relleno en las últimas 24 horas.
-- La lectura es la misma (`leerFicha` por Decodo, dos GETs como mucho, su tope y su fusible); del mismo 200 sale ahora también
-- el detalle (src/lib/guia/detalle-ficha.ts).
--
-- MEDIDO el 19-nov-2026 (función contra función, EXPLAIN ANALYZE BUFFERS, p_limite 40, la nueva como pg_temp):
--   · hoy: 52 ms, 24.688 bloques, 0 filas (el relleno ya leyó a todos los que convienen);
--   · nueva: 129 ms, 25.305 bloques, 9 filas, las 9 de Invierte (de 11 deptos vivos en inv_deptos). Fuera de esa rama, la salida
--     es idéntica a la de hoy (0 filas distintas).
-- plpgsql con plan a medida, como la de hoy (regla del 02-nov-2026).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.relleno_publicadores_candidatos(p_limite integer)
returns table(aviso_id uuid, url text, comuna text, lat numeric, lng numeric, prioridad integer)
language plpgsql stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  with inv as (
    select distinct on (s.id) s.id, s.url, s.comuna, s.lat, s.lng, -1 as prio, 0 as orden
    from public.inv_deptos d
    join public.scraped_properties s
      on s.id = (case when d.aviso_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then d.aviso_id::uuid end)
    where d.estado in ('opcion', 'elegido')
      and not exists (select 1 from public.publicacion_detalle pd where pd.aviso_id = s.id and pd.leido_at > now() - interval '7 days')
  ), insc as (
    select s.id, s.url, s.comuna, s.lat, s.lng, 0 as prio, 0 as orden
    from public.invierte_inscripciones i
    join public.scraped_properties s
      on s.id = (case when i.aviso_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then i.aviso_id::uuid end)
    where not exists (select 1 from public.avisos_publicador ap where ap.aviso_id = s.id)
  ), conv as (
    select s.id, s.url, s.comuna, s.lat, s.lng, 1 as prio, -coalesce(e.score_20, 0) as orden
    from public.avisos_evaluados e
    join public.scraped_properties s on s.id = e.aviso_id
    where e.veredicto_20 = 'COMPRAR'
      and not exists (select 1 from public.avisos_publicador ap where ap.aviso_id = s.id)
  ), todos as (select * from inv union all select * from insc union all select * from conv)
  select t.id, t.url, t.comuna, t.lat, t.lng, t.prio
  from todos t
  where t.url is not null
    and not exists (select 1 from public.publicacion_avisos p where p.aviso_id = t.id and p.estado = 'despublicado')
    and not exists (select 1 from public.lecturas_relleno lr where lr.aviso_id = t.id and lr.leido_at > now() - interval '24 hours')
  order by t.prio, t.orden
  limit p_limite;
end
$$;
