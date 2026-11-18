-- 20261120_invierte_v2_entrega2.sql — Invierte con Franco, comprador · etapa 2, entrega 2. PARA REVISAR Y APLICAR POR FABRIZIO,
-- fuera de la sesión del agente. Nada de esto toca `scraped_properties_precios` ni su disparador: la tabla original queda intacta.
--
-- Cuatro partes:
--   1. LA UF DE CADA DÍA (`uf_diaria`), para convertir a UF cada precio con la UF de su día. Hoy solo existe la UF de hoy
--      (`config.uf_value`). Se siembra del 01-mar-2026 al 09-dic-2026 (la UF se publica hasta el día 9 del mes siguiente) con la
--      serie pública del Banco Central (bajada de mindicador.cl, espejo de la serie F073.UFF.PRE.Z.D). Verificada dos veces el
--      18-nov-2026: el valor de hoy es el de `config.uf_value` (41.357), y al convertir el historial con esta serie, 575.154 de
--      575.969 observaciones de los últimos 30 días dan EXACTAMENTE el mismo precio en UF que la anterior (la fuente convierte
--      con la UF del día chileno). De ahí en adelante la llena update-market cada mañana (código de la entrega 2).
--   2. EL HISTORIAL DE PRECIOS EN UF (`precios_uf`): solo los cambios reales, de TODOS los deptos en venta (usados y nuevos),
--      calculado desde `scraped_properties_precios` y alimentado cada noche por `registrar_precios_uf()`.
--   3. EL CARRIL DE INVIERTE (`lecturas_invierte`): la bitácora y el tope propios de las lecturas de ficha del flujo nuevo.
--      El tope de 30 por hora de las personas (lecturas_ficha) no la ve ni la gasta.
--   4. LOS CAMBIOS DE LA PUBLICACIÓN en los deptos elegidos (`inv_cambios`, dos columnas en `inv_deptos` y dos tipos de tarea).
--
-- EL UMBRAL DEL HISTORIAL: 0,1 % sobre el precio en UF. Medido el 18-nov-2026 sobre los usados en venta, últimos 30 días,
-- comparando cada observación con la anterior, las dos en UF:
--     igual en UF (< 0,005 %) .............. 575.154   ← el «cambio» diario en pesos que era solo la UF
--     entre 0,005 % y 0,1 % ................     325   ← redondeos y un día de desfase de la UF: no es un cambio
--     entre 0,1 % y 0,5 % ..................      20
--     0,5 % o más ..........................     470   (439 deptos; 414 bajas, 56 subidas) — la cuenta en pesos daba 468
--     2 % o más ............................     373
--   Entre 0,1 % y 0,5 % casi no hay nada: el umbral no depende de dónde se ponga dentro de ese tramo. Se guarda desde 0,1 % (la
--   etapa 3 quiere el historial completo); los avisos a la persona usan 0,5 % (línea en la base) y 2 % (correo).
--   Relleno inicial (todo el historial desde el 15-mar-2026): 68.694 precios de partida (58.269 usados, 10.425 nuevos) y 1.498
--   cambios (1.099 usados, 399 nuevos).
--
-- MEDICIÓN DE `registrar_precios_uf()` (regla del 02-nov-2026): ver el bloque al final, con la cifra.

-- ── 1. LA UF DE CADA DÍA ────────────────────────────────────────────────────
create table if not exists public.uf_diaria (
  fecha      date primary key,
  valor      numeric(10,2) not null check (valor > 0),
  fuente     text not null default 'bcch',
  created_at timestamptz not null default now()
);
alter table public.uf_diaria enable row level security;
revoke all on public.uf_diaria from anon, authenticated;

