-- Las cuentas de prueba fuera de los envíos (13-oct-2026, decisión de Fabrizio): el correo semanal y el aviso
-- inmediato no le llegan a ninguna cuenta de `test_accounts`, salvo a las que se marquen con `recibe_correos`. El
-- lunes 12 salieron 20 semanales a cuentas de prueba. Para marcar una:
--   update public.test_accounts set recibe_correos = true where user_id = '<id>';
alter table public.test_accounts add column if not exists recibe_correos boolean not null default false;
comment on column public.test_accounts.recibe_correos is 'true: la cuenta de prueba recibe los correos semanales y el aviso inmediato (13-oct-2026). Por defecto, no.';
