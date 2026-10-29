-- LA MARCA DE PRUEBA SE DECIDE AL EMITIR (29-oct-2026, goal de Fabrizio). El punto único que manda eventos a PostHog
-- (src/lib/posthog-captura.ts › marcaDePrueba) pregunta por los ids de cada evento —la cuenta, el id de PostHog de su
-- correo, la cuenta con sesión de una vista— en vez de guardar un minuto la lista entera de `test_accounts`: con la lista
-- guardada, una cuenta de prueba creada dentro de ese minuto emitía sus primeros eventos sin la marca.
--
-- Por cada id que conoce: si es de prueba —está en `test_accounts` o su correo es de Franco (fabriziosciaraffia+… o
-- @refranco.ai, la regla del trigger `marcar_cuenta_interna`)— y cuándo nació la cuenta: el código pregunta en cada evento
-- por una cuenta de menos de una hora. El id del correo es el de `distinctIdDeCorreo` (sha256 del correo en minúsculas, 24
-- caracteres), como en `cuentas_de_prueba`. Un id que no es de ninguna cuenta no vuelve.

create or replace function public.marca_de_prueba(p_ids text[])
returns table (id text, prueba boolean, creada_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with pedidos as (
    select distinct x as id from unnest(coalesce(p_ids, '{}'::text[])) as x where x is not null
  ),
  cuentas as (
    select u.id as uid, u.email, u.created_at,
      (exists (select 1 from public.test_accounts t where t.user_id = u.id)
        or coalesce(u.email, '') ilike 'fabriziosciaraffia+%@gmail.com'
        or coalesce(u.email, '') ilike '%@refranco.ai') as prueba
    from auth.users u
  )
  select p.id, c.prueba, c.created_at
  from pedidos p
  join cuentas c on c.uid::text = lower(p.id)
  union all
  select p.id, c.prueba, c.created_at
  from pedidos p
  join cuentas c on p.id like 'correo:%' and c.email is not null
    and 'correo:' || substr(encode(sha256(convert_to(lower(trim(c.email)), 'UTF8')), 'hex'), 1, 24) = p.id
$$;

revoke all on function public.marca_de_prueba(text[]) from public, anon, authenticated;
grant execute on function public.marca_de_prueba(text[]) to service_role;
