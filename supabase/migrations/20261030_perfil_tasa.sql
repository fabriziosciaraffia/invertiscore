-- ─────────────────────────────────────────────────────────────────────────────
-- LA TASA DEL PERFIL DE BÚSQUEDA (30-oct-2026, goal «la tasa editable en Filtros»; aplicada con el OK de Fabrizio).
-- La tasa que la persona elige en Filtros o en el pop-up de «Analizar este» y guarda con «Guardar como mi perfil de
-- búsqueda». Vacía = «la de hoy»: sigue a la tasa del motor (config.tasa_hipotecaria) cuando se actualiza; elegir «La de
-- hoy» guarda vacío, nunca el número del día. La usan el semanal, la selección diaria y el pop-up. Solo los valores de la
-- lista de Filtros (3,0 % a 6,0 %, de a 0,25): la regla la valida perfil-busqueda.ts; acá, el rango.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.perfil_busqueda add column if not exists tasa_pct numeric;
alter table public.perfil_busqueda drop constraint if exists perfil_busqueda_tasa_pct_rango;
alter table public.perfil_busqueda add constraint perfil_busqueda_tasa_pct_rango check (tasa_pct is null or (tasa_pct >= 3 and tasa_pct <= 6));
comment on column public.perfil_busqueda.tasa_pct is 'Tasa elegida (3,0 a 6,0, de a 0,25). Vacía = la de hoy: la del motor (config.tasa_hipotecaria).';
