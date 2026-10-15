-- El estado de cada cron entre corridas (15-oct-2026): cuántas corridas fallaron seguidas, la última buena, si la
-- corrida está abierta y qué se avisó ya en el episodio vigente. Lo usan las reglas de las alertas
-- (src/lib/cron-alertas.ts): avisar solo cuando hace falta una persona, una vez por episodio.
-- Solo agrega. RLS sin políticas: solo el servidor (service role) lee y escribe.

create table if not exists public.cron_estado (
  nombre text primary key,
  estado jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.cron_estado enable row level security;
revoke all on public.cron_estado from anon, authenticated;

-- Arranque: la última corrida buena de cada cron, de su historial (la fila del día que cerró en verde).
insert into public.cron_estado (nombre, estado)
select metrica,
       jsonb_build_object(
         'ultimaBuena', to_char(max(medido_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
         'fallasSeguidas', 0, 'abiertaAt', null, 'causa', null, 'alertas', '[]'::jsonb)
from public.metrics_daily
where fuente = 'cron-resultado' and valor = 0
group by metrica
on conflict (nombre) do nothing;

-- Meta Ads: el token vencido ya avisó el 11-oct-2026; con la regla nueva no se repite mientras sea la misma causa.
update public.cron_estado
set estado = jsonb_set(estado, '{alertas}', '["accion:meta-token"]'::jsonb), updated_at = now()
where nombre = 'meta-ads';
