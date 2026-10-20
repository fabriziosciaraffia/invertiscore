-- ─────────────────────────────────────────────────────────────────────────────
-- EL ÚLTIMO NAVEGADOR DE CADA PERSONA (20-oct-2026, src/lib/posthog-servidor.ts). PostHog marca como robot todo evento
-- sin agente, y los eventos que el servidor manda sin un navegador delante —el webhook de Flow, el de Resend, los
-- crons— no tienen de dónde sacarlo. Acá queda el último agente de navegador que Franco le vio a cada persona (la
-- cuenta, o el correo de quien todavía no tiene una), y esos eventos lo usan.
--   distinct_id · el id de PostHog: el uuid de la cuenta o `correo:<hash>` (nunca `visita:…`).
--   agente      · el `User-Agent` del navegador, «Mozilla/…» (hasta 512 caracteres).
-- La escribe y la lee solo el servidor, al mandar un evento. RLS sin políticas: solo el service role.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.agentes_navegador (
  distinct_id text primary key check (char_length(distinct_id) between 1 and 200),
  agente text not null check (agente like 'Mozilla/%' and char_length(agente) <= 512),
  actualizado_at timestamptz not null default now()
);
alter table public.agentes_navegador enable row level security;

-- Las cuentas que ya entraron desde un navegador: el agente de su sesión más reciente creada en el navegador (las
-- sesiones creadas en el servidor dicen «node» o «Vercel Edge Functions» y no sirven).
insert into public.agentes_navegador (distinct_id, agente, actualizado_at)
select distinct on (user_id) user_id::text, left(user_agent, 512), coalesce(updated_at, created_at)
from auth.sessions
where user_agent like 'Mozilla/%' and user_agent not ilike '%headless%'
order by user_id, coalesce(updated_at, created_at) desc
on conflict (distinct_id) do nothing;
