-- ─────────────────────────────────────────────────────────────────────────────
-- INVIERTE CON FRANCO · «LO QUE VE FRANCO», UNA LECTURA POR DEPTO (entrega 4 de las láminas del 19-nov-2026; textos aprobados por
-- Fabrizio el 19-nov-2026). PARA QUE LO APLIQUE CLAUDE A PEDIDO DE FABRIZIO; no lo aplica el agente.
--
-- Una fila por depto (aviso_id): la lectura de sus fotos y del texto de la publicación que escribe el modelo (Opus 5.5), de la que
-- salen la versión corta (el resultado) y la larga (los detalles), y la alerta «Lo que el puntaje no considera».
--   · estado: 'generando' mientras se escribe (una marca para no pedirla dos veces; vence a los 3 minutos), 'lista' o 'error'.
--   · version: la de la instrucción (src/lib/invierte-v2/lectura-franco.ts › VERSION_LECTURA); una de otra versión se rehace.
--   · lectura: { alerta: { nivel, motivo }, larga: [{ etiqueta, texto }], corta: [texto] }, ya saneada.
--   · alerta_nivel: 'ninguna' | 'revisar' | 'grave' (con 'grave' el depto no se recomienda como alternativa), aparte para filtrar.
--   · detalle_leido_at: la lectura de la publicación (publicacion_detalle.leido_at) con que se escribió; si la publicación se relee
--     después, se rehace.
--   · modelo, costo_usd, ms, error, generado_at: para el panel y para el tope por hora (60 lecturas nuevas entre todas las personas).
-- Uso interno, como publicacion_detalle: RLS sin políticas y sin grants; solo el servidor la lee y la escribe. No toca filas.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.lecturas_franco (
  aviso_id         uuid primary key,
  estado           text not null check (estado in ('generando', 'lista', 'error')),
  version          integer not null,
  lectura          jsonb null,
  alerta_nivel     text null check (alerta_nivel is null or alerta_nivel in ('ninguna', 'revisar', 'grave')),
  detalle_leido_at timestamptz null,
  modelo           text null,
  costo_usd        numeric null,
  ms               integer null,
  error            text null,
  generado_at      timestamptz null,
  updated_at       timestamptz not null default now()
);
create index if not exists lecturas_franco_generado on public.lecturas_franco (generado_at);

alter table public.lecturas_franco enable row level security;
revoke all on public.lecturas_franco from anon, authenticated;
