-- ─────────────────────────────────────────────────────────────────────────────
-- INVIERTE CON FRANCO · ETAPA 3: EL FLUJO DE CADA DEPTO (SQL consolidado, 21-nov-2026, con los ajustes acordados con Fabrizio).
-- PARA QUE LO REVISE Y LO APLIQUE CLAUDE A PEDIDO DE FABRIZIO; no lo aplica el agente. Después se construye B1.
--
-- Qué trae:
--   1 · inv_deptos: la etapa del depto en el flujo (además de opcion/elegido/descartado, que no se toca), el acuerdo con quien vende,
--       el motivo de «no avanza» (sin acuerdo / dejó de convenir) y el de «no sigo».
--   2 · inv_ubicaciones: la dirección y las coordenadas que confirma el admin (punto en un mapa, sin geocodificar), quién y cuándo, y
--       el análisis rehecho con la ubicación real (con el precio y la versión del motor con que se calculó, y el precio al que un
--       Ajusta supuestos vuelve a Comprar). Por depto: la ven todas las personas que lo tengan. Nada se escribe en scraped_properties,
--       scraped_properties_precios ni avisos_evaluados.
--   3 · inv_ofertas: una fila por ronda, la firma con el mismo mecanismo de la orden de visita más el hash de la versión exacta del
--       documento (texto de PRUEBA marcado como borrador: lo valida un abogado), el rango congelado al ofertar (columnas sin decidir
--       de dónde salen: el rango puede cargarlo una persona de Franco desde el admin) y lo necesario para calibrar después.
--   4 · inv_visitas, inv_preguntas (por depto), inv_hitos (promesa y escritura solo como hitos).
--   5 · inv_documentos, inv_tareas e inv_cambios: tipos y estados nuevos (los valores de hoy siguen entrando; ver el reporte).
--   6 · Triggers: no_sigo no existe desde en_firme en adelante; listo exige la ubicación confirmada con el análisis rehecho en Comprar
--       (o en Ajusta supuestos con precio al que vuelve a Comprar); una oferta no se firma sin ubicación confirmada.
--   7 · config: los valores configurables (sin muy_lejos: la regla del doble quedó reemplazada por el aviso fuerte).
-- Todo con RLS y SIN políticas: solo el servidor (service role) lee y escribe, como inv_deptos. Ninguna transición que presente,
-- acepte, publique o marque algo la hace la IA: las columnas *_por exigen el id de una persona de Franco.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1 · EL DEPTO EN EL FLUJO ─────────────────────────────────────────────────
alter table public.inv_deptos
  add column if not exists etapa text,
  add column if not exists etapa_previa text,          -- para volver de la pausa
  add column if not exists etapa_at timestamptz,
  add column if not exists acuerdo text,
  add column if not exists acuerdo_at timestamptz,
  add column if not exists acuerdo_por uuid references auth.users(id),
  add column if not exists no_avanza_motivo text,
  add column if not exists alternativa_aviso_id text,  -- la más parecida que sí se puede gestionar, cuando no avanza
  add column if not exists no_sigo_motivo text,
  add column if not exists no_sigo_detalle text;

alter table public.inv_deptos
  add constraint inv_deptos_etapa_check check (etapa is null or etapa in
    ('confirmando','no_avanza','sin_preaprobacion','listo','en_pausa','en_firme','promesa','escritura','inscrito','no_sigo')),
  add constraint inv_deptos_etapa_previa_check check (etapa_previa is null or etapa_previa in
    ('confirmando','no_avanza','sin_preaprobacion','listo')),
  add constraint inv_deptos_acuerdo_check check (acuerdo is null or acuerdo in ('pendiente','con_acuerdo','sin_acuerdo')),
  add constraint inv_deptos_no_avanza_motivo_check check (no_avanza_motivo is null or no_avanza_motivo in ('sin_acuerdo','dejo_de_convenir')),
  add constraint inv_deptos_no_sigo_motivo_check check (no_sigo_motivo is null or no_sigo_motivo in
    ('precio','ubicacion','estado_depto','encontre_otro','ya_no_compro','financiamiento','otro')),
  add constraint inv_deptos_etapa_solo_elegidos check (etapa is null or estado in ('elegido','descartado'));

-- Un solo depto en firme (o más allá) por persona.
create unique index if not exists inv_deptos_uno_en_firme
  on public.inv_deptos(user_id) where etapa in ('en_firme','promesa','escritura','inscrito');

