-- ─────────────────────────────────────────────────────────────────────────────
-- QUIÉN PUBLICA CADA AVISO (12-nov-2026, goal de Fabrizio): para saber a qué corredor llamar cuando alguien quiere invertir
-- en un depto. Se aplica a mano en el SQL Editor. Las reglas viven en src/lib/publicadores/publicador.ts.
--
--   · scraped_properties.publicador_tipo — corredor | dueno | inmobiliaria, de la URL del aviso. Es lo ÚNICO del publicador
--     que trae el listado de cada noche, y ya estaba a la vista en la URL: por eso puede vivir en una tabla que se lee con la
--     llave pública. Se siembra al final desde la URL de las filas que ya están.
--   · publicadores — una fila por cliente de la fuente (corredora, inmobiliaria o persona): nombre, clase (franquicia,
--     corredora, corredor independiente, inmobiliaria, dueño directo), sitio, teléfono y correo SI la fuente los publica de
--     forma abierta (hoy no: el perfil de la corredora no existe y el contacto está detrás de un formulario con captcha), y
--     cuántos avisos activos tiene y cuántos convienen. De un dueño directo no se guarda el nombre.
--   · avisos_publicador — qué publicador tiene cada aviso leído (o null si la ficha no lo trajo: queda leído igual).
--   · lecturas_relleno — la bitácora del relleno por Decodo: su tope de 200 fichas por hora se cuenta acá, aparte del tope de
--     30 por hora de las lecturas de las personas (lecturas_ficha).
-- USO INTERNO: las tres tablas nuevas con RLS sin políticas y sin grants a anon/authenticated (solo el service role).
--
-- relleno_publicadores_candidatos(p_limite) — los avisos por leer, en orden: primero los que tienen inscripción en Invierte
-- con Franco, después los que convienen (veredicto_20 = COMPRAR) de mayor a menor puntaje; sin los ya leídos, los
-- despublicados ni los que el relleno intentó en las últimas 24 horas. plpgsql con plan a medida (CLAUDE.md, 02-nov-2026).
-- MEDIDO el 12-nov-2026 contra la base, con avisos_publicador y lecturas_relleno vacías (el caso del primer día), el cuerpo
-- creado como función temporal en pg_temp, seis llamadas seguidas:
--   · consulta suelta, la inscripción cruzada por `s.id::text = i.aviso_id` ...... 102 ms · 26.069 páginas (seq scan doble)
--   · esta función, el cruce por uuid, p_limite 40 ..................... 71 a 84 ms (mediana 74) · 40 filas, 6 de inscripciones
--   · esta función, p_limite 8000 ...................................... 83 a 84 ms · 6.927 filas (todos los candidatos)
-- La salida es la misma de la consulta (40 filas, las 6 inscripciones primero); el cruce por uuid solo evita el seq scan.
--
-- recontar_publicadores() — sin parámetros (no aplica el plan a medida): los conteos de cada publicador sobre los avisos
-- leídos. «Activos» y «convienen» cuentan los avisos cuya ficha ya se leyó: crecen con el relleno.
--
-- Rollback:
--   drop function if exists public.relleno_publicadores_candidatos(integer);
--   drop function if exists public.recontar_publicadores();
--   drop table if exists public.lecturas_relleno;
--   drop table if exists public.avisos_publicador;
--   drop table if exists public.publicadores;
--   alter table public.scraped_properties drop column if exists publicador_tipo;
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.scraped_properties
  add column if not exists publicador_tipo text check (publicador_tipo in ('corredor', 'dueno', 'inmobiliaria'));

create table if not exists public.publicadores (
  id bigint primary key,                 -- el id del cliente en la fuente (`client.id` de la ficha)
  fuente text not null default 'toctoc',
  tipo text check (tipo in ('corredor', 'dueno', 'inmobiliaria')),
  id_tipo integer,                       -- `client.idType` de la fuente
  nombre text,
  logo text,
  clase text check (clase in ('franquicia', 'corredora', 'independiente', 'inmobiliaria', 'dueno')),
  sitio_web text,
  telefono text,
  correo text,
  avisos_activos integer not null default 0,
  avisos_convienen integer not null default 0,
  primera_vez_at timestamptz not null default now(),
  visto_at timestamptz not null default now(),
  recontado_at timestamptz
);

