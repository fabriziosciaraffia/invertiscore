-- ─────────────────────────────────────────────────────────────────────────────
-- INVIERTE CON FRANCO · LAS FOTOS, EL TEXTO Y LA DIRECCIÓN DE CADA PUBLICACIÓN (19-nov-2026, decisión de Fabrizio). PARA QUE LO
-- APLIQUE CLAUDE A PEDIDO DE FABRIZIO; no lo aplica el agente.
--
-- Al leer la publicación de un depto (la misma lectura de siempre: `leerFicha`, por cualquiera de sus puertas —la guía, el relleno
-- por Decodo o el carril de Invierte—), del mismo 200 y sin un GET extra se guardan:
--   · fotos: las direcciones de las fotos de la publicación, en su orden, como mucho 40. Son las que muestran el resultado y los
--     detalles de Invierte con Franco (solo a quien firmó la orden) y las que lee «Lo que ve Franco».
--   · descripcion: el texto del publicador, tal cual. Lo lee «Lo que ve Franco» (marcado «según la publicación»); no se muestra
--     entero en ninguna pantalla.
--   · direccion: la calle y el número que dice la publicación.
--   · puerta: por cuál de las tres lecturas se guardó la última vez.
-- Una lectura nueva reemplaza la fila entera (upsert): las fotos y el texto pueden cambiar. Un despublicado no borra la fila: deja
-- de mostrarse porque sale de `avisos_evaluados`.
--
-- Uso interno, igual que `publicacion_avisos`: RLS sin políticas y sin grants; solo el servidor (service role) la lee y la escribe.
-- No toca filas existentes.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.publicacion_detalle (
  aviso_id    uuid primary key,
  fotos       text[] not null default '{}' check (cardinality(fotos) <= 40),
  descripcion text null check (descripcion is null or length(descripcion) <= 8000),
  direccion   text null check (direccion is null or length(direccion) <= 300),
  puerta      text not null check (puerta in ('guia', 'relleno', 'invierte')),
  leido_at    timestamptz not null default now()
);

alter table public.publicacion_detalle enable row level security;
revoke all on public.publicacion_detalle from anon, authenticated;
