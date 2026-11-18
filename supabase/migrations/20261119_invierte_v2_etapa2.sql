-- 20261119_invierte_v2_etapa2.sql — Invierte con Franco, comprador · etapa 2. APLICADA por Fabrizio el 18-nov-2026 (historial:
-- invierte_v2_etapa2). Este archivo es idéntico a lo aplicado (verificado contra el catálogo: columnas, CHECKs, índices,
-- triggers y bucket).
-- Del perfil a la preaprobación. Tablas nuevas, más tres cambios acotados:
--   (a) el modo de cobro `invierte` en el CHECK de analisis.charge_mode (aprobado por Fabrizio; la única tabla existente);
--   (b) conservar_hasta de inv_ordenes e inv_bitacora puede alargarse, nunca acortarse (anotado en la etapa 1);
--   (c) el bucket `invierte` acepta fotos además de PDF, hasta 15 MB.

-- ── (a) EL MODO DE COBRO `invierte` ─────────────────────────────────────────
-- Verificado en la base el 18-nov-2026 (pg_get_constraintdef): hoy son welcome, paid, subscription, admin, anon_cap.
alter table public.analisis drop constraint analisis_charge_mode_check;
alter table public.analisis add constraint analisis_charge_mode_check
  check (charge_mode is null or charge_mode in ('welcome','paid','subscription','admin','anon_cap','invierte'));

-- ── 1. EL PERFIL DE INVERSIÓN ───────────────────────────────────────────────
-- Uno por persona. Las comunas y el tope se escriben TAMBIÉN en perfil_busqueda (el perfil de la selección semanal) al confirmar:
-- acá solo vive lo que perfil_busqueda no tiene (objetivo, preocupaciones, el financiamiento y el cálculo de hasta cuánto).
-- Se borra con la cuenta (cascade).
create table public.inv_perfiles (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  objetivo              text not null check (objetivo in ('arriendo','plusvalia','ambas')),
  preocupaciones        text[] not null default '{}',          -- 'no_arriende' | 'poner_plata' | 'elegir_mal' | 'tramite'
  comunas               text[] not null,                        -- lo confirmado en el paso 1 (copia en perfil_busqueda.comunas)
  preaprobado           text not null check (preaprobado in ('tengo','tramite','no')),
  monto_preaprobado_uf  numeric(10,2) check (monto_preaprobado_uf is null or monto_preaprobado_uf > 0),
  pie_tiene             text check (pie_tiene in ('si','parte','no')),   -- solo con preaprobación
  pie_uf                numeric(10,2) check (pie_uf is null or pie_uf >= 0),
  renta_liquida_clp     integer check (renta_liquida_clp is null or renta_liquida_clp > 0),
  otras_cuotas_clp      integer check (otras_cuotas_clp is null or otras_cuotas_clp >= 0),
  no_dice_renta         boolean not null default false,
  tope_uf               numeric(10,2),                          -- hasta cuánto puede comprar (función pura hastaCuanto)
  tope_fuente           text check (tope_fuente in ('renta','solo_pie','preaprobacion','aprobada')),
  tope_supuestos        jsonb,                                  -- tasa, plazo, % dividendo, % carga, UF del día, versión de la regla;
                                                                -- y el precio máximo anterior de perfil_busqueda, para poder volver
                                                                -- (el tope lo reemplaza al confirmar, salvo la estimación sin renta)
  avisar_cuando_alcance boolean not null default false,         -- «Avísenme cuando algo me alcance»: se anota y crea una tarea
  es_prueba             boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── 2. LOS DEPTOS DE LA PERSONA ─────────────────────────────────────────────
-- Las opciones que Franco le mostró y las que eligió. Estado de trabajo: se borra con la cuenta.
-- El REGISTRO de qué deptos le presentó Franco se conserva seis años con la orden en inv_bitacora (accion 'depto_presentado',
-- con orden_id), que ya sobrevive a la cuenta y está protegida; no hace falta otra tabla con retención.
create table public.inv_deptos (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  aviso_id           text not null,
  estado             text not null default 'opcion' check (estado in ('opcion','elegido','descartado')),
  origen             text not null check (origen in ('entrada','franco','mapa')),
  etiqueta           text,                                      -- 'el_que_elegiste' | 'menos_al_mes' | 'mejor_precio' | 'pie_mas_bajo' | ...
  alcanza            boolean not null default true,
  fuera_de_alcance_at timestamptz,                              -- dejó de alcanzarle al cambiar el perfil: se marca, no se borra
  datos              jsonb,                                     -- foto de lo que se le mostró (precio, veredicto, score, flujo, pie)
  elegido_at         timestamptz,
  es_prueba          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, aviso_id)
);
create index inv_deptos_user on public.inv_deptos (user_id, estado);

