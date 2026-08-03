-- ═══════════════════════════════════════════════════════════════════════════
-- user_attribution — de dónde vino cada usuario
--
-- CORRER A MANO en el SQL editor de Supabase. NO es una migración: el repo no
-- versiona el esquema (mismo criterio que admin_list_users, admin_metrics y
-- test_accounts, que ya viven en la base sin migración).
--
-- Modelo FIRST-TOUCH: la primera atribución que llega gana y nunca se pisa. Lo
-- garantiza la RPC de más abajo, no la aplicación — así da igual quién escriba
-- primero ni cuántas veces se reintente.
--
-- Por qué tabla propia y no columnas en user_credits: user_credits tiene 72
-- filas para 87 usuarios y esas filas se crean TARDE, desde tres lugares
-- distintos (check-welcome, complete-onboarding, subscriptions/create). Colgar
-- la atribución de una fila que puede no existir en el momento del registro es
-- garantizar huecos justo en el dato que se quiere medir.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.user_attribution (
  user_id       uuid primary key references auth.users(id) on delete cascade,

  -- Los 5 UTM estándar. Todos nullable: el tráfico directo y el orgánico no
  -- traen ninguno, y esa ausencia ES el dato (no se rellena con 'direct' para
  -- no inventar una fuente que nadie declaró).
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,

  -- Contexto de la primera visita.
  referrer      text,  -- document.referrer de la landing
  landing_path  text,  -- path de entrada, sin query (la query ya está en los utm_*)

  -- Cookies del Meta Pixel. _fbc es el fbclid ya cocinado por el pixel, así que
  -- no hace falta capturar fbclid aparte.
  fbp           text,
  fbc           text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.user_attribution is
  'Origen de tráfico del usuario, first-touch. Escribir SOLO vía upsert_user_attribution().';

-- Para "¿cuántos usuarios trajo cada campaña?" sin escanear la tabla entera.
create index if not exists idx_user_attribution_source
  on public.user_attribution (utm_source, utm_campaign);

-- RLS prendido y SIN policies: nadie llega por PostgREST directo. El único
-- camino de escritura es la RPC de abajo (security definer), y la lectura la
-- hace el panel con service_role, que bypassea RLS.
alter table public.user_attribution enable row level security;


-- ───────────────────────────────────────────────────────────────────────────
-- upsert_user_attribution — el ÚNICO escritor
--
-- Idempotente y first-touch por construcción:
--   · si no hay fila, la crea;
--   · si ya hay, SOLO rellena las columnas que están en NULL.
--
-- El coalesce es la pieza clave. Hay dos escritores legítimos y ninguno tiene
-- todos los datos:
--   1. /auth/callback (server) tiene fbp/fbc de las cookies, pero NO los UTM:
--      viven en localStorage del navegador y no viajan en el request.
--   2. POST /api/attribution (cliente, ya logueado) tiene los UTM y el referrer,
--      pero llega después.
-- Con `coalesce(existente, nuevo)` el que llega primero fija cada campo y el
-- segundo completa los huecos sin pisar nada. Un DO NOTHING pelado haría que el
-- callback (que llega primero y sin UTM) bloqueara para siempre la escritura de
-- los UTM.
--
-- Rellenar un NULL no contradice first-touch: no reemplaza una atribución
-- previa, completa la única que hay.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.upsert_user_attribution(
  p_user_id      uuid,
  p_utm_source   text default null,
  p_utm_medium   text default null,
  p_utm_campaign text default null,
  p_utm_content  text default null,
  p_utm_term     text default null,
  p_referrer     text default null,
  p_landing_path text default null,
  p_fbp          text default null,
  p_fbc          text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_attribution as ua (
    user_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    referrer, landing_path, fbp, fbc
  )
  values (
    p_user_id, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content,
    p_utm_term, p_referrer, p_landing_path, p_fbp, p_fbc
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
    updated_at   = now()
  -- Sin cambios reales → no se toca la fila (evita updated_at ruidoso y
  -- escrituras inútiles cada vez que el cliente reintenta).
  where ua.utm_source   is null or ua.utm_medium  is null
     or ua.utm_campaign is null or ua.utm_content is null
     or ua.utm_term     is null or ua.referrer    is null
     or ua.landing_path is null or ua.fbp         is null
     or ua.fbc          is null;
$$;

-- Grant SOLO a service_role: el cliente nunca la llama directo. El endpoint
-- /api/attribution valida la sesión server-side y recién ahí la invoca, así que
-- nadie puede escribir atribución de otro usuario pasando un user_id ajeno.
revoke all on function public.upsert_user_attribution(uuid, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.upsert_user_attribution(uuid, text, text, text, text, text, text, text, text, text) from anon;
revoke all on function public.upsert_user_attribution(uuid, text, text, text, text, text, text, text, text, text) from authenticated;
grant execute on function public.upsert_user_attribution(uuid, text, text, text, text, text, text, text, text, text) to service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- Comprobación después de correrlo
-- ───────────────────────────────────────────────────────────────────────────
-- select count(*) from public.user_attribution;                       -- 0 al inicio
--
-- Usuarios con y sin atribución (los 87 de hoy quedan sin fila a propósito:
-- su origen no es reconstruible y no se inventa):
-- select count(*) filter (where a.user_id is not null) as con_origen,
--        count(*) filter (where a.user_id is null)     as sin_origen
--   from auth.users u
--   left join public.user_attribution a on a.user_id = u.id;
--
-- Usuarios por campaña, una vez que empiece a llenarse:
-- select coalesce(utm_source, '(directo)') as fuente,
--        coalesce(utm_campaign, '—')       as campana,
--        count(*)                          as usuarios
--   from public.user_attribution
--  group by 1, 2
--  order by usuarios desc;
