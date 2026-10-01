-- La casa (02-oct-2026): el perfil de búsqueda de cada persona. Lo inferido sale de TODOS sus
-- informes (perfiles_inversion + analisis); acá vive solo lo que la persona edita a mano en «Tu perfil
-- de búsqueda» (lo editado manda sobre lo inferido, campo por campo) y dos marcas del correo semanal:
-- la baja y el regalo (una sola vez por persona). Solo escribe el servidor (service role); cada
-- persona lee el suyo.
create table if not exists public.perfil_busqueda (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dormitorios integer[] null,
  comunas text[] null,
  precio_max_uf numeric null check (precio_max_uf is null or precio_max_uf > 0),
  modalidad text null check (modalidad is null or modalidad in ('ltr', 'str')),
  pie_pct numeric null check (pie_pct is null or (pie_pct >= 0 and pie_pct <= 100)),
  plazo_anios integer null check (plazo_anios is null or (plazo_anios >= 5 and plazo_anios <= 40)),
  horizonte_compra text null check (horizonte_compra is null or horizonte_compra in ('ya', 'meses', 'mirando')),
  semanal_baja_at timestamptz null,
  regalo_otorgado_at timestamptz null,
  actualizado_at timestamptz not null default now()
);

alter table public.perfil_busqueda enable row level security;
drop policy if exists "perfil_busqueda_lee_el_suyo" on public.perfil_busqueda;
create policy "perfil_busqueda_lee_el_suyo" on public.perfil_busqueda for select using (auth.uid() = user_id);
revoke insert, update, delete on public.perfil_busqueda from anon, authenticated;
