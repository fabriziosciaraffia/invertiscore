-- Explorar (23-oct-2026): el mapa de todos los deptos que convienen para una búsqueda, con la evaluación de la noche.
-- Aditiva: dos funciones nuevas, solo para el service role; nada existente cambia.
--
-- 1 · LOS PINES: el MISMO universo que deptos_conteo y semanal_candidatos (activos, de venta, con coordenadas, vistos en
--     la ventana, con arriendo, sin arriendo sospechoso, sin despublicados), SOLO los que dan Comprar con ese pie y ese
--     plazo. A 25 años, las columnas del estándar de /deptos (`*_20_25` / `*_30_25`); a 30, las de la evaluación de la
--     noche (`veredicto_20` / `veredicto_30`). Con el arriendo evaluado (para el cap rate) y lo último que se supo de la
--     ficha. Sin límite acá: una comuna puede pasar de mil (Santiago, 1.829 el 23-oct-2026), así que el lector pagina
--     con `range` (PostgREST corta en 1.000 sin avisar).
create or replace function public.explorar_pines(
  comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp, pie integer, plazo integer
)
returns table(
  id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer,
  precio_uf numeric, veredicto text, score integer, flujo integer, arriendo integer, pub_estado text, pub_at timestamptz
)
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select sp.id, sp.comuna, sp.lat, sp.lng, sp.superficie_m2,
    case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end,
    sp.banos, ae.precio_uf,
    case when plazo = 30 then (case when pie = 30 then ae.veredicto_30 else ae.veredicto_20 end)
         else (case when pie = 30 then ae.veredicto_30_25 else ae.veredicto_20_25 end) end,
    case when plazo = 30 then (case when pie = 30 then ae.score_30 else ae.score_20 end)
         else (case when pie = 30 then ae.score_30_25 else ae.score_20_25 end) end,
    case when plazo = 30 then (case when pie = 30 then ae.flujo_30 else ae.flujo_20 end)
         else (case when pie = 30 then ae.flujo_30_25 else ae.flujo_20_25 end) end,
    nullif(ae.arriendo->>'monto', '')::numeric::integer,
    pa.estado, pa.chequeado_at
  from scraped_properties sp
  join avisos_evaluados ae on ae.aviso_id = sp.id
  left join publicacion_avisos pa on pa.aviso_id = sp.id
  where sp.is_active = true
    and sp.type = 'venta'
    and sp.lat is not null and sp.lng is not null
    and sp.scraped_at >= desde
    and sp.comuna = any(comunas)
    and (sp.dormitorios = any(dorms) or (0 = any(dorms) and public.es_estudio(sp.dormitorios, sp.titulo)))
    and ae.precio_uf between uf_min and uf_max
    and ae.arriendo is not null
    and ae.arriendo_sospechoso is not true
    and (pa.estado is distinct from 'despublicado')
    and (case when plazo = 30 then (case when pie = 30 then ae.veredicto_30 else ae.veredicto_20 end)
              else (case when pie = 30 then ae.veredicto_30_25 else ae.veredicto_20_25 end) end) = 'COMPRAR'
  order by (case when plazo = 30 then (case when pie = 30 then ae.score_30 else ae.score_20 end)
                 else (case when pie = 30 then ae.score_30_25 else ae.score_20_25 end) end) desc nulls last, sp.id;
$$;
revoke execute on function public.explorar_pines(text[], integer[], numeric, numeric, timestamp, integer, integer) from public, anon, authenticated;

-- 2 · CUÁNTOS CONVIENEN: el mismo conteo, para el botón del dashboard («Explorar los 312 en el mapa»).
create or replace function public.explorar_conteo(
  comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp, pie integer, plazo integer
)
returns integer
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select count(*)::int from public.explorar_pines(comunas, dorms, uf_min, uf_max, desde, pie, plazo);
$$;
revoke execute on function public.explorar_conteo(text[], integer[], numeric, numeric, timestamp, integer, integer) from public, anon, authenticated;
