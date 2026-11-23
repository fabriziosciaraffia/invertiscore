-- ─────────────────────────────────────────────────────────────────────────────
-- LOS AVISOS REPUBLICADOS: EL GEMELO CON OTRO ID (23-nov-2026; criterio aprobado por Fabrizio el 22-nov). PARA QUE LO APLIQUE CLAUDE;
-- no lo aplica el agente. No toca scraped_properties_precios.
--
-- Un aviso nuevo de venta usado es la republicación de uno dado de baja si, en `scraped_properties`:
--   · el viejo está inactivo, a 30 m o menos, con los mismos dormitorios y los mismos baños, y m² ±1;
--   · el viejo se vio por última vez (`scraped_at`) entre 10 días antes y 1 día después de que apareció el nuevo (`created_at`);
--   · el precio en UF de los dos no se separa más de 3 % (para heredar sin errores: dos unidades iguales del mismo edificio a
--     precios distintos no son el mismo aviso).
-- Cada nuevo tiene a lo más un viejo (el más cercano; a igual distancia, el que se vio más tarde) y cada viejo a lo más un nuevo.
-- Con eso, un aviso hereda sus días (desde el primer eslabón de la cadena) y sus rebajas (las de cualquier eslabón, más la
-- republicación misma si volvió más barato).
--
-- `registrar_gemelos(p_desde)` corre al final del pase de la noche (cron invierte-vigilar, junto a registrar_precios_uf) con los
-- avisos que aparecieron los últimos 3 días; el relleno inicial va al final de este archivo.
--
-- MEDICIÓN (23-nov-2026, EXPLAIN (ANALYZE, BUFFERS), datos de producción; regla del 02-nov-2026):
--   · UNA NOCHE (los últimos 3 días, 438 nuevos): la función, 177,6 ms y 39.186 páginas; la consulta suelta, 178,4 ms y 37.937
--     páginas. Salida IDÉNTICA: la función como pg_temp.gemelos_prueba contra la consulta, 298 pares cada una, 0 diferencias en
--     los dos sentidos (EXCEPT). El vecino se busca con idx_scraped_location (30 m).
--   · EL RELLENO desde el 1-mar: 9,0 s y 2,66 millones de páginas, 8.787 pares. Va en tres tramos (al final) para que ninguno
--     se acerque a un corte por tiempo.
--   · plpgsql con plan_cache_mode = force_custom_plan: el rango de fechas de `p_desde` decide cuántos nuevos entran.
--   · `cadena_gemelos` queda en `language sql` con su plan genérico: solo busca por llave (avisos_gemelos.nuevo_id y
--     scraped_properties.id), hasta 10 eslabones; no recorre tablas grandes.
--   · Impacto (los 4.811 Comprar usados activos): 786 tienen gemelo, 767 cambian sus días (mediana +39 días), 122 ganan una rebaja
--     que solo estaba en el aviso anterior, 385 tienen cadena de 2 o más eslabones.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.avisos_gemelos (
  nuevo_id           uuid primary key references public.scraped_properties(id) on delete cascade,
  viejo_id           uuid not null unique references public.scraped_properties(id) on delete cascade,
  distancia_m        numeric(8,1) not null,
  precio_nuevo_uf    numeric(12,2) not null,
  precio_viejo_uf    numeric(12,2) not null,
  delta_pct          numeric(8,3) not null,      -- (nuevo / viejo − 1) × 100: negativo = volvió más barato
  nuevo_visto_desde  timestamp not null,         -- created_at del nuevo
  viejo_visto_hasta  timestamp not null,         -- scraped_at del viejo
  creado_at          timestamptz not null default now(),
  constraint avisos_gemelos_distintos check (nuevo_id <> viejo_id)
);
create index if not exists avisos_gemelos_viejo on public.avisos_gemelos (viejo_id);
alter table public.avisos_gemelos enable row level security;
revoke all on public.avisos_gemelos from anon, authenticated;

