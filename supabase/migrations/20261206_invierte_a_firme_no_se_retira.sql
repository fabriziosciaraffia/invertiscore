-- ─────────────────────────────────────────────────────────────────────────────
-- UNA OFERTA A FIRME VIGENTE NO SE RETIRA (24-nov-2026; decisión de Fabrizio, paquete «a firme»). APLICADA POR FABRIZIO el 24-nov-2026,
-- tal como se le pegó; este archivo queda igual a lo aplicado.
--
-- · Segunda red bajo el servidor (sePuedeRetirar en src/lib/invierte-v2/b4.ts, que ya lo rechaza): la base no deja pasar a «retirada» una
--   oferta a firme (sujeta_a_visita = false) firmada o presentada. La a firme en espera (en_cola) sí se retira; al presentarse, ya no.
--   Las sujetas a visita, como antes.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.inv_ofertas_a_firme_no_se_retira() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.estado = 'retirada' and old.estado in ('firmada', 'presentada') and old.sujeta_a_visita = false then
    raise exception 'inv_ofertas: una oferta a firme vigente no se retira (%)', old.id using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists inv_ofertas_a_firme_no_se_retira on public.inv_ofertas;
create trigger inv_ofertas_a_firme_no_se_retira
  before update of estado on public.inv_ofertas
  for each row execute function public.inv_ofertas_a_firme_no_se_retira();
