-- ─────────────────────────────────────────────────────────────────────────────
-- LA ASESORÍA EN EL MAPA · ENTREGA 1 (27-nov-2026). PARA QUE LO APLIQUE CLAUDE A PEDIDO DE FABRIZIO; no lo aplica el agente.
--
-- 1 · inv_perfiles pasa a ser EL perfil declarado: se puede crear sin orden (preaprobado 'no' y comunas vacías por defecto) y
--     suma lo que pregunta la asesoría. «No sé» en el objetivo se guarda como 'ambas' (el check no cambia: Invierte lo lee) y el
--     tipo de perfil queda 'equilibrado'.
-- 2 · El interruptor: config.asesoria_modo = 'apagada' | 'lista' | 'todos'. Ausente o raro = apagada.
-- 3 · La lista para probar sin cuenta: dispositivos (hash de la cookie franco_disp) que se habilitan desde /admin.
-- 4 · El tope de consultas del filtro por aporte: una fila por consulta, contada sobre la última hora por sesión y por IP (hash).
-- 5 · asesoria_candidatos: los COMPRAR usados del mapa (mismo universo que explorar_mapa_todos, pie 20 %, 30 años) que piden al
--     mes como mucho p_aporte, en p_comunas y bajo p_tope. Al anónimo la ruta le devuelve solo los id (nunca cifras); con cuenta,
--     el servidor la usa para elegir los 3 deptos.
--
-- MEDIDO el 27-nov-2026, consulta (la función todavía no existe; se mide función contra consulta al aplicarla y la cifra se
-- agrega acá): todas las comunas, 7 días, aporte 100.000, tope UF 3.000 → 3.657 filas, 47 ms, 29.821 páginas en caché.
-- plpgsql con plan a medida (regla del 02-nov-2026).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1 · El perfil declarado
alter table public.inv_perfiles
  alter column preaprobado set default 'no',
  alter column comunas set default '{}'::text[],
  add column if not exists origen text not null default 'invierte'
    constraint inv_perfiles_origen_check check (origen in ('invierte', 'asesoria')),
  add column if not exists experiencia text
    constraint inv_perfiles_experiencia_check check (experiencia is null or experiencia in ('primera', 'uno', 'varios')),
  add column if not exists tipo_perfil text
    constraint inv_perfiles_tipo_perfil_check check (tipo_perfil is null or tipo_perfil in ('primer_paso', 'rentista', 'patrimonial', 'equilibrado')),
  add column if not exists aporte_mensual_clp integer
    constraint inv_perfiles_aporte_mensual_check check (aporte_mensual_clp is null or aporte_mensual_clp >= 0),
  add column if not exists rango_edad text
    constraint inv_perfiles_rango_edad_check check (rango_edad is null or rango_edad in ('hasta_39', '40_49', '50_54', '55_mas')),
  add column if not exists tipo_renta text
    constraint inv_perfiles_tipo_renta_check check (tipo_renta is null or tipo_renta in ('contrato', 'boletas', 'ambas')),
  add column if not exists lupa boolean,
  add column if not exists plazo_anios integer
    constraint inv_perfiles_plazo_check check (plazo_anios is null or plazo_anios between 5 and 30),
  add column if not exists elegidos uuid[] not null default '{}'::uuid[];

-- 2 · El interruptor (apagada al aplicar)
insert into public.config (key, value, updated_at) values ('asesoria_modo', 'apagada', now())
on conflict (key) do nothing;

-- 3 · Dispositivos habilitados mientras está en «lista»
create table if not exists public.asesoria_acceso (
  dispositivo_hash text primary key,
  nota             text not null,
  creado_por       uuid references auth.users(id) on delete set null,
  creado_at        timestamptz not null default now()
);
alter table public.asesoria_acceso enable row level security;
revoke all on public.asesoria_acceso from anon, authenticated;

-- 4 · El tope del filtro por aporte
create table if not exists public.asesoria_consultas (
  id          bigserial primary key,
  sesion_hash text,
  ip_hash     text,
  aporte_clp  integer not null,
  con_cuenta  boolean not null default false,
  creada_at   timestamptz not null default now()
);
create index if not exists asesoria_consultas_sesion on public.asesoria_consultas (sesion_hash, creada_at);
create index if not exists asesoria_consultas_ip on public.asesoria_consultas (ip_hash, creada_at);
alter table public.asesoria_consultas enable row level security;
revoke all on public.asesoria_consultas from anon, authenticated;

-- 5 · Los candidatos
create or replace function public.asesoria_candidatos(p_comunas text[], p_desde timestamp, p_aporte integer, p_tope numeric default null)
returns table(aviso_id uuid, comuna text, lat numeric, lng numeric, dormitorios integer, precio_uf numeric, flujo integer,
              score integer, arriendo integer)
language plpgsql
stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_variable
begin
  return query
  select sp.id, sp.comuna, round(sp.lat::numeric, 6), round(sp.lng::numeric, 6),
         case when public.es_estudio(sp.dormitorios, sp.titulo) then 0 else sp.dormitorios end,
         ae.precio_uf, ae.flujo_20, ae.score_20, nullif(ae.arriendo->>'monto', '')::numeric::integer
  from scraped_properties sp
  join avisos_evaluados ae on ae.aviso_id = sp.id
  left join publicacion_avisos pa on pa.aviso_id = sp.id
  where sp.is_active = true
    and sp.type = 'venta'
    and sp.condicion is distinct from 'nuevo'
    and sp.lat is not null and sp.lng is not null
    and sp.scraped_at >= p_desde
    and (p_comunas is null or cardinality(p_comunas) = 0 or sp.comuna = any(p_comunas))
    and ae.arriendo is not null
    and ae.arriendo_sospechoso is not true
    and pa.estado is distinct from 'despublicado'
    and ae.veredicto_20 = 'COMPRAR'
    and ae.flujo_20 >= -greatest(p_aporte, 0)
    and (p_tope is null or ae.precio_uf <= p_tope);
end;
$$;
revoke execute on function public.asesoria_candidatos(text[], timestamp, integer, numeric) from public, anon, authenticated;
