-- RECUPERADA el 27-nov-2026: aplicada directo en la base (supabase_migrations.schema_migrations, versión 20261001130611, «lecturas_ficha_tipo»)
-- sin archivo en el repo. Lo de abajo es lo aplicado, idéntico byte a byte (md5 1727fc0759d6726fe3cd67198871254c). No volver a aplicar.

alter table public.lecturas_ficha drop constraint if exists lecturas_ficha_tipo_check;
alter table public.lecturas_ficha add constraint lecturas_ficha_tipo_check check (tipo in ('guia', 'clic'));
