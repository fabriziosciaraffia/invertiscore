-- La puerta B y la primera semana (16-oct-2026): /deptos, la cuenta con perfil manual, el correo del día y los regalos.
-- Aditiva: columnas y tablas nuevas, funciones nuevas; nada existente cambia de significado.
--
-- 1 · EL ESTÁNDAR DE /deptos: pie 20 % y 30 %, 25 años, tasa de mercado. La evaluación de cada noche seguía con 30 años
--     (veredicto_20 / veredicto_30, sin tocar); estas columnas son el mismo aviso con 25 años, calculadas por la sonda del
--     motor desde lo que la fila ya resolvió (src/lib/avisos/estandar-deptos.ts): el cron las escribe al evaluar y el
--     relleno de una vez (scripts/rellenar-estandar-25.ts), las que ya estaban. Un Comprar de la sonda es el de
--     runAnalysis (medido el 30-sep-2026 en 450 pares); un Ajustar o un Buscar, el del puntaje, antes del rescate.
alter table public.avisos_evaluados
  add column if not exists veredicto_20_25 text,
  add column if not exists score_20_25 integer,
  add column if not exists flujo_20_25 integer,
  add column if not exists veredicto_30_25 text,
  add column if not exists score_30_25 integer,
  add column if not exists flujo_30_25 integer;

-- 2 · EL PERFIL MANUAL con piso de precio: los chips de /deptos dicen un rango («entre UF 3.000 y 4.000»).
alter table public.perfil_busqueda
  add column if not exists precio_min_uf numeric check (precio_min_uf is null or precio_min_uf > 0);

-- 3 · EL CORREO DEL DÍA vive en semanal_selecciones (mismo token, misma página, mismo clic), con `tipo` = 'del_dia' y
--     `semana` = el día del registro. Los crons del semanal leen solo 'semanal'. `publicados_al`: el chequeo de ficha más
--     antiguo de lo que salió en el correo; `intentos`: las vueltas de la cola.
alter table public.semanal_selecciones
  add column if not exists tipo text not null default 'semanal' check (tipo in ('semanal', 'del_dia')),
  add column if not exists publicados_al timestamptz,
  add column if not exists intentos integer not null default 0;
create index if not exists semanal_selecciones_del_dia_cola on public.semanal_selecciones (armada_at)
  where tipo = 'del_dia' and enviada_at is null;

-- 4 · LO ELEGIDO EN /deptos ANTES DEL CÓDIGO, por correo: la cuenta nace con ese perfil aunque el código se escriba en
--     otro aparato (el enlace del correo). Se borra al usarse; solo el service role la lee.
create table if not exists public.deptos_pendientes (
  correo text primary key,
  perfil jsonb not null,
  existe boolean not null,
  creado_at timestamptz not null default now()
);
alter table public.deptos_pendientes enable row level security;

-- 5 · EL REGALO DE ALTA: una decisión por cuenta (la fila es la marca de «una vez»), con el dispositivo y la IP en
--     hash para los topes (src/lib/regalo-alta.ts). `motivo` dice si se otorgó o qué tope lo frenó.
create table if not exists public.regalos_alta (
  user_id uuid primary key references auth.users(id) on delete cascade,
  decidido_at timestamptz not null default now(),
  dia date not null default ((now() at time zone 'America/Santiago')::date),
  motivo text not null check (motivo in ('otorgado', 'tope_dispositivo', 'tope_ip', 'tope_dia', 'fallo')),
  dispositivo_hash text,
  ip_hash text,
  grant_id uuid,
  vence_at timestamptz
);
create index if not exists regalos_alta_dispositivo on public.regalos_alta (dispositivo_hash, decidido_at) where motivo = 'otorgado';
create index if not exists regalos_alta_ip on public.regalos_alta (ip_hash, dia) where motivo = 'otorgado';
create index if not exists regalos_alta_dia on public.regalos_alta (dia) where motivo = 'otorgado';
alter table public.regalos_alta enable row level security;

-- 6 · ¿ESE CORREO YA TIENE CUENTA? Para no duplicar: «ya tienes cuenta, te mandamos el código para entrar».
create or replace function public.correo_tiene_cuenta(p_correo text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from auth.users u where lower(u.email) = lower(trim(p_correo)));
$$;
revoke all on function public.correo_tiene_cuenta(text) from public, anon, authenticated;
grant execute on function public.correo_tiene_cuenta(text) to service_role;

-- 7 · LA RESPUESTA AL INSTANTE: cuántos avisos hay por comuna en el filtro y cuántos convienen con pie 20 % y 30 % a 25
--     años. El MISMO universo que semanal_candidatos (activos, de venta, con coordenadas, vistos en la ventana, con
--     arriendo, sin arriendo sospechoso, sin despublicados). `sin_estandar`: los que todavía no tienen la evaluación a
--     25 años (la respuesta no los cuenta como convenientes).
create or replace function public.deptos_conteo(
  comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp
)
returns table(comuna text, total integer, comprar_20 integer, comprar_30 integer, sin_estandar integer)
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select sp.comuna, count(*)::int,
    count(*) filter (where ae.veredicto_20_25 = 'COMPRAR')::int,
    count(*) filter (where ae.veredicto_30_25 = 'COMPRAR')::int,
    count(*) filter (where ae.veredicto_20_25 is null)::int
  from scraped_properties sp
  join avisos_evaluados ae on ae.aviso_id = sp.id
  where sp.is_active = true
    and sp.type = 'venta'
    and sp.lat is not null and sp.lng is not null
    and sp.scraped_at >= desde
    and sp.comuna = any(comunas)
    and (sp.dormitorios = any(dorms) or (0 = any(dorms) and public.es_estudio(sp.dormitorios, sp.titulo)))
    and ae.precio_uf between uf_min and uf_max
    and ae.arriendo is not null
    and ae.arriendo_sospechoso is not true
    and not exists (select 1 from publicacion_avisos pd where pd.aviso_id = sp.id and pd.estado = 'despublicado')
  group by sp.comuna;
