-- ─────────────────────────────────────────────────────────────────────────────
-- DESPUÉS DE LA VISITA, TODA OFERTA ES EN FIRME (24-nov-2026; decisión de Fabrizio, agregado del LEEME y lámina 5.1b). APLICADA POR FABRIZIO el
-- 24-nov-2026; este archivo queda igual a lo aplicado (verificado contra pg_constraint y el md5 del cuerpo de la función). Verificado antes de escribirlo (24-nov, lectura): 0 ofertas con sujeta_a_visita = false y 0 en firme; 1 visita con
-- el reporte publicado y 1 ronda firmada después de ella (la prueba de Fabrizio en a67843d8), que queda como estaba: sujeta a visita.
--
-- · Una ronda que nace en firme (sujeta_a_visita = false) exige, desde que se firma, una visita de ese depto con el reporte publicado
--   (visita_id) y la segunda casilla, «Entiendo que si la aceptan no puedo retirarla» (en_firme_confirmo). Lo fija el check
--   inv_ofertas_en_firme_firmada y el trigger.
-- · Al aceptarla quien vende pasa directo a en firme: desde presentada (la respuesta de quien vende) o desde firmada (aceptar su precio,
--   cuando Franco marca la aceptación como comunicada). Las sujetas a visita siguen como hoy: en firme solo desde aceptada.
-- · El trigger queda igual al aplicado el 24-nov en sus tres reglas, con dos cambios: la regla nueva de la ronda en firme y el origen
--   de «en firme». Sin comentarios dentro del cuerpo de la función (la base los guarda sin ellos).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.inv_ofertas drop constraint if exists inv_ofertas_en_firme_firmada;
alter table public.inv_ofertas add constraint inv_ofertas_en_firme_firmada check (
  sujeta_a_visita or estado = 'borrador' or (visita_id is not null and en_firme_confirmo is true));

create or replace function public.inv_ofertas_visita_respaldo() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  v_anterior numeric;
begin
  if new.anterior_id is not null and new.monto_uf is not null and (tg_op = 'INSERT' or new.monto_uf is distinct from old.monto_uf or new.visita_id is distinct from old.visita_id) then
    select o.monto_uf into v_anterior from public.inv_ofertas o where o.id = new.anterior_id;
    if v_anterior is not null and new.monto_uf < v_anterior and not exists (
      select 1 from public.inv_visitas v
      where v.id = new.visita_id and v.depto_id = new.depto_id and v.user_id = new.user_id
        and v.estado = 'reporte_publicado' and cardinality(v.reporte_arreglos) > 0) then
      raise exception 'una oferta bajo la anterior exige una visita con un arreglo concreto' using errcode = 'check_violation';
    end if;
  end if;
  if new.sugerida_uf is not null and new.monto_uf is not null and new.sugerida_uf < new.monto_uf and not exists (
    select 1 from public.inv_visitas v
    where v.id = new.sugerida_visita_id and v.depto_id = new.depto_id and v.user_id = new.user_id
      and v.estado = 'reporte_publicado' and cardinality(v.reporte_arreglos) > 0) then
    raise exception 'sugerir menos que la oferta exige una visita con un arreglo concreto' using errcode = 'check_violation';
  end if;
  if new.sujeta_a_visita = false and new.estado <> 'borrador'
     and (tg_op = 'INSERT' or old.sujeta_a_visita is distinct from false or new.visita_id is distinct from old.visita_id)
     and not exists (
       select 1 from public.inv_visitas v
       where v.id = new.visita_id and v.depto_id = new.depto_id and v.user_id = new.user_id and v.estado = 'reporte_publicado') then
    raise exception 'una oferta en firme exige la visita de ese depto con el reporte publicado' using errcode = 'check_violation';
  end if;
  if new.estado = 'en_firme' and (tg_op = 'INSERT' or old.estado is distinct from 'en_firme') then
    if tg_op = 'INSERT' then
      raise exception 'en firme solo desde aceptada' using errcode = 'check_violation';
    end if;
    if not (old.estado = 'aceptada_sujeta' or (old.estado in ('presentada', 'firmada') and new.sujeta_a_visita = false)) then
      raise exception 'en firme solo desde aceptada, o desde presentada o firmada si la oferta nació en firme' using errcode = 'check_violation';
    end if;
    if new.en_firme_como = 'tras_visita' and not exists (
      select 1 from public.inv_visitas v where v.depto_id = new.depto_id and v.user_id = new.user_id and v.estado = 'reporte_publicado') then
      raise exception 'en firme tras la visita exige el reporte publicado' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.inv_ofertas_visita_respaldo() from public, anon, authenticated;