insert into public.uf_diaria (fecha, valor, fuente) values
  ('2026-03-01', 39796.31), ('2026-03-02', 39801.98), ('2026-03-03', 39807.65), ('2026-03-04', 39813.33), ('2026-03-05', 39819.01), ('2026-03-06', 39824.68),
  ('2026-03-07', 39830.36), ('2026-03-08', 39836.04), ('2026-03-09', 39841.72), ('2026-03-10', 39841.72), ('2026-03-11', 39841.72), ('2026-03-12', 39841.72),
  ('2026-03-13', 39841.72), ('2026-03-14', 39841.72), ('2026-03-15', 39841.72), ('2026-03-16', 39841.72), ('2026-03-17', 39841.72), ('2026-03-18', 39841.72),
  ('2026-03-19', 39841.72), ('2026-03-20', 39841.72), ('2026-03-21', 39841.72), ('2026-03-22', 39841.72), ('2026-03-23', 39841.72), ('2026-03-24', 39841.72),
  ('2026-03-25', 39841.72), ('2026-03-26', 39841.72), ('2026-03-27', 39841.72), ('2026-03-28', 39841.72), ('2026-03-29', 39841.72), ('2026-03-30', 39841.72),
  ('2026-03-31', 39841.72), ('2026-04-01', 39841.72), ('2026-04-02', 39841.72), ('2026-04-03', 39841.72), ('2026-04-04', 39841.72), ('2026-04-05', 39841.72),
  ('2026-04-06', 39841.72), ('2026-04-07', 39841.72), ('2026-04-08', 39841.72), ('2026-04-09', 39841.72), ('2026-04-10', 39854.94), ('2026-04-11', 39868.16),
  ('2026-04-12', 39881.38), ('2026-04-13', 39894.61), ('2026-04-14', 39907.85), ('2026-04-15', 39921.09), ('2026-04-16', 39934.33), ('2026-04-17', 39947.58),
  ('2026-04-18', 39960.83), ('2026-04-19', 39974.09), ('2026-04-20', 39987.35), ('2026-04-21', 40000.61), ('2026-04-22', 40013.88), ('2026-04-23', 40027.15),
  ('2026-04-24', 40040.43), ('2026-04-25', 40053.72), ('2026-04-26', 40067.00), ('2026-04-27', 40080.29), ('2026-04-28', 40093.59), ('2026-04-29', 40106.89),
  ('2026-04-30', 40120.20), ('2026-05-01', 40133.50), ('2026-05-02', 40146.82), ('2026-05-03', 40160.14), ('2026-05-04', 40173.46), ('2026-05-05', 40186.79),
  ('2026-05-06', 40200.12), ('2026-05-07', 40213.45), ('2026-05-08', 40226.79), ('2026-05-09', 40240.14), ('2026-05-10', 40256.91), ('2026-05-11', 40273.69),
  ('2026-05-12', 40290.47), ('2026-05-13', 40307.26), ('2026-05-14', 40324.06), ('2026-05-15', 40340.86), ('2026-05-16', 40357.67), ('2026-05-17', 40374.49),
  ('2026-05-18', 40391.32), ('2026-05-19', 40408.15), ('2026-05-20', 40424.99), ('2026-05-21', 40441.84), ('2026-05-22', 40458.69), ('2026-05-23', 40475.55),
  ('2026-05-24', 40492.42), ('2026-05-25', 40509.29), ('2026-05-26', 40526.18), ('2026-05-27', 40543.07), ('2026-05-28', 40559.96), ('2026-05-29', 40576.86),
  ('2026-05-30', 40593.77), ('2026-05-31', 40610.69), ('2026-06-01', 40627.62), ('2026-06-02', 40644.55), ('2026-06-03', 40661.48), ('2026-06-04', 40678.43),
  ('2026-06-05', 40695.38), ('2026-06-06', 40712.34), ('2026-06-07', 40729.31), ('2026-06-08', 40746.28), ('2026-06-09', 40763.26), ('2026-06-10', 40765.97),
  ('2026-06-11', 40768.69), ('2026-06-12', 40771.41), ('2026-06-13', 40774.12), ('2026-06-14', 40776.84), ('2026-06-15', 40779.55), ('2026-06-16', 40782.27),
  ('2026-06-17', 40784.98), ('2026-06-18', 40787.70), ('2026-06-19', 40790.42), ('2026-06-20', 40793.13), ('2026-06-21', 40795.85), ('2026-06-22', 40798.57),
  ('2026-06-23', 40801.29), ('2026-06-24', 40804.00), ('2026-06-25', 40806.72), ('2026-06-26', 40809.44), ('2026-06-27', 40812.16), ('2026-06-28', 40814.87),
  ('2026-06-29', 40817.59), ('2026-06-30', 40820.31), ('2026-07-01', 40823.03), ('2026-07-02', 40825.75), ('2026-07-03', 40828.47), ('2026-07-04', 40831.19),
  ('2026-07-05', 40833.91), ('2026-07-06', 40836.63), ('2026-07-07', 40839.35), ('2026-07-08', 40842.07), ('2026-07-09', 40844.79), ('2026-07-10', 40844.79),
  ('2026-07-11', 40844.79), ('2026-07-12', 40844.79), ('2026-07-13', 40844.79), ('2026-07-14', 40844.79), ('2026-07-15', 40844.79), ('2026-07-16', 40844.79),
  ('2026-07-17', 40844.79), ('2026-07-18', 40844.79), ('2026-07-19', 40844.79), ('2026-07-20', 40844.79), ('2026-07-21', 40844.79), ('2026-07-22', 40844.79),
  ('2026-07-23', 40844.79), ('2026-07-24', 40844.79), ('2026-07-25', 40844.79), ('2026-07-26', 40844.79), ('2026-07-27', 40844.79), ('2026-07-28', 40844.79),
  ('2026-07-29', 40844.79), ('2026-07-30', 40844.79), ('2026-07-31', 40844.79), ('2026-08-01', 40844.79), ('2026-08-02', 40844.79), ('2026-08-03', 40844.79),
  ('2026-08-04', 40844.79), ('2026-08-05', 40844.79), ('2026-08-06', 40844.79), ('2026-08-07', 40844.79), ('2026-08-08', 40844.79), ('2026-08-09', 40844.79),
  ('2026-08-10', 40846.11), ('2026-08-11', 40847.42), ('2026-08-12', 40848.74), ('2026-08-13', 40850.06), ('2026-08-14', 40851.38), ('2026-08-15', 40852.69),
  ('2026-08-16', 40854.01), ('2026-08-17', 40855.33), ('2026-08-18', 40856.64), ('2026-08-19', 40857.96), ('2026-08-20', 40859.28), ('2026-08-21', 40860.60),
  ('2026-08-22', 40861.91), ('2026-08-23', 40863.23), ('2026-08-24', 40864.55), ('2026-08-25', 40865.87), ('2026-08-26', 40867.18), ('2026-08-27', 40868.50),
  ('2026-08-28', 40869.82), ('2026-08-29', 40871.14), ('2026-08-30', 40872.45), ('2026-08-31', 40873.77), ('2026-09-01', 40875.09), ('2026-09-02', 40876.41),
  ('2026-09-03', 40877.73), ('2026-09-04', 40879.04), ('2026-09-05', 40880.36), ('2026-09-06', 40881.68), ('2026-09-07', 40883.00), ('2026-09-08', 40884.32),
  ('2026-09-09', 40885.63), ('2026-09-10', 40893.78), ('2026-09-11', 40901.94), ('2026-09-12', 40910.10), ('2026-09-13', 40918.25), ('2026-09-14', 40926.41),
  ('2026-09-15', 40934.58), ('2026-09-16', 40942.74), ('2026-09-17', 40950.90), ('2026-09-18', 40959.07), ('2026-09-19', 40967.24), ('2026-09-20', 40975.41),
  ('2026-09-21', 40983.58), ('2026-09-22', 40991.75), ('2026-09-23', 40999.93), ('2026-09-24', 41008.10), ('2026-09-25', 41016.28), ('2026-09-26', 41024.46),
  ('2026-09-27', 41032.64), ('2026-09-28', 41040.82), ('2026-09-29', 41049.01), ('2026-09-30', 41057.20), ('2026-10-01', 41065.38), ('2026-10-02', 41073.57),
  ('2026-10-03', 41081.76), ('2026-10-04', 41089.96), ('2026-10-05', 41098.15), ('2026-10-06', 41106.35), ('2026-10-07', 41114.54), ('2026-10-08', 41122.74),
  ('2026-10-09', 41130.94), ('2026-10-10', 41136.24), ('2026-10-11', 41141.53), ('2026-10-12', 41146.83), ('2026-10-13', 41152.13), ('2026-10-14', 41157.43),
  ('2026-10-15', 41162.73), ('2026-10-16', 41168.03), ('2026-10-17', 41173.33), ('2026-10-18', 41178.64), ('2026-10-19', 41183.94), ('2026-10-20', 41189.24),
  ('2026-10-21', 41194.55), ('2026-10-22', 41199.85), ('2026-10-23', 41205.16), ('2026-10-24', 41210.47), ('2026-10-25', 41215.77), ('2026-10-26', 41221.08),
  ('2026-10-27', 41226.39), ('2026-10-28', 41231.70), ('2026-10-29', 41237.01), ('2026-10-30', 41242.32), ('2026-10-31', 41247.63), ('2026-11-01', 41252.94),
  ('2026-11-02', 41258.26), ('2026-11-03', 41263.57), ('2026-11-04', 41268.88), ('2026-11-05', 41274.20), ('2026-11-06', 41279.51), ('2026-11-07', 41284.83),
  ('2026-11-08', 41290.15), ('2026-11-09', 41295.46), ('2026-11-10', 41302.33), ('2026-11-11', 41309.19), ('2026-11-12', 41316.06), ('2026-11-13', 41322.93),
  ('2026-11-14', 41329.80), ('2026-11-15', 41336.67), ('2026-11-16', 41343.55), ('2026-11-17', 41350.42), ('2026-11-18', 41357.30), ('2026-11-19', 41364.17),
  ('2026-11-20', 41371.05), ('2026-11-21', 41377.93), ('2026-11-22', 41384.81), ('2026-11-23', 41391.69), ('2026-11-24', 41398.57), ('2026-11-25', 41405.45),
  ('2026-11-26', 41412.34), ('2026-11-27', 41419.22), ('2026-11-28', 41426.11), ('2026-11-29', 41433.00), ('2026-11-30', 41439.89), ('2026-12-01', 41446.78),
  ('2026-12-02', 41453.67), ('2026-12-03', 41460.56), ('2026-12-04', 41467.45), ('2026-12-05', 41474.35), ('2026-12-06', 41481.24), ('2026-12-07', 41488.14),
  ('2026-12-08', 41495.04), ('2026-12-09', 41501.94)