$$;
revoke execute on function public.deptos_conteo(text[], integer[], numeric, numeric, timestamp) from public, anon, authenticated;

-- 8 · LOS PRIMEROS DEPTOS: los que convienen con ese pie a 25 años, por puntaje, con lo último que se supo de su ficha
--     (estado y hora). Las mismas columnas que semanal_candidatos, más la publicación.
create or replace function public.deptos_candidatos(
  comunas text[], dorms integer[], uf_min numeric, uf_max numeric, desde timestamp, pie integer, max_filas integer
)
returns table(
  id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer,
  condicion text, direccion text, fecha_entrega text, url text, precio_uf numeric, antiguedad_anios integer,
  antiguedad_origen text, arriendo jsonb, venta jsonb, gastos_comunes integer, mediana_comuna jsonb, score_cron integer,
  flujo integer, pub_estado text, pub_at timestamptz
)
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select sp.id, sp.comuna, sp.lat, sp.lng, sp.superficie_m2,
    case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end,
    sp.banos, coalesce(sp.condicion, 'usado'),
    sp.direccion, sp.fecha_entrega, sp.url, ae.precio_uf, ae.antiguedad_anios, ae.antiguedad_origen, ae.arriendo, ae.venta,
    ae.gastos_comunes, ae.mediana_comuna,
    case when pie = 30 then ae.score_30_25 else ae.score_20_25 end,
    case when pie = 30 then ae.flujo_30_25 else ae.flujo_20_25 end,
    pa.estado, pa.chequeado_at
  from scraped_properties sp
  join avisos_evaluados ae on ae.aviso_id = sp.id
  left join publicacion_avisos pa on pa.aviso_id = sp.id
  where sp.is_active = true
    and sp.type = 'venta'
    and sp.lat is not null and sp.lng is not null
    and sp.scraped_at >= desde
    and sp.comuna = any(comunas)
    and (sp.dormitorios = any(dorms) or (0 = any(dorms) and public.es_estudio(sp.dormitorios, sp.titulo)))
    and ae.precio_uf between uf_min and uf_max
    and ae.arriendo is not null
    and ae.arriendo_sospechoso is not true
    and (pa.estado is distinct from 'despublicado')
    and (case when pie = 30 then ae.veredicto_30_25 else ae.veredicto_20_25 end) = 'COMPRAR'
  order by case when pie = 30 then ae.score_30_25 else ae.score_20_25 end desc nulls last, sp.id
  limit max_filas;
$$;
revoke execute on function public.deptos_candidatos(text[], integer[], numeric, numeric, timestamp, integer, integer) from public, anon, authenticated;

-- 9 · EL RELLENO DE UNA VEZ del estándar de 25 años: las filas evaluadas con lo que hace falta para la sonda, de a
--     páginas por id, y la escritura de a lotes. La escritura respeta `evaluado_at`: si el cron reevaluó la fila
--     mientras tanto, ya trae sus propias columnas y el relleno no la pisa.
create or replace function public.estandar25_filas(desde_id uuid, n integer)
returns table(
  id uuid, comuna text, lat numeric, lng numeric, superficie_m2 numeric, dormitorios integer, banos integer,
  condicion text, direccion text, fecha_entrega text, url text, precio_uf numeric, antiguedad_anios integer,
  antiguedad_origen text, arriendo jsonb, venta jsonb, gastos_comunes integer, mediana_comuna jsonb, score_cron integer,
  evaluado_at timestamptz
)
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select sp.id, sp.comuna, sp.lat, sp.lng, sp.superficie_m2,
    case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end,
    sp.banos, coalesce(sp.condicion, 'usado'),
    sp.direccion, sp.fecha_entrega, sp.url, ae.precio_uf, ae.antiguedad_anios, ae.antiguedad_origen, ae.arriendo, ae.venta,
    ae.gastos_comunes, ae.mediana_comuna, ae.score_20, ae.evaluado_at
  from avisos_evaluados ae
  join scraped_properties sp on sp.id = ae.aviso_id
  where ae.aviso_id > desde_id
  order by ae.aviso_id
  limit n;
$$;
revoke execute on function public.estandar25_filas(uuid, integer) from public, anon, authenticated;

create or replace function public.rellenar_estandar25(filas jsonb)
returns integer
language sql
set search_path to 'public', 'pg_temp'
as $$
  with f as (
    select * from jsonb_to_recordset(filas) as x(
      aviso_id uuid, evaluado_at timestamptz,
      veredicto_20_25 text, score_20_25 integer, flujo_20_25 integer,
      veredicto_30_25 text, score_30_25 integer, flujo_30_25 integer
    )
  ), u as (
    update avisos_evaluados ae set
      veredicto_20_25 = f.veredicto_20_25, score_20_25 = f.score_20_25, flujo_20_25 = f.flujo_20_25,
      veredicto_30_25 = f.veredicto_30_25, score_30_25 = f.score_30_25, flujo_30_25 = f.flujo_30_25
    from f
    where ae.aviso_id = f.aviso_id and ae.evaluado_at = f.evaluado_at
    returning 1
  )
  select count(*)::int from u;
$$;
revoke execute on function public.rellenar_estandar25(jsonb) from public, anon, authenticated;