-- Registra los gemelos de los avisos aparecidos desde `p_desde` (y antes de `p_hasta`, si viene). Idempotente. Devuelve cuántos agregó.
create or replace function public.registrar_gemelos(p_desde timestamp default (now() at time zone 'utc') - interval '3 days', p_hasta timestamp default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
declare v_n integer; v_uf numeric;
begin
  select value::numeric into v_uf from config where key = 'uf_value';
  if v_uf is null or v_uf <= 0 then return 0; end if;
  with nuevos as (
    select sp.id, sp.location, sp.dormitorios, sp.banos, sp.superficie_m2, sp.created_at,
      case when sp.moneda = 'UF' then sp.precio else sp.precio / v_uf end as precio_uf
    from scraped_properties sp
    where sp.type = 'venta' and coalesce(sp.condicion, 'usado') = 'usado' and sp.created_at >= p_desde and (p_hasta is null or sp.created_at < p_hasta)
      and sp.location is not null and sp.dormitorios is not null and sp.superficie_m2 is not null and sp.precio > 0
      and not exists (select 1 from avisos_gemelos g where g.nuevo_id = sp.id)
  ),
  pares as (
    select n.id as nuevo_id, c.id as viejo_id, c.distancia_m, n.precio_uf as precio_nuevo_uf, c.precio_uf as precio_viejo_uf,
      n.created_at as nuevo_visto_desde, c.scraped_at as viejo_visto_hasta
    from nuevos n
    join lateral (
      select v.id, v.scraped_at, st_distance(v.location::geography, n.location::geography) as distancia_m,
        case when v.moneda = 'UF' then v.precio else v.precio / v_uf end as precio_uf
      from scraped_properties v
      where v.type = 'venta' and v.is_active = false and coalesce(v.condicion, 'usado') = 'usado' and v.location is not null and v.id <> n.id
        and st_dwithin(v.location::geography, n.location::geography, 30)
        and v.dormitorios = n.dormitorios and abs(v.superficie_m2 - n.superficie_m2) <= 1
        and v.banos is not distinct from n.banos
        and v.scraped_at between n.created_at - interval '10 days' and n.created_at + interval '1 day'
        and v.precio > 0 and abs((case when v.moneda = 'UF' then v.precio else v.precio / v_uf end) / n.precio_uf - 1) <= 0.03
        and not exists (select 1 from avisos_gemelos g where g.viejo_id = v.id)
      order by st_distance(v.location::geography, n.location::geography), v.scraped_at desc
      limit 1
    ) c on true
  ),
  -- Un viejo, un nuevo: si dos nuevos apuntan al mismo viejo, gana el más cercano (y, a igual distancia, el que apareció primero).
  unicos as (
    select distinct on (viejo_id) * from pares order by viejo_id, distancia_m, nuevo_visto_desde
  )
  insert into avisos_gemelos (nuevo_id, viejo_id, distancia_m, precio_nuevo_uf, precio_viejo_uf, delta_pct, nuevo_visto_desde, viejo_visto_hasta)
  select nuevo_id, viejo_id, round(distancia_m::numeric, 1), round(precio_nuevo_uf, 2), round(precio_viejo_uf, 2),
    round((precio_nuevo_uf / precio_viejo_uf - 1) * 100, 3), nuevo_visto_desde, viejo_visto_hasta
  from unicos
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.registrar_gemelos(timestamp, timestamp) from public, anon, authenticated;
grant execute on function public.registrar_gemelos(timestamp, timestamp) to service_role;

-- La cadena de un aviso: él mismo (nivel 0) y sus eslabones anteriores, hasta 10. Para heredar días y rebajas.
create or replace function public.cadena_gemelos(p_aviso uuid)
returns table (aviso_id uuid, nivel integer, visto_desde timestamp)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with recursive c as (
    select p_aviso as aviso_id, 0 as nivel
    union all
    select g.viejo_id, c.nivel + 1 from c join avisos_gemelos g on g.nuevo_id = c.aviso_id where c.nivel < 10
  )
  select c.aviso_id, c.nivel, sp.created_at from c join scraped_properties sp on sp.id = c.aviso_id order by c.nivel;
$$;
revoke all on function public.cadena_gemelos(uuid) from public, anon, authenticated;
grant execute on function public.cadena_gemelos(uuid) to service_role;

-- EL RELLENO INICIAL (una vez, al aplicar): todo lo aparecido desde el 1 de marzo de 2026, el comienzo del listado, de lo más viejo
-- a lo más nuevo, en tres tramos que no se pisan. Cada select devuelve cuántos agregó.
select public.registrar_gemelos('2026-03-01'::timestamp, '2026-06-01'::timestamp);
select public.registrar_gemelos('2026-06-01'::timestamp, '2026-09-01'::timestamp);
select public.registrar_gemelos('2026-09-01'::timestamp, null);