create table if not exists public.avisos_publicador (
  aviso_id uuid primary key references public.scraped_properties(id) on delete cascade,
  publicador_id bigint null references public.publicadores(id) on delete set null,
  tipo text check (tipo in ('corredor', 'dueno', 'inmobiliaria')),
  leido_at timestamptz not null default now()
);
create index if not exists avisos_publicador_publicador_idx on public.avisos_publicador (publicador_id);

create table if not exists public.lecturas_relleno (
  id bigserial primary key,
  aviso_id uuid not null,
  codigo integer,
  motivo text not null check (motivo in ('redirige', 'publicado', 'despublicado', 'bloqueo', 'error', 'tiempo')),
  destino text,
  leido_at timestamptz not null default now()
);
create index if not exists lecturas_relleno_leido_idx on public.lecturas_relleno (leido_at desc);
create index if not exists lecturas_relleno_aviso_idx on public.lecturas_relleno (aviso_id, leido_at desc);

alter table public.publicadores enable row level security;
alter table public.avisos_publicador enable row level security;
alter table public.lecturas_relleno enable row level security;
revoke all on public.publicadores from anon, authenticated;
revoke all on public.avisos_publicador from anon, authenticated;
revoke all on public.lecturas_relleno from anon, authenticated;

create or replace function public.relleno_publicadores_candidatos(p_limite integer)
returns table(aviso_id uuid, url text, comuna text, lat numeric, lng numeric, prioridad integer)
language plpgsql stable
set search_path = public, pg_temp
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  with insc as (
    select s.id, s.url, s.comuna, s.lat, s.lng, 0 as prio, 0 as orden
    from public.invierte_inscripciones i
    join public.scraped_properties s
      on s.id = (case when i.aviso_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then i.aviso_id::uuid end)
  ), conv as (
    select s.id, s.url, s.comuna, s.lat, s.lng, 1 as prio, -coalesce(e.score_20, 0) as orden
    from public.avisos_evaluados e
    join public.scraped_properties s on s.id = e.aviso_id
    where e.veredicto_20 = 'COMPRAR'
  ), todos as (select * from insc union all select * from conv)
  select t.id, t.url, t.comuna, t.lat, t.lng, t.prio
  from todos t
  where t.url is not null
    and not exists (select 1 from public.avisos_publicador ap where ap.aviso_id = t.id)
    and not exists (select 1 from public.publicacion_avisos p where p.aviso_id = t.id and p.estado = 'despublicado')
    and not exists (select 1 from public.lecturas_relleno lr where lr.aviso_id = t.id and lr.leido_at > now() - interval '24 hours')
  order by t.prio, t.orden
  limit p_limite;
end
$$;

create or replace function public.recontar_publicadores()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  with c as (
    select ap.publicador_id as id,
           count(*) filter (where s.is_active) as activos,
           count(*) filter (where s.is_active and e.veredicto_20 = 'COMPRAR') as convienen
    from public.avisos_publicador ap
    join public.scraped_properties s on s.id = ap.aviso_id
    left join public.avisos_evaluados e on e.aviso_id = ap.aviso_id
    where ap.publicador_id is not null
    group by ap.publicador_id
  ), todos as (
    select p.id, coalesce(c.activos, 0)::int as activos, coalesce(c.convienen, 0)::int as convienen
    from public.publicadores p left join c on c.id = p.id
  )
  update public.publicadores p
     set avisos_activos = t.activos, avisos_convienen = t.convienen, recontado_at = now()
    from todos t
   where p.id = t.id
     and (p.avisos_activos is distinct from t.activos or p.avisos_convienen is distinct from t.convienen or p.recontado_at is null);
end
$$;

revoke execute on function public.relleno_publicadores_candidatos(integer) from public, anon, authenticated;
revoke execute on function public.recontar_publicadores() from public, anon, authenticated;

-- LA SIEMBRA del tipo desde la URL de las filas que ya están (la misma regla que tipoDesdeUrl).
update public.scraped_properties
   set publicador_tipo = case
     when url ~ '/propiedades/[a-z]*nuevo/' then 'inmobiliaria'
     when url ~ '/propiedades/[a-z]*particular[a-z]*/' then 'dueno'
     when url ~ '/propiedades/[a-z]*corredor[a-z]*/' then 'corredor'
     when url ~ '/r_[0-9a-f]+/?$' then 'inmobiliaria'
     when url ~ '/o_[0-9a-f]+/?$' then 'dueno'
     when url ~ '/b_[0-9a-f]+/?$' then 'corredor'
   end
 where publicador_tipo is null and url is not null;
