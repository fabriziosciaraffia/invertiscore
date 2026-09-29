-- Avisos evaluados con el motor (30-sep-2026).
--
-- 1 · La fecha de entrega de la obra nueva, cruda como la da la fuente por proyecto («Inmediata»,
--     «2° Semestre 2026»…). La escribe scrape-unidades-nuevas en cada unidad; la lee
--     src/lib/avisos/fecha-entrega.ts. ANTES del deploy del scraper: propertyToRow ya la manda.
alter table public.scraped_properties
  add column if not exists fecha_entrega text null;

-- 2 · La evaluación de cada aviso de venta con el perfil estándar (pie 20% y 30%, 30 años, tasa de
--     mercado), con las sugerencias de arriendo y venta que la produjeron (fuente y muestra). La escribe
--     solo el cron /api/cron/evaluar-avisos (service role); nadie más la lee por ahora.
create table if not exists public.avisos_evaluados (
  aviso_id uuid primary key references public.scraped_properties(id) on delete cascade,
  evaluado_at timestamptz not null default now(),
  precio_uf numeric not null,
  comuna text not null,
  condicion text not null check (condicion in ('usado', 'nuevo')),
  antiguedad_anios integer not null,
  antiguedad_origen text not null check (antiguedad_origen in ('ficha', 'supuesta', 'nuevo')),
  entrega jsonb null,
  arriendo jsonb null,
  venta jsonb not null,
  gastos_comunes integer null,
  contribuciones integer null,
  veredicto_20 text null,
  score_20 integer null,
  flujo_20 integer null,
  veredicto_30 text null,
  score_30 integer null,
  flujo_30 integer null,
  motor_version text not null
);

create index if not exists avisos_evaluados_comuna_veredicto on public.avisos_evaluados (comuna, veredicto_20);

-- Sin políticas: solo el service role (el cron) lee y escribe.
alter table public.avisos_evaluados enable row level security;
