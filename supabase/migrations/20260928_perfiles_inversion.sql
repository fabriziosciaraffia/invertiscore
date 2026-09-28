-- «Lo que sigue» (28-sep-2026): el perfil de inversión de cada análisis —presupuesto, pie, comuna,
-- modalidad, tipología y veredicto— guardado al crear el análisis y ligado a la persona cuando se
-- registra (el claim del análisis anónimo pone user_id). Es la base del producto de oportunidades:
-- a quién avisar, de qué comuna, con qué presupuesto. Solo escribe el servidor (service role);
-- cada persona lee los suyos.
create table if not exists public.perfiles_inversion (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analisis(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  anon_claim_token_hash text null,
  presupuesto_uf numeric null,
  pie_pct numeric null,
  comuna text null,
  modalidad text not null check (modalidad in ('ltr', 'str')),
  tipologia text null,
  veredicto text null,
  created_at timestamptz not null default now(),
  linked_at timestamptz null
);

create unique index if not exists perfiles_inversion_analysis_id_idx on public.perfiles_inversion (analysis_id);
create index if not exists perfiles_inversion_user_id_idx on public.perfiles_inversion (user_id);
create index if not exists perfiles_inversion_anon_hash_idx on public.perfiles_inversion (anon_claim_token_hash)
  where anon_claim_token_hash is not null;

alter table public.perfiles_inversion enable row level security;

drop policy if exists "perfiles_inversion_lee_los_suyos" on public.perfiles_inversion;
create policy "perfiles_inversion_lee_los_suyos" on public.perfiles_inversion
  for select using (auth.uid() = user_id);
