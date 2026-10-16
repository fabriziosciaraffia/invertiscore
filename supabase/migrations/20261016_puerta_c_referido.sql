-- ─────────────────────────────────────────────────────────────────────────────
-- LA PUERTA C, EL REFERIDO (16-oct-2026): una persona invita a alguien y, si entra, los dos reciben un análisis.
--
--   invitaciones · el enlace propio de cada persona, «refranco.ai/i/CÓDIGO». Hasta dos por persona: el de siempre
--                  (el invitado ve «un amigo te invitó a Franco») y, solo si lo pide, uno con su nombre. `dispositivos`
--                  son los hashes de los navegadores donde quien invita abrió su enlace: el «mismo dispositivo».
--   referidos    · una fila por cuenta invitada (su clave es el invitado: una cuenta, una invitación). Nace al
--                  registrarse con la cookie de la invitación —por cualquier puerta— y se decide al contestar el
--                  «cuándo»: pagado (premio_n 1..5: el tope de cinco por persona lo garantiza el índice único),
--                  tope, mismo_dispositivo, o cuenta_previa (ya tenía cuenta: no cuenta).
--   fijar_puerta_referido · la cuenta nueva que entra por una invitación queda con la puerta C y el código, aunque
--                  otra puerta haya llegado antes (el reclamo del banner, /deptos): es la única que pisa.
-- RLS sin políticas: solo el service role las lee y las escribe.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.invitaciones (
  codigo text primary key check (codigo ~ '^[A-HJKMNP-Z2-9]{6}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  con_nombre boolean not null default false,
  nombre text check (nombre is null or char_length(nombre) between 1 and 40),
  dispositivos text[] not null default '{}',
  creada_at timestamptz not null default now(),
  unique (user_id, con_nombre)
);
alter table public.invitaciones enable row level security;

create table if not exists public.referidos (
  invitado_id uuid primary key references auth.users(id) on delete cascade,
  invitador_id uuid not null references auth.users(id) on delete cascade,
  codigo text not null references public.invitaciones(codigo) on delete cascade,
  estado text not null check (estado in ('pendiente', 'pagado', 'tope', 'mismo_dispositivo', 'cuenta_previa')),
  premio_n smallint check (premio_n between 1 and 5),
  grant_id uuid references public.credit_grants(id) on delete set null,
  dispositivo_hash text,
  vinculado_at timestamptz not null default now(),
  decidido_at timestamptz,
  correo_estado text check (correo_estado is null or correo_estado in ('enviado', 'fallo', 'omitido_prueba', 'sin_correo')),
  check ((estado = 'pagado') = (premio_n is not null))
);
create unique index if not exists referidos_premio_unico on public.referidos (invitador_id, premio_n) where premio_n is not null;
create index if not exists referidos_invitador on public.referidos (invitador_id);
alter table public.referidos enable row level security;

create or replace function public.fijar_puerta_referido(p_user_id uuid, p_detalle text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.user_attribution as ua (user_id, puerta, puerta_detalle)
  values (p_user_id, 'C', left(p_detalle, 60))
  on conflict (user_id) do update set puerta = 'C', puerta_detalle = left(p_detalle, 60), updated_at = now();
$$;
revoke execute on function public.fijar_puerta_referido(uuid, text) from public, anon, authenticated;
grant execute on function public.fijar_puerta_referido(uuid, text) to service_role;
