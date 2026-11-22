-- ─────────────────────────────────────────────────────────────────────────────
-- LA FECHA O ANTIGÜEDAD DE LA PUBLICACIÓN, DE LAS LECTURAS QUE YA HACE EL RELLENO (22-nov-2026, decisión de Fabrizio). PARA QUE LO
-- APLIQUE CLAUDE; no lo aplica el agente.
-- `parsearDetalleFicha` (src/lib/guia/detalle-ficha.ts) busca en cada ficha que se lee —relleno, guía y carril de Invierte; ningún
-- pedido extra— los campos con nombre de fecha o de días y el texto «publicado hace …». No se sabe todavía qué campo la trae: se guarda
-- lo encontrado tal cual, para revisar en unos días en cuántas vino el dato. Hasta que la columna exista, el código no la escribe
-- (la actualización va aparte y su error se ignora).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.publicacion_detalle add column if not exists publicado_info jsonb;
