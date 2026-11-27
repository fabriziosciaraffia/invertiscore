-- RECUPERADA el 27-nov-2026: aplicada directo en la base (supabase_migrations.schema_migrations, versión 20261125212719, «aviso_lugar»)
-- sin archivo en el repo. Lo de abajo es lo aplicado, idéntico byte a byte (md5 4c77eff2d70e9656087b95696953169c). No volver a aplicar.

-- El lugar de cada aviso para la tarjeta del mapa: el barrio o sector y la avenida principal, de OpenStreetMap (extracto BBBike
-- del 22-nov-2026), una sola vez por aviso. El metro a menos de 1 km sale de src/lib/metro-stations.ts y no se guarda.
create table if not exists public.aviso_lugar (
  aviso_id      uuid primary key references public.scraped_properties(id) on delete cascade,
  barrio        text,
  avenida       text,
  fuente        text not null,
  calculado_at  timestamptz not null default now()
);
alter table public.aviso_lugar enable row level security;
revoke all on public.aviso_lugar from anon, authenticated;
