-- RECUPERADA el 27-nov-2026: aplicada directo en la base (supabase_migrations.schema_migrations, versión 20261125190800, «analisis_sin_truncate_publico»)
-- sin archivo en el repo. Lo de abajo es lo aplicado, idéntico byte a byte (md5 5d46593e9cc1cbbfe561aafed87b7e7f). No volver a aplicar.

-- TRUNCATE no pasa por RLS: ni anon ni authenticated lo necesitan sobre analisis (25-nov).
revoke truncate on table public.analisis from anon, authenticated;
