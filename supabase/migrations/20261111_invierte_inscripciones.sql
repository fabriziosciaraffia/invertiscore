-- «Pronto: Invierte con Franco» (11-nov-2026, goal de Fabrizio). Una inscripción por persona y depto que mide cuántos
-- registrados quieren invertir con Franco antes de construir el servicio. Si repite, se actualiza (única por user_id +
-- aviso_id). Sin depto no hay inscripción: aviso_id es NOT NULL y no vacío.
-- RLS sin políticas: solo el service role la lee y escribe (la ruta /api/invierte y /admin/invierte).
-- Sin funciones con parámetros: no aplica la regla del plan a medida.
-- Rollback: drop table if exists public.invierte_inscripciones;

create table if not exists public.invierte_inscripciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  aviso_id text not null check (length(trim(aviso_id)) > 0),
  analysis_id uuid null,
  origen text not null check (origen in ('explorar', 'informe', 'seleccion')),
  urgencia text not null check (urgencia in ('este_mes', 'uno_a_tres', 'mas_adelante')),
  pie text not null check (pie in ('si', 'parte', 'no')),
  pie_uf integer null,
  precio_uf integer null,
  linea text null,
  veredicto text null,
  score integer null,
  whatsapp text not null,
  campana jsonb null,
  estado text not null default 'nuevo' check (estado in ('nuevo', 'contactado', 'descartado')),
  correo_enviado_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, aviso_id)
);

create index if not exists invierte_inscripciones_created_idx on public.invierte_inscripciones (created_at desc);

alter table public.invierte_inscripciones enable row level security;
revoke all on public.invierte_inscripciones from anon, authenticated;
