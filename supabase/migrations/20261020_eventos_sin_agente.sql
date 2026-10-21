-- ─────────────────────────────────────────────────────────────────────────────
-- NINGÚN EVENTO DEL SERVIDOR SALE SIN EL AGENTE DE LA PERSONA (20-oct-2026, src/lib/agentes-navegador.ts). Los de una
-- persona cuyo navegador Franco todavía no vio esperan acá, con su hora (va dentro de `evento`), y salen cuando lo ve:
-- cuando un evento sale de un pedido de su navegador o cuando navega con sesión por la app (el middleware).
--   distinct_id · el id de PostHog de la persona (la cuenta o `correo:<hash>`).
--   evento      · el evento entero ({ event, distinctId, properties, uuid, timestamp }).
-- RLS sin políticas: solo el service role.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.eventos_sin_agente (
  id bigint generated always as identity primary key,
  distinct_id text not null check (char_length(distinct_id) between 1 and 200),
  evento jsonb not null,
  creado_at timestamptz not null default now()
);
create index if not exists eventos_sin_agente_distinct_id on public.eventos_sin_agente (distinct_id);
alter table public.eventos_sin_agente enable row level security;

-- El correo de cada cuenta es la misma persona: su id `correo:<hash>` (el de los correos que salen antes de tener cuenta,
-- `distinctIdDeCorreo`) queda con el agente de la cuenta.
insert into public.agentes_navegador (distinct_id, agente, actualizado_at)
select 'correo:' || left(encode(extensions.digest(lower(trim(u.email)), 'sha256'), 'hex'), 24), a.agente, a.actualizado_at
from auth.users u
join public.agentes_navegador a on a.distinct_id = u.id::text
where u.email is not null
on conflict (distinct_id) do nothing;