on conflict (fecha) do nothing;

-- ── 2. EL HISTORIAL DE PRECIOS EN UF ────────────────────────────────────────
-- Una fila por depto la primera vez que se lo vio ('primera') y una por cada cambio real después ('cambio'). `fuente_id` es la
-- fila de scraped_properties_precios de donde salió (única: una corrida repetida no duplica).
create table if not exists public.precios_uf (
  id               bigint generated always as identity primary key,
  property_id      uuid not null references public.scraped_properties(id) on delete cascade,
  fuente_id        bigint not null unique,
  visto_en         timestamptz not null,
  fecha            date not null,                 -- el día chileno de la observación (el de su UF)
  precio_uf        numeric(12,2) not null check (precio_uf > 0),
  precio_uf_antes  numeric(12,2),                 -- null en 'primera'
  delta_pct        numeric(8,3),                  -- (precio_uf / precio_uf_antes − 1) × 100; null en 'primera'
  origen           text not null check (origen in ('primera','cambio'))
);
create index if not exists precios_uf_property on public.precios_uf (property_id, visto_en desc);
create index if not exists precios_uf_fecha on public.precios_uf (fecha) where origen = 'cambio';
alter table public.precios_uf enable row level security;
revoke all on public.precios_uf from anon, authenticated;

-- RELLENO INICIAL: cada observación de los deptos en venta contra la anterior del mismo depto, las dos en UF.
insert into public.precios_uf (property_id, fuente_id, visto_en, fecha, precio_uf, precio_uf_antes, delta_pct, origen)
select property_id, id, visto_en, fecha, round(puf, 2), round(prev, 2),
       case when prev is null then null else round((puf / prev - 1) * 100, 3) end,
       case when prev is null then 'primera' else 'cambio' end
