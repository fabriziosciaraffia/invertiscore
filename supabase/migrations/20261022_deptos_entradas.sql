-- ─────────────────────────────────────────────────────────────────────────────
-- LA ENTRADA DE /deptos NO PUEDE QUEDAR GIRANDO (22-oct-2026, QA del recorrido de la puerta B). Una corrida verificó el
-- código en Supabase y el navegador nunca pidió el alta: la respuesta del verify no volvió y nada tenía tope.
--
-- · deptos_pendientes.puerta: la puerta de quien eligió (B en /deptos, C en la página del invitado), para medir.
-- · deptos_entradas: cada entrada verificada por un camino de /deptos —el código (verificado en el servidor,
--   POST /api/deptos/entrar), el enlace del correo o Google (el callback)—, con su alta cuando llega. Sirve para dos
--   cosas: (1) el reintento con el MISMO código, si la respuesta se perdió, repone la sesión sin pedir otro código
--   (codigo_hash, HMAC del servidor; una vez y dentro de la ventana) y devuelve el alta ya hecha (alta) en vez de
--   correrla dos veces; (2) una entrada sin alta pasado un minuto sale a PostHog como `alta_perdida` con la puerta
--   (perdida_avisada_at: una vez).
-- Solo el service role la lee y escribe (RLS sin políticas, como las demás tablas del servidor).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.deptos_pendientes add column if not exists puerta text;

create table if not exists public.deptos_entradas (
  id uuid primary key default gen_random_uuid(),
  correo text not null,
  user_id uuid,
  puerta text,
  metodo text not null check (metodo in ('codigo', 'enlace', 'google')),
  codigo_hash text,
  verificado_at timestamptz not null default now(),
  alta jsonb,
  alta_at timestamptz,
  recuperada_at timestamptz,
  perdida_avisada_at timestamptz
);

alter table public.deptos_entradas enable row level security;

create index if not exists deptos_entradas_correo_idx on public.deptos_entradas (correo, verificado_at desc);
create index if not exists deptos_entradas_sin_alta_idx on public.deptos_entradas (verificado_at)
  where alta_at is null and perdida_avisada_at is null;

comment on table public.deptos_entradas is
  'Entradas verificadas por /deptos (código, enlace, Google) y su alta. Reintento sin pedir otro código y alta_perdida en PostHog. 22-oct-2026.';