-- ── 2 · LA UBICACIÓN CONFIRMADA Y EL ANÁLISIS REHECHO (por depto) ────────────
create table if not exists public.inv_ubicaciones (
  aviso_id text primary key,
  direccion text not null,
  numero text,
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  pin_lat numeric(10,7),                   -- el pin de la publicación al confirmar
  pin_lng numeric(10,7),
  distancia_m integer,                     -- del pin a la ubicación confirmada
  cargada_por uuid not null references auth.users(id),
  cargada_at timestamptz not null default now(),
  analisis jsonb,                          -- veredicto, puntaje, al mes, arriendo, cap rate, radio, comparables
  analisis_veredicto text check (analisis_veredicto in ('COMPRAR','AJUSTA SUPUESTOS','BUSCAR OTRA')),
  analisis_precio_uf numeric(10,2),        -- el precio con que se calculó (si cambia el publicado, se rehace)
  precio_comprar_uf numeric(10,2),         -- Ajusta supuestos: el precio al que vuelve a Comprar (techo de la oferta)
  analisis_motor_version text,             -- si cambia la versión del motor, se rehace
  analisis_at timestamptz,                 -- si pasa una semana, se rehace
  analisis_error text,
  es_prueba boolean not null default false,
  constraint inv_ubicaciones_en_santiago check (lat between -34.2 and -33.0 and lng between -71.2 and -70.3),
  constraint inv_ubicaciones_precio_comprar check (precio_comprar_uf is null or analisis_veredicto = 'AJUSTA SUPUESTOS')
);
alter table public.inv_ubicaciones enable row level security;

-- ── 3 · OFERTAS (una fila por ronda; la contraoferta de la persona crea la siguiente y deja la anterior «reemplazada») ──
create table if not exists public.inv_ofertas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  depto_id uuid not null references public.inv_deptos(id) on delete cascade,
  aviso_id text not null,
  ronda integer not null default 1,
  anterior_id uuid references public.inv_ofertas(id),
  estado text not null default 'borrador' check (estado in
    ('borrador','firmada','en_cola','presentada','contraoferta','aceptada_sujeta','en_firme','reemplazada','sin_acuerdo','retirada')),
  -- La recomendación y el rango, congelados al ofertar. De dónde salen no está decidido (puede cargarlos una persona de Franco
  -- desde el admin): por eso van todos con nulo y `rango_fuente` libre.
  postura_recomendada text check (postura_recomendada in ('asegura','negocia_poco','negocia_argumentos')),
  postura text check (postura in ('asegura','negocia_poco','negocia_argumentos')),
  publicado_uf numeric(10,2) not null,     -- el precio publicado al ofertar
  piso_uf numeric(10,2),
  recomendado_uf numeric(10,2),
  techo_uf numeric(10,2),                  -- el publicado, o el precio al que un Ajusta supuestos vuelve a Comprar
  rango_fuente text,                       -- quién o qué lo armó (admin, regla y su versión)
  regla_version text,
  razones jsonb not null default '[]'::jsonb,
  senales jsonb not null default '{}'::jsonb,  -- CALIBRAR: parecidos, posición, mediana, dispersión, días publicado, bajas,
                                               -- estado para arrendar, antigüedad y su fuente, al momento de ofertar
  monto_uf numeric(10,2),
  aviso_nivel text not null default 'ninguno' check (aviso_nivel in ('ninguno','bajo_piso','bajo_piso_fuerte','sobre_recomendado')),
  insistio_at timestamptz,                 -- vio el aviso y siguió igual
  sujeta_a_visita boolean not null default true,  -- falso si visitó antes de ofertar
  vigencia_dias integer not null default 5,
  -- La firma: el mismo mecanismo de la orden de visita (inv_ordenes) más el hash de la versión exacta del documento.
  nombre text,
  rut text,
  texto_version text,                      -- 'borrador-AAAAMMDD': texto de PRUEBA, lo revisa un abogado
  texto text,
  texto_sha256 text,
  acepto_casilla boolean,
  leyo_hasta_el_final boolean,
  firmada_at timestamptz,
  ip text,
  user_agent text,
  pdf_path text,
  pdf_sha256 text,
  conservar_hasta timestamptz,
  -- Presentar y responder: siempre una persona de Franco.
  presentada_at timestamptz,
  presentada_por uuid references auth.users(id),
  vigente_hasta timestamptz,
  respuesta text check (respuesta in ('aceptada_sujeta','contraoferta','rechazada')),
  respuesta_at timestamptz,
  respuesta_por uuid references auth.users(id),
  dias_hasta_respuesta numeric(6,2) generated always as (extract(epoch from (respuesta_at - presentada_at)) / 86400.0) stored,
  contraoferta_uf numeric(10,2),
  contraoferta_nota text,
  sin_acuerdo_motivo text check (sin_acuerdo_motivo in ('rechazada','vencida','depto_salio')),
  en_firme_at timestamptz,
  en_firme_como text check (en_firme_como in ('tras_visita','sin_visitar')),
  precio_final_uf numeric(10,2),           -- CALIBRAR: el precio en firme
  es_prueba boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inv_ofertas_firmada check (estado = 'borrador' or (firmada_at is not null and texto_sha256 is not null and acepto_casilla is true)),
  constraint inv_ofertas_presentada_por_persona check (
    estado not in ('presentada','contraoferta','aceptada_sujeta','en_firme') or presentada_por is not null),
  constraint inv_ofertas_respuesta_por_persona check (respuesta is null or respuesta_por is not null),
  constraint inv_ofertas_contraoferta_monto check (estado <> 'contraoferta' or contraoferta_uf is not null),
  constraint inv_ofertas_ronda unique (depto_id, ronda)
);
-- Una sola oferta viva por persona entre todos sus deptos (la aceptada sujeta a visita también); las demás esperan en cola.
create unique index if not exists inv_ofertas_una_viva
  on public.inv_ofertas(user_id) where estado in ('presentada','contraoferta','aceptada_sujeta');