from (
  select o.*, lag(o.puf) over (partition by o.property_id order by o.visto_en, o.id) as prev
  from (
    select h.id, h.property_id, h.visto_en, (h.visto_en at time zone 'America/Santiago')::date as fecha,
           case when h.moneda = 'UF' then h.precio else h.precio / u.valor end as puf
    from public.scraped_properties_precios h
    join public.scraped_properties sp on sp.id = h.property_id and sp.type = 'venta'
    join public.uf_diaria u on u.fecha = (h.visto_en at time zone 'America/Santiago')::date
    where h.precio > 0
  ) o
) d
where prev is null or abs(puf / prev - 1) >= 0.001
on conflict (fuente_id) do nothing;

-- Hasta dónde se procesó: el último id de scraped_properties_precios cuyo día tiene UF.
insert into public.config (key, value, updated_at)
select 'precios_uf_ultimo_id', coalesce(max(h.id), 0)::text, now()
from public.scraped_properties_precios h
where (h.visto_en at time zone 'America/Santiago')::date <= (select max(fecha) from public.uf_diaria)
on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;

-- CADA NOCHE (la llama el cron de la entrega 2 después de la carga): las filas nuevas de scraped_properties_precios, en UF,
-- contra el último precio registrado de cada depto. Las de un día sin UF esperan a la corrida siguiente.
create or replace function public.registrar_precios_uf(p_lote integer default 200000)
returns table (procesadas integer, registradas integer, hasta_id bigint)
language plpgsql
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_variable
declare
  v_desde bigint;
  v_hasta bigint;
  v_max_uf date;
  v_proc integer;
  v_reg integer;
