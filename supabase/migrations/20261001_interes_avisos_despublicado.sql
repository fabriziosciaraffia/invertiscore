-- «Quiero verlo» automático (01-oct-2026): cuándo el chequeo de la ficha encontró el aviso despublicado
-- y por eso no salió el correo. Aplicada el 01-oct-2026 por MCP (`interes_avisos_despublicado`).
alter table public.interes_avisos add column if not exists aviso_despublicado_at timestamptz null;
