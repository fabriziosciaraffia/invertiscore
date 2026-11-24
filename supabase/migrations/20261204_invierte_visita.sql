-- ─────────────────────────────────────────────────────────────────────────────
-- LA VISITA ANTES DE CERRAR EL PRECIO (24-nov-2026; LEEME «visita antes del precio» del 23-nov). APLICADA POR FABRIZIO el 24-nov-2026;
-- este archivo queda igual a lo aplicado (verificado contra pg_constraint, pg_trigger y el md5 del cuerpo de la función, que en la base
-- quedó sin comentarios internos: las tres reglas del trigger se explican acá arriba).
-- Solo agrega columnas, reglas, un trigger y tipos de tarea. Verificado antes de escribirlo (24-nov, lectura): 0 filas en inv_visitas,
-- 0 ofertas en firme, 0 aceptadas; en inv_ofertas el único trigger es inv_ofertas_firma.
--
-- · La visita: desde dónde se pidió, cuándo se hizo y el reporte en campos (lo que la regla necesita para recalcular): el estado visto
--   (coincide con las fotos, arreglos menores, remodelación), los arreglos concretos y la línea que ve la persona. Quién va queda
--   abierto: `modo` null = por decidir.
-- · La contraoferta que se mantiene mientras se visita: Franco lo pide (tarea), quien vende responde; si acepta, la fecha nueva
--   reemplaza al vencimiento (`contraoferta_vence`) y la de antes queda en `contraoferta_vence_original`.
-- · Bajar de la oferta anterior, o que Franco sugiera menos que ella: solo con una visita de ese depto con el reporte publicado que
--   nombra un arreglo concreto (lo fija el trigger, no solo el código).
-- · En firme: solo desde aceptada, con la confirmación explícita de la persona; «tras la visita» exige el reporte publicado.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1 · LA VISITA ──────────────────────────────────────────────────────────
alter table public.inv_visitas alter column modo drop default;
alter table public.inv_visitas alter column modo drop not null;
alter table public.inv_visitas
  add column if not exists pedida_desde     text,
  add column if not exists visitada_at      timestamptz,
  add column if not exists reporte_estado   text,
  add column if not exists reporte_arreglos text[] not null default '{}',
  add column if not exists reporte_linea    text,
  add column if not exists sugerida_antes_uf   numeric(12,2),
  add column if not exists sugerida_despues_uf numeric(12,2),
  add column if not exists cancelada_motivo text;

alter table public.inv_visitas drop constraint if exists inv_visitas_pedida_desde;
alter table public.inv_visitas add constraint inv_visitas_pedida_desde check (pedida_desde is null or pedida_desde in ('antes_de_ofertar', 'contraoferta', 'aceptada'));
alter table public.inv_visitas drop constraint if exists inv_visitas_visitada;
alter table public.inv_visitas add constraint inv_visitas_visitada check (estado not in ('visitada', 'reporte_publicado') or visitada_at is not null);
alter table public.inv_visitas drop constraint if exists inv_visitas_reporte_estado;
alter table public.inv_visitas add constraint inv_visitas_reporte_estado check (reporte_estado is null or reporte_estado in ('coincide', 'arreglos_menores', 'remodelacion'));
-- Publicado = con estado y línea; «coincide» va sin arreglos, y los otros dos con al menos uno.
alter table public.inv_visitas drop constraint if exists inv_visitas_reporte_campos;
alter table public.inv_visitas add constraint inv_visitas_reporte_campos check (estado <> 'reporte_publicado' or (reporte_estado is not null and length(btrim(coalesce(reporte_linea, ''))) > 0));
alter table public.inv_visitas drop constraint if exists inv_visitas_reporte_arreglos;
alter table public.inv_visitas add constraint inv_visitas_reporte_arreglos check (reporte_estado is null or ((reporte_estado = 'coincide') = (cardinality(reporte_arreglos) = 0)));
alter table public.inv_visitas drop constraint if exists inv_visitas_cancelada;
alter table public.inv_visitas add constraint inv_visitas_cancelada check (
  (estado = 'cancelada') = (cancelada_motivo is not null)
  and (cancelada_motivo is null or cancelada_motivo in ('persona', 'oferta_cerrada', 'quien_vende', 'depto_salio')));

