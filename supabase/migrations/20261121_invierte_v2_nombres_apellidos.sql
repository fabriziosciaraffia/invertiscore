-- ─────────────────────────────────────────────────────────────────────────────
-- INVIERTE CON FRANCO · NOMBRES Y APELLIDOS EN LA ORDEN (20-nov-2026, decisión de Fabrizio). PARA QUE LO APLIQUE CLAUDE A PEDIDO
-- DE FABRIZIO; no lo aplica el agente.
--
-- El formulario de la firma pide «Nombres» y «Apellidos» por separado (con el autocompletado given-name / family-name). Lo que
-- cambia en la base:
--   · inv_ordenes gana `nombres` y `apellidos`. La columna `nombre` se sigue llenando, con «Nombres Apellidos»: el texto de la
--     orden (que no cambia), el PDF y el registro de la firma la siguen leyendo igual.
--   · Las órdenes ya firmadas quedan como están: las dos columnas nuevas en NULL y su `nombre` intacto (el saludo sale de ahí,
--     como hoy). No se rellenan: partir un nombre completo en nombres y apellidos es adivinar.
--   · La regla: o las dos van NULL (las de antes), o las dos llenas (1 a 80 caracteres, sin espacios en los bordes) y entonces
--     `nombre` = nombres || ' ' || apellidos.
--   · La protección de la orden firmada (inv_ordenes_inmutable) incluye las dos columnas nuevas: una vez firmada, no se cambian.
--     El resto de la función queda IGUAL a la vigente (20261119_invierte_v2_etapa2, verificada contra pg_get_functiondef el
--     20-nov-2026).
-- No toca filas (agrega columnas nulas y una regla que las filas de hoy cumplen: las dos NULL).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.inv_ordenes
  add column if not exists nombres   text,
  add column if not exists apellidos text;

alter table public.inv_ordenes
  add constraint inv_ordenes_nombres_apellidos check (
    (nombres is null and apellidos is null)
    or (
      nombres is not null and apellidos is not null
      and nombres = btrim(nombres) and apellidos = btrim(apellidos)
      and length(nombres) between 1 and 80 and length(apellidos) between 1 and 80
      and nombre = nombres || ' ' || apellidos
    )
  );

create or replace function public.inv_ordenes_inmutable() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    if not old.es_prueba and old.conservar_hasta > now() then
      raise exception 'inv_ordenes: la orden % se conserva hasta %', old.id, old.conservar_hasta;
    end if;
    return old;
  end if;
  if new.email is distinct from old.email or new.nombre is distinct from old.nombre or new.rut is distinct from old.rut
     or new.nombres is distinct from old.nombres or new.apellidos is distinct from old.apellidos
     or new.aviso_id is distinct from old.aviso_id or new.depto_linea is distinct from old.depto_linea
     or new.texto_version is distinct from old.texto_version or new.texto_sha256 is distinct from old.texto_sha256
     or new.texto is distinct from old.texto or new.acepto_casilla is distinct from old.acepto_casilla
     or new.leyo_hasta_el_final is distinct from old.leyo_hasta_el_final or new.es_prueba is distinct from old.es_prueba
     or new.firmado_at is distinct from old.firmado_at or new.ip is distinct from old.ip
     or new.user_agent is distinct from old.user_agent
     or new.conservar_hasta is null or new.conservar_hasta < old.conservar_hasta
     or (new.user_id is distinct from old.user_id and new.user_id is not null)
     or (old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path)
     or (old.pdf_sha256 is not null and new.pdf_sha256 is distinct from old.pdf_sha256) then
    raise exception 'inv_ordenes: la orden firmada no se modifica (conservar_hasta solo se alarga)';
  end if;
  return new;
end $$;
revoke execute on function public.inv_ordenes_inmutable() from public, anon, authenticated;
