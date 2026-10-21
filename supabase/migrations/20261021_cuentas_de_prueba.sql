-- Las cuentas de prueba para los eventos del servidor (21-oct-2026, src/lib/posthog-captura.ts). Todo evento que
-- refranco manda a PostHog desde el servidor lleva la marca de cuenta de prueba desde el primer evento, con la misma
-- regla que `es_test_account`: la cuenta está en `test_accounts`. La función devuelve el id de cada cuenta y el id de
-- PostHog de su correo (`correo:` + 24 hex del sha256 del correo en minúsculas, el mismo de `distinctIdDeCorreo`), sin
-- el correo en claro. Solo la lee el service role.
create or replace function public.cuentas_de_prueba()
returns table (user_id uuid, id_correo text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.user_id,
         case when u.email is null then null
              else 'correo:' || substr(encode(sha256(convert_to(lower(trim(u.email)), 'UTF8')), 'hex'), 1, 24)
         end
  from public.test_accounts t
  left join auth.users u on u.id = t.user_id
$$;

revoke all on function public.cuentas_de_prueba() from public, anon, authenticated;
grant execute on function public.cuentas_de_prueba() to service_role;