-- Una sola oferta abierta por depto.
create unique index if not exists inv_ofertas_una_abierta_por_depto
  on public.inv_ofertas(depto_id) where estado in ('borrador','firmada','en_cola','presentada','contraoferta','aceptada_sujeta');
create index if not exists inv_ofertas_vencen on public.inv_ofertas(vigente_hasta) where estado = 'presentada';
alter table public.inv_ofertas enable row level security;

-- ── 4 · VISITAS, PREGUNTAS E HITOS ───────────────────────────────────────────
create table if not exists public.inv_visitas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  depto_id uuid not null references public.inv_deptos(id) on delete cascade,
  oferta_id uuid references public.inv_ofertas(id),        -- null si la visita va antes de ofertar
  modo text not null default 'franco' check (modo in ('franco','persona_con_franco')),
  estado text not null default 'pedida' check (estado in ('pedida','agendada','visitada','reporte_publicado','cancelada')),
  horarios_ofrecidos jsonb not null default '[]'::jsonb,    -- los de quien vende, cargados por el admin
  ninguno_sirve_at timestamptz,
  agendada_para timestamptz,
  confirmada_por_persona_at timestamptz,
  reporte jsonb,                                            -- fotos (paths), checklist, «Franco recomienda»
  reporte_publicado_at timestamptz,
  reporte_publicado_por uuid references auth.users(id),
  respuesta text check (respuesta in ('confirmo','ajusto','retiro')),
  respuesta_at timestamptz,
  es_prueba boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inv_visitas_agendada check (estado not in ('agendada','visitada','reporte_publicado') or agendada_para is not null),
  constraint inv_visitas_reporte_por_persona check (estado <> 'reporte_publicado' or (reporte is not null and reporte_publicado_por is not null))
);
create unique index if not exists inv_visitas_una_abierta
  on public.inv_visitas(depto_id) where estado in ('pedida','agendada','visitada');
alter table public.inv_visitas enable row level security;

-- «Lo que Franco averiguó»: las preguntas «Ojo» de la lectura más las del admin, con la respuesta que consigue Franco. Por depto
-- (decisión de Fabrizio): user_id null = vale para todas las personas que lo tengan.
create table if not exists public.inv_preguntas (
  id uuid primary key default gen_random_uuid(),
  aviso_id text not null,
  user_id uuid references auth.users(id) on delete cascade,
  origen text not null check (origen in ('lectura','admin','persona')),
  pregunta text not null,
  orden integer not null default 0,
  enviada_at timestamptz,
  respuesta text,
  respuesta_fuente text check (respuesta_fuente in ('quien_vende','documento','visita','publicacion')),
  respondida_at timestamptz,
  respondida_por uuid references auth.users(id),
  visible boolean not null default true,
  es_prueba boolean not null default false,
  created_at timestamptz not null default now(),
  constraint inv_preguntas_respuesta_por_persona check (respuesta is null or respondida_por is not null)
);
create index if not exists inv_preguntas_aviso on public.inv_preguntas(aviso_id);
create unique index if not exists inv_preguntas_lectura_unica on public.inv_preguntas(aviso_id, md5(pregunta)) where origen = 'lectura';
alter table public.inv_preguntas enable row level security;

-- Hitos (solo hitos: ni promesa ni escritura se redactan ni se firman acá).
create table if not exists public.inv_hitos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  depto_id uuid not null references public.inv_deptos(id) on delete cascade,
  tipo text not null check (tipo in ('oferta_en_firme','promesa','escritura','inscripcion')),
  estado text not null default 'pendiente' check (estado in ('pendiente','fecha_propuesta','fecha_confirmada','hecho')),
  fecha timestamptz,
  lugar text,
  confirmada_por_persona_at timestamptz,
  marcado_por uuid references auth.users(id),
  nota text,
  es_prueba boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inv_hitos_unico unique (depto_id, tipo),
  constraint inv_hitos_fecha check (estado = 'pendiente' or fecha is not null),
  constraint inv_hitos_hecho_por_persona check (estado <> 'hecho' or marcado_por is not null)
);
alter table public.inv_hitos enable row level security;

