-- LA PUERTA D, SOLO DESDE EL 15-OCT (26-oct-2026, decisión de Fabrizio). «D · orgánico» es el valor por defecto que manda
-- el navegador cuando no sabe nada; una cuenta creada antes del 15-oct-2026 (cuando empezaron a medirse las puertas) lo
-- mandaba al volver a la app y quedaba como orgánica de la semana en que volvió: 23 cuentas reales y 3 internas al 26-oct.
-- Esas quedan sin puerta, que se lee «antes de las puertas» (src/lib/atribucion-puerta.ts › etiquetaPuerta).
--
-- 1 · La RPC no guarda una D para una cuenta de antes del 15-oct-2026 a medianoche de Chile (03:00 UTC: INICIO_PUERTAS).
--     A, B y C sí, a cualquier cuenta. Mismo cuerpo que 20261015_medicion_campana, con la puerta pasada por `admitida`.
-- 2 · Las D ya guardadas de cuentas de antes del 15-oct vuelven a NULL (con su detalle).

create or replace function public.upsert_user_attribution(
  p_user_id uuid,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_utm_content text default null,
  p_utm_term text default null,
  p_referrer text default null,
  p_landing_path text default null,
  p_fbp text default null,
  p_fbc text default null,
  p_puerta text default null,
  p_puerta_detalle text default null
) returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  with admitida as (
    select case
      when p_puerta in ('A', 'B', 'C') then p_puerta
      when p_puerta = 'D' and coalesce((select u.created_at from auth.users u where u.id = p_user_id) >= timestamptz '2026-10-15 03:00:00+00', true) then 'D'
    end as puerta
  )
  insert into public.user_attribution as ua (
    user_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    referrer, landing_path, fbp, fbc, puerta, puerta_detalle
  )
  select
    p_user_id, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content,
    p_utm_term, p_referrer, p_landing_path, p_fbp, p_fbc,
    admitida.puerta,
    case when admitida.puerta is not null then p_puerta_detalle end
  from admitida
  on conflict (user_id) do update set
    utm_source   = coalesce(ua.utm_source,   excluded.utm_source),
    utm_medium   = coalesce(ua.utm_medium,   excluded.utm_medium),
    utm_campaign = coalesce(ua.utm_campaign, excluded.utm_campaign),
    utm_content  = coalesce(ua.utm_content,  excluded.utm_content),
    utm_term     = coalesce(ua.utm_term,     excluded.utm_term),
    referrer     = coalesce(ua.referrer,     excluded.referrer),
    landing_path = coalesce(ua.landing_path, excluded.landing_path),
    fbp          = coalesce(ua.fbp,          excluded.fbp),
    fbc          = coalesce(ua.fbc,          excluded.fbc),
    -- La puerta: la primera gana; D (el valor por defecto) cede ante A, B o C.
    puerta_detalle = case
      when excluded.puerta is not null and (ua.puerta is null or (ua.puerta = 'D' and excluded.puerta <> 'D')) then excluded.puerta_detalle
      else ua.puerta_detalle end,
    puerta = case
      when excluded.puerta is not null and (ua.puerta is null or (ua.puerta = 'D' and excluded.puerta <> 'D')) then excluded.puerta
      else ua.puerta end,
    updated_at   = now()
  where ua.utm_source   is null or ua.utm_medium  is null
     or ua.utm_campaign is null or ua.utm_content is null
     or ua.utm_term     is null or ua.referrer    is null
     or ua.landing_path is null or ua.fbp         is null
     or ua.fbc          is null
     or (excluded.puerta is not null and (ua.puerta is null or (ua.puerta = 'D' and excluded.puerta <> 'D')));
$$;
revoke all on function public.upsert_user_attribution(uuid, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.upsert_user_attribution(uuid, text, text, text, text, text, text, text, text, text, text, text) to service_role;

update public.user_attribution ua
set puerta = null, puerta_detalle = null, updated_at = now()
from auth.users u
where u.id = ua.user_id
  and ua.puerta = 'D'
  and u.created_at < timestamptz '2026-10-15 03:00:00+00';
