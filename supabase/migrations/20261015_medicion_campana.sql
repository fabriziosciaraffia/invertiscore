-- Medición para la campaña (15-oct-2026). Solo agrega; lo que existía sigue funcionando igual.
--
-- 1 · meta_eventos: cada evento que el servidor decide mandar a Meta, una fila por event_id (y por modo prueba).
--     La fila es la marca de «una vez»: el servidor solo manda —y solo le pide al navegador que repita— el evento
--     cuya fila acaba de insertar. Queda el estado (enviado, fallo, omitido por cuenta de prueba, apagado) para
--     poder verificar en producción sin depender de los logs.
-- 2 · meta_contexto: el último navegador conocido de cada cuenta (IP, navegador, fbp, fbc). Lo escriben los
--     requests del navegador; lo leen los webhooks del pago, que no traen cookies, para que la compra llegue a Meta
--     con algo más que el correo.
-- 3 · user_attribution.puerta: por dónde entró la cuenta — A informe, B página de selección, C referido,
--     D orgánico — con su detalle. La RPC la escribe: la primera gana, salvo que D se corrige a A, B o C (D es el
--     valor por defecto del navegador y puede llegar antes que la puerta real).
-- 4 · es_cuenta_de_prueba(user, correo): las cuentas de prueba quedan fuera de Meta también cuando solo se sabe el
--     correo (el Lead se manda antes de que exista la sesión).
-- RLS sin políticas en las tablas nuevas: solo el servidor (service role).

create table if not exists public.meta_eventos (
  id bigserial primary key,
  event_id text not null,
  evento text not null,
  user_id uuid,
  prueba boolean not null default false,
  estado text not null default 'enviando',
  origen text,
  detalle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Por evento: el primer cobro de un plan manda Purchase y Subscribe con el mismo id (`sub-<id>`).
  constraint meta_eventos_evento_event_id_prueba_key unique (evento, event_id, prueba)
);
create index if not exists meta_eventos_created_at_idx on public.meta_eventos (created_at desc);
alter table public.meta_eventos enable row level security;
revoke all on public.meta_eventos from anon, authenticated;

create table if not exists public.meta_contexto (
  user_id uuid primary key,
  ip text,
  ua text,
  fbp text,
  fbc text,
  url text,
  prueba boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.meta_contexto enable row level security;
revoke all on public.meta_contexto from anon, authenticated;

alter table public.user_attribution add column if not exists puerta text;
alter table public.user_attribution add column if not exists puerta_detalle text;
do $$ begin
  alter table public.user_attribution add constraint user_attribution_puerta_check check (puerta is null or puerta in ('A', 'B', 'C', 'D'));
exception when duplicate_object then null; end $$;

-- La RPC con la puerta. Se reemplaza la firma vieja (10 parámetros) por la nueva (12, los dos últimos con default):
-- el código desplegado hoy llama con parámetros nombrados y sigue resolviendo a esta.
drop function if exists public.upsert_user_attribution(uuid, text, text, text, text, text, text, text, text, text);
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
  insert into public.user_attribution as ua (
    user_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    referrer, landing_path, fbp, fbc, puerta, puerta_detalle
  )
  values (
    p_user_id, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content,
    p_utm_term, p_referrer, p_landing_path, p_fbp, p_fbc,
    case when p_puerta in ('A', 'B', 'C', 'D') then p_puerta end,
    case when p_puerta in ('A', 'B', 'C', 'D') then p_puerta_detalle end
  )
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

create or replace function public.es_cuenta_de_prueba(p_user_id uuid default null, p_email text default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.test_accounts t
    where (p_user_id is not null and t.user_id = p_user_id)
       or (p_email is not null and t.user_id in (select u.id from auth.users u where lower(u.email) = lower(trim(p_email))))
  );
$$;
revoke all on function public.es_cuenta_de_prueba(uuid, text) from public, anon, authenticated;
grant execute on function public.es_cuenta_de_prueba(uuid, text) to service_role;
