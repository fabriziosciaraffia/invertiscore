-- RECUPERADA el 27-nov-2026: aplicada directo en la base (supabase_migrations.schema_migrations, versión 20261001132535, «lecturas_ficha_redirige»)
-- sin archivo en el repo. Lo de abajo es lo aplicado, idéntico byte a byte (md5 ad46e50f3c2b2b2fa7b5eb6e846d568b). No volver a aplicar.

alter table public.lecturas_ficha drop constraint if exists lecturas_ficha_motivo_check;
alter table public.lecturas_ficha add constraint lecturas_ficha_motivo_check check (motivo in ('redirige', 'publicado', 'despublicado', 'bloqueo', 'error', 'tiempo'));
