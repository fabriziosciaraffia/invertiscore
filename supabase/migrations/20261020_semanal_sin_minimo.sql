-- El semanal sin correos vacíos cuando hay algo que mandar (20-oct-2026, decisión de Fabrizio). Aditiva.
--
-- 1 · EL RELLENO: con menos de tres confirmados, los Comprar que la evaluación de anoche vio publicados en los resultados
--     del portal pero cuya ficha no se alcanzó a leer, en el orden de la regla (semanal.ts › elegirSemanal). El envío los
--     suma al final del correo, marcados «Visto anoche, sin confirmar», si al mandar siguen faltando confirmados.
alter table public.semanal_selecciones
  add column if not exists relleno jsonb not null default '[]'::jsonb;
comment on column public.semanal_selecciones.relleno is 'Comprar de anoche sin ficha leída, en orden, para completar hasta tres al mandar (20-oct-2026). Marcados «Visto anoche, sin confirmar».';

-- 2 · LOS CANDIDATOS SE ORDENAN CON EL PLAZO DE LA PERSONA, no fijo a 30 años: con plazo de hasta 27 años, por la
--     evaluación a 25 años (score_20_25 / score_30_25, la sonda de /deptos); con más, por la de 30 (score_20 / score_30).
--     `plazo` con valor por defecto: el código de antes del cambio llama sin él y sigue andando. La firma vieja se va.
drop function if exists public.semanal_candidatos(text[], integer[], numeric, numeric, timestamp, integer);

create or replace function public.semanal_candidatos(
  comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp, max_filas integer, plazo integer default 30
)
returns table(
  id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer,
  condicion text, direccion text, fecha_entrega text, url text, precio_uf numeric, antiguedad_anios integer,
  antiguedad_origen text, arriendo jsonb, venta jsonb, gastos_comunes integer, mediana_comuna jsonb, score_cron integer
)
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select sp.id, sp.comuna, sp.lat, sp.lng, sp.superficie_m2,
    case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end,
    sp.banos, coalesce(sp.condicion, 'usado'),
    sp.direccion, sp.fecha_entrega, sp.url, ae.precio_uf, ae.antiguedad_anios, ae.antiguedad_origen, ae.arriendo, ae.venta,
    ae.gastos_comunes, ae.mediana_comuna,
    case when plazo <= 27
      then greatest(coalesce(ae.score_20_25, 0), coalesce(ae.score_30_25, 0))
      else greatest(coalesce(ae.score_20, 0), coalesce(ae.score_30, 0)) end
  from scraped_properties sp
  join avisos_evaluados ae on ae.aviso_id = sp.id
  where sp.is_active = true
    and sp.type = 'venta'
    and sp.lat is not null and sp.lng is not null
    and sp.scraped_at >= desde
    and sp.comuna = any(comunas)
    and (sp.dormitorios = any(dorms) or (0 = any(dorms) and public.es_estudio(sp.dormitorios, sp.titulo)))
    and ae.precio_uf between uf_min and uf_max
    and ae.arriendo is not null
    and ae.arriendo_sospechoso is not true
    and not exists (select 1 from publicacion_avisos pd where pd.aviso_id = sp.id and pd.estado = 'despublicado')
  order by case when plazo <= 27
      then greatest(coalesce(ae.score_20_25, 0), coalesce(ae.score_30_25, 0))
      else greatest(coalesce(ae.score_20, 0), coalesce(ae.score_30, 0)) end desc, sp.id
  limit max_filas;
$$;
revoke execute on function public.semanal_candidatos(text[], integer[], numeric, numeric, timestamp, integer, integer) from public, anon, authenticated;
