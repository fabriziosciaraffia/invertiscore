-- 20261118_invierte_v2_etapa1.sql — Invierte con Franco, comprador · etapa 1 (solo tablas nuevas y un bucket)
-- USO INTERNO: RLS sin políticas y sin grants a anon/authenticated (solo el service role), como 20261112_publicadores.
-- Conservación: inv_ordenes e inv_bitacora sobreviven a la eliminación de la cuenta (user_id → null) y no se borran antes
-- de 6 años, salvo las de prueba (es_prueba, puesta por el servidor si la cuenta está en test_accounts al firmar), que
-- «Reiniciar prueba» del admin puede borrar para repetir el recorrido.

-- 1. La lista del interruptor (por correo: se puede agregar a alguien antes de que tenga cuenta).
create table public.invierte_v2_acceso (
  email        text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  nota         text,
  agregado_por text,
  agregado_at  timestamptz not null default now()
);

-- 2. La persona del flujo nuevo (paso de contacto). Se borra con la cuenta: son datos de contacto, no respaldo.
create table public.inv_personas (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  email               text,
  aviso_origen        text not null check (length(btrim(aviso_origen)) > 0),
  origen              text not null check (origen in ('explorar','informe','seleccion')),
  urgencia            text not null check (urgencia in ('este_mes','uno_a_tres','mas_adelante')),
  pie                 text not null check (pie in ('si','parte','no')),
  pie_uf              integer,
  whatsapp            text not null check (whatsapp ~ '^\+569[0-9]{8}$'),
  permiso_whatsapp_at timestamptz not null,           -- la casilla es obligatoria
  estado              text not null default 'contacto' check (estado in ('contacto','firmo')),
  campana             jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 3. La orden firmada. Una por cuenta y por versión del texto.
create table public.inv_ordenes (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete set null,
  email               text not null,
  nombre              text not null check (length(btrim(nombre)) between 3 and 120),
  rut                 text not null check (rut ~ '^[0-9]{7,8}-[0-9K]$'),
  aviso_id            text not null,
  depto_linea         text not null,
  texto_version       integer not null check (texto_version > 0),
  texto_sha256        text not null check (texto_sha256 ~ '^[0-9a-f]{64}$'),
  texto               text not null,
  acepto_casilla      boolean not null check (acepto_casilla),
  leyo_hasta_el_final boolean not null check (leyo_hasta_el_final),
  es_prueba           boolean not null default false,
  firmado_at          timestamptz not null default now(),
  ip                  text,
  user_agent          text,
  pdf_path            text,
  pdf_sha256          text check (pdf_sha256 is null or pdf_sha256 ~ '^[0-9a-f]{64}$'),
  pdf_generado_at     timestamptz,
  copia_enviada_at    timestamptz,
  conservar_hasta     timestamptz not null default (now() + interval '6 years')
);
create unique index inv_ordenes_una_por_cuenta_y_version
  on public.inv_ordenes (user_id, texto_version) where user_id is not null;

-- Lo firmado no se cambia. Solo se completan una vez el PDF y la copia, y user_id puede pasar a null
-- (eliminación de cuenta). Borrar: solo una orden de prueba, o una real ya vencida.
create or replace function public.inv_ordenes_inmutable() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    if not old.es_prueba and old.conservar_hasta > now() then
      raise exception 'inv_ordenes: la orden % se conserva hasta %', old.id, old.conservar_hasta;
    end if;
    return old;
  end if;
  if new.email is distinct from old.email or new.nombre is distinct from old.nombre or new.rut is distinct from old.rut
     or new.aviso_id is distinct from old.aviso_id or new.depto_linea is distinct from old.depto_linea
     or new.texto_version is distinct from old.texto_version or new.texto_sha256 is distinct from old.texto_sha256
     or new.texto is distinct from old.texto or new.acepto_casilla is distinct from old.acepto_casilla
     or new.leyo_hasta_el_final is distinct from old.leyo_hasta_el_final or new.es_prueba is distinct from old.es_prueba
     or new.firmado_at is distinct from old.firmado_at or new.ip is distinct from old.ip
     or new.user_agent is distinct from old.user_agent or new.conservar_hasta is distinct from old.conservar_hasta
     or (new.user_id is distinct from old.user_id and new.user_id is not null)
     or (old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path)
     or (old.pdf_sha256 is not null and new.pdf_sha256 is distinct from old.pdf_sha256) then
    raise exception 'inv_ordenes: la orden firmada no se modifica';
  end if;
  return new;
end $$;
create trigger inv_ordenes_inmutable before update or delete on public.inv_ordenes
  for each row execute function public.inv_ordenes_inmutable();
revoke execute on function public.inv_ordenes_inmutable() from public, anon, authenticated;

-- 4. La bitácora (quién hizo qué). También sobrevive a la cuenta y se protege igual.
create table public.inv_bitacora (
  id              bigint generated always as identity primary key,
  user_id         uuid references auth.users(id) on delete set null,
  email           text,
  orden_id        uuid references public.inv_ordenes(id) on delete restrict,
  actor           text not null check (actor in ('persona','admin','sistema')),
  actor_email     text,
  accion          text not null,
  detalle         jsonb,
  ip              text,
  user_agent      text,
  es_prueba       boolean not null default false,
  created_at      timestamptz not null default now(),
  conservar_hasta timestamptz not null default (now() + interval '6 years')
);
create index inv_bitacora_user on public.inv_bitacora (user_id, created_at desc);

create or replace function public.inv_bitacora_protegida() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    if not old.es_prueba and old.conservar_hasta > now() then
      raise exception 'inv_bitacora: el registro % se conserva hasta %', old.id, old.conservar_hasta;
    end if;
    return old;
  end if;
  -- Solo user_id → null (eliminación de cuenta); nada más cambia.
  if (new.user_id is distinct from old.user_id and new.user_id is not null)
     or new.email is distinct from old.email or new.orden_id is distinct from old.orden_id
     or new.actor is distinct from old.actor or new.actor_email is distinct from old.actor_email
     or new.accion is distinct from old.accion or new.detalle is distinct from old.detalle
     or new.ip is distinct from old.ip or new.user_agent is distinct from old.user_agent
     or new.es_prueba is distinct from old.es_prueba or new.created_at is distinct from old.created_at
     or new.conservar_hasta is distinct from old.conservar_hasta then
    raise exception 'inv_bitacora: el registro no se modifica';
  end if;
  return new;
end $$;
create trigger inv_bitacora_protegida before update or delete on public.inv_bitacora
  for each row execute function public.inv_bitacora_protegida();
revoke execute on function public.inv_bitacora_protegida() from public, anon, authenticated;

alter table public.invierte_v2_acceso enable row level security;
alter table public.inv_personas       enable row level security;
alter table public.inv_ordenes        enable row level security;
alter table public.inv_bitacora       enable row level security;
revoke all on public.invierte_v2_acceso, public.inv_personas, public.inv_ordenes, public.inv_bitacora from anon, authenticated;

-- 5. El bucket privado de las órdenes (solo PDF, 5 MB). Sin políticas: lo lee y escribe el servidor, que entrega URLs firmadas de 60 s.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invierte', 'invierte', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;