-- ── 5 · DOCUMENTOS, TAREAS Y CAMBIOS: TIPOS NUEVOS (los de hoy siguen entrando) ──
alter table public.inv_documentos
  add column if not exists depto_id uuid references public.inv_deptos(id) on delete cascade,
  add column if not exists oferta_id uuid references public.inv_ofertas(id);
alter table public.inv_documentos drop constraint if exists inv_documentos_tipo_check;
alter table public.inv_documentos add constraint inv_documentos_tipo_check check (tipo in
  ('preaprobacion','sin_credito','oferta','reporte_visita','promesa','escritura','dominio_vigente','otro'));
alter table public.inv_documentos drop constraint if exists inv_documentos_estado_check;
alter table public.inv_documentos add constraint inv_documentos_estado_check check (estado in
  ('subiendo','en_revision','aprobada','por_corregir','sin_credito','disponible'));
create index if not exists inv_documentos_depto on public.inv_documentos(depto_id) where depto_id is not null;

alter table public.inv_tareas drop constraint if exists inv_tareas_tipo_check;
alter table public.inv_tareas add constraint inv_tareas_tipo_check check (tipo in (
  'revisar_preaprobacion','contactar_listo','explicar_preaprobacion','gestionar_corredor','avisar_alcance',
  'cambio_publicacion','cambio_publicador',
  'confirmar_depto','confirmar_depto_atrasado','confirmar_ubicacion','responder_preguntas','cargar_recomendacion',
  'presentar_oferta','registrar_respuesta','hablar_oferta','hablar_con_franco','agendar_visita','hacer_visita',
  'publicar_reporte','fijar_hito','enviar_whatsapp'));

alter table public.inv_cambios drop constraint if exists inv_cambios_tipo_check;
alter table public.inv_cambios add constraint inv_cambios_tipo_check check (tipo in
  ('precio_baja','precio_sube','despublicado','republicado','veredicto','al_mes','publicador','ubicacion'));

-- ── 6 · LAS TRANSICIONES QUE LA BASE IMPONE ADEMÁS DEL CÓDIGO ─────────────────
create or replace function public.inv_deptos_transicion() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.etapa is distinct from old.etapa then
    -- «No sigo» existe hasta antes de en_firme; desde ahí es «Hablarlo con Franco», una tarea.
    if new.etapa = 'no_sigo' and old.etapa in ('en_firme','promesa','escritura','inscrito') then
      raise exception 'no_sigo no se permite desde %', old.etapa using errcode = 'check_violation';
    end if;
    -- Listo exige la ubicación confirmada con el análisis rehecho en Comprar, o en Ajusta supuestos con un precio al que vuelve a Comprar.
    if new.etapa = 'listo' and not exists (
      select 1 from public.inv_ubicaciones u
      where u.aviso_id = new.aviso_id
        and (u.analisis_veredicto = 'COMPRAR' or (u.analisis_veredicto = 'AJUSTA SUPUESTOS' and u.precio_comprar_uf is not null))) then
      raise exception 'listo exige la ubicación confirmada y el análisis rehecho en Comprar' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists inv_deptos_transicion on public.inv_deptos;
create trigger inv_deptos_transicion before update of etapa on public.inv_deptos
  for each row execute function public.inv_deptos_transicion();

create or replace function public.inv_ofertas_firma() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.firmada_at is not null and (tg_op = 'INSERT' or old.firmada_at is null)
     and not exists (select 1 from public.inv_ubicaciones u where u.aviso_id = new.aviso_id) then
    raise exception 'sin dirección confirmada no se firma una oferta' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists inv_ofertas_firma on public.inv_ofertas;
create trigger inv_ofertas_firma before insert or update of firmada_at on public.inv_ofertas
  for each row execute function public.inv_ofertas_firma();

-- ── 7 · VALORES CONFIGURABLES ────────────────────────────────────────────────
insert into public.config(key, value, updated_at) values
  ('invierte_oferta_vigencia_dias', '5', now()),
  ('invierte_aviso_fuerte_pct', '5', now()),          -- piso − oferta > 5 % del publicado ⇒ aviso fuerte
  ('invierte_confirmar_dias_tarea', '3', now()),
  ('invierte_whatsapp_espera_dias', '2', now()),
  ('invierte_reanalisis_dias', '7', now())             -- el análisis rehecho se vuelve a hacer cada semana
on conflict (key) do nothing;