-- ── 2 · LA OFERTA: MANTENER LA CONTRAOFERTA, LA RONDA CON RESPALDO Y EN FIRME ──
alter table public.inv_ofertas
  add column if not exists contraoferta_vence_original timestamptz,
  add column if not exists mantener_pedido_at          timestamptz,
  add column if not exists mantener_respuesta          text,
  add column if not exists mantener_respuesta_at       timestamptz,
  add column if not exists mantener_respuesta_por      uuid references auth.users(id),
  add column if not exists visita_id                   uuid references public.inv_visitas(id),
  add column if not exists sugerida_visita_id          uuid references public.inv_visitas(id),
  add column if not exists en_firme_confirmo           boolean,
  add column if not exists en_firme_ip                 text,
  add column if not exists en_firme_user_agent         text;

alter table public.inv_ofertas drop constraint if exists inv_ofertas_mantener;
alter table public.inv_ofertas add constraint inv_ofertas_mantener check (
  (mantener_respuesta is null or (mantener_respuesta in ('acepta', 'no_acepta') and mantener_respuesta_por is not null and mantener_respuesta_at is not null and mantener_pedido_at is not null))
  and (mantener_respuesta is distinct from 'acepta' or contraoferta_vence_original is not null));
alter table public.inv_ofertas drop constraint if exists inv_ofertas_en_firme;
alter table public.inv_ofertas add constraint inv_ofertas_en_firme check (estado <> 'en_firme' or (en_firme_at is not null and en_firme_como is not null and en_firme_confirmo is true));
-- Lo que sugiere Franco: nunca sobre lo que piden; bajo la oferta de la persona solo con una visita de respaldo (el trigger verifica el arreglo).
alter table public.inv_ofertas drop constraint if exists inv_ofertas_sugerida_tramo;
alter table public.inv_ofertas add constraint inv_ofertas_sugerida_tramo check (
  sugerida_uf is null or (contraoferta_uf is not null and sugerida_uf <= contraoferta_uf and (sugerida_uf >= monto_uf or sugerida_visita_id is not null)));

-- ── 3 · LA VISITA QUE RESPALDA (trigger) ─────────────────────────────────────
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
  if new.estado = 'en_firme' and (tg_op = 'INSERT' or old.estado is distinct from 'en_firme') then
    if tg_op = 'INSERT' or old.estado <> 'aceptada_sujeta' then
      raise exception 'en firme solo desde aceptada' using errcode = 'check_violation';
    end if;
    if new.en_firme_como = 'tras_visita' and not exists (
      select 1 from public.inv_visitas v where v.depto_id = new.depto_id and v.user_id = new.user_id and v.estado = 'reporte_publicado') then
      raise exception 'en firme tras la visita exige el reporte publicado' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.inv_ofertas_visita_respaldo() from public, anon, authenticated;
drop trigger if exists inv_ofertas_visita_respaldo on public.inv_ofertas;
create trigger inv_ofertas_visita_respaldo before insert or update on public.inv_ofertas
  for each row execute function public.inv_ofertas_visita_respaldo();

-- ── 4 · TAREAS NUEVAS: pedir que mantengan la contraoferta y comunicar la confirmación en firme ──
alter table public.inv_tareas drop constraint inv_tareas_tipo_check;
alter table public.inv_tareas add constraint inv_tareas_tipo_check check (tipo = any (array[
  'revisar_preaprobacion', 'contactar_listo', 'explicar_preaprobacion', 'gestionar_corredor', 'avisar_alcance', 'cambio_publicacion',
  'cambio_publicador', 'confirmar_depto', 'confirmar_depto_atrasado', 'confirmar_ubicacion', 'responder_preguntas', 'cargar_recomendacion',
  'presentar_oferta', 'registrar_respuesta', 'hablar_oferta', 'hablar_con_franco', 'agendar_visita', 'hacer_visita', 'publicar_reporte',
  'fijar_hito', 'enviar_whatsapp',
  'insistir_oferta', 'avisar_retiro', 'precio_bajo_oferta', 'comunicar_aceptacion',
  'pedir_mantener_contraoferta', 'comunicar_en_firme'
]::text[]));