-- ── 3. LOS DOCUMENTOS FINANCIEROS ───────────────────────────────────────────
-- Hoy solo la preaprobación (o «Compro sin crédito»). Uno vigente por persona; los anteriores quedan como historial hasta que
-- la persona cierre su cuenta (cascade). El ARCHIVO en el bucket no se borra solo: lo borra el paso de eliminación de cuenta y
-- un barrido de huérfanos (ver FASE 0, riesgos).
create table public.inv_documentos (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  tipo               text not null default 'preaprobacion' check (tipo in ('preaprobacion','sin_credito')),
  estado             text not null check (estado in ('subiendo','en_revision','aprobada','por_corregir','sin_credito')),
  path               text,                                      -- preaprobaciones/<user>/<id>.<ext>
  mime               text,
  bytes              integer,
  sha256             text,
  motivo             text,                                      -- por corregir: el motivo que ve la persona
  ia                 jsonb,                                     -- {banco, monto_uf, vigente_hasta, nombre_coincide, certeza:{...}}
  ia_modelo          text,
  ia_costo_usd       numeric(8,5),
  ia_at              timestamptz,
  banco              text,                                      -- lo que confirma la persona de Franco al aprobar
  monto_aprobado_uf  numeric(10,2),
  vigente_hasta      date,
  revisado_por       text,
  revisado_at        timestamptz,
  es_prueba          boolean not null default false,
  created_at         timestamptz not null default now()
);
create index inv_documentos_user on public.inv_documentos (user_id, created_at desc);

-- ── 4. LAS TAREAS INTERNAS ──────────────────────────────────────────────────
-- Lo que una persona de Franco tiene que hacer a mano hasta la etapa 3.
create table public.inv_tareas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in ('revisar_preaprobacion','contactar_listo','explicar_preaprobacion','gestionar_corredor','avisar_alcance')),
  aviso_id    text,
  estado      text not null default 'pendiente' check (estado in ('pendiente','hecha')),
  detalle     jsonb,
  hecha_por   text,
  hecha_at    timestamptz,
  es_prueba   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index inv_tareas_pendientes on public.inv_tareas (estado, created_at) where estado = 'pendiente';
-- Una sola tarea pendiente por persona, tipo y depto (los reintentos no duplican).
create unique index inv_tareas_una_pendiente on public.inv_tareas (user_id, tipo, coalesce(aviso_id, '')) where estado = 'pendiente';

alter table public.inv_perfiles   enable row level security;
alter table public.inv_deptos     enable row level security;
alter table public.inv_documentos enable row level security;
alter table public.inv_tareas     enable row level security;
revoke all on public.inv_perfiles, public.inv_deptos, public.inv_documentos, public.inv_tareas from anon, authenticated;

-- ── (b) conservar_hasta: se alarga, nunca se acorta ─────────────────────────
-- Igual que en la etapa 1, salvo una condición: antes `new.conservar_hasta is distinct from old.conservar_hasta` rechazaba
-- todo cambio; ahora rechaza solo el que lo ACORTA (o lo deja en null).
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
     or new.user_agent is distinct from old.user_agent
     or new.conservar_hasta is null or new.conservar_hasta < old.conservar_hasta
     or (new.user_id is distinct from old.user_id and new.user_id is not null)
     or (old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path)
     or (old.pdf_sha256 is not null and new.pdf_sha256 is distinct from old.pdf_sha256) then
    raise exception 'inv_ordenes: la orden firmada no se modifica (conservar_hasta solo se alarga)';
  end if;
  return new;
end $$;

create or replace function public.inv_bitacora_protegida() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    if not old.es_prueba and old.conservar_hasta > now() then
      raise exception 'inv_bitacora: el registro % se conserva hasta %', old.id, old.conservar_hasta;
    end if;
    return old;
  end if;
  if (new.user_id is distinct from old.user_id and new.user_id is not null)
     or new.email is distinct from old.email or new.orden_id is distinct from old.orden_id
     or new.actor is distinct from old.actor or new.actor_email is distinct from old.actor_email
     or new.accion is distinct from old.accion or new.detalle is distinct from old.detalle
     or new.ip is distinct from old.ip or new.user_agent is distinct from old.user_agent
     or new.es_prueba is distinct from old.es_prueba or new.created_at is distinct from old.created_at
     or new.conservar_hasta is null or new.conservar_hasta < old.conservar_hasta then
    raise exception 'inv_bitacora: el registro no se modifica (conservar_hasta solo se alarga)';
  end if;
  return new;
end $$;

-- ── (c) EL BUCKET ACEPTA FOTOS ──────────────────────────────────────────────
-- Una foto de celular pesa 2-6 MB (HEIC/JPEG) y un PDF escaneado hasta ~8 MB: 15 MB deja margen sin abrir la puerta a videos.
-- Sigue privado y sin políticas: la persona sube con una URL firmada de un solo uso que entrega el servidor (createSignedUploadUrl).
update storage.buckets
   set file_size_limit = 15728640,
       allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif']
 where id = 'invierte';

-- ── PRUEBA (en una transacción con ROLLBACK) ────────────────────────────────
-- begin;
--   -- (b) alargar pasa, acortar falla: update inv_ordenes set conservar_hasta = conservar_hasta + interval '1 year' where id = <una de prueba>;
--   -- update inv_ordenes set conservar_hasta = conservar_hasta - interval '1 day' where id = <una de prueba>;  -- debe fallar
--   -- (a) insert into analisis (..., charge_mode) values (..., 'invierte');  -- debe pasar
-- rollback;
