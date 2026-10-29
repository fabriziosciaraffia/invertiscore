-- LA PUERTA E: EXPLORAR SIN CUENTA (29-oct-2026, goal de Fabrizio; mockup docs/puerta-b-mockups/6-puerta-e.html). La hoja de
-- registro sobre el mapa de /explorar crea la cuenta con el perfil del pin que miraba; la cuenta queda con la puerta E y el
-- detalle de la llegada: «explorar:landing» (la tarjeta nueva de la landing) o «explorar:directo».
--
-- 1 · `user_attribution.puerta` admite la E (la restricción de 20261015_medicion_campana decía A a D).
-- 2 · La RPC `upsert_user_attribution` la guarda como a A, B y C: mismo cuerpo que 20261026_puerta_d_desde_15oct, con la E
--     en `admitida` (la regla de siempre: la primera gana; D cede).
-- 3 · `deptos_pendientes.puerta_detalle`: lo elegido antes del código o de Google lleva el detalle de la puerta E hasta el
--     alta (lib/deptos/alta-servidor.ts), que es donde se fija la atribución.

alter table public.user_attribution drop constraint if exists user_attribution_puerta_check;
alter table public.user_attribution add constraint user_attribution_puerta_check check (puerta is null or puerta in ('A', 'B', 'C', 'D', 'E'));

alter table public.deptos_pendientes add column if not exists puerta_detalle text;

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
      when p_puerta in ('A', 'B', 'C', 'E') then p_puerta
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
    -- La puerta: la primera gana; D (el valor por defecto) cede ante A, B, C o E.
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