begin
  select coalesce((select c.value::bigint from config c where c.key = 'precios_uf_ultimo_id'), 0) into v_desde;
  select max(u.fecha) into v_max_uf from uf_diaria u;
  select max(l.id) into v_hasta
  from (select h.id, h.visto_en from scraped_properties_precios h where h.id > v_desde order by h.id limit p_lote) l
  where (l.visto_en at time zone 'America/Santiago')::date <= v_max_uf;
  if v_hasta is null then
    return query select 0, 0, v_desde;
    return;
  end if;

  with nuevos as (
    select h.id, h.property_id, h.visto_en, (h.visto_en at time zone 'America/Santiago')::date as fecha,
           case when h.moneda = 'UF' then h.precio else h.precio / u.valor end as puf
    from scraped_properties_precios h
    join scraped_properties sp on sp.id = h.property_id and sp.type = 'venta'
    join uf_diaria u on u.fecha = (h.visto_en at time zone 'America/Santiago')::date
    where h.id > v_desde and h.id <= v_hasta and h.precio > 0
  ),
  ultimos as (
    select distinct on (p.property_id) p.property_id, p.precio_uf
    from precios_uf p
    where p.property_id in (select n.property_id from nuevos n)
    order by p.property_id, p.visto_en desc, p.id desc
  ),
  seq as (
    select n.*, coalesce(lag(n.puf) over (partition by n.property_id order by n.visto_en, n.id), u.precio_uf) as prev
    from nuevos n left join ultimos u on u.property_id = n.property_id
  ),
  ins as (
    insert into precios_uf (property_id, fuente_id, visto_en, fecha, precio_uf, precio_uf_antes, delta_pct, origen)
    select s.property_id, s.id, s.visto_en, s.fecha, round(s.puf, 2), round(s.prev, 2),
           case when s.prev is null then null else round((s.puf / s.prev - 1) * 100, 3) end,
           case when s.prev is null then 'primera' else 'cambio' end
    from seq s
    where s.prev is null or abs(s.puf / s.prev - 1) >= 0.001
    on conflict (fuente_id) do nothing
    returning 1
  )
  select (select count(*) from nuevos)::integer, (select count(*) from ins)::integer into v_proc, v_reg;

  update config set value = v_hasta::text, updated_at = now() where key = 'precios_uf_ultimo_id';
  return query select v_proc, v_reg, v_hasta;
end $$;
revoke all on function public.registrar_precios_uf(integer) from public, anon, authenticated;

-- ── 3. EL CARRIL DE INVIERTE ────────────────────────────────────────────────
-- Cada pedido a la ficha que hace el flujo nuevo (al elegir, al abrir algo no preparado y la relectura de la noche). Su tope
-- (60 pedidos por hora) y su fusible (en config, `invierte_carril_fusible`) son suyos.
create table if not exists public.lecturas_invierte (
  id        bigserial primary key,
  aviso_id  uuid not null,
  user_id   uuid,                                 -- quién la pidió (null en la relectura de la noche)
  origen    text not null check (origen in ('elegir','abrir','noche')),
  codigo    integer,
  motivo    text not null check (motivo in ('redirige','publicado','despublicado','bloqueo','error','tiempo')),
  destino   text,
  leido_at  timestamptz not null default now()
);
create index if not exists lecturas_invierte_leido on public.lecturas_invierte (leido_at desc);
create index if not exists lecturas_invierte_aviso on public.lecturas_invierte (aviso_id, leido_at desc);
alter table public.lecturas_invierte enable row level security;
revoke all on public.lecturas_invierte from anon, authenticated;

-- ── 4. LOS CAMBIOS DE LA PUBLICACIÓN EN LOS DEPTOS ELEGIDOS ────────────────
-- Lo último que la persona sabe de cada depto (precio, publicado, veredicto, al mes), para comparar cada noche; y cuándo se
-- leyó su ficha por última vez (la relectura es como mucho una vez cada 24 horas).
alter table public.inv_deptos add column if not exists vigente jsonb;
alter table public.inv_deptos add column if not exists publicacion_leida_at timestamptz;

-- Un cambio = una fila. La base muestra el último de cada depto; el correo junta los relevantes del día (uno por persona al día).
create table if not exists public.inv_cambios (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  aviso_id    text not null,
  tipo        text not null check (tipo in ('precio_baja','precio_sube','despublicado','republicado','veredicto','al_mes','publicador')),
  antes       jsonb,
  despues     jsonb,
  fecha       date not null,                      -- el día chileno del cambio
  en_base     boolean not null default true,      -- se muestra en la base (quién publica: no, solo tarea)
  relevante   boolean not null default false,     -- va al correo
  correo_at   timestamptz,                        -- cuándo salió en un correo (null = todavía no)
  es_prueba   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists inv_cambios_user on public.inv_cambios (user_id, aviso_id, created_at desc);
create index if not exists inv_cambios_correo on public.inv_cambios (created_at) where relevante and correo_at is null;
-- Un mismo cambio no se anota dos veces el mismo día (la noche se puede reintentar).
create unique index if not exists inv_cambios_uno_por_dia on public.inv_cambios (user_id, aviso_id, tipo, fecha);
alter table public.inv_cambios enable row level security;
revoke all on public.inv_cambios from anon, authenticated;

-- Dos tipos de tarea interna: el cambio de la publicación y el cambio de quién publica (este último no se le avisa a la persona).
alter table public.inv_tareas drop constraint inv_tareas_tipo_check;
alter table public.inv_tareas add constraint inv_tareas_tipo_check
  check (tipo in ('revisar_preaprobacion','contactar_listo','explicar_preaprobacion','gestionar_corredor','avisar_alcance',
                  'cambio_publicacion','cambio_publicador'));

-- ── MEDICIÓN (18-nov-2026, EXPLAIN ANALYZE en producción, solo lectura) ──────
-- La parte cara de registrar_precios_uf() es leer las filas nuevas de la noche y convertirlas a UF: las del último día son
-- 21.944 (casi todas, el «cambio» diario de la UF), y esa lectura con su join a scraped_properties y a la UF tomó ~100 ms
-- (índice de la llave sobre `id > último procesado`, nested loop de 22.865 búsquedas por llave). La otra parte, el último
-- precio registrado de cada depto, va sobre `precios_uf` (~70 mil filas, índice por property_id), no sobre la tabla original
-- de 1,1 millones: medida con la original como sustituto tomó 1,6 s por ordenar 915 mil filas, lo que en precios_uf no pasa.
-- Sin parámetros que cambien el plan (el único es el lote): plpgsql con plan a medida igual, por la regla del 02-nov-2026.
-- Al aplicar, correr una vez `select * from public.registrar_precios_uf();` y mirar el tiempo: debería procesar 0 filas
-- (el relleno ya dejó el punto de partida) en menos de un segundo.

